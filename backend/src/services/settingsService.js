import prisma from '../utils/prisma.js';
import { settingsCache } from '../utils/cache.js';

export const getSettings = async () => {
  const cached = settingsCache.get();
  if (cached) return cached;

  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        restaurantName: 'Maharaj Veg Villa',
        sgstPercent: 2.5,
        cgstPercent: 2.5,
      },
    });
  }

  settingsCache.set(settings);
  return settings;
};

export const updateSettings = async (data) => {
  let settings = await prisma.settings.findFirst();

  const updateData = {};
  if (data.restaurantName !== undefined) updateData.restaurantName = data.restaurantName;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.gstin !== undefined) updateData.gstin = data.gstin;
  if (data.sgstPercent !== undefined) updateData.sgstPercent = data.sgstPercent;
  if (data.cgstPercent !== undefined) updateData.cgstPercent = data.cgstPercent;
  if (data.includePurchasesInReports !== undefined) updateData.includePurchasesInReports = data.includePurchasesInReports;

  let result;
  if (!settings) {
    result = await prisma.settings.create({
      data: {
        restaurantName: data.restaurantName || 'Maharaj Veg Villa',
        address: data.address || null,
        phone: data.phone || null,
        gstin: data.gstin || null,
        sgstPercent: data.sgstPercent !== undefined ? data.sgstPercent : 2.5,
        cgstPercent: data.cgstPercent !== undefined ? data.cgstPercent : 2.5,
        includePurchasesInReports: data.includePurchasesInReports !== undefined ? data.includePurchasesInReports : false,
      },
    });
  } else {
    result = await prisma.settings.update({
      where: { id: settings.id },
      data: updateData,
    });
  }

  settingsCache.invalidate();
  return result;
};
