export function resolveActivityStatus(activity, now = new Date()) {
  if (activity.status === 'Completed') {
    return 'Completed';
  }
  if (activity.dueDate && new Date(activity.dueDate).getTime() < now.getTime()) {
    return 'Overdue';
  }
  return 'Pending';
}

export function overdueQuery(now = new Date()) {
  return { status: 'Pending', dueDate: { $lt: now, $ne: null } };
}

export function pendingQuery(now = new Date()) {
  return {
    status: 'Pending',
    $or: [{ dueDate: null }, { dueDate: { $gte: now } }],
  };
}
