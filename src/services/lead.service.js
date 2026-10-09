import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { canTransitionLeadStatus, TERMINAL_LEAD_STATUSES } from '../constants/leadStatus.js';
import { isOpenDealStage } from '../constants/dealStage.js';
import { ROLES } from '../constants/roles.js';
import { Customer } from '../models/Customer.js';
import { Deal } from '../models/Deal.js';
import { Activity } from '../models/Activity.js';
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
import { runConversionGuard } from './conversionGuard.js';

const LEAD_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'priority', 'status', 'source'];
const TERMINAL = new Set(TERMINAL_LEAD_STATUSES);

function populateLead(query) {
  return query
    .populate('assignedTo', 'name email role team')
    .populate('createdBy', 'name email role')
    .populate('team', 'name');
}

async function findLeadInScope(id, actor, session) {
  const lead = await Lead.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
  if (!lead) {
    throw new ApiError(404, 'Lead not found');
  }
  return lead;
}

function assertMutable(lead) {
  if (TERMINAL.has(lead.status)) {
    throw new ApiError(409, 'Terminal leads cannot be modified');
  }
}

export async function createLead(input, actor) {
  return withTransaction(async (session) => {
    if (actor.role === ROLES.SALES_EXECUTIVE && input.assignedTo && String(input.assignedTo) !== String(actor._id)) {
      throw new ApiError(403, 'You cannot assign leads to another user');
    }
    const settings = await getConfig(session);
    const { user: assignee, team } = await resolveAssignee(
      actor,
      actor.role === ROLES.SALES_EXECUTIVE ? actor._id : input.assignedTo,
      session,
    );
    const [lead] = await Lead.create([{
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company || '',
      source: input.source || settings.defaultLeadSource,
      status: 'New',
      priority: input.priority || settings.defaultLeadPriority,
      assignedTo: assignee._id,
      createdBy: actor._id,
      team,
      description: input.description || '',
    }], { session });

    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_CREATED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      newValue: { name: lead.name, status: lead.status, assignedTo: lead.assignedTo, priority: lead.priority },
    }, session);

    return populateLead(Lead.findById(lead._id).session(session));
  });
}

export async function listLeads(query, actor) {
  if (
    actor.role === ROLES.SALES_EXECUTIVE
    && query.assignedTo
    && String(query.assignedTo) !== String(actor._id)
  ) {
    throw new ApiError(403, 'You do not have permission to filter another user\'s leads');
  }

  const createdAt = createdAtRange(query.from, query.to);
  const filter = combineFilters(
    scopeFilter(actor),
    query.status ? { status: query.status } : null,
    query.priority ? { priority: query.priority } : null,
    query.source ? { source: query.source } : null,
    query.assignedTo ? { assignedTo: query.assignedTo } : null,
    createdAt ? { createdAt } : null,
    searchClause(query.search, ['name', 'email', 'company', 'phone']),
  );
  const sort = buildSort(query.sortBy, query.sortOrder, LEAD_SORT_FIELDS);
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    populateLead(Lead.find(filter).sort(sort).skip(skip).limit(query.limit)),
    Lead.countDocuments(filter),
  ]);
  return { records, meta: paginationMeta(query.page, query.limit, totalRecords) };
}

export async function getLead(id, actor) {
  const lead = await populateLead(Lead.findOne({ _id: id, ...scopeFilter(actor) }));
  if (!lead) {
    throw new ApiError(404, 'Lead not found');
  }
  return lead;
}

export async function updateLead(id, input, actor) {
  return withTransaction(async (session) => {
    const lead = await findLeadInScope(id, actor, session);
    assertMutable(lead);
    const previous = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      priority: lead.priority,
      description: lead.description,
    };
    const priorityChanged = input.priority && input.priority !== lead.priority;
    const updates = {};
    for (const key of ['name', 'email', 'phone', 'company', 'source', 'priority', 'description']) {
      if (input[key] !== undefined) {
        updates[key] = input[key];
      }
    }
    const updated = await Lead.findOneAndUpdate(
      { _id: lead._id, updatedAt: lead.updatedAt },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Lead was modified by another request');
    }

    if (priorityChanged) {
      await writeAudit({
        action: AUDIT_ACTIONS.LEAD_PRIORITY_CHANGED,
        entityType: ENTITY_TYPES.LEAD,
        entityId: lead._id,
        performedBy: actor._id,
        previousValue: { priority: previous.priority },
        newValue: { priority: input.priority },
      }, session);
    }
    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: input,
    }, session);
    return populateLead(Lead.findById(updated._id).session(session));
  });
}

export async function updateLeadStatus(id, status, actor) {
  return withTransaction(async (session) => {
    const lead = await findLeadInScope(id, actor, session);
    if (!canTransitionLeadStatus(lead.status, status)) {
      throw new ApiError(422, `Cannot change lead status from ${lead.status} to ${status}`);
    }
    const updated = await Lead.findOneAndUpdate(
      { _id: lead._id, status: lead.status, updatedAt: lead.updatedAt },
      { $set: { status } },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Lead was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_STATUS_CHANGED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: { status: lead.status },
      newValue: { status },
    }, session);
    return populateLead(Lead.findById(updated._id).session(session));
  });
}

export async function assignLead(id, input, actor) {
  assertCanAssign(actor);
  return withTransaction(async (session) => {
    const lead = await findLeadInScope(id, actor, session);
    assertMutable(lead);
    const { user: assignee, team } = await resolveAssignee(actor, input.assignedTo, session);
    const updated = await Lead.findOneAndUpdate(
      { _id: lead._id, assignedTo: lead.assignedTo, updatedAt: lead.updatedAt },
      { $set: { assignedTo: assignee._id, team } },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Lead was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_ASSIGNED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: { assignedTo: lead.assignedTo },
      newValue: { assignedTo: assignee._id },
      metadata: { reason: input.reason || null },
    }, session);
    return populateLead(Lead.findById(updated._id).session(session));
  });
}

export async function deleteLead(id, actor) {
  return withTransaction(async (session) => {
    const lead = await findLeadInScope(id, actor, session);
    if (lead.status === 'Converted' || lead.convertedCustomer) {
      throw new ApiError(409, 'Converted leads cannot be deleted');
    }
    const [activities, deals] = await Promise.all([
      Activity.countDocuments({ relatedEntityType: 'Lead', relatedEntityId: lead._id }).session(session),
      Deal.countDocuments({ lead: lead._id }).session(session),
    ]);
    if (activities > 0 || deals > 0) {
      throw new ApiError(409, 'Lead cannot be deleted because related records exist');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_DELETED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: { name: lead.name, status: lead.status, email: lead.email },
    }, session);
    await lead.deleteOne({ session });
    return { id: lead._id };
  });
}

export async function convertLead(id, input, actor) {
  return withTransaction(async (session) => {
    const lead = await findLeadInScope(id, actor, session);
    if (lead.status === 'Converted' || lead.convertedCustomer) {
      throw new ApiError(409, 'Lead has already been converted');
    }
    if (lead.status !== 'Qualified') {
      throw new ApiError(422, 'Only qualified leads can be converted');
    }

    const settings = await getConfig(session);
    const stage = input.deal.stage || settings.defaultDealStage;
    if (!isOpenDealStage(stage)) {
      throw new ApiError(422, 'Conversion deals must start in an open stage');
    }

    const [customer] = await Customer.create([{
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company || '',
      originalLead: lead._id,
      assignedTo: lead.assignedTo,
      team: lead.team,
      status: 'Active',
    }], { session });

    const expectedRevenue = calculateExpectedRevenue(input.deal.value, input.deal.probability);
    const [deal] = await Deal.create([{
      name: input.deal.name,
      value: input.deal.value,
      probability: input.deal.probability,
      expectedRevenue,
      expectedClosingDate: new Date(input.deal.expectedClosingDate),
      stage,
      description: input.deal.description || '',
      lead: lead._id,
      customer: customer._id,
      assignedTo: lead.assignedTo,
      createdBy: actor._id,
      team: lead.team,
    }], { session });

    const updated = await Lead.findOneAndUpdate(
      { _id: lead._id, status: 'Qualified', convertedCustomer: null },
      { $set: { status: 'Converted', convertedCustomer: customer._id } },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Lead has already been converted');
    }

    await writeAudit({
      action: AUDIT_ACTIONS.LEAD_CONVERTED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: { status: 'Qualified' },
      newValue: { status: 'Converted', customerId: customer._id, dealId: deal._id },
    }, session);
    await writeAudit({
      action: AUDIT_ACTIONS.CUSTOMER_CREATED,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: customer._id,
      performedBy: actor._id,
      newValue: { originalLead: lead._id, name: customer.name },
    }, session);
    await writeAudit({
      action: AUDIT_ACTIONS.DEAL_CREATED,
      entityType: ENTITY_TYPES.DEAL,
      entityId: deal._id,
      performedBy: actor._id,
      newValue: { name: deal.name, stage: deal.stage, value: deal.value, lead: lead._id, customer: customer._id },
    }, session);

    await runConversionGuard(session);

    return {
      lead: await populateLead(Lead.findById(updated._id).session(session)),
      customer,
      deal,
    };
  });
}
