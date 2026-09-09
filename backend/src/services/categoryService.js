import prisma from '../utils/prisma.js';
import { categoryCache, invalidateMenuCaches } from '../utils/cache.js';

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
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) throw { status: 400, message: 'Category name already exists' };
  const created = await prisma.category.create({ data });
  categoryCache.invalidate();
  invalidateMenuCaches();
  return created;
};

export const update = async (id, data) => {
  if (data.name) {
    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing && existing.id !== id) throw { status: 400, message: 'Category name already exists' };
  }
  const updated = await prisma.category.update({ where: { id }, data });
  categoryCache.invalidate();
  invalidateMenuCaches();
  return updated;
};

export const softDelete = async (id) => {
  const deleted = await prisma.category.update({ where: { id }, data: { active: false } });
  categoryCache.invalidate();
  invalidateMenuCaches();
  return deleted;
};
