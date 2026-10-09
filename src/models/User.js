import mongoose from 'mongoose';
import { ROLE_VALUES, ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, default: undefined },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, required: true },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1, team: 1 });

userSchema.pre('validate', function requireTeam() {
  if (this.role === ROLES.ADMIN) {
    this.team = null;
    return;
  }
  if (this.role === ROLES.SALES_MANAGER && !this.team) {
    this.invalidate('team', 'Sales managers must belong to a team');
  }
});

function hidePassword(_doc, ret) {
  delete ret.password;
  return ret;
}

userSchema.set('toJSON', { transform: hidePassword });
userSchema.set('toObject', { transform: hidePassword });

export const User = mongoose.model('User', userSchema);
