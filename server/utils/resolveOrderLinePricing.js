/**
 * Computes quantity, unitPrice, subtotal and audit payload for an order line.
 * @param {import('mongoose').Document} test - Test document
 * @param {{ quantity?: number, pricingTierCode?: string, componentQuantities?: Record<string, number> }} line
 */
function resolveOrderLinePricing(test, line) {
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
    const unitPrice = tier.price;
    const subtotal = qty * tier.price;
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
        pricePerPackage: tier.price,
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
      breakdown[c.code] = {
        label: c.label,
        quantity: count,
        pricePerUnit: c.pricePerUnit,
        billUnitLabel: c.billUnitLabel || 'unit',
        lineTotal: count * c.pricePerUnit,
      };
      subtotal += count * c.pricePerUnit;
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
  const unitPrice = test.pricePerUnit;
  if (!(unitPrice > 0)) {
    const err = new Error(
      'This test has no simple pricePerUnit yet. Use tier/component pricing or set a price (admin).'
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
    },
  };
}

module.exports = resolveOrderLinePricing;
