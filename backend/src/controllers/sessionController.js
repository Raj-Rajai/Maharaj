import * as sessionService from '../services/sessionService.js';

export const create = async (req, res, next) => {
  try {
    const session = await sessionService.create(req.body, req.user.id);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

export const getActive = async (req, res, next) => {
  try {
    const sessions = await sessionService.getActive();
    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
};

export const close = async (req, res, next) => {
  try {
    const session = await sessionService.close(req.params.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
};
