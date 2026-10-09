import { ApiError } from '../utils/ApiError.js';

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
