import prisma from '../utils/prisma.js';
import { menuCache, categoryCache, invalidateMenuCaches } from '../utils/cache.js';

const MENU_LABELS = { AC: 'AC', NON_AC: 'Non-AC', SWIGGY: 'Swiggy', ZOMATO: 'Zomato' };

// An inventory item can be added to each menu only once
const assertInventoryLinkable = async (client, inventoryItemId, menuType, excludeMenuItemId = null) => {
  const inventoryItem = await client.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!inventoryItem) throw { status: 400, message: 'Inventory item not found' };
  const existing = await client.menuItem.findFirst({
    where: {
      inventoryItemId,
      menuType,
      ...(excludeMenuItemId ? { id: { not: excludeMenuItemId } } : {}),
    },
  });
  if (existing) {
    throw {
      status: 400,
      message: `"${inventoryItem.name}" is already on the ${MENU_LABELS[menuType] || menuType} menu as "${existing.name}"`,
    };
  }
  return inventoryItem;
};

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
  if (data.inventoryItemId) {
    await assertInventoryLinkable(prisma, data.inventoryItemId, data.menuType);
  }
  const created = await prisma.menuItem.create({ data });
  invalidateMenuCaches();
  return created;
};

export const update = async (id, data) => {
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw { status: 400, message: 'Invalid category' };
  }
  if (data.inventoryItemId) {
    const current = await prisma.menuItem.findUnique({ where: { id }, select: { menuType: true } });
    if (!current) throw { status: 404, message: 'Menu item not found' };
    await assertInventoryLinkable(prisma, data.inventoryItemId, data.menuType || current.menuType, id);
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
  const { name, categoryId, description, items, inventoryItemId } = data;

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
    const toLink = [];
    const res = [];

    // Adding from inventory: skip menus that already carry this stock item, and link
    // same-named menu items that aren't linked to anything yet
    let alreadyLinkedMap = new Map();
    if (inventoryItemId) {
      const inventoryItem = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!inventoryItem) throw { status: 400, message: 'Inventory item not found' };
      const linked = await tx.menuItem.findMany({
        where: { inventoryItemId, menuType: { in: menuTypes } },
        include: { category: true },
      });
      alreadyLinkedMap = new Map(linked.map(i => [i.menuType, i]));
    }

    for (const item of items) {
      if (alreadyLinkedMap.has(item.menuType)) {
        res.push({
          menuType: item.menuType,
          status: 'ALREADY_LINKED',
          item: alreadyLinkedMap.get(item.menuType)
        });
      } else if (inventoryItemId && existingMap.has(item.menuType) && !existingMap.get(item.menuType).inventoryItemId) {
        toLink.push(existingMap.get(item.menuType));
      } else if (existingMap.has(item.menuType)) {
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
          description: description || null,
          inventoryItemId: inventoryItemId || null
        });
      }
    }

    if (toLink.length > 0) {
      const linkedItems = await Promise.all(
        toLink.map(existing => tx.menuItem.update({
          where: { id: existing.id },
          data: { inventoryItemId },
          include: { category: true }
        }))
      );
      linkedItems.forEach(linked => {
        res.push({ menuType: linked.menuType, status: 'LINKED', item: linked });
      });
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
  const { name, categoryId, items, inventoryItemId } = data;

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
            data: {
              price: item.price,
              ...(inventoryItemId && !existing.inventoryItemId ? { inventoryItemId } : {}),
            }
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
