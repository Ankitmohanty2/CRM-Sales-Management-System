import mongoose from 'mongoose';
import { LEAD_PRIORITIES, LEAD_SOURCES } from '../constants/leadStatus.js';
import { OPEN_DEAL_STAGES } from '../constants/dealStage.js';

const crmConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    companyName: { type: String, required: true, trim: true, maxlength: 150, default: 'CRM Sales' },
    defaultLeadSource: { type: String, enum: LEAD_SOURCES, default: 'Website' },
    defaultLeadPriority: { type: String, enum: LEAD_PRIORITIES, default: 'Medium' },
    defaultDealStage: { type: String, enum: OPEN_DEAL_STAGES, default: 'Qualification' },
    defaultDealProbability: { type: Number, min: 0, max: 100, default: 20 },
  },
  { timestamps: true },
);

export const CrmConfig = mongoose.model('CrmConfig', crmConfigSchema);

export const CONFIG_KEY = 'default';
