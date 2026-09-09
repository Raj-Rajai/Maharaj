import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Zap, Plus, Edit2, Trash2, RotateCcw, Check,
  ArrowRight, ChevronLeft, ChevronRight, Settings2,
  ExternalLink, Sparkles, X
} from 'lucide-react';
import Modal from '../ui/Modal';
import {
  dineInBlue, takeAwayBlue, kitchenBlue, billBlue,
  menuBlue, reportsBlue, purchasesBlue, inventoryBlue,
  usersBlue, settingsBlue, tableBlue, dashboardBlue,
  acBlue, nonAcBlue, swiggyIcon, zomatoIcon
} from '../../assets';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'maharaj_dashboard_shortcuts_v2';

export const ICON_MAP = {
  dineInBlue: { label: 'Dine-In Logo', src: dineInBlue },
  takeAwayBlue: { label: 'Take Away Logo', src: takeAwayBlue },
  kitchenBlue: { label: 'Kitchen Logo', src: kitchenBlue },
  billBlue: { label: 'Bills Logo', src: billBlue },
  menuBlue: { label: 'Menu Logo', src: menuBlue },
  reportsBlue: { label: 'Reports Logo', src: reportsBlue },
  purchasesBlue: { label: 'Purchases Logo', src: purchasesBlue },
  inventoryBlue: { label: 'Inventory Logo', src: inventoryBlue },
  usersBlue: { label: 'Users Logo', src: usersBlue },
  settingsBlue: { label: 'Settings Logo', src: settingsBlue },
  tableBlue: { label: 'Table Logo', src: tableBlue },
  acBlue: { label: 'AC Hall Logo', src: acBlue },
  nonAcBlue: { label: 'Non-AC Logo', src: nonAcBlue },
  swiggyIcon: { label: 'Swiggy Icon', src: swiggyIcon },
  zomatoIcon: { label: 'Zomato Icon', src: zomatoIcon },
};

export const COLOR_THEMES = {
  blue: {
    label: 'Classic Blue',
    bg: 'bg-blue-50/80 hover:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-950/60',
    border: 'border-blue-200/80 hover:border-blue-400 dark:border-blue-800/80 dark:hover:border-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/60',
    textColor: 'text-blue-900 dark:text-blue-200',
    badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-600'
  },
  emerald: {
    label: 'Emerald Green',
    bg: 'bg-emerald-50/80 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60',
    border: 'border-emerald-200/80 hover:border-emerald-400 dark:border-emerald-800/80 dark:hover:border-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
    textColor: 'text-emerald-900 dark:text-emerald-200',
    badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-600'
  },
  amber: {
    label: 'Warm Amber',
    bg: 'bg-amber-50/80 hover:bg-amber-50 dark:bg-amber-950/40 dark:hover:bg-amber-950/60',
    border: 'border-amber-200/80 hover:border-amber-400 dark:border-amber-800/80 dark:hover:border-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/60',
    textColor: 'text-amber-900 dark:text-amber-200',
    badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-600'
  },
  indigo: {
    label: 'Royal Indigo',
    bg: 'bg-indigo-50/80 hover:bg-indigo-50 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60',
    border: 'border-indigo-200/80 hover:border-indigo-400 dark:border-indigo-800/80 dark:hover:border-indigo-600',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    textColor: 'text-indigo-900 dark:text-indigo-200',
    badge: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300',
    dot: 'bg-indigo-600'
  },
  rose: {
    label: 'Rose Pink',
    bg: 'bg-rose-50/80 hover:bg-rose-50 dark:bg-rose-950/40 dark:hover:bg-rose-950/60',
    border: 'border-rose-200/80 hover:border-rose-400 dark:border-rose-800/80 dark:hover:border-rose-600',
    iconBg: 'bg-rose-100 dark:bg-rose-900/60',
    textColor: 'text-rose-900 dark:text-rose-200',
    badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-600'
  },
  cyan: {
    label: 'Cyan Ocean',
    bg: 'bg-cyan-50/80 hover:bg-cyan-50 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60',
    border: 'border-cyan-200/80 hover:border-cyan-400 dark:border-cyan-800/80 dark:hover:border-cyan-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/60',
    textColor: 'text-cyan-900 dark:text-cyan-200',
    badge: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300',
    dot: 'bg-cyan-600'
  },
  violet: {
    label: 'Vibrant Violet',
    bg: 'bg-violet-50/80 hover:bg-violet-50 dark:bg-violet-950/40 dark:hover:bg-violet-950/60',
    border: 'border-violet-200/80 hover:border-violet-400 dark:border-violet-800/80 dark:hover:border-violet-600',
    iconBg: 'bg-violet-100 dark:bg-violet-900/60',
    textColor: 'text-violet-900 dark:text-violet-200',
    badge: 'bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-300',
    dot: 'bg-violet-600'
  },
  teal: {
    label: 'Fresh Teal',
    bg: 'bg-teal-50/80 hover:bg-teal-50 dark:bg-teal-950/40 dark:hover:bg-teal-950/60',
    border: 'border-teal-200/80 hover:border-teal-400 dark:border-teal-800/80 dark:hover:border-teal-600',
    iconBg: 'bg-teal-100 dark:bg-teal-900/60',
    textColor: 'text-teal-900 dark:text-teal-200',
    badge: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300',
    dot: 'bg-teal-600'
  },
  slate: {
    label: 'Neutral Slate',
    bg: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750',
    border: 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
    iconBg: 'bg-slate-200 dark:bg-slate-700',
    textColor: 'text-slate-900 dark:text-slate-200',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300',
    dot: 'bg-slate-600'
  }
};

export const ALL_SYSTEM_FUNCTIONS = [
  {
    functionId: 'dine-in',
    title: 'Dine-In Floor',
    description: 'Table orders & hall view',
    path: '/tables',
    iconKey: 'dineInBlue',
    color: 'blue',
    permission: 'TABLE_VIEW',
    category: 'Floor Operations'
  },
  {
    functionId: 'take-away',
    title: 'Take Away POS',
    description: 'Counter parcels & delivery',
    path: '/take-away',
    iconKey: 'takeAwayBlue',
    color: 'emerald',
    permission: 'ORDER_CREATE',
    category: 'Sales & Orders'
  },
  {
    functionId: 'kitchen',
    title: 'Kitchen Display',
    description: 'Live active KOT tickets',
    path: '/kitchen',
    iconKey: 'kitchenBlue',
    color: 'amber',
    permission: 'KOT_VIEW',
    category: 'Floor Operations'
  },
  {
    functionId: 'bills',
    title: 'Bills & Register',
    description: 'Checkout, settle & print',
    path: '/bills',
    iconKey: 'billBlue',
    color: 'indigo',
    permission: null,
    category: 'Sales & Orders'
  },
  {
    functionId: 'menu',
    title: 'Menu Items',
    description: '4 menus & bulk add',
    path: '/menu',
    iconKey: 'menuBlue',
    color: 'rose',
    permission: 'MENU_AC_VIEW',
    category: 'Management'
  },
  {
    functionId: 'reports',
    title: 'Reports & Analytics',
    description: 'Visual trends & CSV export',
    path: '/reports',
    iconKey: 'reportsBlue',
    color: 'cyan',
    permission: 'REPORT_VIEW',
    category: 'Management'
  },
  {
    functionId: 'purchases',
    title: 'Purchases & Bills',
    description: 'Supplier expenses & stock',
    path: '/purchases',
    iconKey: 'purchasesBlue',
    color: 'violet',
    permission: 'PURCHASE_VIEW',
    category: 'Inventory & Stock'
  },
  {
    functionId: 'inventory',
    title: 'Inventory Stock',
    description: 'Stock counts & adjustments',
    path: '/inventory',
    iconKey: 'inventoryBlue',
    color: 'teal',
    permission: 'INVENTORY_VIEW',
    category: 'Inventory & Stock'
  },
  {
    functionId: 'users',
    title: 'User Management',
    description: 'Staff roles & permissions',
    path: '/users',
    iconKey: 'usersBlue',
    color: 'slate',
    permission: 'USER_VIEW',
    category: 'Administration'
  },
  {
    functionId: 'settings',
    title: 'Settings & Config',
    description: 'GST, printing & preferences',
    path: '/settings',
    iconKey: 'settingsBlue',
    color: 'blue',
    permission: 'SETTINGS_VIEW',
    category: 'Administration'
  },
];

const DEFAULT_SHORTCUTS = [
  { id: 'sc-1', functionId: 'dine-in', title: 'Dine-In Floor', description: 'Table orders & hall view', path: '/tables', iconKey: 'dineInBlue', color: 'blue' },
  { id: 'sc-2', functionId: 'take-away', title: 'Take Away POS', description: 'Counter parcel orders', path: '/take-away', iconKey: 'takeAwayBlue', color: 'emerald' },
  { id: 'sc-3', functionId: 'kitchen', title: 'Kitchen Display', description: 'Active KOT orders', path: '/kitchen', iconKey: 'kitchenBlue', color: 'amber' },
  { id: 'sc-4', functionId: 'bills', title: 'Bills & Register', description: 'Checkout & print', path: '/bills', iconKey: 'billBlue', color: 'indigo' },
  { id: 'sc-5', functionId: 'menu', title: 'Menu Items', description: '4 menus & bulk add', path: '/menu', iconKey: 'menuBlue', color: 'rose' },
  { id: 'sc-6', functionId: 'reports', title: 'Reports & Analytics', description: 'Visual charts & sales', path: '/reports', iconKey: 'reportsBlue', color: 'cyan' },
];

export default function QuickOperations() {
  const { hasPermission } = useAuth();
  const [shortcuts, setShortcuts] = useState([]);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [addTab, setAddTab] = useState('browse');

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPath, setFormPath] = useState('/tables');
  const [formIconKey, setFormIconKey] = useState('dineInBlue');
  const [formColor, setFormColor] = useState('blue');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShortcuts(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load shortcuts from storage:', e);
    }
    setShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  const saveShortcuts = (updated) => {
    setShortcuts(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist shortcuts:', e);
    }
  };

  const handleAddFromCatalog = (fn) => {

    if (shortcuts.some(s => s.functionId === fn.functionId && s.path === fn.path)) {
      toast('This shortcut is already active on your dashboard', { icon: 'ℹ️' });
      return;
    }

    const newShortcut = {
      id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      functionId: fn.functionId,
      title: fn.title,
      description: fn.description,
      path: fn.path,
      iconKey: fn.iconKey,
      color: fn.color
    };

    const updated = [...shortcuts, newShortcut];
    saveShortcuts(updated);
    toast.success(`Added "${fn.title}" to Quick Operations`);
  };

  const handleSaveCustom = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    if (editingShortcut) {

      const updated = shortcuts.map(s => {
        if (s.id === editingShortcut.id) {
          return {
            ...s,
            title: formTitle.trim(),
            description: formDescription.trim() || 'Quick shortcut',
            path: formPath,
            iconKey: formIconKey,
            color: formColor
          };
        }
        return s;
      });
      saveShortcuts(updated);
      setIsEditModalOpen(false);
      setEditingShortcut(null);
      toast.success('Shortcut updated successfully');
    } else {

      const newShortcut = {
        id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        functionId: 'custom',
        title: formTitle.trim(),
        description: formDescription.trim() || 'Custom shortcut',
        path: formPath,
        iconKey: formIconKey,
        color: formColor
      };
      saveShortcuts([...shortcuts, newShortcut]);
      setIsAddModalOpen(false);
      toast.success(`Added "${formTitle}" to Quick Operations`);
    }

    resetForm();
  };

  const openEditModal = (shortcut, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingShortcut(shortcut);
    setFormTitle(shortcut.title);
    setFormDescription(shortcut.description || '');
    setFormPath(shortcut.path || '/tables');
    setFormIconKey(shortcut.iconKey || 'dineInBlue');
    setFormColor(shortcut.color || 'blue');
    setIsEditModalOpen(true);
  };

  const handleDeleteShortcut = (id, title, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = shortcuts.filter(s => s.id !== id);
    saveShortcuts(updated);
    toast.success(`Removed "${title}" from shortcuts`);
  };

  const handleMove = (index, direction, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= shortcuts.length) return;

    const updated = [...shortcuts];
    const item = updated.splice(index, 1)[0];
    updated.splice(targetIndex, 0, item);
    saveShortcuts(updated);
  };

  const handleResetDefaults = () => {
    saveShortcuts(DEFAULT_SHORTCUTS);
    toast.success('Restored default shortcuts');
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPath('/tables');
    setFormIconKey('dineInBlue');
    setFormColor('blue');
    setEditingShortcut(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 p-4 sm:p-5 shadow-xs animate-fade-in-up transition-colors duration-200">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-border/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-primary dark:text-blue-400 flex items-center justify-center shadow-2xs">
            <Zap size={17} className="fill-primary/20 dark:fill-blue-400/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-text dark:text-slate-100">
                Quick Operations
              </h2>
              <span className="text-[10px] font-semibold bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 px-2 py-0.5 rounded-full font-mono">
                {shortcuts.length} active
              </span>
            </div>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">
              One-click instant shortcuts to daily operational workflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">

          <button
            type="button"
            onClick={() => {
              resetForm();
              setAddTab('browse');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all duration-200 cursor-pointer active:scale-95"
            title="Add shortcut to dashboard"
          >
            <Plus size={14} />
            <span>Add Shortcut</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomizeMode(!isCustomizeMode)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              isCustomizeMode
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 hover:bg-surface dark:hover:bg-slate-700 text-text-secondary dark:text-slate-300 hover:text-text dark:hover:text-slate-100 border-border dark:border-slate-700'
            }`}
            title={isCustomizeMode ? 'Finish customizing' : 'Customize shortcuts'}
          >
            <Settings2 size={14} className={isCustomizeMode ? 'animate-spin' : ''} />
            <span>{isCustomizeMode ? 'Done' : 'Customize'}</span>
          </button>

          {shortcuts.length !== DEFAULT_SHORTCUTS.length && (
            <button
              type="button"
              onClick={handleResetDefaults}
              className="p-1.5 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100 hover:bg-surface dark:hover:bg-slate-800 rounded-lg border border-border dark:border-slate-700 transition-colors cursor-pointer"
              title="Restore default shortcuts"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {isCustomizeMode && (
        <div className="mb-3.5 p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 animate-fade-in-down">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-600 shrink-0" />
            <span>
              <strong>Customize Mode Active:</strong> Use the ✏️ Edit or 🗑️ Delete buttons on each card, or move with &larr; &rarr;.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsCustomizeMode(false)}
            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {shortcuts.length === 0 ? (
        <div className="py-8 text-center bg-surface/50 rounded-xl border border-dashed border-border/80">
          <Zap size={28} className="text-text-secondary/40 mx-auto mb-2" />
          <p className="text-xs font-semibold text-text">No shortcuts active</p>
          <p className="text-[11px] text-text-secondary mt-0.5">Add operations from the catalog to launch actions fast.</p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-3 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            + Add First Shortcut
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {shortcuts.map((sc, index) => {
            const theme = COLOR_THEMES[sc.color] || COLOR_THEMES.blue;
            const iconData = ICON_MAP[sc.iconKey] || ICON_MAP.dineInBlue;

            return (
              <div
                key={sc.id}
                className="relative group transition-all duration-200"
              >

                <Link
                  to={sc.path}
                  onClick={(e) => {
                    if (isCustomizeMode) {
                      e.preventDefault();
                    }
                  }}
                  className={`flex flex-col justify-between p-3 rounded-xl border ${theme.bg} ${theme.border} shadow-2xs hover:-translate-y-1 hover:shadow-md transition-all duration-200 text-left h-full group/card cursor-pointer`}
                >

                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300 shadow-2xs`}>
                      <img src={iconData.src} alt={sc.title} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                    </div>

                    {!isCustomizeMode && (
                      <div className="w-6 h-6 rounded-full bg-white/80 opacity-0 group-hover/card:opacity-100 flex items-center justify-center text-text-secondary group-hover/card:text-primary transition-all duration-200">
                        <ArrowRight size={13} className="group-hover/card:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold leading-tight line-clamp-1 group-hover/card:text-primary transition-colors ${theme.textColor}`}>
                      {sc.title}
                    </h4>
                    <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-1">
                      {sc.description}
                    </p>
                  </div>
                </Link>

                {isCustomizeMode && (
                  <div className="absolute -top-2 -right-1.5 flex items-center gap-1 bg-white p-1 rounded-lg border border-border shadow-md z-10 animate-fade-in-down">

                    {index > 0 && (
                      <button
                        type="button"
                        onClick={(e) => handleMove(index, -1, e)}
                        className="p-1 hover:bg-surface text-text-secondary hover:text-text rounded cursor-pointer"
                        title="Move left"
                      >
                        <ChevronLeft size={12} />
                      </button>
                    )}

                    {index < shortcuts.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleMove(index, 1, e)}
                        className="p-1 hover:bg-surface text-text-secondary hover:text-text rounded cursor-pointer"
                        title="Move right"
                      >
                        <ChevronRight size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => openEditModal(sc, e)}
                      className="p-1 hover:bg-blue-50 text-blue-600 rounded cursor-pointer"
                      title="Edit shortcut"
                    >
                      <Edit2 size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteShortcut(sc.id, sc.title, e)}
                      className="p-1 hover:bg-red-50 text-danger rounded cursor-pointer"
                      title="Delete shortcut"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              resetForm();
              setAddTab('browse');
              setIsAddModalOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border hover:border-primary/50 bg-surface/40 hover:bg-primary/5 text-text-secondary hover:text-primary transition-all duration-200 cursor-pointer min-h-[90px] group"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-border/80 flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:scale-110 transition-transform mb-1 shadow-2xs">
              <Plus size={16} />
            </div>
            <span className="text-[11px] font-bold">Add Function</span>
          </button>
        </div>
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Add Quick Operations Shortcut"
        size="lg"
      >
        <div className="space-y-4">

          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setAddTab('browse')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                addTab === 'browse'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              Browse System Functions ({ALL_SYSTEM_FUNCTIONS.length})
            </button>
            <button
              type="button"
              onClick={() => setAddTab('custom')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                addTab === 'custom'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              Create Custom Shortcut
            </button>
          </div>

          {addTab === 'browse' && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Click <strong>+ Add</strong> on any function below to place its shortcut directly on your dashboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {ALL_SYSTEM_FUNCTIONS.map((fn) => {
                  const isAdded = shortcuts.some(s => s.path === fn.path);
                  const iconData = ICON_MAP[fn.iconKey] || ICON_MAP.dineInBlue;
                  const theme = COLOR_THEMES[fn.color] || COLOR_THEMES.blue;
                  const permitted = !fn.permission || hasPermission(fn.permission);

                  return (
                    <div
                      key={fn.functionId}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isAdded
                          ? 'bg-surface/80 border-border/70 opacity-75'
                          : 'bg-white border-border hover:border-primary/40 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                          <img src={iconData.src} alt={fn.title} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-text">{fn.title}</h4>
                            <span className="text-[9px] font-semibold text-text-secondary uppercase px-1.5 py-0.2 bg-surface rounded">
                              {fn.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary">{fn.description}</p>
                        </div>
                      </div>

                      <div>
                        {isAdded ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                            <Check size={12} />
                            Added
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddFromCatalog(fn)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-white border border-primary/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {addTab === 'custom' && (
            <form onSubmit={handleSaveCustom} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Shortcut Label / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Reports"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Subtitle / Description
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Sales breakdown & print"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Target Destination / Path *
                </label>
                <select
                  value={formPath}
                  onChange={(e) => setFormPath(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary bg-white"
                >
                  <option value="/tables">🍽️ Dine-In Tables (/tables)</option>
                  <option value="/take-away">🛍️ Take Away Counter (/take-away)</option>
                  <option value="/kitchen">🍳 Kitchen KOT Screen (/kitchen)</option>
                  <option value="/bills">🧾 Bills & Cashier Register (/bills)</option>
                  <option value="/menu">📋 Menu Management (/menu)</option>
                  <option value="/reports">📊 Reports & Analytics (/reports)</option>
                  <option value="/purchases">🚚 Purchases & Supplier Bills (/purchases)</option>
                  <option value="/inventory">📦 Inventory & Raw Stock (/inventory)</option>
                  <option value="/users">👥 Users & Permissions (/users)</option>
                  <option value="/settings">⚙️ Settings & Printing (/settings)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Select Icon
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-2 bg-surface rounded-xl border border-border/80">
                  {Object.entries(ICON_MAP).map(([key, data]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormIconKey(key)}
                      className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                        formIconKey === key
                          ? 'bg-primary text-white shadow-xs scale-105'
                          : 'bg-white hover:bg-slate-100 border border-border/60'
                      }`}
                      title={data.label}
                    >
                      <img src={data.src} alt={data.label} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Accent Color Theme
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COLOR_THEMES).map(([colorKey, data]) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setFormColor(colorKey)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        formColor === colorKey
                          ? 'border-primary ring-2 ring-primary/20 bg-white font-bold text-primary shadow-xs'
                          : 'border-border bg-surface text-text-secondary hover:bg-white'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${data.dot}`} />
                      <span>{data.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Save & Add Shortcut
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title="Edit Shortcut"
        size="md"
      >
        <form onSubmit={handleSaveCustom} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Shortcut Title *
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Subtitle / Description
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Target Destination / Route *
            </label>
            <select
              value={formPath}
              onChange={(e) => setFormPath(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-primary bg-white"
            >
              <option value="/tables">🍽️ Dine-In Tables (/tables)</option>
              <option value="/take-away">🛍️ Take Away Counter (/take-away)</option>
              <option value="/kitchen">🍳 Kitchen KOT Screen (/kitchen)</option>
              <option value="/bills">🧾 Bills & Cashier Register (/bills)</option>
              <option value="/menu">📋 Menu Management (/menu)</option>
              <option value="/reports">📊 Reports & Analytics (/reports)</option>
              <option value="/purchases">🚚 Purchases & Supplier Bills (/purchases)</option>
              <option value="/inventory">📦 Inventory & Raw Stock (/inventory)</option>
              <option value="/users">👥 Users & Permissions (/users)</option>
              <option value="/settings">⚙️ Settings & Printing (/settings)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Icon Choice
            </label>
            <div className="grid grid-cols-5 gap-2 p-2 bg-surface rounded-xl border border-border/80">
              {Object.entries(ICON_MAP).map(([key, data]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormIconKey(key)}
                  className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                    formIconKey === key
                      ? 'bg-primary text-white shadow-xs scale-105'
                      : 'bg-white hover:bg-slate-100 border border-border/60'
                  }`}
                  title={data.label}
                >
                  <img src={data.src} alt={data.label} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Color Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COLOR_THEMES).map(([colorKey, data]) => (
                <button
                  key={colorKey}
                  type="button"
                  onClick={() => setFormColor(colorKey)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    formColor === colorKey
                      ? 'border-primary ring-2 ring-primary/20 bg-white font-bold text-primary shadow-xs'
                      : 'border-border bg-surface text-text-secondary hover:bg-white'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${data.dot}`} />
                  <span>{data.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
