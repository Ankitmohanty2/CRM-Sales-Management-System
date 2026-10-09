import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/token.js';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const options = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: options.path,
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
  });
}

function presentSession(session) {
  const user = typeof session.user.toJSON === 'function' ? session.user.toJSON() : session.user;
  return { user, accessToken: session.accessToken };
}

export const register = asyncHandler(async (req, res) => {
  const session = await authService.register(req.body);
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: presentSession(session),
  });
});

export const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, { message: 'Login successful', data: presentSession(session) });
});

export const refresh = asyncHandler(async (req, res) => {
  const session = await authService.refresh(authService.readRefreshCookie(req));
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, { message: 'Token refreshed successfully', data: presentSession(session) });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(authService.readRefreshCookie(req));
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'All sessions revoked successfully' });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: 'Profile fetched successfully', data: req.user.toJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Password updated successfully' });
});
