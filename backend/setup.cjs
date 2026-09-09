const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/rajai/OneDrive/Desktop/Maharaj Veg Villa/backend/src';

const files = {
  'validators/tableValidator.js': `import { z } from 'zod';

export const createTableSchema = z.object({
  number: z.number().int().min(1, 'Table number must be at least 1'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  type: z.enum(['AC', 'NON_AC'], { required_error: 'Type must be AC or NON_AC' }),
});

export const updateTableSchema = z.object({
  number: z.number().int().optional(),
  capacity: z.number().int().optional(),
  type: z.enum(['AC', 'NON_AC']).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'BILLING'], { required_error: 'Status must be AVAILABLE, OCCUPIED, or BILLING' }),
});
`,
  'services/tableService.js': `import prisma from '../utils/prisma.js';

export const getAll = async () => {
  return prisma.table.findMany({
    where: { active: true },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        include: { captain: true },
      },
    },
    orderBy: { number: 'asc' },
  });
};

export const getById = async (id) => {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table || !table.active) throw { status: 404, message: 'Table not found' };
  return table;
};

export const create = async (data) => {
  const existing = await prisma.table.findUnique({ where: { number: data.number } });
  if (existing) throw { status: 400, message: 'Table number already exists' };
  return prisma.table.create({ data });
};

export const update = async (id, data) => {
  const table = await getById(id);
  if (data.number && data.number !== table.number) {
    const existing = await prisma.table.findUnique({ where: { number: data.number } });
    if (existing) throw { status: 400, message: 'Table number already exists' };
  }
  return prisma.table.update({ where: { id }, data });
};

export const updateStatus = async (id, status) => {
  await getById(id);
  return prisma.table.update({ where: { id }, data: { status } });
};

export const softDelete = async (id) => {
  const table = await getById(id);
  if (table.status !== 'AVAILABLE') throw { status: 400, message: 'Cannot delete table that is not available' };
  return prisma.table.update({ where: { id }, data: { active: false } });
};
`,
  'controllers/tableController.js': `import * as tableService from '../services/tableService.js';

export const getAll = async (req, res, next) => {
  try {
    const tables = await tableService.getAll();
    res.json(tables);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const table = await tableService.getById(req.params.id);
    res.json(table);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const table = await tableService.create(req.body);
    res.status(201).json(table);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const table = await tableService.update(req.params.id, req.body);
    res.json(table);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const table = await tableService.updateStatus(req.params.id, req.body.status);
    res.json(table);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    await tableService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
`,
  'routes/tableRoutes.js': `import { Router } from 'express';
import * as tableController from '../controllers/tableController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTableSchema, updateTableSchema, updateStatusSchema } from '../validators/tableValidator.js';

const router = Router();

router.get('/', authenticate, tableController.getAll);
router.get('/:id', authenticate, tableController.getById);
router.post('/', authenticate, authorize('ADMIN'), validate(createTableSchema), tableController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateTableSchema), tableController.update);
router.patch('/:id/status', authenticate, validate(updateStatusSchema), tableController.updateStatus);
router.delete('/:id', authenticate, authorize('ADMIN'), tableController.softDelete);

export default router;
`,
  'validators/categoryValidator.js': `import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayOrder: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
`,
  'services/categoryService.js': `import prisma from '../utils/prisma.js';

export const getAll = async () => {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      _count: {
        select: { menuItems: { where: { active: true } } }
      }
    }
  });
};

export const getById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      menuItems: {
        where: { active: true },
        orderBy: { name: 'asc' }
      }
    }
  });
  if (!category) throw { status: 404, message: 'Category not found' };
  return category;
};

export const create = async (data) => {
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) throw { status: 400, message: 'Category name already exists' };
  return prisma.category.create({ data });
};

export const update = async (id, data) => {
  if (data.name) {
    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing && existing.id !== id) throw { status: 400, message: 'Category name already exists' };
  }
  return prisma.category.update({ where: { id }, data });
};

export const softDelete = async (id) => {
  return prisma.category.update({ where: { id }, data: { active: false } });
};
`,
  'controllers/categoryController.js': `import * as categoryService from '../services/categoryService.js';

export const getAll = async (req, res, next) => {
  try {
    const categories = await categoryService.getAll();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const category = await categoryService.getById(req.params.id);
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const category = await categoryService.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const category = await categoryService.update(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    await categoryService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
`,
  'routes/categoryRoutes.js': `import { Router } from 'express';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator.js';

const router = Router();

router.get('/', authenticate, categoryController.getAll);
router.get('/:id', authenticate, categoryController.getById);
router.post('/', authenticate, authorize('ADMIN'), validate(createCategorySchema), categoryController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.softDelete);

export default router;
`,
  'validators/menuItemValidator.js': `import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  price: z.number().positive().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export const updateAvailabilitySchema = z.object({
  active: z.boolean({ required_error: 'Active status is required' }),
});
`,
  'services/menuItemService.js': `import prisma from '../utils/prisma.js';

export const getAll = async (filters = {}) => {
  const where = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.active !== undefined) where.active = filters.active;
  else where.active = true;

  return prisma.menuItem.findMany({
    where,
    include: {
      category: { select: { name: true } }
    },
    orderBy: [
      { category: { displayOrder: 'asc' } },
      { name: 'asc' }
    ]
  });
};

export const getById = async (id) => {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { category: true }
  });
  if (!item) throw { status: 404, message: 'Menu item not found' };
  return item;
};

export const create = async (data) => {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || !category.active) throw { status: 400, message: 'Invalid or inactive category' };
  return prisma.menuItem.create({ data });
};

export const update = async (id, data) => {
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw { status: 400, message: 'Invalid category' };
  }
  return prisma.menuItem.update({ where: { id }, data });
};

export const updateAvailability = async (id, active) => {
  return prisma.menuItem.update({ where: { id }, data: { active } });
};

export const softDelete = async (id) => {
  return prisma.menuItem.update({ where: { id }, data: { active: false } });
};
`,
  'controllers/menuItemController.js': `import * as menuItemService from '../services/menuItemService.js';

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      categoryId: req.query.categoryId,
      active: req.query.active !== undefined ? req.query.active === 'true' : undefined
    };
    const items = await menuItemService.getAll(filters);
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const item = await menuItemService.getById(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const item = await menuItemService.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const item = await menuItemService.update(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req, res, next) => {
  try {
    const item = await menuItemService.updateAvailability(req.params.id, req.body.active);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const softDelete = async (req, res, next) => {
  try {
    await menuItemService.softDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
`,
  'routes/menuItemRoutes.js': `import { Router } from 'express';
import * as menuItemController from '../controllers/menuItemController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMenuItemSchema, updateMenuItemSchema, updateAvailabilitySchema } from '../validators/menuItemValidator.js';

const router = Router();

router.get('/', authenticate, menuItemController.getAll);
router.get('/:id', authenticate, menuItemController.getById);
router.post('/', authenticate, authorize('ADMIN'), validate(createMenuItemSchema), menuItemController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateMenuItemSchema), menuItemController.update);
router.patch('/:id/availability', authenticate, authorize('ADMIN'), validate(updateAvailabilitySchema), menuItemController.updateAvailability);
router.delete('/:id', authenticate, authorize('ADMIN'), menuItemController.softDelete);

export default router;
`,
  'validators/sessionValidator.js': `import { z } from 'zod';

export const createSessionSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').optional(),
});
`,
  'services/sessionService.js': `import prisma from '../utils/prisma.js';

export const create = async (data, captainId) => {
  return prisma.$transaction(async (tx) => {
    const table = await tx.table.findUnique({ where: { id: data.tableId } });
    if (!table) throw { status: 404, message: 'Table not found' };
    if (table.status !== 'AVAILABLE') throw { status: 400, message: 'Table is not available' };
    
    const existingOpenSession = await tx.tableSession.findFirst({
      where: { tableId: data.tableId, status: 'OPEN' }
    });
    if (existingOpenSession) throw { status: 400, message: 'Table already has an open session' };

    const session = await tx.tableSession.create({
      data: {
        tableId: data.tableId,
        captainId,
        guestCount: data.guestCount,
        status: 'OPEN'
      }
    });

    await tx.table.update({
      where: { id: data.tableId },
      data: { status: 'OCCUPIED' }
    });

    return session;
  });
};

export const getActive = async () => {
  return prisma.tableSession.findMany({
    where: { status: 'OPEN' },
    include: {
      table: true,
      captain: { select: { name: true } }
    }
  });
};

export const getById = async (id) => {
  const session = await prisma.tableSession.findUnique({
    where: { id },
    include: {
      table: true,
      captain: { select: { name: true } },
      orders: true,
      kots: true
    }
  });
  if (!session) throw { status: 404, message: 'Session not found' };
  return session;
};

export const close = async (id) => {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id },
      include: { orders: true }
    });
    
    if (!session) throw { status: 404, message: 'Session not found' };
    if (session.status !== 'OPEN') throw { status: 400, message: 'Session is already closed' };

    const hasIncompleteOrders = session.orders.some(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (hasIncompleteOrders) throw { status: 400, message: 'Cannot close session with incomplete orders' };

    const updatedSession = await tx.tableSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    await tx.table.update({
      where: { id: session.tableId },
      data: { status: 'AVAILABLE' }
    });

    return updatedSession;
  });
};
`,
  'controllers/sessionController.js': `import * as sessionService from '../services/sessionService.js';

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
`,
  'routes/sessionRoutes.js': `import { Router } from 'express';
import * as sessionController from '../controllers/sessionController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema } from '../validators/sessionValidator.js';

const router = Router();

router.post('/', authenticate, validate(createSessionSchema), sessionController.create);
router.get('/active', authenticate, sessionController.getActive);
router.get('/:id', authenticate, sessionController.getById);
router.post('/:id/close', authenticate, authorize('ADMIN'), sessionController.close);

export default router;
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}
console.log('Done creating files.');
