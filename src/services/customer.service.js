import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { ROLES } from '../constants/roles.js';
import { Customer } from '../models/Customer.js';
import { Deal } from '../models/Deal.js';
import { ApiError } from '../utils/ApiError.js';
import { buildSort, paginationMeta, skipFor } from '../utils/pagination.js';
import { combineFilters, createdAtRange, searchClause } from '../utils/queryFilters.js';
import { scopeFilter } from '../utils/scope.js';
import { withTransaction } from '../utils/transaction.js';
import { resolveAssignee } from './assignment.service.js';
import { writeAudit } from './audit.service.js';

const CUSTOMER_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'status', 'company'];

function populateCustomer(query) {
  return query.populate('assignedTo', 'name email role').populate('team', 'name').populate('originalLead', 'name email status');
}

async function findCustomerInScope(id, actor, session) {
  const customer = await Customer.findOne({ _id: id, ...scopeFilter(actor) }).session(session);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  return customer;
}

export async function createCustomer(input, actor) {
  return withTransaction(async (session) => {
    if (actor.role === ROLES.SALES_EXECUTIVE && input.assignedTo && String(input.assignedTo) !== String(actor._id)) {
      throw new ApiError(403, 'You cannot assign customers to another user');
    }
    const { user: assignee, team } = await resolveAssignee(
      actor,
      actor.role === ROLES.SALES_EXECUTIVE ? actor._id : input.assignedTo,
      session,
    );
    const [customer] = await Customer.create([{
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company || '',
      address: input.address || {},
      assignedTo: assignee._id,
      team,
      status: input.status || 'Active',
    }], { session });

    await writeAudit({
      action: AUDIT_ACTIONS.CUSTOMER_CREATED,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: customer._id,
      performedBy: actor._id,
      newValue: { name: customer.name, email: customer.email, assignedTo: customer.assignedTo },
    }, session);

    return populateCustomer(Customer.findById(customer._id).session(session));
  });
}

export async function listCustomers(query, actor) {
  if (
    actor.role === ROLES.SALES_EXECUTIVE
    && query.assignedTo
    && String(query.assignedTo) !== String(actor._id)
  ) {
    throw new ApiError(403, 'You do not have permission to filter another user\'s customers');
  }
  const createdAt = createdAtRange(query.from, query.to);
  const filter = combineFilters(
    scopeFilter(actor),
    query.status ? { status: query.status } : null,
    query.assignedTo ? { assignedTo: query.assignedTo } : null,
    createdAt ? { createdAt } : null,
    searchClause(query.search, ['name', 'email', 'company', 'phone']),
  );
  const sort = buildSort(query.sortBy, query.sortOrder, CUSTOMER_SORT_FIELDS);
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    populateCustomer(Customer.find(filter).sort(sort).skip(skip).limit(query.limit)),
    Customer.countDocuments(filter),
  ]);
  return { records, meta: paginationMeta(query.page, query.limit, totalRecords) };
}

export async function getCustomer(id, actor) {
  const customer = await populateCustomer(Customer.findOne({ _id: id, ...scopeFilter(actor) }));
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  return customer;
}

export async function updateCustomer(id, input, actor) {
  return withTransaction(async (session) => {
    const customer = await findCustomerInScope(id, actor, session);
    const plainAddress = (address = {}) => {
      const source = typeof address.toObject === 'function' ? address.toObject() : address;
      return {
        street: source.street || '',
        city: source.city || '',
        state: source.state || '',
        postalCode: source.postalCode || '',
        country: source.country || '',
      };
    };
    const previous = {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      address: plainAddress(customer.address),
      status: customer.status,
    };
    const updates = {};
    if (input.address) {
      updates.address = { ...plainAddress(customer.address), ...input.address };
    }
    for (const key of ['name', 'email', 'phone', 'company', 'status']) {
      if (input[key] !== undefined) {
        updates[key] = input[key];
      }
    }
    const updated = await Customer.findOneAndUpdate(
      { _id: customer._id, updatedAt: customer.updatedAt },
      { $set: updates },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ApiError(409, 'Customer was modified by another request');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: customer._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: updates,
    }, session);
    return populateCustomer(Customer.findById(updated._id).session(session));
  });
}

export async function deleteCustomer(id, actor) {
  return withTransaction(async (session) => {
    const customer = await findCustomerInScope(id, actor, session);
    if (customer.originalLead) {
      throw new ApiError(409, 'Customers created from lead conversion cannot be deleted');
    }
    const deals = await Deal.countDocuments({ customer: customer._id }).session(session);
    if (deals > 0) {
      throw new ApiError(409, 'Customer cannot be deleted because related deals exist');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.CUSTOMER_DELETED,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: customer._id,
      performedBy: actor._id,
      previousValue: { name: customer.name, email: customer.email },
    }, session);
    await customer.deleteOne({ session });
    return { id: customer._id };
  });
}
