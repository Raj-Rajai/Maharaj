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
      where: { name, categoryId, menuType: { in: menuTypes } },
      include: { category: true }
    });
    
    const existingMap = new Map(existingItems.map(i => [i.menuType, i]));
    const toCreate = [];
    const res = [];
    
    for (const item of items) {
      if (existingMap.has(item.menuType)) {
        res.push({
          menuType: item.menuType,
          status: 'EXISTS',
          item: existingMap.get(item.menuType)
        });
      } else {
        toCreate.push({
          name,
          categoryId,
          menuType: item.menuType,
          price: item.price,
          description: description || null
        });
      }
    }

    if (toCreate.length > 0) {
      const createdItems = await Promise.all(
        toCreate.map(itemData => tx.menuItem.create({
          data: itemData,
          include: { category: true }
        }))
      );
      createdItems.forEach(created => {
        res.push({
          menuType: created.menuType,
          status: 'CREATED',
          item: created
        });
      });
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
      where: { name, categoryId, menuType: { in: menuTypes } },
      include: { category: true }
    });
    
    const existingMap = new Map(existingItems.map(i => [i.menuType, i]));
    const updatePromises = [];
    const res = [];
    
    for (const item of items) {
      if (existingMap.has(item.menuType)) {
        const existing = existingMap.get(item.menuType);
        updatePromises.push(
          tx.menuItem.update({
            where: { id: existing.id },
            data: { price: item.price }
          }).then(updated => {
            res.push({
              menuType: item.menuType,
              status: 'UPDATED',
              item: { ...updated, category: existing.category }
            });
          })
        );
      } else {
        res.push({ menuType: item.menuType, status: 'NOT_FOUND' });
      }
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    return res;
  });

  invalidateMenuCaches();
  return results;
};
