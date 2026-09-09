import * as purchaseService from '../services/purchaseService.js';

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      supplierId: req.query.supplierId,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const purchases = await purchaseService.getAll(filters);
    res.json(purchases);
  } catch (error) { next(error); }
};

export const getById = async (req, res, next) => {
  try {
    const purchase = await purchaseService.getById(req.params.id);
    res.json(purchase);
  } catch (error) { next(error); }
};

export const create = async (req, res, next) => {
  try {
    const purchase = await purchaseService.create(req.body, req.user.id);
    res.status(201).json(purchase);
  } catch (error) { next(error); }
};

export const update = async (req, res, next) => {
  try {
    const purchase = await purchaseService.update(req.params.id, req.body, req.user.id);
    res.json(purchase);
  } catch (error) { next(error); }
};

export const cancel = async (req, res, next) => {
  try {
    const purchase = await purchaseService.cancel(req.params.id, req.user.id);
    res.json(purchase);
  } catch (error) { next(error); }
};
