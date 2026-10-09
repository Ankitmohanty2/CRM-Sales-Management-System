import { DEAL_STAGES, OPEN_DEAL_STAGES } from '../constants/dealStage.js';
import { ROLES } from '../constants/roles.js';
import { Activity } from '../models/Activity.js';
import { Customer } from '../models/Customer.js';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { overdueQuery, pendingQuery } from '../utils/activityStatus.js';
import { createdAtRange } from '../utils/queryFilters.js';
import { scopeFilter } from '../utils/scope.js';

function matchWithDate(scope, from, to) {
  const createdAt = createdAtRange(from, to);
  return createdAt ? { ...scope, createdAt } : { ...scope };
}

function emptyOverview() {
  return {
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalDeals: 0,
    openDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    totalRevenue: 0,
    expectedRevenue: 0,
    conversionRate: 0,
    pendingActivities: 0,
    overdueActivities: 0,
  };
}

export async function overview(query, actor) {
  const scope = scopeFilter(actor);
  const match = matchWithDate(scope, query.from, query.to);
  const now = new Date();
  const [leadStats, customerCount, dealStats, pendingActivities, overdueActivities] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: { $sum: { $cond: [{ $eq: ['$status', 'New'] }, 1, 0] } },
          qualifiedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
          convertedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } },
        },
      },
    ]),
    Customer.countDocuments(match),
    Deal.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalDeals: { $sum: 1 },
          openDeals: { $sum: { $cond: [{ $in: ['$stage', OPEN_DEAL_STAGES] }, 1, 0] } },
          wonDeals: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, 1, 0] } },
          lostDeals: { $sum: { $cond: [{ $eq: ['$stage', 'Lost'] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, '$value', 0] } },
          expectedRevenue: { $sum: { $cond: [{ $in: ['$stage', OPEN_DEAL_STAGES] }, '$expectedRevenue', 0] } },
        },
      },
    ]),
    Activity.countDocuments({ ...match, ...pendingQuery(now) }),
    Activity.countDocuments({ ...match, ...overdueQuery(now) }),
  ]);

  const leads = leadStats[0] || { totalLeads: 0, newLeads: 0, qualifiedLeads: 0, convertedLeads: 0 };
  const deals = dealStats[0] || {
    totalDeals: 0, openDeals: 0, wonDeals: 0, lostDeals: 0, totalRevenue: 0, expectedRevenue: 0,
  };
  const conversionRate = leads.totalLeads === 0
    ? 0
    : Math.round((leads.convertedLeads / leads.totalLeads) * 10000) / 100;

  return {
    ...emptyOverview(),
    ...leads,
    totalCustomers: customerCount,
    ...deals,
    conversionRate,
    pendingActivities,
    overdueActivities,
  };
}

export async function pipeline(query, actor) {
  const match = matchWithDate(scopeFilter(actor), query.from, query.to);
  const rows = await Deal.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
        expectedRevenue: { $sum: '$expectedRevenue' },
      },
    },
  ]);
  const byStage = new Map(rows.map((row) => [row._id, row]));
  return DEAL_STAGES.map((stage) => {
    const row = byStage.get(stage);
    const expectedRevenue = OPEN_DEAL_STAGES.includes(stage) ? (row?.expectedRevenue || 0) : (stage === 'Won' ? (row?.totalValue || 0) : 0);
    return {
      stage,
      count: row?.count || 0,
      totalValue: row?.totalValue || 0,
      expectedRevenue,
    };
  });
}

export async function teamPerformance(query, actor) {
  const scope = scopeFilter(actor);
  const match = matchWithDate(scope, query.from, query.to);
  const now = new Date();
  const [leads, deals, createdDeals, activities] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assignedTo',
          leadsAssigned: { $sum: 1 },
          leadsQualified: { $sum: { $cond: [{ $in: ['$status', ['Qualified', 'Converted']] }, 1, 0] } },
          leadsConverted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } },
        },
      },
    ]),
    Deal.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assignedTo',
          dealsWon: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, 1, 0] } },
          dealsLost: { $sum: { $cond: [{ $eq: ['$stage', 'Lost'] }, 1, 0] } },
          wonRevenue: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, '$value', 0] } },
        },
      },
    ]),
    Deal.aggregate([
      { $match: match },
      { $group: { _id: '$createdBy', dealsCreated: { $sum: 1 } } },
    ]),
    Activity.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assignedTo',
          pendingActivities: {
            $sum: {
              $cond: [{
                $and: [
                  { $eq: ['$status', 'Pending'] },
                  { $or: [{ $eq: ['$dueDate', null] }, { $gte: ['$dueDate', now] }] },
                ],
              }, 1, 0],
            },
          },
          overdueActivities: {
            $sum: {
              $cond: [{
                $and: [
                  { $eq: ['$status', 'Pending'] },
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', now] },
                ],
              }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const rows = new Map();
  const ensure = (id) => {
    const key = String(id);
    if (!rows.has(key)) {
      rows.set(key, {
        userId: id,
        leadsAssigned: 0,
        leadsQualified: 0,
        leadsConverted: 0,
        dealsCreated: 0,
        dealsWon: 0,
        dealsLost: 0,
        wonRevenue: 0,
        pendingActivities: 0,
        overdueActivities: 0,
      });
    }
    return rows.get(key);
  };

  for (const row of leads) Object.assign(ensure(row._id), row);
  for (const row of deals) Object.assign(ensure(row._id), row);
  for (const row of createdDeals) ensure(row._id).dealsCreated = row.dealsCreated;
  for (const row of activities) Object.assign(ensure(row._id), row);

  const ids = [...rows.keys()];
  const allowedIds = await performanceUserIds(actor);
  const visibleIds = allowedIds
    ? ids.filter((id) => allowedIds.has(id))
    : ids;
  const users = await User.find({ _id: { $in: visibleIds } }).select('name email role team');
  const names = new Map(users.map((user) => [String(user._id), user]));
  return visibleIds.map((id) => {
    const row = rows.get(id);
    const user = names.get(id);
    return {
      userId: row.userId,
      name: user?.name || 'Unknown',
      email: user?.email || null,
      role: user?.role || null,
      leadsAssigned: row.leadsAssigned,
      leadsQualified: row.leadsQualified,
      leadsConverted: row.leadsConverted,
      dealsCreated: row.dealsCreated,
      dealsWon: row.dealsWon,
      dealsLost: row.dealsLost,
      wonRevenue: row.wonRevenue,
      pendingActivities: row.pendingActivities,
      overdueActivities: row.overdueActivities,
    };
  });
}

async function performanceUserIds(actor) {
  if (actor.role === ROLES.ADMIN) {
    return null;
  }
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    return new Set([String(actor._id)]);
  }
  if (!actor.team) {
    return new Set();
  }
  const members = await User.find({ team: actor.team }).select('_id');
  return new Set(members.map((user) => String(user._id)));
}
