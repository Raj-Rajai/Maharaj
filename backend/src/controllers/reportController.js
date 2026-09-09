import * as reportService from '../services/reportService.js';

export const getDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // Run sequentially to avoid connection pool exhaustion on remote Supabase
    const sales = await reportService.salesSummary(startDate, endDate);
    const orders = await reportService.orderSummary(startDate, endDate);
    const payments = await reportService.paymentBreakdown(startDate, endDate);
    const onlineOrders = await reportService.onlineOrderSummary(startDate, endDate);
    const purchases = await reportService.purchaseSummary(startDate, endDate).catch(() => ({ totalPurchaseAmount: 0, bySupplier: {} }));
    const tables = await reportService.tableSummary(startDate, endDate).catch(() => []);
    res.json({ sales, orders, payments, onlineOrders, purchases, tables });
  } catch (error) {
    next(error);
  }
};

export const getSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.salesSummary(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOrderSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.orderSummary(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPaymentBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.paymentBreakdown(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getTableSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.tableSummary(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOnlineOrderSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.onlineOrderSummary(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.purchaseSummary(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getInventoryStatus = async (req, res, next) => {
  try {
    const result = await reportService.inventoryStatus();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
