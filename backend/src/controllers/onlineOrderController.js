import * as onlineOrderService from '../services/onlineOrderService.js';

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      platform: req.query.platform,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const orders = await onlineOrderService.getAll(filters);
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const order = await onlineOrderService.getById(req.params.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const order = await onlineOrderService.create(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const order = await onlineOrderService.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const order = await onlineOrderService.updateStatus(req.params.id, req.body.status);
    res.json(order);
  } catch (error) {
    next(error);
  }
};
