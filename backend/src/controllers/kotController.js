import * as kotService from '../services/kotService.js';

export const create = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const captainId = req.user.id;
    const result = await kotService.create(orderId, captainId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const result = await kotService.getAll(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const result = await kotService.getById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await kotService.updateStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateItemStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await kotService.updateItemStatus(req.params.itemId, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const editItemQuantity = async (req, res, next) => {
  try {
    const { quantity, reason } = req.body;
    const result = await kotService.editItemQuantity(req.params.itemId, quantity, reason, req.user.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const cancelItem = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await kotService.cancelItem(req.params.itemId, reason, req.user.id);
    res.json(result);
  } catch (error) { next(error); }
};

