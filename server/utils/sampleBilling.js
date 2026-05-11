/**
 * Detects sample-style billing for employee-only per-order price overrides (catalog unchanged).
 */

const SAMPLE_RE =
  /sample|specimen|cytolog|smear|عين|عيّنة|عينة|عينات|عيّنات/i;

function looksLikeSample(str) {
  return SAMPLE_RE.test(String(str || '').trim());
}

function tierHasSamples(tier) {
  const n = Number(tier?.packageSamples);
  return Number.isFinite(n) && n > 0;
}

function testHasSampleTier(test) {
  return Array.isArray(test?.pricingTiers) && test.pricingTiers.some((t) => tierHasSamples(t));
}

function testHasSampleComponents(test) {
  if (!Array.isArray(test?.pricingComponents) || !test.pricingComponents.length) return false;
  return test.pricingComponents.some(
    (c) => looksLikeSample(c.billUnitLabel) || looksLikeSample(c.label)
  );
}

/** Simple (per–unitLabel) pricing where the unit is sample-like. */
function simpleUnitLooksLikeSamples(test) {
  if (!test || test.pricingTiers?.length || test.pricingComponents?.length) return false;
  return looksLikeSample(test.unitLabel);
}

module.exports = {
  looksLikeSample,
  tierHasSamples,
  testHasSampleTier,
  testHasSampleComponents,
  simpleUnitLooksLikeSamples,
};
