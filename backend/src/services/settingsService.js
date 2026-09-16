import prisma from '../utils/prisma.js';
import { settingsCache } from '../utils/cache.js';

const formatSettings = (s) => {
  if (!s) return s;
  return {
    ...s,
    sgstPercent: s.sgstPercent !== undefined && s.sgstPercent !== null ? Number(s.sgstPercent).toFixed(3) : '2.500',
    cgstPercent: s.cgstPercent !== undefined && s.cgstPercent !== null ? Number(s.cgstPercent).toFixed(3) : '2.500',
  };
};

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

  const formatted = formatSettings(settings);
  settingsCache.set(formatted);
  return formatted;
};

export const updateSettings = async (data) => {
  let settings = await prisma.settings.findFirst();

  const updateData = {};
  if (data.restaurantName !== undefined) updateData.restaurantName = data.restaurantName;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.gstin !== undefined) updateData.gstin = data.gstin;
  if (data.sgstPercent !== undefined) updateData.sgstPercent = Number(Number(data.sgstPercent).toFixed(3));
  if (data.cgstPercent !== undefined) updateData.cgstPercent = Number(Number(data.cgstPercent).toFixed(3));
  if (data.includePurchasesInReports !== undefined) updateData.includePurchasesInReports = data.includePurchasesInReports;

  let result;
  if (!settings) {
    result = await prisma.settings.create({
      data: {
        restaurantName: data.restaurantName || 'Maharaj Veg Villa',
        address: data.address || null,
        phone: data.phone || null,
        gstin: data.gstin || null,
        sgstPercent: data.sgstPercent !== undefined ? Number(Number(data.sgstPercent).toFixed(3)) : 2.5,
        cgstPercent: data.cgstPercent !== undefined ? Number(Number(data.cgstPercent).toFixed(3)) : 2.5,
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
  return formatSettings(result);
};

