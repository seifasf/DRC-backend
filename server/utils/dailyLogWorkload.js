/**
 * How progress is logged for an order line depends on pricing snapshot:
 * - Tier + cycles/samples: body `unitsCompleted` is workload (cycles/samples); stored line progress stays as fractional packages.
 * - Otherwise: `unitsCompleted` is whole line units (packages or simple qty).
 */

const EPS = 1e-9;

function dailyLogWorkloadMeta(orderItem) {
  const bd = orderItem.pricingBreakdown;
  if (bd && bd.mode === 'tier') {
    const cycles = Number(bd.cycles);
    if (Number.isFinite(cycles) && cycles > 0) {
      return { kind: 'cycles', perPackage: cycles };
    }
    const samples = Number(bd.packageSamples);
    if (Number.isFinite(samples) && samples > 0) {
      return { kind: 'samples', perPackage: samples };
    }
  }
  return { kind: 'line' };
}

function roundPkgProgress(x) {
  return Math.round(Number(x) * 1e12) / 1e12;
}

/**
 * @returns {{ deltaPkgs: number, err?: { status: number, message: string } }}
 */
function computeDeltaPackages(orderItem, unitsCompleted) {
  const meta = dailyLogWorkloadMeta(orderItem);
  const qty = Number(orderItem.quantity);
  const donePkgs = Number(orderItem.completedUnits || 0);
  const u = Number(unitsCompleted);

  if (!Number.isFinite(u) || u < 0) {
    return { deltaPkgs: 0, err: { status: 400, message: 'unitsCompleted must be a non-negative number.' } };
  }
  if (u <= 0) {
    return { deltaPkgs: 0, err: { status: 400, message: 'unitsCompleted must be greater than zero.' } };
  }

  if (meta.kind === 'cycles' || meta.kind === 'samples') {
    const cpp = meta.perPackage;
    const remainingWorkload = qty * cpp - donePkgs * cpp;
    if (u > remainingWorkload + EPS) {
      const label = meta.kind === 'cycles' ? 'cycles' : 'samples';
      const cap =
        Math.round(remainingWorkload * 1e6) % 1000000 === 0
          ? String(Math.round(remainingWorkload))
          : remainingWorkload.toFixed(4).replace(/\.?0+$/, '');
      return {
        deltaPkgs: 0,
        err: {
          status: 400,
          message: `You can log at most ${cap} ${label} remaining on this task.`,
        },
      };
    }
    return { deltaPkgs: u / cpp };
  }

  if (!Number.isInteger(u)) {
    return {
      deltaPkgs: 0,
      err: { status: 400, message: 'unitsCompleted must be a whole number for this line.' },
    };
  }
  const remainingLines = Math.max(0, qty - donePkgs);
  if (u > remainingLines + EPS) {
    return {
      deltaPkgs: 0,
      err: {
        status: 400,
        message: `You can log at most ${remainingLines} unit(s) on this line.`,
      },
    };
  }
  return { deltaPkgs: u };
}

module.exports = {
  dailyLogWorkloadMeta,
  roundPkgProgress,
  computeDeltaPackages,
  EPS,
};
