export const OPEN_DEAL_STAGES = Object.freeze([
  'Qualification',
  'Discovery',
  'Proposal',
  'Negotiation',
]);

export const CLOSED_DEAL_STAGES = Object.freeze(['Won', 'Lost']);

export const DEAL_STAGES = Object.freeze([...OPEN_DEAL_STAGES, ...CLOSED_DEAL_STAGES]);

export function isOpenDealStage(stage) {
  return OPEN_DEAL_STAGES.includes(stage);
}

export function isClosedDealStage(stage) {
  return CLOSED_DEAL_STAGES.includes(stage);
}

export function canTransitionDealStage(from, to) {
  if (from === to) {
    return false;
  }
  if (isClosedDealStage(from)) {
    return false;
  }
  return isOpenDealStage(from) && DEAL_STAGES.includes(to);
}
