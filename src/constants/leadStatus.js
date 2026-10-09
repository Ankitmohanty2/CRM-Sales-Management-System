export const LEAD_SOURCES = Object.freeze([
  'Website',
  'Referral',
  'Social Media',
  'Email',
  'Phone',
  'Other',
]);

export const LEAD_STATUSES = Object.freeze([
  'New',
  'Contacted',
  'Qualified',
  'Unqualified',
  'Converted',
  'Lost',
]);

export const LEAD_PRIORITIES = Object.freeze(['Low', 'Medium', 'High']);

export const TERMINAL_LEAD_STATUSES = Object.freeze(['Converted', 'Unqualified', 'Lost']);

const TRANSITIONS = Object.freeze({
  New: ['Contacted'],
  Contacted: ['Qualified', 'Unqualified', 'Lost'],
  Qualified: ['Lost'],
  Unqualified: [],
  Converted: [],
  Lost: [],
});

export function canTransitionLeadStatus(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
