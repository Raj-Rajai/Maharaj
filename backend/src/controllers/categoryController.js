import * as categoryService from '../services/categoryService.js';

export const getAll = async (req, res, next) => {
  try {
    const categories = await categoryService.getAll();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const category = await categoryService.getById(req.params.id);
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const category = await categoryService.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const category = await categoryService.update(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    await categoryService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
