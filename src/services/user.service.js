import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { ROLES } from '../constants/roles.js';
import { Activity } from '../models/Activity.js';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta, buildSort, skipFor } from '../utils/pagination.js';
import { combineFilters, searchClause } from '../utils/queryFilters.js';
import { withTransaction } from '../utils/transaction.js';
import { OPEN_DEAL_STAGES } from '../constants/dealStage.js';
import { writeAudit } from './audit.service.js';

const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'role'];
const ACTIVE_LEAD_STATUSES = ['New', 'Contacted', 'Qualified'];

async function resolveTeam({ teamId, teamName }, session) {
  if (teamId) {
    const team = await Team.findById(teamId).session(session);
    if (!team) {
      throw new ApiError(422, 'Team not found');
    }
    return team;
  }
  if (teamName) {
    const existing = await Team.findOne({ name: teamName }).session(session);
    if (existing) {
      return existing;
    }
    const [created] = await Team.create([{ name: teamName }], { session });
    return created;
  }
  return null;
}

async function assertAnotherActiveAdmin(userId, session) {
  const remaining = await User.countDocuments({
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: userId },
  }).session(session);
  if (remaining === 0) {
    throw new ApiError(409, 'Cannot remove the last active admin');
  }
}

function usersQuery(filter) {
  return User.find(filter).select('-password').populate('team', 'name');
}

export async function createUser(input, actor) {
  return withTransaction(async (session) => {
    const team = await resolveTeam(input, session);
    if (input.role === ROLES.ADMIN && team) {
      throw new ApiError(422, 'Admin users cannot belong to a team');
    }
    if (input.role !== ROLES.ADMIN && !team) {
      throw new ApiError(422, 'A team is required for this role');
    }

    const password = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    let user;
    try {
      const [created] = await User.create([{
        name: input.name,
        email: input.email,
        phone: input.phone,
        password,
        role: input.role,
        team: team?._id ?? null,
        isActive: input.isActive ?? true,
      }], { session });
      user = created;
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(409, 'Duplicate value for email');
      }
      throw error;
    }

    await writeAudit({
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: ENTITY_TYPES.USER,
      entityId: user._id,
      performedBy: actor._id,
      newValue: { name: user.name, email: user.email, role: user.role, team: user.team, isActive: user.isActive },
    }, session);

    return User.findById(user._id).populate('team', 'name').session(session);
  });
}

export async function listUsers(query) {
  const filter = combineFilters(
    query.role ? { role: query.role } : null,
    query.team ? { team: query.team } : null,
    query.isActive === undefined ? null : { isActive: query.isActive },
    searchClause(query.search, ['name', 'email']),
  );
  const sort = buildSort(query.sortBy, query.sortOrder, USER_SORT_FIELDS);
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    usersQuery(filter).sort(sort).skip(skip).limit(query.limit),
    User.countDocuments(filter),
  ]);
  return { records, meta: paginationMeta(query.page, query.limit, totalRecords) };
}

export async function getUser(id) {
  const user = await User.findById(id).populate('team', 'name');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
}

export async function updateUser(id, input, actor) {
  return withTransaction(async (session) => {
    const user = await User.findById(id).select('+password').session(session);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.role === ROLES.ADMIN && input.role && input.role !== ROLES.ADMIN) {
      await assertAnotherActiveAdmin(user._id, session);
    }
    if (input.role && input.role !== user.role && String(actor._id) === String(user._id)) {
      throw new ApiError(403, 'You cannot change your own role');
    }

    const previous = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      team: user.team,
      isActive: user.isActive,
    };

    if (input.teamId || input.teamName || input.role) {
      const nextRole = input.role || user.role;
      const team = (input.teamId || input.teamName)
        ? await resolveTeam(input, session)
        : (input.role ? null : user.team);
      if (nextRole === ROLES.ADMIN) {
        user.team = null;
      } else if (team) {
        user.team = team._id;
      } else if (!user.team) {
        throw new ApiError(422, 'A team is required for this role');
      }
      if (input.role) {
        user.role = input.role;
      }
    }

    if (input.name) user.name = input.name;
    if (input.email) user.email = input.email;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.password) {
      user.password = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    }

    try {
      await user.save({ session });
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(409, 'Duplicate value for email');
      }
      throw error;
    }

    if (input.password) {
      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session },
      );
    }

    await writeAudit({
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: ENTITY_TYPES.USER,
      entityId: user._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        team: user.team,
        isActive: user.isActive,
        passwordChanged: Boolean(input.password),
      },
    }, session);

    return User.findById(user._id).populate('team', 'name').session(session);
  });
}

export async function updateUserStatus(id, isActive, actor) {
  return withTransaction(async (session) => {
    const user = await User.findById(id).session(session);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user.role === ROLES.ADMIN && user.isActive && !isActive) {
      await assertAnotherActiveAdmin(user._id, session);
    }
    if (String(actor._id) === String(user._id) && !isActive) {
      throw new ApiError(403, 'You cannot deactivate your own account');
    }

    const previous = user.isActive;
    user.isActive = isActive;
    await user.save({ session });

    if (!isActive) {
      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session },
      );
    }

    await writeAudit({
      action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
      entityType: ENTITY_TYPES.USER,
      entityId: user._id,
      performedBy: actor._id,
      previousValue: { isActive: previous },
      newValue: { isActive },
    }, session);

    return User.findById(user._id).populate('team', 'name').session(session);
  });
}

async function hasActiveResources(userId, session) {
  const [leads, deals, activities] = await Promise.all([
    Lead.countDocuments({ assignedTo: userId, status: { $in: ACTIVE_LEAD_STATUSES } }).session(session),
    Deal.countDocuments({ assignedTo: userId, stage: { $in: OPEN_DEAL_STAGES } }).session(session),
    Activity.countDocuments({ assignedTo: userId, status: 'Pending' }).session(session),
  ]);
  return leads + deals + activities > 0;
}

export async function deleteUser(id, actor) {
  return withTransaction(async (session) => {
    const user = await User.findById(id).session(session);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user.role === ROLES.ADMIN && user.isActive) {
      await assertAnotherActiveAdmin(user._id, session);
    }
    if (String(actor._id) === String(user._id)) {
      throw new ApiError(403, 'You cannot delete your own account');
    }
    if (await hasActiveResources(user._id, session)) {
      throw new ApiError(409, 'Reassign active leads, deals, and activities before deactivating this user');
    }

    user.isActive = false;
    await user.save({ session });
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { session },
    );
    await writeAudit({
      action: AUDIT_ACTIONS.USER_DEACTIVATED,
      entityType: ENTITY_TYPES.USER,
      entityId: user._id,
      performedBy: actor._id,
      previousValue: { isActive: true },
      newValue: { isActive: false },
    }, session);

    return User.findById(user._id).populate('team', 'name').session(session);
  });
}
