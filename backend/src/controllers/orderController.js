import * as orderService from '../services/orderService.js';

export const create = async (req, res, next) => {
  try {
    const { sessionId, tableId, items, generateKot } = req.body;
    const captainId = req.user.id;
    const result = await orderService.create({ sessionId, tableId, items, generateKot }, captainId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const createTakeAway = async (req, res, next) => {
  try {
    const { orderSource, items, generateKot, customerNotes } = req.body;
    const captainId = req.user.id;
    const result = await orderService.createTakeAwayOrder({
      orderSource,
      items,
      generateKot: !!generateKot,
      customerNotes,
      captainId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      sessionId: req.query.sessionId,
      tableId: req.query.tableId,
      status: req.query.status,
      orderSource: req.query.orderSource,
    };
    const result = await orderService.getAll(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const result = await orderService.getById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const addItems = async (req, res, next) => {
  try {
    const { items, generateKot } = req.body;
    const captainId = req.user.id;
    const result = await orderService.addItems(req.params.id, items, generateKot, captainId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const result = await orderService.cancel(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const sendKotOrder = async (req, res, next) => {
  try {
    const { sessionId, tableId, items } = req.body;
    const captainId = req.user.id;
    const result = await orderService.sendKotOrder({ sessionId, tableId, items }, captainId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
