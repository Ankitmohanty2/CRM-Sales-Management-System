import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as userService from '../services/user.service.js';

export const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user);
  return sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: user });
});

export const listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query);
  return sendSuccess(res, { message: 'Users fetched successfully', data: result.records, meta: result.meta });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  return sendSuccess(res, { message: 'User fetched successfully', data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: 'User updated successfully', data: user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.isActive, req.user);
  return sendSuccess(res, { message: 'User status updated successfully', data: user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.deleteUser(req.params.id, req.user);
  return sendSuccess(res, { message: 'User deactivated successfully', data: user });
});
