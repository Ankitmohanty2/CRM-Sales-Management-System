let conversionGuard = async () => {};

export function setConversionGuard(guard) {
  conversionGuard = guard || (async () => {});
}

export async function runConversionGuard(session) {
  await conversionGuard(session);
}
