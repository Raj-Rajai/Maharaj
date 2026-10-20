/**
 * Centralized Date Range Utility for Maharaj Veg Villa
 *
 * Rules:
 * 1. Given starting date & ending date:
 *    - Starting date starts at 00:00:00.000 (local time)
 *    - Ending date:
 *      - If ending date is today: time is current time (now)
 *      - If ending date is past/future (not today): time is 23:59:59.999 (local time)
 * 2. If no dates provided:
 *    - Defaults to today: starting at 00:00:00.000 to current time (now)
 * 3. Correctly handles YYYY-MM-DD strings in local timezone without UTC offset drift.
 */

export const isDateToday = (d) => {
  if (!d) return false;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const date1 = d1 instanceof Date ? d1 : new Date(d1);
  const date2 = d2 instanceof Date ? d2 : new Date(d2);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const parseLocalDate = (val, isEnd = false) => {
  if (!val) return null;
  let d;
  if (val instanceof Date) {
    d = new Date(val);
  } else {
    const str = String(val).trim();
    if (!str || str.toUpperCase() === 'ALL') return null;

    const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    } else {
      d = new Date(str);
    }
  }

  if (isNaN(d.getTime())) return null;

  if (isEnd) {
    if (isDateToday(d)) {
      return new Date();
    } else {
      d.setHours(23, 59, 59, 999);
      return d;
    }
  } else {
    d.setHours(0, 0, 0, 0);
    return d;
  }
};

export const parseDateRange = (startDate, endDate) => {
  const now = new Date();
  let start = parseLocalDate(startDate, false);
  let end = parseLocalDate(endDate, true);

  if (!start && !end) {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (start && !end) {
    end = isDateToday(start) ? new Date() : new Date();
  } else if (!start && end) {
    start = new Date(end);
    start.setHours(0, 0, 0, 0);
  }

  const isSingleDay =
    isSameDay(start, end) ||
    Boolean(startDate && endDate && String(startDate).slice(0, 10) === String(endDate).slice(0, 10));

  return { start, end, isSingleDay };
};

export const getPrismaDateFilter = (startDate, endDate, fieldName = 'createdAt') => {
  const { start, end } = parseDateRange(startDate, endDate);
  return {
    [fieldName]: {
      gte: start,
      lte: end,
    },
  };
};

export default {
  isDateToday,
  isSameDay,
  parseLocalDate,
  parseDateRange,
  getPrismaDateFilter,
};
