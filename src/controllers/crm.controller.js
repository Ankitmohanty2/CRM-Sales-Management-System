import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as leadService from '../services/lead.service.js';
import * as customerService from '../services/customer.service.js';
import * as dealService from '../services/deal.service.js';
import * as activityService from '../services/activity.service.js';
import * as timelineService from '../services/timeline.service.js';
import * as analyticsService from '../services/analytics.service.js';
import * as configService from '../services/config.service.js';

function listResponse(res, message, result) {
  return sendSuccess(res, { message, data: result.records, meta: result.meta });
}

export const createLead = asyncHandler(async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user);
  return sendSuccess(res, { statusCode: 201, message: 'Lead created successfully', data: lead });
});
export const listLeads = asyncHandler(async (req, res) => listResponse(res, 'Leads fetched successfully', await leadService.listLeads(req.query, req.user)));
export const getLead = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Lead fetched successfully', data: await leadService.getLead(req.params.id, req.user) }));
export const updateLead = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Lead updated successfully', data: await leadService.updateLead(req.params.id, req.body, req.user) }));
export const updateLeadStatus = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Lead status updated successfully', data: await leadService.updateLeadStatus(req.params.id, req.body.status, req.user) }));
export const assignLead = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Lead assigned successfully', data: await leadService.assignLead(req.params.id, req.body, req.user) }));
export const deleteLead = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Lead deleted successfully', data: await leadService.deleteLead(req.params.id, req.user) }));
export const convertLead = asyncHandler(async (req, res) => sendSuccess(res, { statusCode: 201, message: 'Lead converted successfully', data: await leadService.convertLead(req.params.id, req.body, req.user) }));

export const createCustomer = asyncHandler(async (req, res) => sendSuccess(res, { statusCode: 201, message: 'Customer created successfully', data: await customerService.createCustomer(req.body, req.user) }));
export const listCustomers = asyncHandler(async (req, res) => listResponse(res, 'Customers fetched successfully', await customerService.listCustomers(req.query, req.user)));
export const getCustomer = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Customer fetched successfully', data: await customerService.getCustomer(req.params.id, req.user) }));
export const updateCustomer = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Customer updated successfully', data: await customerService.updateCustomer(req.params.id, req.body, req.user) }));
export const deleteCustomer = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Customer deleted successfully', data: await customerService.deleteCustomer(req.params.id, req.user) }));

export const createDeal = asyncHandler(async (req, res) => sendSuccess(res, { statusCode: 201, message: 'Deal created successfully', data: await dealService.createDeal(req.body, req.user) }));
export const listDeals = asyncHandler(async (req, res) => listResponse(res, 'Deals fetched successfully', await dealService.listDeals(req.query, req.user)));
export const getDeal = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal fetched successfully', data: await dealService.getDeal(req.params.id, req.user) }));
export const updateDeal = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal updated successfully', data: await dealService.updateDeal(req.params.id, req.body, req.user) }));
export const updateDealStage = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal stage updated successfully', data: await dealService.updateDealStage(req.params.id, req.body, req.user) }));
export const assignDeal = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal assigned successfully', data: await dealService.assignDeal(req.params.id, req.body, req.user) }));
export const reopenDeal = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal reopened successfully', data: await dealService.reopenDeal(req.params.id, req.body, req.user) }));
export const deleteDeal = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Deal deleted successfully', data: await dealService.deleteDeal(req.params.id, req.user) }));

export const createActivity = asyncHandler(async (req, res) => sendSuccess(res, { statusCode: 201, message: 'Activity created successfully', data: await activityService.createActivity(req.body, req.user) }));
export const listActivities = asyncHandler(async (req, res) => listResponse(res, 'Activities fetched successfully', await activityService.listActivities(req.query, req.user)));
export const getActivity = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Activity fetched successfully', data: await activityService.getActivity(req.params.id, req.user) }));
export const updateActivity = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Activity updated successfully', data: await activityService.updateActivity(req.params.id, req.body, req.user) }));
export const completeActivity = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Activity completed successfully', data: await activityService.completeActivity(req.params.id, req.user) }));
export const deleteActivity = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Activity deleted successfully', data: await activityService.deleteActivity(req.params.id, req.user) }));

export const leadTimeline = asyncHandler(async (req, res) => listResponse(res, 'Lead timeline fetched successfully', await timelineService.leadTimeline(req.params.id, req.query, req.user)));
export const customerTimeline = asyncHandler(async (req, res) => listResponse(res, 'Customer timeline fetched successfully', await timelineService.customerTimeline(req.params.id, req.query, req.user)));
export const dealTimeline = asyncHandler(async (req, res) => listResponse(res, 'Deal timeline fetched successfully', await timelineService.dealTimeline(req.params.id, req.query, req.user)));

export const overview = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Overview fetched successfully', data: await analyticsService.overview(req.query, req.user) }));
export const pipeline = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Pipeline fetched successfully', data: await analyticsService.pipeline(req.query, req.user) }));
export const teamPerformance = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Team performance fetched successfully', data: await analyticsService.teamPerformance(req.query, req.user) }));

export const getConfig = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Configuration fetched successfully', data: await configService.getConfig() }));
export const updateConfig = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Configuration updated successfully', data: await configService.updateConfig(req.body, req.user) }));
