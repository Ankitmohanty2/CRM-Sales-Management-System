import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { CLOSED_DEAL_STAGES, OPEN_DEAL_STAGES, canTransitionDealStage, isClosedDealStage, isOpenDealStage } from '../constants/dealStage.js';
import { ROLES } from '../constants/roles.js';
import { Customer } from '../models/Customer.js';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { ApiError } from '../utils/ApiError.js';
import { buildSort, paginationMeta, skipFor } from '../utils/pagination.js';
import { combineFilters, createdAtRange, searchClause } from '../utils/queryFilters.js';
import { calculateExpectedRevenue } from '../utils/revenue.js';
import { scopeFilter } from '../utils/scope.js';
import { withTransaction } from '../utils/transaction.js';
import { assertCanAssign, resolveAssignee } from './assignment.service.js';
import { writeAudit } from './audit.service.js';
import { getConfig } from './config.service.js';

const DEAL_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'value', 'probability', 'expectedClosingDate', 'stage'];

function populateDeal(query) {
  return query
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('customer', 'name email company')
    .populate('lead', 'name email status')
    .populate('team', 'name');
}

async function findDealInScope(id, actor, session) {
  const deal = await Deal.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
  if (!deal) {
    throw new ApiError(404, 'Deal not found');
  }
  return deal;
}

async function assertCustomerAndLead(input, actor, session) {
  const customer = await Customer.findOne({ _id: input.customer, ...scopeFilter(actor) }).session(session);
  if (!customer) {
    throw new ApiError(422, 'Customer not found');
  }
  let lead = null;
  if (input.lead) {
    lead = await Lead.findOne({ _id: input.lead, ...scopeFilter(actor) }).session(session);
    if (!lead) {
      throw new ApiError(422, 'Lead not found');
    }
  }
  return { customer, lead };
}

export async function createDeal(input, actor) {
  return withTransaction(async (session) => {
    if (actor.role === ROLES.SALES_EXECUTIVE && input.assignedTo && String(input.assignedTo) !== String(actor._id)) {
      throw new ApiError(403, 'You cannot assign deals to another user');
    }
    const settings = await getConfig(session);
    const stage = input.stage || settings.defaultDealStage;
    if (!isOpenDealStage(stage)) {
      throw new ApiError(422, 'New deals must start in an open stage');
    }
    const probability = input.probability ?? settings.defaultDealProbability;
    await assertCustomerAndLead(input, actor, session);
    const { user: assignee, team } = await resolveAssignee(
      actor,
      actor.role === ROLES.SALES_EXECUTIVE ? actor._id : input.assignedTo,
      session,
    );
    const expectedRevenue = calculateExpectedRevenue(input.value, probability);
    const [deal] = await Deal.create([{
      name: input.name,
      lead: input.lead || null,
      customer: input.customer,
      assignedTo: assignee._id,
      createdBy: actor._id,
      team,
      value: input.value,
      probability,
      expectedRevenue,
      expectedClosingDate: new Date(input.expectedClosingDate),
      stage,
      description: input.description || '',
    }], { session });

    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_CREATED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      newValue: { name: deal.name, stage: deal.stage, value: deal.value, assignedTo: deal.assignedTo, expectedRevenue },
    }, session);
    return populateDeal(Deal.findById(deal._id).session(session));
  });
}

export async function listDeals(query, actor) {
  if (
    actor.role === ROLES.SALES_EXECUTIVE
    && query.assignedTo
    && String(query.assignedTo) !== String(actor._id)
  ) {
    throw new ApiError(403, 'You do not have permission to filter another user\'s deals');
  }

  let stageFilter = null;
  if (query.status === 'open') {
    stageFilter = { stage: { $in: OPEN_DEAL_STAGES } };
  } else if (query.status === 'won') {
    stageFilter = { stage: 'Won' };
  } else if (query.status === 'lost') {
    stageFilter = { stage: 'Lost' };
  }
  if (query.stage) {
    stageFilter = stageFilter ? { $and: [stageFilter, { stage: query.stage }] } : { stage: query.stage };
  }

  const createdAt = createdAtRange(query.from, query.to);
  const closing = createdAtRange(query.closingFrom, query.closingTo);
  const value = {};
  if (query.minValue !== undefined) value.$gte = query.minValue;
  if (query.maxValue !== undefined) value.$lte = query.maxValue;

  const filter = combineFilters(
    scopeFilter(actor),
    stageFilter,
    query.assignedTo ? { assignedTo: query.assignedTo } : null,
    createdAt ? { createdAt } : null,
    closing ? { expectedClosingDate: closing } : null,
    Object.keys(value).length ? { value } : null,
    searchClause(query.search, ['name', 'description']),
  );
  const sort = buildSort(query.sortBy, query.sortOrder, DEAL_SORT_FIELDS);
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    populateDeal(Deal.find(filter).sort(sort).skip(skip).limit(query.limit)),
    Deal.countDocuments(filter),
  ]);
  return { records, meta: paginationMeta(query.page, query.limit, totalRecords) };
}

export async function getDeal(id, actor) {
  const deal = await populateDeal(Deal.findOne({ _id: id, ...scopeFilter(actor) }));
  if (!deal) {
    throw new ApiError(404, 'Deal not found');
  }
  return deal;
}

export async function updateDeal(id, input, actor) {
  return withTransaction(async (session) => {
    const deal = await findDealInScope(id, actor, session);
    if (isClosedDealStage(deal.stage)) {
      throw new ApiError(409, 'Closed deals cannot be modified. Reopen the deal with an authorized admin workflow');
    }
    const nextValue = input.value ?? deal.value;
    const nextProbability = input.probability ?? deal.probability;
    const updates = {
      expectedRevenue: calculateExpectedRevenue(nextValue, nextProbability),
    };
    for (const key of ['name', 'value', 'probability', 'description']) {
      if (input[key] !== undefined) updates[key] = input[key];
    }
    if (input.expectedClosingDate) {
      updates.expectedClosingDate = new Date(input.expectedClosingDate);
    }
    const previous = {
      name: deal.name,
      value: deal.value,
      probability: deal.probability,
      expectedRevenue: deal.expectedRevenue,
      expectedClosingDate: deal.expectedClosingDate,
      description: deal.description,
    };
    const updated = await Deal.findOneAndUpdate(
      { _id: deal._id, updatedAt: deal.updatedAt, stage: { $in: OPEN_DEAL_STAGES } },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Deal was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_UPDATED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: updates,
    }, session);
    return populateDeal(Deal.findById(updated._id).session(session));
  });
}

function stageAction(stage) {
  if (stage === 'Won') return AUDIT_ACTIONS.DEAL_WON;
  if (stage === 'Lost') return AUDIT_ACTIONS.DEAL_LOST;
  return AUDIT_ACTIONS.DEAL_STAGE_CHANGED;
}

export async function updateDealStage(id, input, actor) {
  return withTransaction(async (session) => {
    const deal = await findDealInScope(id, actor, session);
    if (!canTransitionDealStage(deal.stage, input.stage)) {
      throw new ApiError(422, `Cannot change deal stage from ${deal.stage} to ${input.stage}`);
    }
    if (input.stage === 'Lost' && !input.lostReason?.trim()) {
      throw new ApiError(422, 'A lost reason is required');
    }
    if (input.stage === 'Won' && !(deal.value > 0)) {
      throw new ApiError(422, 'A won deal must have a value greater than zero');
    }

    const updates = { stage: input.stage };
    if (input.stage === 'Won') {
      updates.probability = 100;
      updates.expectedRevenue = calculateExpectedRevenue(deal.value, 100);
      updates.closedAt = new Date();
      updates.lostReason = '';
    } else if (input.stage === 'Lost') {
      updates.probability = 0;
      updates.expectedRevenue = 0;
      updates.closedAt = new Date();
      updates.lostReason = input.lostReason.trim();
    }

    const updated = await Deal.findOneAndUpdate(
      { _id: deal._id, stage: deal.stage, updatedAt: deal.updatedAt },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Deal was modified by another request');
    }
    await writeAudit({
      action: stageAction(input.stage),
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      previousValue: { stage: deal.stage, probability: deal.probability },
      newValue: updates,
    }, session);
    return populateDeal(Deal.findById(updated._id).session(session));
  });
}

export async function assignDeal(id, input, actor) {
  assertCanAssign(actor);
  return withTransaction(async (session) => {
    const deal = await findDealInScope(id, actor, session);
    if (isClosedDealStage(deal.stage)) {
      throw new ApiError(409, 'Closed deals cannot be reassigned');
    }
    const { user: assignee, team } = await resolveAssignee(actor, input.assignedTo, session);
    const updated = await Deal.findOneAndUpdate(
      { _id: deal._id, assignedTo: deal.assignedTo, updatedAt: deal.updatedAt },
      { $set: { assignedTo: assignee._id, team } },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Deal was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_ASSIGNED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      previousValue: { assignedTo: deal.assignedTo },
      newValue: { assignedTo: assignee._id },
      metadata: { reason: input.reason || null },
    }, session);
    return populateDeal(Deal.findById(updated._id).session(session));
  });
}

export async function reopenDeal(id, input, actor) {
  if (actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Only an admin can reopen a closed deal');
  }
  return withTransaction(async (session) => {
    const deal = await findDealInScope(id, actor, session);
    if (!isClosedDealStage(deal.stage)) {
      throw new ApiError(409, 'Only closed deals can be reopened');
    }
    if (!isOpenDealStage(input.stage)) {
      throw new ApiError(422, 'Reopened deals must move to an open stage');
    }
    const expectedRevenue = calculateExpectedRevenue(deal.value, input.probability);
    const previous = { stage: deal.stage, closedAt: deal.closedAt, probability: deal.probability, lostReason: deal.lostReason };
    const updates = {
      stage: input.stage,
      probability: input.probability,
      expectedRevenue,
      closedAt: null,
      lostReason: '',
    };
    const updated = await Deal.findOneAndUpdate(
      { _id: deal._id, stage: { $in: CLOSED_DEAL_STAGES }, updatedAt: deal.updatedAt },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Deal was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_REOPENED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: updates,
      metadata: { reason: input.reason },
    }, session);
    return populateDeal(Deal.findById(updated._id).session(session));
  });
}

export async function deleteDeal(id, actor) {
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    throw new ApiError(403, 'You do not have permission to delete deals');
  }
  return withTransaction(async (session) => {
    const deal = await findDealInScope(id, actor, session);
    if (deal.stage === 'Won' || deal.stage === 'Lost') {
      throw new ApiError(409, 'Closed deals cannot be deleted');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_DELETED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      previousValue: { name: deal.name, stage: deal.stage, value: deal.value },
    }, session);
    await deal.deleteOne({ session });
    return { id: deal._id };
  });
}
