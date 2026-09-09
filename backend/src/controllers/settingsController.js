import * as settingsService from '../services/settingsService.js';

export const get = async (req, res, next) => {
  try {
    const result = await settingsService.getSettings();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const result = await settingsService.updateSettings(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
