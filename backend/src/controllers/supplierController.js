import * as supplierService from '../services/supplierService.js';

export const getAll = async (req, res, next) => {
  try {
    const suppliers = await supplierService.getAll();
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const supplier = await supplierService.getById(req.params.id);
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const supplier = await supplierService.create(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const supplier = await supplierService.update(req.params.id, req.body);
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await supplierService.softDelete(req.params.id);
    res.json({ message: 'Supplier deactivated successfully' });
  } catch (error) {
    next(error);
  }
};
