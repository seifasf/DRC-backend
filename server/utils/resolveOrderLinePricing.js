/**
 * Computes quantity, unitPrice, subtotal and audit payload for an order line.
 * @param {import('mongoose').Document} test - Test document
 * @param {{ quantity?: number, pricingTierCode?: string, componentQuantities?: Record<string, number> }} line
 * @param {{ relaxSampleOverrideRules?: boolean }} [options] When true (manager), allow per-order price overrides on any tier/component/simple line.
 */
const { looksLikeSample, simpleUnitLooksLikeSamples } = require('./sampleBilling');
function resolveOrderLinePricing(test, line, options = {}) {
  const relax = options.relaxSampleOverrideRules === true;
  const tiers = test.pricingTiers?.length ? test.pricingTiers : [];
  const comps = test.pricingComponents?.length ? test.pricingComponents : [];

  if (tiers.length) {
    const code = line.pricingTierCode;
    if (!code || typeof code !== 'string') {
      const err = new Error('pricingTierCode is required for this test (tiered pricing).');
      err.status = 400;
      throw err;
    }
    const tier = tiers.find((t) => t.code === code);
    if (!tier) {
      const err = new Error(`Invalid pricingTierCode "${code}" for test "${test.name}".`);
      err.status = 400;
      throw err;
    }
    const qty = Number(line.quantity);
    if (Number.isNaN(qty) || qty < 1) {
      const err = new Error('quantity must be at least 1 (number of tier packages).');
      err.status = 400;
      throw err;
    }
    let unitPrice = tier.price;
    const rawOverride = line.tierPriceOverride;
    if (rawOverride != null && rawOverride !== '') {
      const o = Number(rawOverride);
      if (!Number.isFinite(o) || o < 0) {
        const err = new Error('tierPriceOverride must be a non-negative number when provided.');
        err.status = 400;
        throw err;
      }
      const samples = Number(tier.packageSamples);
      if (!relax && (!Number.isFinite(samples) || samples <= 0)) {
        const err = new Error('Custom package price is only allowed for tiers that define samples per package.');
        err.status = 400;
        throw err;
      }
      unitPrice = o;
    }
    const subtotal = qty * unitPrice;
    return {
      quantity: qty,
      unitPrice,
      subtotal,
      pricingBreakdown: {
        mode: 'tier',
        tierCode: tier.code,
        tierLabel: tier.label,
        cycles: tier.cycles,
        packageSamples: tier.packageSamples,
        pricePerPackage: unitPrice,
        catalogPricePerPackage:
          rawOverride != null && rawOverride !== '' && unitPrice !== tier.price ? tier.price : undefined,
        currency: tier.currency || 'LE',
      },
    };
  }

  if (comps.length) {
    const cq = line.componentQuantities;
    if (!cq || typeof cq !== 'object' || Array.isArray(cq)) {
      const err = new Error('componentQuantities object is required for this test (multi-component pricing).');
      err.status = 400;
      throw err;
    }

    const breakdown = {};
    let subtotal = 0;
    let countedUnits = 0;

    for (const c of comps) {
      const n = Number(cq[c.code]);
      const count = Number.isNaN(n) ? 0 : n;
      if (count < 0) {
        const err = new Error(`Invalid quantity for component "${c.code}".`);
        err.status = 400;
        throw err;
      }
      const rawOverride =
        line.componentUnitPrices && typeof line.componentUnitPrices === 'object'
          ? line.componentUnitPrices[c.code]
          : undefined;
      const hasOverride =
        rawOverride != null &&
        rawOverride !== '' &&
        Number.isFinite(Number(rawOverride));
      if (hasOverride) {
        if (!relax && !looksLikeSample(c.billUnitLabel) && !looksLikeSample(c.label)) {
          const err = new Error(
            `Custom unit price is only allowed for sample components ("${c.code}").`
          );
          err.status = 400;
          throw err;
        }
      }
      const pricePerUnit = hasOverride ? Math.max(0, Number(rawOverride)) : c.pricePerUnit;
      breakdown[c.code] = {
        label: c.label,
        quantity: count,
        pricePerUnit,
        billUnitLabel: c.billUnitLabel || 'unit',
        lineTotal: count * pricePerUnit,
      };
      if (hasOverride && pricePerUnit !== c.pricePerUnit) {
        breakdown[c.code].catalogPricePerUnit = c.pricePerUnit;
      }
      subtotal += count * pricePerUnit;
      countedUnits += count;
    }

    if (subtotal <= 0) {
      const err = new Error('At least one component quantity must be greater than zero.');
      err.status = 400;
      throw err;
    }

    const qty =
      line.quantity != null && Number(line.quantity) >= 1
        ? Number(line.quantity)
        : countedUnits > 0
          ? countedUnits
          : 1;
    const unitPrice = subtotal / qty;

    return {
      quantity: qty,
      unitPrice,
      subtotal,
      pricingBreakdown: {
        mode: 'components',
        components: breakdown,
        currency: 'LE',
      },
    };
  }

  const qty = Number(line.quantity);
  if (Number.isNaN(qty) || qty < 1) {
    const err = new Error('quantity must be at least 1.');
    err.status = 400;
    throw err;
  }
  let unitPrice = test.pricePerUnit;
  const rawSimple = line.simpleUnitPriceOverride;
  if (rawSimple != null && rawSimple !== '') {
    const o = Number(rawSimple);
    if (!Number.isFinite(o) || o < 0) {
      const err = new Error('simpleUnitPriceOverride must be a non-negative number when provided.');
      err.status = 400;
      throw err;
    }
    if (!relax && !simpleUnitLooksLikeSamples(test)) {
      const err = new Error('Custom unit price is only allowed when the test bills by sample-like units.');
      err.status = 400;
      throw err;
    }
    unitPrice = o;
  }
  if (!(unitPrice > 0)) {
    const err = new Error(
      'Resolved unit price must be greater than zero. Use tier/component pricing or set a price (admin).'
    );
    err.status = 400;
    throw err;
  }
  const subtotal = qty * unitPrice;
  return {
    quantity: qty,
    unitPrice,
    subtotal,
    pricingBreakdown: {
      mode: 'simple',
      currency: 'LE',
      ...(rawSimple != null && rawSimple !== '' && Number(unitPrice) !== Number(test.pricePerUnit)
        ? { catalogPricePerUnit: test.pricePerUnit }
        : {}),
    },
  };
}

module.exports = resolveOrderLinePricing;
