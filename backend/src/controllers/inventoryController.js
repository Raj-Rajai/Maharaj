import * as inventoryService from '../services/inventoryService.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await inventoryService.getAll();
    res.json(items);
  } catch (error) { next(error); }
};

export const getById = async (req, res, next) => {
  try {
    const item = await inventoryService.getById(req.params.id);
    res.json(item);
  } catch (error) { next(error); }
};

export const create = async (req, res, next) => {
  try {
    const item = await inventoryService.create(req.body, req.user.id);
    res.status(201).json(item);
  } catch (error) { next(error); }
};

export const update = async (req, res, next) => {
  try {
    const item = await inventoryService.update(req.params.id, req.body, req.user.id);
    res.json(item);
  } catch (error) { next(error); }
};

export const adjustStock = async (req, res, next) => {
  try {
    const result = await inventoryService.adjust(req.body, req.user.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const remove = async (req, res, next) => {
  try {
    const result = await inventoryService.remove(req.params.id, req.user.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const getTransactions = async (req, res, next) => {
  try {
    const filters = {
      inventoryItemId: req.query.inventoryItemId,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const transactions = await inventoryService.getTransactions(filters);
    res.json(transactions);
  } catch (error) { next(error); }
};
