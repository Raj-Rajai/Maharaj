import * as reportService from '../services/reportService.js';
import { reportCache } from '../utils/cache.js';

export const getDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `dashboard:${startDate}:${endDate}`;
    const cached = reportCache.get(cacheKey);
    if (cached) return res.json(cached);

    const metrics = await reportService.getUnifiedDashboardMetrics(startDate, endDate);
    reportCache.set(cacheKey, metrics);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

export const getSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `sales:${startDate}:${endDate}`;
    const cached = reportCache.get(cacheKey);
    if (cached) return res.json(cached);

    const result = await reportService.salesSummary(startDate, endDate);
    reportCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPaymentBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `payments:${startDate}:${endDate}`;
    const cached = reportCache.get(cacheKey);
    if (cached) return res.json(cached);

    const result = await reportService.paymentBreakdown(startDate, endDate);
    reportCache.set(cacheKey, result);
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
