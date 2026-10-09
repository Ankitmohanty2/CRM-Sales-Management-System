import mongoose from 'mongoose';
import { ACTIVITY_TYPES, RELATED_ENTITY_TYPES, STORED_ACTIVITY_STATUSES } from '../constants/activityStatus.js';

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: STORED_ACTIVITY_STATUSES, default: 'Pending', required: true },
    relatedEntityType: { type: String, enum: RELATED_ENTITY_TYPES, required: true },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ team: 1, assignedTo: 1, status: 1, dueDate: 1 });
activitySchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
activitySchema.index({ dueDate: 1, status: 1 });
activitySchema.index({ createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
