import * as billService from '../services/billService.js';

export const preview = async (req, res, next) => {
  try {
    const { orderId, discount } = req.body;
    const result = await billService.preview(orderId, discount);
    res.json(result);
  } catch (error) { next(error); }
};

export const create = async (req, res, next) => {
  try {
    const { orderId, discount, customerName, customerPhone } = req.body;
    const result = await billService.create(orderId, discount, customerName, customerPhone);
    res.status(201).json(result);
  } catch (error) { next(error); }
};

export const getAll = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    const result = await billService.getAll(filters);
    res.json(result);
  } catch (error) { next(error); }
};

export const getById = async (req, res, next) => {
  try {
    const result = await billService.getById(req.params.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const finalize = async (req, res, next) => {
  try {
    const { paymentMethod, customerName, customerPhone } = req.body;
    const result = await billService.finalize(req.params.id, paymentMethod, customerName, customerPhone);
    res.json(result);
  } catch (error) { next(error); }
};

export const cancel = async (req, res, next) => {
  try {
    const result = await billService.cancel(req.params.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const getPrintData = async (req, res, next) => {
  try {
    const result = await billService.getBillPrintData(req.params.id);
    res.json(result);
  } catch (error) { next(error); }
};

// Bill Amendment (§11-15)
export const amendBill = async (req, res, next) => {
  try {
    const { changes, reason, discount, customerName, customerPhone } = req.body;
    const result = await billService.amendBill(req.params.id, changes, reason, req.user.id, discount, customerName, customerPhone);
    res.json(result);
  } catch (error) { next(error); }
};

export const getAmendments = async (req, res, next) => {
  try {
    const result = await billService.getAmendments(req.params.id);
    res.json(result);
  } catch (error) { next(error); }
};

export const settleAmendment = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body;
    const result = await billService.settleAmendment(req.params.id, paymentMethod);
    res.json(result);
  } catch (error) { next(error); }
};
export const editDraft = async (req, res, next) => {
  try {
    const { changes, discount, customerName, customerPhone } = req.body;
    const result = await billService.editDraft(req.params.id, changes, discount, req.user.id, customerName, customerPhone);
    res.json(result);
  } catch (error) { next(error); }
};
