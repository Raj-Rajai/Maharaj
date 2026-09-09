import * as userService from '../services/userService.js';

export const getAll = async (req, res, next) => {
  try {
    const result = await userService.getAll();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await userService.getById(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const result = await userService.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await userService.update(id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const result = await userService.updateStatus(id, active);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updatePermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    await userService.updatePermissions(id, permissions);
    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.getById(id);
    res.json(user.permissions || []);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await userService.remove(id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
