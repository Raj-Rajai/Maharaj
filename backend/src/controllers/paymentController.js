import * as paymentService from '../services/paymentService.js';

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      method: req.query.method,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const result = await paymentService.getAll(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const result = await paymentService.getById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
