import { ROLES } from '../constants/roles.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function resolveAssignee(actor, assignedTo, session) {
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    if (!actor.team) {
      throw new ApiError(422, 'Your account must be assigned to a team before managing records');
    }
    return { user: actor, team: actor.team };
  }

  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.SALES_MANAGER) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  if (!assignedTo) {
    throw new ApiError(422, 'assignedTo is required');
  }

  const assignee = await User.findById(assignedTo).session(session);
  if (!assignee || !assignee.isActive || assignee.role !== ROLES.SALES_EXECUTIVE) {
    throw new ApiError(422, 'Assignee must be an active sales executive');
  }
  if (!assignee.team) {
    throw new ApiError(422, 'Assignee must belong to a team');
  }
  if (actor.role === ROLES.SALES_MANAGER && String(assignee.team) !== String(actor.team)) {
    throw new ApiError(403, 'Managers can assign only within their team');
  }

  return { user: assignee, team: assignee.team };
}

export function assertCanAssign(actor) {
  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.SALES_MANAGER) {
    throw new ApiError(403, 'You do not have permission to assign records');
  }
}
