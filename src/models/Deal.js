import mongoose from 'mongoose';
import { DEAL_STAGES } from '../constants/dealStage.js';

const dealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    value: { type: Number, required: true, min: 0.01 },
    probability: { type: Number, required: true, min: 0, max: 100 },
    expectedRevenue: { type: Number, required: true, min: 0 },
    expectedClosingDate: { type: Date, required: true },
    stage: { type: String, enum: DEAL_STAGES, required: true },
    lostReason: { type: String, trim: true, maxlength: 1000, default: '' },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

dealSchema.index({ team: 1, assignedTo: 1, stage: 1, createdAt: -1 });
dealSchema.index({ expectedClosingDate: 1 });
dealSchema.index({ lead: 1 });
dealSchema.index({ value: 1 });
dealSchema.index({ createdAt: -1 });

export const Deal = mongoose.model('Deal', dealSchema);
