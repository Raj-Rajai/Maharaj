import * as auditService from '../services/auditService.js';

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      entity: req.query.entity,
      entityId: req.query.entityId,
      userId: req.query.userId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const logs = await auditService.getAll(filters);
    res.json(logs);
  } catch (error) { next(error); }
};
