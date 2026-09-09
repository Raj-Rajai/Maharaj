import * as tableService from '../services/tableService.js';

export const getAll = async (req, res, next) => {
  try {
    const tables = await tableService.getAll();
    res.json(tables);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const table = await tableService.getById(req.params.id);
    res.json(table);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const result = await tableService.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const result = await tableService.update(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const table = await tableService.updateStatus(req.params.id, req.body.status);
    res.json(table);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    await tableService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await tableService.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
