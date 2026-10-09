import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/token.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'Invalid or expired access token');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'Authentication required');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
