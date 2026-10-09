import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { ROLES } from '../constants/roles.js';
import { Activity } from '../models/Activity.js';
import { Customer } from '../models/Customer.js';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { overdueQuery, pendingQuery, resolveActivityStatus } from '../utils/activityStatus.js';
import { buildSort, paginationMeta, skipFor } from '../utils/pagination.js';
import { combineFilters, createdAtRange, searchClause } from '../utils/queryFilters.js';
import { scopeFilter } from '../utils/scope.js';
import { withTransaction } from '../utils/transaction.js';
import { writeAudit } from './audit.service.js';

const ACTIVITY_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'title', 'type'];

function presentActivity(activity, now = new Date()) {
  const plain = activity.toObject ? activity.toObject() : { ...activity };
  plain.status = resolveActivityStatus(plain, now);
  return plain;
}

function populateActivity(query) {
  return query.populate('assignedTo', 'name email role').populate('createdBy', 'name email role').populate('team', 'name');
}

async function assertRelatedEntity(actor, type, id, session) {
  if (type === 'Lead') {
    const lead = await Lead.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!lead) throw new ApiError(422, 'Related record was not found');
    return lead;
  }
  if (type === 'Customer') {
    const customer = await Customer.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!customer) throw new ApiError(422, 'Related record was not found');
    return customer;
  }
  if (type === 'Deal') {
    const deal = await Deal.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!deal) throw new ApiError(422, 'Related record was not found');
    return deal;
  }
  if (type === 'User') {
    const user = await User.findById(id).session(session);
    if (!user) throw new ApiError(422, 'Related record was not found');
    if (actor.role === ROLES.ADMIN) return user;
    if (actor.role === ROLES.SALES_MANAGER && actor.team && String(user.team) === String(actor.team)) return user;
    if (actor.role === ROLES.SALES_EXECUTIVE && String(user._id) === String(actor._id)) return user;
    throw new ApiError(422, 'Related record was not found');
  }
  throw new ApiError(422, 'Invalid related entity');
}

async function resolveActivityAssignee(actor, assignedTo, session) {
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    if (assignedTo && String(assignedTo) !== String(actor._id)) {
      throw new ApiError(403, 'You cannot assign activities to another user');
    }
    if (!actor.team) {
      throw new ApiError(422, 'Your account must be assigned to a team before managing records');
    }
    return { userId: actor._id, team: actor.team };
  }

  const targetId = assignedTo || actor._id;
  const assignee = await User.findById(targetId).session(session);
  if (!assignee || !assignee.isActive) {
    throw new ApiError(422, 'Assignee must be an active user');
  }
  if (!assignee.team && actor.role !== ROLES.ADMIN) {
    throw new ApiError(422, 'Assignee must belong to a team');
  }
  if (actor.role === ROLES.SALES_MANAGER && String(assignee.team) !== String(actor.team)) {
    throw new ApiError(403, 'Managers can assign activities only within their team');
  }
  const team = assignee.team || actor.team;
  if (!team) {
    throw new ApiError(422, 'Activity assignee must belong to a team');
  }
  return { userId: assignee._id, team };
}

export async function createActivity(input, actor) {
  return withTransaction(async (session) => {
    if (input.type !== 'Note' && !input.dueDate) {
      throw new ApiError(422, 'dueDate is required for this activity type');
    }
    const related = await assertRelatedEntity(actor, input.relatedEntityType, input.relatedEntityId, session);
    const { userId, team } = await resolveActivityAssignee(actor, input.assignedTo, session);
    const [activity] = await Activity.create([{
      type: input.type,
      title: input.title,
      description: input.description || '',
      assignedTo: userId,
      createdBy: actor._id,
      team,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: 'Pending',
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    }], { session });

    const auditPayload = {
      action: AUDIT_ACTIONS.ACTIVITY_CREATED,
      performedBy: actor._id,
      newValue: { type: activity.type, title: activity.title, relatedEntityType: activity.relatedEntityType, relatedEntityId: activity.relatedEntityId },
      metadata: { activityId: activity._id, type: activity.type },
    };
    await writeAudit({ ...auditPayload, entityType: ENTITY_TYPES.ACTIVITY, entityId: activity._id }, session);
    if (['Lead', 'Customer', 'Deal'].includes(input.relatedEntityType)) {
      await writeAudit({
        ...auditPayload,
        entityType: input.relatedEntityType,
        entityId: related._id,
      }, session);
    }
    const saved = await populateActivity(Activity.findById(activity._id).session(session));
    return presentActivity(saved);
  });
}

export async function listActivities(query, actor) {
  if (
    actor.role === ROLES.SALES_EXECUTIVE
    && query.assignedTo
    && String(query.assignedTo) !== String(actor._id)
  ) {
    throw new ApiError(403, 'You do not have permission to filter another user\'s activities');
  }
  const now = new Date();
  let statusFilter = null;
  if (query.status === 'Overdue') statusFilter = overdueQuery(now);
  else if (query.status === 'Pending') statusFilter = pendingQuery(now);
  else if (query.status === 'Completed') statusFilter = { status: 'Completed' };

  const createdAt = createdAtRange(query.from, query.to);
  const due = createdAtRange(query.dueFrom, query.dueTo);
  const filter = combineFilters(
    scopeFilter(actor),
    query.type ? { type: query.type } : null,
    statusFilter,
    query.assignedTo ? { assignedTo: query.assignedTo } : null,
    query.relatedEntityType ? { relatedEntityType: query.relatedEntityType } : null,
    query.relatedEntityId ? { relatedEntityId: query.relatedEntityId } : null,
    createdAt ? { createdAt } : null,
    due ? { dueDate: due } : null,
    searchClause(query.search, ['title', 'description']),
  );
  const sort = buildSort(query.sortBy, query.sortOrder, ACTIVITY_SORT_FIELDS);
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    populateActivity(Activity.find(filter).sort(sort).skip(skip).limit(query.limit)),
    Activity.countDocuments(filter),
  ]);
  return {
    records: records.map((record) => presentActivity(record, now)),
    meta: paginationMeta(query.page, query.limit, totalRecords),
  };
}

export async function getActivity(id, actor) {
  const activity = await populateActivity(Activity.findOne({ _id: id, ...scopeFilter(actor) }));
  if (!activity) {
    throw new ApiError(404, 'Activity not found');
  }
  return presentActivity(activity);
}

export async function updateActivity(id, input, actor) {
  return withTransaction(async (session) => {
    const activity = await Activity.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!activity) throw new ApiError(404, 'Activity not found');
    if (activity.status === 'Completed') {
      throw new ApiError(409, 'Completed activities cannot be modified');
    }
    const updates = {};
    for (const key of ['title', 'description', 'type']) {
      if (input[key] !== undefined) updates[key] = input[key];
    }
    if (input.dueDate !== undefined) {
      updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.assignedTo) {
      const { userId, team } = await resolveActivityAssignee(actor, input.assignedTo, session);
      updates.assignedTo = userId;
      updates.team = team;
    }
    const nextType = updates.type || activity.type;
    const nextDue = updates.dueDate !== undefined ? updates.dueDate : activity.dueDate;
    if (nextType !== 'Note' && !nextDue) {
      throw new ApiError(422, 'dueDate is required for this activity type');
    }
    const previous = { title: activity.title, description: activity.description, type: activity.type, dueDate: activity.dueDate, assignedTo: activity.assignedTo };
    const updated = await Activity.findOneAndUpdate(
      { _id: activity._id, updatedAt: activity.updatedAt, status: 'Pending' },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) throw new ApiError(409, 'Activity was modified by another request');
    await writeAudit({
      action: AUDIT_ACTIONS.ACTIVITY_UPDATED,
      entityType: ENTITY_TYPES.ACTIVITY,
      entityId: activity._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: updates,
    }, session);
    const saved = await populateActivity(Activity.findById(updated._id).session(session));
    return presentActivity(saved);
  });
}

export async function completeActivity(id, actor) {
  return withTransaction(async (session) => {
    const activity = await Activity.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!activity) throw new ApiError(404, 'Activity not found');
    if (activity.status === 'Completed') {
      throw new ApiError(409, 'Activity is already completed');
    }
    const completedAt = new Date();
    const updated = await Activity.findOneAndUpdate(
      { _id: activity._id, status: 'Pending' },
      { $set: { status: 'Completed', completedAt } },
      { returnDocument: 'after', session },
    );
    if (!updated) throw new ApiError(409, 'Activity was modified by another request');
    await writeAudit({
      action: AUDIT_ACTIONS.ACTIVITY_COMPLETED,
      entityType: ENTITY_TYPES.ACTIVITY,
      entityId: activity._id,
      performedBy: actor._id,
      previousValue: { status: 'Pending' },
      newValue: { status: 'Completed', completedAt },
    }, session);
    if (['Lead', 'Customer', 'Deal'].includes(activity.relatedEntityType)) {
      await writeAudit({
        action: AUDIT_ACTIONS.ACTIVITY_COMPLETED,
        entityType: activity.relatedEntityType,
        entityId: activity.relatedEntityId,
        performedBy: actor._id,
        metadata: { activityId: activity._id, type: activity.type },
        newValue: { status: 'Completed', completedAt },
      }, session);
    }
    const saved = await populateActivity(Activity.findById(updated._id).session(session));
    return presentActivity(saved);
  });
}

export async function deleteActivity(id, actor) {
  return withTransaction(async (session) => {
    const activity = await Activity.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
    if (!activity) throw new ApiError(404, 'Activity not found');
    if (activity.status === 'Completed') {
      throw new ApiError(409, 'Completed activities cannot be deleted');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.ACTIVITY_DELETED,
      entityType: ENTITY_TYPES.ACTIVITY,
      entityId: activity._id,
      performedBy: actor._id,
      previousValue: { title: activity.title, type: activity.type },
    }, session);
    await activity.deleteOne({ session });
    return { id: activity._id };
  });
}
