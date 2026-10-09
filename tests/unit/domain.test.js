import { describe, expect, it } from 'vitest';
import { resolveActivityStatus } from '../../src/utils/activityStatus.js';
import { canTransitionDealStage } from '../../src/constants/dealStage.js';
import { canTransitionLeadStatus } from '../../src/constants/leadStatus.js';
import { paginationMeta } from '../../src/utils/pagination.js';
import { escapeRegex } from '../../src/utils/queryFilters.js';
import { calculateExpectedRevenue } from '../../src/utils/revenue.js';

describe('domain rules', () => {
  it('calculates expected revenue on the server formula', () => {
    expect(calculateExpectedRevenue(100000, 30)).toBe(30000);
    expect(calculateExpectedRevenue(10, 0)).toBe(0);
  });

  it('allows only the documented lead status graph', () => {
    expect(canTransitionLeadStatus('New', 'Contacted')).toBe(true);
    expect(canTransitionLeadStatus('Contacted', 'Qualified')).toBe(true);
    expect(canTransitionLeadStatus('Qualified', 'Lost')).toBe(true);
    expect(canTransitionLeadStatus('New', 'Qualified')).toBe(false);
    expect(canTransitionLeadStatus('Converted', 'Contacted')).toBe(false);
    expect(canTransitionLeadStatus('Lost', 'New')).toBe(false);
  });

  it('allows open deal stages to move and blocks reopening', () => {
    expect(canTransitionDealStage('Qualification', 'Negotiation')).toBe(true);
    expect(canTransitionDealStage('Proposal', 'Won')).toBe(true);
    expect(canTransitionDealStage('Won', 'Qualification')).toBe(false);
    expect(canTransitionDealStage('Lost', 'Discovery')).toBe(false);
    expect(canTransitionDealStage('Qualification', 'Qualification')).toBe(false);
  });

  it('derives overdue without rewriting completed activities', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(resolveActivityStatus({ status: 'Pending', dueDate: past })).toBe('Overdue');
    expect(resolveActivityStatus({ status: 'Pending', dueDate: future })).toBe('Pending');
    expect(resolveActivityStatus({ status: 'Pending', dueDate: null })).toBe('Pending');
    expect(resolveActivityStatus({ status: 'Completed', dueDate: past })).toBe('Completed');
  });

  it('escapes search input and returns empty pagination metadata', () => {
    expect(escapeRegex('a+b')).toBe('a\\+b');
    expect(paginationMeta(1, 10, 0)).toEqual({ page: 1, limit: 10, totalRecords: 0, totalPages: 0 });
    expect(paginationMeta(2, 10, 25)).toEqual({ page: 2, limit: 10, totalRecords: 25, totalPages: 3 });
  });
});
