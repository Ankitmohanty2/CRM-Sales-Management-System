import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  REFRESH_COOKIE_NAME,
  generateRefreshToken,
  hashToken,
  newFamilyId,
  refreshMaxAgeMs,
  signAccessToken,
} from '../utils/token.js';
import { withTransaction } from '../utils/transaction.js';

async function persistRefreshToken({ userId, familyId, session }) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + refreshMaxAgeMs());
  await RefreshToken.create([{
    user: userId,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt,
  }], { session });
  return refreshToken;
}

export async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = await persistRefreshToken({
    userId: user._id,
    familyId: newFamilyId(),
  });
  return { accessToken, refreshToken, user };
}

export async function register(input) {
  if (!env.ALLOW_PUBLIC_REGISTRATION) {
    throw new ApiError(403, 'Public registration is disabled');
  }

  const password = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      password,
      role: ROLES.SALES_EXECUTIVE,
      isActive: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'Duplicate value for email');
    }
    throw error;
  }

  const session = await issueSession(user);
  return session;
}

let dummyPasswordHash;

async function passwordMatches(user, password) {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await bcrypt.hash('invalid-credential', env.BCRYPT_ROUNDS);
  }
  const matches = await bcrypt.compare(password, user?.password || dummyPasswordHash);
  return Boolean(user) && matches;
}

export async function login(input) {
  const user = await User.findOne({ email: input.email }).select('+password');
  const matches = await passwordMatches(user, input.password);
  if (!user || !matches) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Account is inactive');
  }
  return issueSession(user);
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token required');
  }

  const tokenHash = hashToken(refreshToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (existing.revokedAt) {
    await RefreshToken.updateMany(
      { familyId: existing.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new ApiError(401, 'Refresh token reuse detected');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, 'Refresh token expired');
  }

  const user = await User.findById(existing.user);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Authentication required');
  }

  return withTransaction(async (session) => {
    const current = await RefreshToken.findOne({ _id: existing._id, revokedAt: null }).session(session);
    if (!current) {
      await RefreshToken.updateMany(
        { familyId: existing.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session },
      );
      throw new ApiError(401, 'Refresh token reuse detected');
    }

    const nextRefreshToken = generateRefreshToken();
    const nextHash = hashToken(nextRefreshToken);
    current.revokedAt = new Date();
    current.replacedByHash = nextHash;
    await current.save({ session });
    await RefreshToken.create([{
      user: user._id,
      tokenHash: nextHash,
      familyId: current.familyId,
      expiresAt: new Date(Date.now() + refreshMaxAgeMs()),
    }], { session });

    return {
      accessToken: signAccessToken(user),
      refreshToken: nextRefreshToken,
      user,
    };
  });
}

export async function logout(refreshToken) {
  if (!refreshToken) {
    return;
  }
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function logoutAll(userId, session) {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    session ? { session } : undefined,
  );
}

export async function changePassword(user, input) {
  const current = await User.findById(user._id).select('+password');
  if (!current || !current.isActive) {
    throw new ApiError(401, 'Authentication required');
  }
  const matches = await bcrypt.compare(input.currentPassword, current.password);
  if (!matches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const password = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
  return withTransaction(async (session) => {
    const fresh = await User.findById(user._id).session(session);
    if (!fresh || !fresh.isActive) {
      throw new ApiError(401, 'Authentication required');
    }
    fresh.password = password;
    await fresh.save({ session });
    await logoutAll(user._id, session);
    return fresh;
  });
}

export function readRefreshCookie(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME];
}
