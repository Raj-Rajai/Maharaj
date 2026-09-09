import prisma from '../utils/prisma.js';

export const getAll = async (filters) => {
  const { method, startDate, endDate } = filters || {};
  const where = {};

  if (method) where.method = method;

  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) where.paidAt.gte = new Date(startDate);
    if (endDate) where.paidAt.lte = new Date(endDate);
  }

  return prisma.payment.findMany({
    where,
    include: {
      bill: true,
    },
    orderBy: { paidAt: 'desc' },
  });
};

export const getById = async (id) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      bill: {
        include: { order: true },
      },
    },
  });

  if (!payment) {
    throw { status: 404, message: 'Payment not found' };
  }

  return payment;
};
