import * as menuItemService from '../services/menuItemService.js';
import prisma from '../utils/prisma.js';

const checkUserPermission = async (userId, userRole, requiredPerm) => {
  if (userRole === 'SUPER_ADMIN') return true;
  const match = await prisma.userPermission.findFirst({
    where: { userId, permission: requiredPerm }
  });
  return !!match;
};

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      categoryId: req.query.categoryId,
      menuType: req.query.menuType,
      active: req.query.active !== undefined ? req.query.active === 'true' : undefined
    };
    const items = await menuItemService.getAll(filters);
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const item = await menuItemService.getById(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const reqPerm = `MENU_${req.body.menuType}_CREATE`;
    const allowed = await checkUserPermission(req.user.id, req.user.role, reqPerm);
    if (!allowed) {
      return res.status(403).json({ message: `Insufficient permissions: requires ${reqPerm}` });
    }
    const item = await menuItemService.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    const reqPerm = `MENU_${existing.menuType}_EDIT`;
    const allowed = await checkUserPermission(req.user.id, req.user.role, reqPerm);
    if (!allowed) {
      return res.status(403).json({ message: `Insufficient permissions: requires ${reqPerm}` });
    }
    const item = await menuItemService.update(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    const reqPerm = `MENU_${existing.menuType}_EDIT`;
    const allowed = await checkUserPermission(req.user.id, req.user.role, reqPerm);
    if (!allowed) {
      return res.status(403).json({ message: `Insufficient permissions: requires ${reqPerm}` });
    }
    const item = await menuItemService.updateAvailability(req.params.id, req.body.active);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    const reqPerm = `MENU_${existing.menuType}_DELETE`;
    const allowed = await checkUserPermission(req.user.id, req.user.role, reqPerm);
    if (!allowed) {
      return res.status(403).json({ message: `Insufficient permissions: requires ${reqPerm}` });
    }
    await menuItemService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const bulkAdd = async (req, res, next) => {
  try {
    const results = await menuItemService.bulkAdd(req.body);
    res.status(201).json(results);
  } catch (error) {
    next(error);
  }
};

export const bulkUpdate = async (req, res, next) => {
  try {
    const results = await menuItemService.bulkUpdate(req.body);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
