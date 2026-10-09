import mongoose from 'mongoose';
import { CUSTOMER_STATUSES } from '../constants/activityStatus.js';

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, maxlength: 200, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    postalCode: { type: String, trim: true, maxlength: 20, default: '' },
    country: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    originalLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'Active', required: true },
  },
  { timestamps: true },
);

customerSchema.index({ originalLead: 1 }, { unique: true, sparse: true });
customerSchema.index({ team: 1, assignedTo: 1, createdAt: -1 });
customerSchema.index({ email: 1 });
customerSchema.index({ status: 1, createdAt: -1 });

export const Customer = mongoose.model('Customer', customerSchema);
