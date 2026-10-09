import mongoose from 'mongoose';
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES } from '../constants/leadStatus.js';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'New', required: true },
    priority: { type: String, enum: LEAD_PRIORITIES, default: 'Medium', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    convertedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  },
  { timestamps: true },
);

leadSchema.index({ team: 1, assignedTo: 1, createdAt: -1 });
leadSchema.index({ status: 1, priority: 1, source: 1, createdAt: -1 });
leadSchema.index({ email: 1 });
leadSchema.index({ createdAt: -1 });

export const Lead = mongoose.model('Lead', leadSchema);
