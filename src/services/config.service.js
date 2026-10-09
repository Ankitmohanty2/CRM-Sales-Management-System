import { CONFIG_KEY, CrmConfig } from '../models/CrmConfig.js';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../constants/auditActions.js';
import { writeAudit } from './audit.service.js';
import { withTransaction } from '../utils/transaction.js';

export async function getConfig(session) {
  const existing = await CrmConfig.findOne({ key: CONFIG_KEY }).session(session || null);
  if (existing) {
    return existing;
  }
  const [created] = await CrmConfig.create([{ key: CONFIG_KEY }], { session });
  return created;
}

export async function updateConfig(input, actor) {
  return withTransaction(async (session) => {
    const current = await getConfig(session);
    const previous = {
      companyName: current.companyName,
      defaultLeadSource: current.defaultLeadSource,
      defaultLeadPriority: current.defaultLeadPriority,
      defaultDealStage: current.defaultDealStage,
      defaultDealProbability: current.defaultDealProbability,
    };
    current.set(input);
    await current.save({ session });
    await writeAudit({
      action: AUDIT_ACTIONS.CONFIG_UPDATED,
      entityType: ENTITY_TYPES.CONFIG,
      entityId: current._id,
      performedBy: actor._id,
      previousValue: previous,
      newValue: input,
    }, session);
    return current;
  });
}
