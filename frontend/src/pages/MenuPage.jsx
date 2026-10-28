import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { UtensilsCrossed, Plus, Edit2, Trash2, Check, X, CopyPlus, Package, PenLine, Search } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { menuBlue, acBlue, nonAcBlue, swiggyIcon, zomatoIcon } from '../assets';

const TABS = [
  { id: 'AC', label: 'AC Menu', logo: acBlue, perm: 'MENU_AC_VIEW' },
  { id: 'NON_AC', label: 'Non-AC Menu', logo: nonAcBlue, perm: 'MENU_NON_AC_VIEW' },
  { id: 'SWIGGY', label: 'Swiggy Menu', logo: swiggyIcon, perm: 'MENU_SWIGGY_VIEW' },
  { id: 'ZOMATO', label: 'Zomato Menu', logo: zomatoIcon, perm: 'MENU_ZOMATO_VIEW' },
];

const MENU_SHORT = { AC: 'AC', NON_AC: 'Non-AC', SWIGGY: 'Swiggy', ZOMATO: 'Zomato' };

const MENU_META = {
  AC: { label: 'AC Menu', logo: acBlue, type: 'Dine-In AC', bgActive: 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 ring-1 ring-blue-300 dark:ring-blue-800' },
  NON_AC: { label: 'Non-AC Menu', logo: nonAcBlue, type: 'Dine-In Non-AC', bgActive: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300 dark:ring-emerald-800' },
  SWIGGY: { label: 'Swiggy Menu', logo: swiggyIcon, type: 'Online Delivery', bgActive: 'bg-orange-50/70 dark:bg-orange-950/40 border-orange-400 dark:border-orange-500 ring-1 ring-orange-300 dark:ring-orange-800' },
  ZOMATO: { label: 'Zomato Menu', logo: zomatoIcon, type: 'Online Delivery', bgActive: 'bg-red-50/70 dark:bg-red-950/40 border-red-400 dark:border-red-500 ring-1 ring-red-300 dark:ring-red-800' }
};

export default function MenuPage() {
  const { hasPermission, hasAnyPermission } = useAuth();

  const availableTabs = TABS.filter(t => hasPermission(t.perm));
  const defaultTab = availableTabs.length > 0 ? availableTabs[0].id : '';

  const [menuType, setMenuType] = useState(defaultTab);

  const canCreateCurrent = menuType ? hasPermission(`MENU_${menuType}_CREATE`) : false;
  const canEditCurrent = menuType ? hasPermission(`MENU_${menuType}_EDIT`) : false;
  const canDeleteCurrent = menuType ? hasPermission(`MENU_${menuType}_DELETE`) : false;

  const canCreateCategory = hasAnyPermission('MENU_AC_CREATE', 'MENU_NON_AC_CREATE', 'MENU_SWIGGY_CREATE', 'MENU_ZOMATO_CREATE');
  const canEditCategory = hasAnyPermission('MENU_AC_EDIT', 'MENU_NON_AC_EDIT', 'MENU_SWIGGY_EDIT', 'MENU_ZOMATO_EDIT');
  const canDeleteCategory = hasAnyPermission('MENU_AC_DELETE', 'MENU_NON_AC_DELETE', 'MENU_SWIGGY_DELETE', 'MENU_ZOMATO_DELETE');

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [catModal, setCatModal] = useState(null);
  const [itemModal, setItemModal] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', displayOrder: 0 });
  const [itemForm, setItemForm] = useState({
    name: '', categoryId: '', menuType: defaultTab, price: '', description: '', inventoryItemId: null,
  });

  // "Add from inventory": menu items linked to a stock item deduct stock when ordered
  const canUseInventory = hasPermission('INVENTORY_VIEW');
  const [inventory, setInventory] = useState([]);
  const [itemSource, setItemSource] = useState('manual');
  const [bulkSource, setBulkSource] = useState('manual');
  const [invSearch, setInvSearch] = useState('');
  const inventoryById = useMemo(() => new Map(inventory.map(i => [i.id, i])), [inventory]);

  const [bulkModal, setBulkModal] = useState(false);
  const [basePrice, setBasePrice] = useState('');
  const [bulkForm, setBulkForm] = useState({
    name: '', categoryId: '', description: '', inventoryItemId: null,
    menus: { AC: false, NON_AC: false, SWIGGY: false, ZOMATO: false },
    prices: { AC: '', NON_AC: '', SWIGGY: '', ZOMATO: '' }
  });
  const [conflictDialog, setConflictDialog] = useState(null);

  const applyBasePrice = () => {
    if (!basePrice || isNaN(parseFloat(basePrice)) || parseFloat(basePrice) <= 0) {
      return toast.error('Enter a valid positive base price');
    }
    const val = parseFloat(basePrice);
    setBulkForm(f => {
      const newPrices = { ...f.prices };
      Object.keys(f.menus).forEach(m => {
        if (f.menus[m]) {
          newPrices[m] = String(val);
        }
      });
      return { ...f, prices: newPrices };
    });
    toast.success('Applied base price to selected menus');
  };

  const toggleAllMenus = (select) => {
    setBulkForm(f => ({
      ...f,
      // Menus that already carry the picked stock item stay unselected
      menus: Object.fromEntries(['AC', 'NON_AC', 'SWIGGY', 'ZOMATO'].map(m => [m, select && !(bulkSource === 'inventory' && bulkLinkedMenus.has(m))]))
    }));
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/menu/categories');
      setCategories(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch {
      toast.error('Failed to load categories');
    }
  };

  const fetchItems = async (type = menuType) => {
    if (!type) return;
    setItemsLoading(true);
    try {
      const res = await api.get('/menu/items', { params: { menuType: type } });
      setItems(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch {
      toast.error('Failed to load menu items');
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!canUseInventory) return;
    try {
      const res = await api.get('/inventory');
      setInventory(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch {
      // Stock badges are optional; the menu still works without them
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await fetchCategories();
      await fetchItems(menuType);
      fetchInventory();
    } catch {
      toast.error('Failed to initialize menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (defaultTab) {
      loadInitialData();
    } else {
      setLoading(false);
    }
  }, []);

  useOnRouteActive(() => {
    fetchCategories();
    fetchInventory();
    if (menuType) {
      fetchItems(menuType);
    }
  });

  const handleMenuTypeChange = (newType) => {
    setMenuType(newType);
    setSelectedCat('ALL');
    setCurrentPage(1);
    fetchItems(newType);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return toast.error('Category name is required');
    try {
      if (catModal === 'new') {
        await api.post('/menu/categories', catForm);
        toast.success('Category created');
      } else {
        await api.patch(`/menu/categories/${catModal.id}`, catForm);
        toast.success('Category updated');
      }
      setCatModal(null);
      await fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    }
  };

  const deleteCat = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      toast.success('Category deleted');
      await fetchCategories();
      await fetchItems(menuType);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const openAddItemModal = () => {
    setItemForm({
      name: '',
      categoryId: categories[0]?.id || '',
      menuType: menuType,
      price: '',
      description: '',
      inventoryItemId: null,
    });
    setItemSource('manual');
    setInvSearch('');
    fetchInventory();
    setItemModal('new');
  };

  const openEditItemModal = (item) => {
    setItemForm({
      name: item.name,
      categoryId: item.categoryId,
      menuType: item.menuType || menuType,
      price: item.price,
      description: item.description || '',
      inventoryItemId: item.inventoryItemId || null,
    });
    setItemModal(item);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Item name is required');
    if (!itemForm.categoryId) return toast.error('Please select a category');
    if (!itemForm.price || isNaN(parseFloat(itemForm.price))) return toast.error('Please enter a valid price');
    if (itemModal === 'new' && itemSource === 'inventory' && !itemForm.inventoryItemId) return toast.error('Pick an inventory item');

    try {
      const payload = {
        name: itemForm.name.trim(),
        categoryId: itemForm.categoryId,
        menuType: itemForm.menuType,
        price: parseFloat(itemForm.price),
        description: itemForm.description?.trim() || undefined,
      };
      if (itemModal === 'new') {
        if (itemForm.inventoryItemId) payload.inventoryItemId = itemForm.inventoryItemId;
      } else if ((itemForm.inventoryItemId || null) !== (itemModal.inventoryItemId || null)) {
        payload.inventoryItemId = itemForm.inventoryItemId || null;
      }

      if (itemModal === 'new') {
        await api.post('/menu/items', payload);
        toast.success('Menu item created');
      } else {
        await api.patch(`/menu/items/${itemModal.id}`, payload);
        toast.success('Menu item updated');
      }
      setItemModal(null);
      await fetchItems(menuType);
      await fetchCategories();
      if (payload.inventoryItemId !== undefined) fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save menu item');
    }
  };

  const toggleItem = async (id, active) => {
    try {
      await api.patch(`/menu/items/${id}/availability`, { active: !active });
      toast.success(`Item ${!active ? 'enabled' : 'disabled'}`);
      fetchItems(menuType);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update item availability');
    }
  };

  const openBulkModal = () => {
    setBasePrice('');
    setBulkForm({
      name: '', categoryId: categories[0]?.id || '', description: '', inventoryItemId: null,
      menus: { AC: true, NON_AC: true, SWIGGY: false, ZOMATO: false },
      prices: { AC: '', NON_AC: '', SWIGGY: '', ZOMATO: '' }
    });
    setBulkSource('manual');
    setInvSearch('');
    fetchInventory();
    setBulkModal(true);
  };

  // Menus that already carry the stock item picked in the bulk modal — it can be added to each menu only once
  const bulkLinkedMenus = useMemo(() => {
    const inv = bulkForm.inventoryItemId ? inventoryById.get(bulkForm.inventoryItemId) : null;
    return new Set((inv?.menuItems || []).map(m => m.menuType));
  }, [bulkForm.inventoryItemId, inventoryById]);

  const pickBulkInventory = (inv) => {
    const linked = new Set((inv.menuItems || []).map(m => m.menuType));
    setBulkForm(f => ({
      ...f,
      inventoryItemId: inv.id,
      name: inv.name,
      menus: Object.fromEntries(Object.entries(f.menus).map(([k, v]) => [k, v && !linked.has(k)])),
    }));
  };

  const submitBulk = async (forceUpdate = false) => {
    const selectedMenus = Object.keys(bulkForm.menus).filter(m => bulkForm.menus[m]);
    if (bulkSource === 'inventory' && !bulkForm.inventoryItemId) return toast.error('Pick an inventory item');
    if (selectedMenus.length === 0) return toast.error('Select at least one menu');
    if (!bulkForm.name.trim()) return toast.error('Item name is required');
    if (!bulkForm.categoryId) return toast.error('Category is required');

    const itemsPayload = [];
    for (const m of selectedMenus) {
      if (!bulkForm.prices[m] || isNaN(parseFloat(bulkForm.prices[m]))) {
        return toast.error(`Valid price required for ${m}`);
      }
      itemsPayload.push({ menuType: m, price: parseFloat(bulkForm.prices[m]) });
    }

    const payload = {
      name: bulkForm.name.trim(),
      categoryId: bulkForm.categoryId,
      description: bulkForm.description?.trim() || undefined,
      items: itemsPayload
    };
    if (bulkSource === 'inventory' && bulkForm.inventoryItemId) payload.inventoryItemId = bulkForm.inventoryItemId;

    try {
      if (forceUpdate) {
        await api.put('/menu/items/bulk', payload);
        toast.success('Items updated/added successfully');
        setConflictDialog(null);
        setBulkModal(false);
        fetchItems(menuType);
      } else {
        const res = await api.post('/menu/items/bulk', payload);
        const results = res.data;
        const existing = results.filter(r => r.status === 'EXISTS');
        if (existing.length > 0) {
          setConflictDialog({
            menus: existing.map(e => e.menuType),
            message: `Item already exists in: ${existing.map(e => e.menuType).join(', ')}`
          });
        } else {
          const createdCount = results.filter(r => r.status === 'CREATED').length;
          const linkedCount = results.filter(r => r.status === 'LINKED').length;
          toast.success(linkedCount > 0
            ? `Added to ${createdCount} menu(s), linked ${linkedCount} existing item(s) to stock`
            : `Added to ${createdCount} menu(s)`);
          setBulkModal(false);
          fetchItems(menuType);
        }
      }
      fetchCategories();
      if (payload.inventoryItemId) fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk add failed');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => selectedCat === 'ALL' || i.categoryId === selectedCat);
  }, [items, selectedCat]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const sourceSwitch = (source, setSource, onManual) => (
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {[
        { id: 'manual', label: 'New item', icon: PenLine },
        { id: 'inventory', label: 'From inventory', icon: Package },
      ].map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => { setSource(opt.id); setInvSearch(''); if (opt.id === 'manual') onManual(); }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            source === opt.id ? 'bg-white dark:bg-slate-900 text-primary dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <opt.icon size={14} /> {opt.label}
        </button>
      ))}
    </div>
  );

  // blockedMenuType: the single-item modal refuses stock items already on that menu (one time per menu)
  const inventoryPicker = (selectedId, onPick, blockedMenuType = null) => {
    const q = invSearch.trim().toLowerCase();
    const list = inventory.filter(i => !q || i.name.toLowerCase().includes(q));
    return (
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={invSearch}
            onChange={e => setInvSearch(e.target.value)}
            placeholder="Search inventory items..."
            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {list.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {inventory.length === 0 ? 'No inventory items yet — add stock items on the Inventory page first.' : 'No matching inventory items'}
            </p>
          ) : list.map(inv => {
            const onMenus = (inv.menuItems || []).map(m => m.menuType);
            const blocked = blockedMenuType && onMenus.includes(blockedMenuType);
            const selected = selectedId === inv.id;
            return (
              <button
                key={inv.id}
                type="button"
                disabled={blocked}
                onClick={() => onPick(inv)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                  selected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                } ${blocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${selected ? 'text-primary dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>{inv.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {blocked
                      ? `Already on the ${MENU_SHORT[blockedMenuType]} menu`
                      : onMenus.length > 0 ? `On ${[...new Set(onMenus)].map(m => MENU_SHORT[m]).join(', ')} menu` : 'Not on any menu yet'}
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-mono font-semibold ${inv.currentStock <= 0 ? 'text-red-600 dark:text-red-400' : inv.lowStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  {inv.currentStock} {inv.unit}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const stockBadge = (item) => {
    if (!item.inventoryItemId) return null;
    const inv = inventoryById.get(item.inventoryItemId);
    if (!inv) {
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400"><Package size={11} /> Stock-linked</span>;
    }
    const tone = inv.currentStock <= 0
      ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60'
      : inv.lowStock
        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
        : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${tone}`} title={`Linked to inventory: ${inv.name}`}>
        <Package size={11} /> {inv.currentStock <= 0 ? 'Out of stock' : `${inv.currentStock} ${inv.unit} in stock`}
      </span>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (availableTabs.length === 0) return <div className="p-8 text-center text-text-secondary">You do not have permission to view any menus.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
            <img src={menuBlue} alt="Menu" className="w-5 sm:w-6 h-5 sm:h-6 object-contain dark:brightness-0 dark:invert" />
            Menu & Catalog Management
          </h1>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">Centralized item catalog and pricing across Dine-In (AC / Non-AC) and Delivery (Swiggy / Zomato)</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('MENU_BULK_ADD') && (
            <button
              type="button"
              onClick={openBulkModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light active:scale-[0.99] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer min-h-[40px]"
            >
              <CopyPlus size={16} />
              <span>Bulk Add Item</span>
            </button>
          )}
        </div>
      </div>

      <div className="tablet-tab-bar bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl border border-border dark:border-slate-700 gap-1">
        {availableTabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleMenuTypeChange(t.id)}
            className={`min-w-[110px] sm:min-w-0 flex-1 tablet-tab-pill gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
              menuType === t.id ? 'bg-primary text-white shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <img src={t.logo} alt={t.label} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0 ${(t.id === 'AC' || t.id === 'NON_AC') ? 'dark:brightness-0 dark:invert' : ''}`} />
            <span>{t.label}</span>
            {menuType === t.id && (
              <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono font-medium">
                {items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-text dark:text-slate-100">Categories</h2>
          {canCreateCategory && (
            <button onClick={() => { setCatForm({ name: '', displayOrder: categories.length }); setCatModal('new'); }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-light cursor-pointer shadow-xs min-h-[36px]">
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-surface dark:bg-slate-800/80 rounded-lg border border-border dark:border-slate-700 text-xs">
              <span className="font-medium text-text dark:text-slate-200">{c.name}</span>
              <span className="text-text-secondary dark:text-slate-400 font-mono">({c._count?.menuItems ?? 0})</span>
              {(canEditCategory || canDeleteCategory) && (
                <div className="flex items-center gap-1 ml-1 border-l border-border dark:border-slate-700 pl-1.5">
                  {canEditCategory && (
                    <button onClick={() => { setCatForm({ name: c.name, displayOrder: c.displayOrder || 0 }); setCatModal(c); }} className="text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 p-0.5 cursor-pointer" title="Edit Category"><Edit2 size={12} /></button>
                  )}
                  {canDeleteCategory && (
                    <button onClick={() => deleteCat(c.id)} className="text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-rose-400 p-0.5 cursor-pointer" title="Delete Category"><Trash2 size={12} /></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-border dark:border-slate-800 bg-surface/50 dark:bg-slate-800/50">
          <div className="tablet-tab-bar py-0.5">
            <button onClick={() => { setSelectedCat('ALL'); setCurrentPage(1); }} className={`tablet-tab-pill px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${selectedCat === 'ALL' ? 'bg-primary text-white font-semibold' : 'bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-300 border border-border dark:border-slate-700 hover:bg-surface dark:hover:bg-slate-700'}`}>
              All Items ({items.length})
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => { setSelectedCat(c.id); setCurrentPage(1); }} className={`tablet-tab-pill px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${selectedCat === c.id ? 'bg-primary text-white font-semibold' : 'bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-300 border border-border dark:border-slate-700 hover:bg-surface dark:hover:bg-slate-700'}`}>
                {c.name}
              </button>
            ))}
          </div>
          {canCreateCurrent && (
            <button onClick={openAddItemModal} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-light whitespace-nowrap cursor-pointer shadow-xs min-h-[36px]">
              <Plus size={14} /> Add {availableTabs.find(t=>t.id===menuType)?.label?.split(' ')[1] || 'Item'}
            </button>
          )}
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="md" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[540px]">
              <thead className="bg-surface dark:bg-slate-800/80 border-b border-border dark:border-slate-800">
                <tr className="text-left text-text-secondary dark:text-slate-400 text-xs">
                  <th className="px-4 py-3 tablet-table-cell font-semibold">Item Name</th>
                  <th className="px-4 py-3 tablet-table-cell font-semibold">Category</th>
                  <th className="px-4 py-3 tablet-table-cell font-semibold">Price (₹)</th>
                  <th className="px-4 py-3 tablet-table-cell font-semibold">Status</th>
                  {(canEditCurrent || canDeleteCurrent) && <th className="px-4 py-3 tablet-table-cell font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800">
                {paginatedItems.map(item => (
                  <tr key={item.id} className="hover:bg-surface/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 tablet-table-cell font-medium text-text dark:text-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{item.name}</span>
                        {stockBadge(item)}
                      </div>
                      {item.description && <div className="text-xs text-text-secondary dark:text-slate-400 font-normal truncate max-w-xs">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3 tablet-table-cell text-text-secondary dark:text-slate-400 text-xs">{item.category?.name || '-'}</td>
                    <td className="px-4 py-3 tablet-table-cell font-mono font-bold text-text dark:text-slate-100">₹{parseFloat(item.price).toFixed(2)}</td>
                    <td className="px-4 py-3 tablet-table-cell"><Badge variant={item.active ? 'success' : 'danger'}>{item.active ? 'Active' : 'Inactive'}</Badge></td>
                    {(canEditCurrent || canDeleteCurrent) && (
                      <td className="px-4 py-3 tablet-table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEditCurrent && (
                            <button onClick={() => openEditItemModal(item)} className="p-1.5 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center" title="Edit Item"><Edit2 size={14} /></button>
                          )}
                          {canEditCurrent && (
                            <button onClick={() => toggleItem(item.id, item.active)} className={`text-xs px-2.5 py-1 rounded font-medium border cursor-pointer min-h-[34px] inline-flex items-center justify-center ${item.active ? 'text-danger dark:text-rose-400 border-danger/30 dark:border-rose-500/30 hover:bg-danger/10 dark:hover:bg-rose-950/40' : 'text-success dark:text-emerald-400 border-success/30 dark:border-emerald-500/30 hover:bg-success/10 dark:hover:bg-emerald-950/40'}`}>
                              {item.active ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-12 text-center text-text-secondary dark:text-slate-500"><UtensilsCrossed size={36} className="mx-auto mb-2 opacity-30" /><p>No items found</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!itemsLoading && filteredItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        )}
      </div>

      <Modal isOpen={!!catModal} onClose={() => setCatModal(null)} title={catModal === 'new' ? 'Add Category' : 'Edit Category'} size="sm">
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Category Name</label><input type="text" value={catForm.name} onChange={e => setCatForm(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px]" /></div>
          <div><label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Display Order</label><input type="number" value={catForm.displayOrder} onChange={e => setCatForm(f => ({...f, displayOrder: parseInt(e.target.value)||0}))} className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px]" /></div>
          <button onClick={saveCat} className="w-full min-h-[42px] py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light active:scale-[0.99] cursor-pointer shadow-xs">Save Category</button>
        </div>
      </Modal>

      <Modal isOpen={!!itemModal} onClose={() => setItemModal(null)} title={itemModal === 'new' ? 'Add Menu Item' : 'Edit Menu Item'}>
        <div className="space-y-4">
          {itemModal === 'new' && canUseInventory && sourceSwitch(itemSource, setItemSource, () => setItemForm(f => ({ ...f, inventoryItemId: null })))}
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Menu Type</label>
            <div className="flex gap-2 flex-wrap">
              {availableTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setItemForm(f => {
                    // A stock item already on the newly chosen menu can't be added there again
                    const inv = f.inventoryItemId ? inventoryById.get(f.inventoryItemId) : null;
                    const clash = itemModal === 'new' && inv?.menuItems?.some(m => m.menuType === t.id);
                    return { ...f, menuType: t.id, ...(clash ? { inventoryItemId: null } : {}) };
                  })}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold border ${itemForm.menuType === t.id ? 'bg-primary text-white border-primary' : 'bg-surface dark:bg-slate-800 text-text dark:text-slate-200 border-border dark:border-slate-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {itemModal === 'new' && itemSource === 'inventory' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Inventory Item</label>
              {inventoryPicker(itemForm.inventoryItemId, inv => setItemForm(f => ({ ...f, inventoryItemId: inv.id, name: inv.name })), itemForm.menuType)}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Each order of this menu item deducts the same quantity from this stock item.</p>
            </div>
          )}
          {itemModal !== 'new' && itemForm.inventoryItemId && (
            <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5 min-w-0">
                <Package size={14} className="shrink-0" />
                <span className="truncate">Linked to stock: <strong>{inventoryById.get(itemForm.inventoryItemId)?.name || 'inventory item'}</strong></span>
              </span>
              <button type="button" onClick={() => setItemForm(f => ({ ...f, inventoryItemId: null }))} className="shrink-0 px-2 py-1 rounded font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer">Unlink</button>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Item Name</label>
            <input
              type="text"
              value={itemForm.name}
              onChange={e => setItemForm(f => ({...f, name: e.target.value}))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Category</label>
              <select
                value={itemForm.categoryId}
                onChange={e => setItemForm(f => ({...f, categoryId: e.target.value}))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-800">{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={itemForm.price}
                onChange={e => setItemForm(f => ({...f, price: e.target.value}))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Description</label>
            <textarea
              rows={2}
              value={itemForm.description}
              onChange={e => setItemForm(f => ({...f, description: e.target.value}))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
          <button onClick={saveItem} className="w-full py-2.5 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer">
            Save Item
          </button>
        </div>
      </Modal>

      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Add Menu Item" size="lg">
        <div className="space-y-4">
          {canUseInventory && sourceSwitch(bulkSource, setBulkSource, () => setBulkForm(f => ({ ...f, inventoryItemId: null })))}
          {bulkSource === 'inventory' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Inventory Item <span className="text-red-500">*</span>
              </label>
              {inventoryPicker(bulkForm.inventoryItemId, pickBulkInventory)}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Orders from any of the selected menus deduct the same quantity from this stock item.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bulkForm.name}
                onChange={e => setBulkForm(f => ({...f, name: e.target.value}))}
                placeholder="e.g. Paneer Butter Masala"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={bulkForm.categoryId}
                onChange={e => setBulkForm(f => ({...f, categoryId: e.target.value}))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-800">{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={bulkForm.description}
              onChange={e => setBulkForm(f => ({...f, description: e.target.value}))}
              placeholder="Brief description or key ingredients..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
            />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Target Menus & Pricing</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Select which menus will receive this item and set each price</p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => toggleAllMenus(true)}
                  className="px-2 py-1 text-xs font-semibold text-primary dark:text-blue-400 hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllMenus(false)}
                  className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Quick Fill Base Price:</span>
              <div className="flex items-center gap-2">
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={basePrice}
                    onChange={e => setBasePrice(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyBasePrice}
                  className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  Apply to Selected
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TABS.map(t => {
                const isChecked = !!bulkForm.menus[t.id];
                const alreadyLinked = bulkSource === 'inventory' && bulkLinkedMenus.has(t.id);
                const meta = MENU_META[t.id] || { label: t.label, icon: '📋', type: 'Menu', bgActive: 'bg-slate-50 dark:bg-slate-800 border-primary' };
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isChecked
                        ? meta.bgActive
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={alreadyLinked}
                          onChange={e =>
                            setBulkForm(f => ({
                              ...f,
                              menus: { ...f.menus, [t.id]: e.target.checked }
                            }))
                          }
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <img src={meta.logo} alt={meta.label} className={`w-4 h-4 object-contain shrink-0 ${(t.id === 'AC' || t.id === 'NON_AC') ? 'dark:brightness-0 dark:invert' : ''}`} />
                          <span>{meta.label}</span>
                        </span>
                      </label>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {alreadyLinked ? 'Already on this menu' : meta.type}
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={!isChecked}
                        placeholder={isChecked ? 'Enter price' : 'Enable to set price'}
                        value={bulkForm.prices[t.id] || ''}
                        onChange={e =>
                          setBulkForm(f => ({
                            ...f,
                            prices: { ...f.prices, [t.id]: e.target.value }
                          }))
                        }
                        className={`w-full pl-7 pr-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${
                          isChecked
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
                            : 'bg-slate-100/80 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed placeholder:text-slate-400/80 dark:placeholder:text-slate-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setBulkModal(false)}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submitBulk(false)}
              className="flex-2 py-2.5 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Add Item to Selected Menus
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!conflictDialog} onClose={() => setConflictDialog(null)} title="Item Already Exists" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary dark:text-slate-300">{conflictDialog?.message}</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setConflictDialog(null)} className="flex-1 py-2 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">Skip / Cancel</button>
            <button onClick={() => submitBulk(true)} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light">Update Existing</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
