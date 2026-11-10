import prisma from '../utils/prisma.js';
import { categoryCache, invalidateMenuCaches, reportCache } from '../utils/cache.js';
import { emitMenuUpdated } from '../utils/socket.js';

export const getAll = async () => {
  const cached = categoryCache.get();
  if (cached) return cached;

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      _count: {
        select: { menuItems: { where: { active: true } } }
      }
    }
  });

  categoryCache.set(categories);
  return categories;
};

export const getById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      menuItems: {
        where: { active: true },
        orderBy: { name: 'asc' }
      }
    }
  });
  if (!category) throw { status: 404, message: 'Category not found' };
  return category;
};

export const create = async (data) => {
  try {
    const created = await prisma.category.create({ data });
    categoryCache.invalidate();
    invalidateMenuCaches();
    reportCache.invalidate();
    emitMenuUpdated({ action: 'category_created', id: created.id });
    return created;
  } catch (error) {
    if (error.code === 'P2002') throw { status: 400, message: 'Category name already exists' };
    throw error;
  }
};

export const update = async (id, data) => {
  try {
    const updated = await prisma.category.update({ where: { id }, data });
    categoryCache.invalidate();
    invalidateMenuCaches();
    reportCache.invalidate();
    emitMenuUpdated({ action: 'category_updated', id });
    return updated;
  } catch (error) {
    if (error.code === 'P2025') throw { status: 404, message: 'Category not found' };
    if (error.code === 'P2002') throw { status: 400, message: 'Category name already exists' };
    throw error;
  }
};

export const softDelete = async (id) => {
  const deleted = await prisma.category.update({ where: { id }, data: { active: false } });
  categoryCache.invalidate();
  invalidateMenuCaches();
  reportCache.invalidate();
  emitMenuUpdated({ action: 'category_deleted', id });
  return deleted;
};
