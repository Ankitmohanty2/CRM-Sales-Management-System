export function calculateExpectedRevenue(value, probability) {
  return Math.round(Number(value) * Number(probability)) / 100;
}
