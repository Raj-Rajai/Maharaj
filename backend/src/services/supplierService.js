import prisma from '../utils/prisma.js';

export const getAll = async () => {
  return prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });
};

export const getById = async (id) => {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw { status: 404, message: 'Supplier not found' };
  return supplier;
};

export const create = async (data) => {
  return prisma.supplier.create({ data });
};

export const update = async (id, data) => {
  await getById(id);
  return prisma.supplier.update({ where: { id }, data });
};

export const softDelete = async (id) => {
  await getById(id);
  return prisma.supplier.update({
    where: { id },
    data: { active: false }
  });
};
