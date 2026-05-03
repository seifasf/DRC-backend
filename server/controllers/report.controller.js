const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');
const Payment = require('../models/Payment.model');
const Test = require('../models/Test.model');

function woCreatedAtRangeFilter(fromRaw, toRaw) {
  const range = {};
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (!Number.isNaN(d.getTime())) range.$lte = d;
  }
  return Object.keys(range).length ? { createdAt: range } : {};
}

/**
 * GET /reports/work-tracking
 * Admin dashboard: per-test volumes (ordered vs completed), revenue breakdown, cash collected.
 */
exports.workTracking = async (req, res) => {
  try {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const dateOnWorkOrder = woCreatedAtRangeFilter(from, to);

    const woCollection = WorkOrder.collection.name;
    const testsCollection = Test.collection.name;

    const woPreMatch = { status: { $ne: 'cancelled' }, ...dateOnWorkOrder };

    const byTest = await OrderItem.aggregate([
      {
        $lookup: {
          from: woCollection,
          localField: 'workOrderId',
          foreignField: '_id',
          as: 'wo',
        },
      },
      { $unwind: '$wo' },
      { $match: { 'wo.status': { $ne: 'cancelled' }, ...(Object.keys(dateOnWorkOrder).length ? { 'wo.createdAt': dateOnWorkOrder.createdAt } : {}) } },
      {
        $lookup: {
          from: testsCollection,
          localField: 'testId',
          foreignField: '_id',
          as: 'test',
        },
      },
      { $unwind: '$test' },
      {
        $group: {
          _id: '$testId',
          testName: { $first: '$test.name' },
          category: { $first: '$test.category' },
          unitLabel: { $first: '$test.unitLabel' },
          lineItemCount: { $sum: 1 },
          totalQuantityOrdered: { $sum: '$quantity' },
          totalUnitsCompleted: { $sum: '$completedUnits' },
          /** Revenue from this test across all matching order lines (catalog work only; excludes blocks). */
          revenueFromTestLines: { $sum: '$subtotal' },
        },
      },
      { $sort: { revenueFromTestLines: -1, testName: 1 } },
      {
        $project: {
          _id: 0,
          testId: '$_id',
          testName: 1,
          category: 1,
          unitLabel: 1,
          lineItemCount: 1,
          totalQuantityOrdered: 1,
          totalUnitsCompleted: 1,
          remainingUnits: { $subtract: ['$totalQuantityOrdered', '$totalUnitsCompleted'] },
          revenueFromTestLines: 1,
        },
      },
    ]);

    const [blocksRow] = await WorkOrder.aggregate([
      { $match: woPreMatch },
      { $unwind: { path: '$blockLines', preserveNullAndEmptyArrays: false } },
      { $group: { _id: null, blocksRevenue: { $sum: '$blockLines.subtotal' } } },
    ]);

    const [testsRevenueRow] = await OrderItem.aggregate([
      {
        $lookup: {
          from: woCollection,
          localField: 'workOrderId',
          foreignField: '_id',
          as: 'wo',
        },
      },
      { $unwind: '$wo' },
      { $match: { 'wo.status': { $ne: 'cancelled' }, ...(Object.keys(dateOnWorkOrder).length ? { 'wo.createdAt': dateOnWorkOrder.createdAt } : {}) } },
      { $group: { _id: null, testsRevenue: { $sum: '$subtotal' } } },
    ]);

    const [invoiceRow] = await WorkOrder.aggregate([
      { $match: woPreMatch },
      {
        $group: {
          _id: null,
          workOrderCount: { $sum: 1 },
          /** Sum of invoice totals (tests + blocks on each order). */
          totalInvoicedOnOrders: { $sum: '$totalAmount' },
          totalCollectedOnOrders: { $sum: '$amountPaid' },
        },
      },
    ]);

    const paymentMatch = {};
    if (Object.keys(dateOnWorkOrder).length) {
      paymentMatch.paidAt = dateOnWorkOrder.createdAt;
    }

    const [paymentsRow] = await Payment.aggregate([
      ...(Object.keys(paymentMatch).length ? [{ $match: paymentMatch }] : []),
      { $group: { _id: null, totalPaymentsRecorded: { $sum: '$amount' }, paymentCount: { $sum: 1 } } },
    ]);

    const [outstandingRow] = await WorkOrder.aggregate([
      { $match: { ...woPreMatch, paymentStatus: { $in: ['unpaid', 'partial'] } } },
      {
        $project: {
          owed: { $subtract: ['$totalAmount', '$amountPaid'] },
        },
      },
      { $group: { _id: null, outstandingBalance: { $sum: '$owed' } } },
    ]);

    const [linesRow] = await OrderItem.aggregate([
      {
        $lookup: {
          from: woCollection,
          localField: 'workOrderId',
          foreignField: '_id',
          as: 'wo',
        },
      },
      { $unwind: '$wo' },
      { $match: { 'wo.status': { $ne: 'cancelled' }, ...(Object.keys(dateOnWorkOrder).length ? { 'wo.createdAt': dateOnWorkOrder.createdAt } : {}) } },
      { $group: { _id: null, totalOrderLines: { $sum: 1 } } },
    ]);

    const testsRevenue = testsRevenueRow?.testsRevenue || 0;
    const blocksRevenue = blocksRow?.blocksRevenue || 0;

    const catalogTests = await Test.countDocuments({});

    const rollupAcrossTests = byTest.reduce(
      (acc, row) => ({
        lineItemCount: acc.lineItemCount + row.lineItemCount,
        totalQuantityOrdered: acc.totalQuantityOrdered + row.totalQuantityOrdered,
        totalUnitsCompleted: acc.totalUnitsCompleted + row.totalUnitsCompleted,
        revenueFromTestLines: acc.revenueFromTestLines + row.revenueFromTestLines,
      }),
      {
        lineItemCount: 0,
        totalQuantityOrdered: 0,
        totalUnitsCompleted: 0,
        revenueFromTestLines: 0,
      }
    );

    const invoiced = invoiceRow?.totalInvoicedOnOrders || 0;
    const testsPlusBlocks = testsRevenue + blocksRevenue;

    return res.json({
      success: true,
      data: {
        period: {
          from: from || null,
          to: to || null,
          /** Reporting window is based on work order createdAt. */
          field: 'workOrder.createdAt',
        },
        summary: {
          catalogTestTypes: catalogTests,
          testsWithRecordedWork: byTest.length,
          totalOrderLines: linesRow?.totalOrderLines || 0,
          workOrdersInScope: invoiceRow?.workOrderCount || 0,
          revenueFromCatalogTests: testsRevenue,
          revenueFromBlocks: blocksRevenue,
          /** Sum of line-item test revenue + block line snapshots (sanity check vs invoiced). */
          computedTestsPlusBlocks: testsPlusBlocks,
          invoicedTotalOnOrders: invoiced,
          /** Difference suggests rounding drift or legacy orders; normally near zero. */
          invoicedMinusComputed: invoiced - testsPlusBlocks,
          amountPaidFieldSumOnOrders: invoiceRow?.totalCollectedOnOrders || 0,
          totalPaymentsRecorded: paymentsRow?.totalPaymentsRecorded || 0,
          paymentTransactionsCount: paymentsRow?.paymentCount || 0,
          outstandingOnOpenBalances: outstandingRow?.outstandingBalance || 0,
          /** Aggregates across every row in byTest (ordered vs completed units use each test's unitLabel). */
          rollupAcrossTests,
        },
        /** One row per test type that appears on at least one order line in scope. */
        byTest,
        notes: [
          'totalQuantityOrdered / totalUnitsCompleted use each test catalog unitLabel (e.g. teeth, specimens, cycles).',
          'revenueFromTestLines is the sum of order line subtotals for that test (priced at order time).',
          'Block charges are summarized in summary.revenueFromBlocks; see each work order blockLines for detail.',
          'totalPaymentsRecorded sums Payment documents; amountPaidFieldSumOnOrders sums WorkOrder.amountPaid.',
        ],
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
