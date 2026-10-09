import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, unique: true },
  },
  { timestamps: true },
);

export const Team = mongoose.model('Team', teamSchema);
