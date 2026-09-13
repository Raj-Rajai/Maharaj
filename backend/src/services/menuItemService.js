import prisma from '../utils/prisma.js';
import { menuCache, categoryCache, invalidateMenuCaches } from '../utils/cache.js';

export const getAll = async (filters = {}) => {
  const cacheKey = filters.menuType || 'ALL';
  const isCacheable = !filters.categoryId && (filters.active === undefined || filters.active === true);
  
  if (isCacheable) {
    const cached = menuCache.get(cacheKey);
    if (cached) return cached;
  }

  const where = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.menuType) where.menuType = filters.menuType;
  if (filters.active !== undefined) where.active = filters.active;
  else where.active = true;

  const results = await prisma.menuItem.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }]
  });

  if (isCacheable) {
    menuCache.set(cacheKey, results);
  }
  return results;
};

export const getById = async (id) => {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { category: true }
  });
  if (!item) throw { status: 404, message: 'Menu item not found' };
  return item;
};

export const create = async (data) => {
  if (!data.menuType) throw { status: 400, message: 'Menu type is required' };
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || !category.active) throw { status: 400, message: 'Invalid or inactive category' };
  const created = await prisma.menuItem.create({ data });
  invalidateMenuCaches();
  return created;
};

export const update = async (id, data) => {
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw { status: 400, message: 'Invalid category' };
  }
  const updated = await prisma.menuItem.update({ where: { id }, data });
  invalidateMenuCaches();
  return updated;
};

export const updateAvailability = async (id, active) => {
  const updated = await prisma.menuItem.update({ where: { id }, data: { active } });
  invalidateMenuCaches();
  return updated;
};

export const softDelete = async (id) => {
  const deleted = await prisma.menuItem.update({ where: { id }, data: { active: false } });
  invalidateMenuCaches();
  return deleted;
};

export const bulkAdd = async (data) => {
  const { name, categoryId, description, items } = data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error('Category not found');

  const results = await prisma.$transaction(async (tx) => {
    const menuTypes = items.map(i => i.menuType);
    const existingItems = await tx.menuItem.findMany({
      where: { name, categoryId, menuType: { in: menuTypes } }
    });
    
    const existingMap = new Map(existingItems.map(i => [i.menuType, i]));
    const res = [];
    
    for (const item of items) {
      if (existingMap.has(item.menuType)) {
        res.push({
          menuType: item.menuType,
          status: 'EXISTS',
          item: existingMap.get(item.menuType)
        });
      } else {
        const created = await tx.menuItem.create({
          data: {
            name,
            categoryId,
            menuType: item.menuType,
            price: item.price,
            description: description || null
          },
          include: { category: true }
        });
        res.push({
          menuType: item.menuType,
          status: 'CREATED',
          item: created
        });
      }
    }
    
    return res;
  });

  invalidateMenuCaches();
  return results;
};

export const bulkUpdate = async (data) => {
  const { name, categoryId, items } = data;

  const results = await prisma.$transaction(async (tx) => {
    const menuTypes = items.map(i => i.menuType);
    const existingItems = await tx.menuItem.findMany({
      where: { name, categoryId, menuType: { in: menuTypes } }
    });
    
    const existingMap = new Map(existingItems.map(i => [i.menuType, i]));
    const res = [];
    
    for (const item of items) {
      if (existingMap.has(item.menuType)) {
        const updated = await tx.menuItem.update({
          where: { id: existingMap.get(item.menuType).id },
          data: { price: item.price },
          include: { category: true }
        });
        res.push({ menuType: item.menuType, status: 'UPDATED', item: updated });
      } else {
        res.push({ menuType: item.menuType, status: 'NOT_FOUND' });
      }
    }
    
    return res;
  });

  invalidateMenuCaches();
  return results;
};
