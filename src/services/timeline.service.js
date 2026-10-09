import { AuditLog } from '../models/AuditLog.js';
import { buildSort, paginationMeta, skipFor } from '../utils/pagination.js';
import { getCustomer } from './customer.service.js';
import { getDeal } from './deal.service.js';
import { getLead } from './lead.service.js';

async function listForEntity(entityType, entityId, query) {
  const filter = { entityType, entityId };
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt'], 'createdAt');
  const skip = skipFor(query.page, query.limit);
  const [records, totalRecords] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(query.limit).populate('performedBy', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);
  return { records, meta: paginationMeta(query.page, query.limit, totalRecords) };
}

export async function leadTimeline(id, query, actor) {
  await getLead(id, actor);
  return listForEntity('Lead', id, query);
}

export async function customerTimeline(id, query, actor) {
  await getCustomer(id, actor);
  return listForEntity('Customer', id, query);
}

export async function dealTimeline(id, query, actor) {
  await getDeal(id, actor);
  return listForEntity('Deal', id, query);
}
