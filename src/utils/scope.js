import { ROLES } from '../constants/roles.js';

export function scopeFilter(actor) {
  if (actor.role === ROLES.ADMIN) {
    return {};
  }
  if (actor.role === ROLES.SALES_MANAGER) {
    if (!actor.team) {
      return { _id: { $exists: false } };
    }
    return { team: actor.team };
  }
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    return { assignedTo: actor._id };
  }
  return { _id: { $exists: false } };
}
