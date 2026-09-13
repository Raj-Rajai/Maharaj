import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Edit, Trash2, Package, X, Check, Filter, RotateCcw } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { purchasesBlue } from '../assets';
import MasterColumnFilter from '../components/ui/MasterColumnFilter';

const PURCHASE_TYPES_LIST = [
  'Fruits & Vegetables',
  'Groceries & Staples',
  'Spices & Masalas',
  'Dairy & Bakery',
  'Cooking Essentials',
  'Beverages',
  'Packaged Foods',
  'Utensils',
  'Disposables',
  'General Essentials',
  'Others',
];

const PURCHASE_COLUMNS = [
  { key: 'purchaseDate', label: 'Date', sortType: 'date' },
  { key: 'supplierName', label: 'Type of Purchase', sortType: 'text' },
  { key: 'itemsCount', label: 'Items', sortType: 'number' },
  { key: 'totalAmount', label: 'Total Amount', sortType: 'number' },
  { key: 'status', label: 'Status', sortType: 'text' },
];

export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    supplierId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseNumber: '',
    addToInventory: false,
    items: [{ name: '', quantity: '', unit: 'kg', rate: '' }]
  });

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  const fetchPurchases = async () => {
    try {
      const res = await api.get('/purchases');
      setPurchases(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch (error) {
      toast.error('Failed to load purchases');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch (error) {
      toast.error('Failed to load suppliers');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPurchases();
      await fetchSuppliers();
      setLoading(false);
    };
    loadData();
  }, []);

  useOnRouteActive(() => {
    fetchPurchases();
    fetchSuppliers();
  });

  const sortedPurchaseTypes = useMemo(() => {
    return suppliers
      .filter(s => PURCHASE_TYPES_LIST.includes(s.name))
      .sort((a, b) => {
        return PURCHASE_TYPES_LIST.indexOf(a.name) - PURCHASE_TYPES_LIST.indexOf(b.name);
      });
  }, [suppliers]);

  const handleOpenModal = (purchase = null) => {
    if (purchase) {
      setEditId(purchase.id);
      setForm({
        supplierId: purchase.supplierId || (purchase.supplier?.id) || '',
        purchaseDate: purchase.purchaseDate ? new Date(purchase.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        purchaseNumber: purchase.purchaseNumber || '',
        addToInventory: purchase.addToInventory !== undefined ? !!purchase.addToInventory : true,
        items: purchase.items?.length
          ? purchase.items.map(i => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit || 'kg',
              rate: i.rate
            }))
          : [{ name: '', quantity: '', unit: 'kg', rate: '' }]
      });
    } else {
      setEditId(null);
      setForm({
        supplierId: sortedPurchaseTypes.length > 0 ? sortedPurchaseTypes[0].id : (suppliers.length > 0 ? suppliers[0].id : ''),
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseNumber: '',
        addToInventory: true,
        items: [{ name: '', quantity: '', unit: 'kg', rate: '' }]
      });
    }
    setModalOpen(true);
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: '', unit: 'kg', rate: '' }]
    }));
  };

  const removeItem = (index) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const calculateTotal = () => {
    return form.items.reduce((total, item) => {
      const q = parseFloat(item.quantity) || 0;
      const r = parseFloat(item.rate) || 0;
      return total + (q * r);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.supplierId) {
      toast.error('Please select Type of Purchase');
      return;
    }

    const validItems = form.items.filter(i => i.name.trim() && i.quantity && i.rate);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    try {
      const payload = {
        supplierId: form.supplierId,
        purchaseDate: form.purchaseDate,
        purchaseNumber: form.purchaseNumber || undefined,
        addToInventory: form.addToInventory,
        items: validItems.map(i => ({
          name: i.name,
          quantity: Number(i.quantity),
          unit: i.unit,
          rate: Number(i.rate)
        }))
      };

      if (editId) {
        await api.patch(`/purchases/${editId}`, payload);
        toast.success('Purchase updated successfully');
      } else {
        await api.post('/purchases', payload);
        toast.success('Purchase created successfully');
      }

      setModalOpen(false);
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error?.message || 'Failed to save purchase');
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm('Are you sure you want to cancel this purchase? This action cannot be undone.')) {
      try {
        await api.delete(`/purchases/${id}`);
        toast.success('Purchase cancelled');
        fetchPurchases();
      } catch (err) {
        toast.error('Failed to cancel purchase');
      }
    }
  };

  const [columnFilters, setColumnFilters] = useState({});
  const [columnSort, setColumnSort] = useState(null);
  const [activeFilterPopover, setActiveFilterPopover] = useState(null);

  const purchasesWithMeta = useMemo(() => {
    return purchases.map((p) => {
      const d = new Date(p.purchaseDate);
      const dateFormatted = isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN');
      const supplierName = p.supplier?.name || '-';
      const itemsCount = `${p.items?.length || 0} items`;
      const totalAmount = Number(p.totalAmount || 0);
      const status = p.status || 'ACTIVE';

      return {
        purchase: p,
        purchaseDate: dateFormatted,
        timestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
        supplierName,
        itemsCount,
        rawItemsCount: p.items?.length || 0,
        totalAmount,
        totalAmountFormatted: `₹${totalAmount.toFixed(2)}`,
        status,
        addToInventory: !!p.addToInventory,
      };
    });
  }, [purchases]);

  const columnDistinctValues = useMemo(() => {
    const maps = {
      purchaseDate: new Map(),
      supplierName: new Map(),
      itemsCount: new Map(),
      totalAmount: new Map(),
      status: new Map(),
    };

    purchasesWithMeta.forEach((row) => {
      maps.purchaseDate.set(row.purchaseDate, (maps.purchaseDate.get(row.purchaseDate) || 0) + 1);
      maps.supplierName.set(row.supplierName, (maps.supplierName.get(row.supplierName) || 0) + 1);
      maps.itemsCount.set(row.itemsCount, (maps.itemsCount.get(row.itemsCount) || 0) + 1);
      maps.totalAmount.set(row.totalAmountFormatted, (maps.totalAmount.get(row.totalAmountFormatted) || 0) + 1);
      maps.status.set(row.status, (maps.status.get(row.status) || 0) + 1);
    });

    return {
      purchaseDate: Array.from(maps.purchaseDate.entries()).map(([v, count]) => ({ value: v, count })),
      supplierName: Array.from(maps.supplierName.entries()).map(([v, count]) => ({ value: v, count })),
      itemsCount: Array.from(maps.itemsCount.entries()).map(([v, count]) => ({ value: v, count })),
      totalAmount: Array.from(maps.totalAmount.entries()).map(([v, count]) => ({ value: v, count })),
      status: Array.from(maps.status.entries()).map(([v, count]) => ({ value: v, count })),
    };
  }, [purchasesWithMeta]);

  const displayedPurchases = useMemo(() => {
    let list = purchasesWithMeta.filter((row) => {

      if (filterDate) {
        const pDate = new Date(row.purchase.purchaseDate).toISOString().split('T')[0];
        if (pDate !== filterDate) return false;
      }

      if (filterStatus !== 'ALL' && row.status !== filterStatus) return false;

      for (const [colKey, selectedSet] of Object.entries(columnFilters)) {
        if (!selectedSet || selectedSet.size === 0) continue;
        if (selectedSet.has('__EMPTY__')) return false;

        let val = row[colKey];
        if (colKey === 'totalAmount') {
          val = row.totalAmountFormatted;
        }
        if (!selectedSet.has(val)) {
          return false;
        }
      }
      return true;
    });

    if (columnSort?.columnKey && columnSort?.direction) {
      const { columnKey, direction } = columnSort;
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (columnKey === 'totalAmount') {
          cmp = a.totalAmount - b.totalAmount;
        } else if (columnKey === 'purchaseDate') {
          cmp = a.timestamp - b.timestamp;
        } else if (columnKey === 'itemsCount') {
          cmp = a.rawItemsCount - b.rawItemsCount;
        } else {
          cmp = String(a[colKey] || '').localeCompare(String(b[colKey] || ''));
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [purchasesWithMeta, filterDate, filterStatus, columnFilters, columnSort]);

  const openFilterForHeader = (colKey, colLabel, element, sortType) => {
    const rect = element.getBoundingClientRect();
    setActiveFilterPopover({
      columnKey: colKey,
      columnLabel: colLabel,
      anchorRect: rect,
      targetCellValue: null,
      sortType: sortType || 'text',
    });
  };

  const openFilterForCell = (colKey, colLabel, element, cellValue, sortType) => {
    const rect = element.getBoundingClientRect();
    setActiveFilterPopover({
      columnKey: colKey,
      columnLabel: colLabel,
      anchorRect: rect,
      targetCellValue: cellValue,
      sortType: sortType || 'text',
    });
  };

  const handleApplyFilter = (columnKey, selectedSet) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!selectedSet || selectedSet.size === 0) {
        delete next[columnKey];
      } else {
        next[columnKey] = selectedSet;
      }
      return next;
    });
  };

  const handleApplySort = (columnKey, direction) => {
    if (!direction) {
      setColumnSort((prev) => (prev?.columnKey === columnKey ? null : prev));
    } else {
      setColumnSort({ columnKey, direction });
    }
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setColumnSort(null);
  };

  const hasActiveColumnFilters = Object.keys(columnFilters).length > 0 || !!columnSort;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <img src={purchasesBlue} alt="Purchases" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
          Purchases
        </h1>
        {hasPermission('PURCHASE_CREATE') && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus size={18} /> Add Inventory / Purchase
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="flex-1 flex items-center">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="ml-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'CANCELLED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                filterStatus === status
                  ? 'bg-gray-800 dark:bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {hasActiveColumnFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-xl text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary dark:text-blue-400 flex items-center gap-1.5">
              <Filter size={13} className="text-primary dark:text-blue-400" /> Active Master Filters:
            </span>
            {Object.entries(columnFilters).map(([key, set]) => {
              const col = PURCHASE_COLUMNS.find((c) => c.key === key);
              const label = col?.label || key;
              const count = set.size;
              const sample = Array.from(set).slice(0, 2).join(', ');
              const more = count > 2 ? ` +${count - 2} more` : '';
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs"
                >
                  <span>{label}: <strong>{sample}{more}</strong></span>
                  <button
                    onClick={() => handleApplyFilter(key, null)}
                    className="text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                    title={`Clear ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {columnSort && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs">
                <span>
                  Sorted: <strong>{PURCHASE_COLUMNS.find((c) => c.key === columnSort.columnKey)?.label}</strong> (
                  {columnSort.direction === 'asc' ? 'Ascending' : 'Descending'})
                </span>
                <button
                  onClick={() => setColumnSort(null)}
                  className="text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                  title="Clear sort"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-text-secondary dark:text-slate-400 text-[11px]">
              Showing <strong>{displayedPurchases.length}</strong> of {purchasesWithMeta.length} purchases
            </span>
            <button
              onClick={clearAllFilters}
              className="text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 hover:underline font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
            >
              <RotateCcw size={11} /> Reset All
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
              <tr>
                {PURCHASE_COLUMNS.map((col) => {
                  const isFiltered = columnFilters[col.key] && columnFilters[col.key].size > 0;
                  const isSorted = columnSort?.columnKey === col.key;
                  return (
                    <th key={col.key} className="px-6 py-4 font-semibold relative group/th">
                      <div className="flex items-center justify-between gap-1.5 select-none">
                        <span>{col.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterForHeader(col.key, col.label, e.currentTarget, col.sortType);
                          }}
                          className={`p-1 rounded transition-all duration-150 cursor-pointer ${
                            isFiltered || isSorted
                              ? 'opacity-100 text-primary dark:text-blue-400 bg-primary/15 dark:bg-blue-950/60 border border-primary/30 dark:border-blue-800 shadow-xs'
                              : 'opacity-0 group-hover/th:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
                          }`}
                          title={`Master Filter: ${col.label}`}
                        >
                          <Filter size={12} className={isFiltered ? 'fill-primary text-primary dark:text-blue-400' : ''} />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
              {displayedPurchases.length > 0 ? (
                displayedPurchases.map((row) => {
                  const p = row.purchase;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">

                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-slate-300 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.purchaseDate}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('purchaseDate', 'Date', e.currentTarget, row.purchaseDate, 'date');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.purchaseDate}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.supplierName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('supplierName', 'Type of Purchase', e.currentTarget, row.supplierName, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.supplierName}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600 dark:text-slate-400 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span>{row.itemsCount}</span>
                            {row.addToInventory && (
                              <span title="Added to Inventory" className="inline-flex items-center justify-center p-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full">
                                <Package size={14} />
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('itemsCount', 'Items', e.currentTarget, row.itemsCount, 'number');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.itemsCount}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono font-medium text-gray-900 dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.totalAmountFormatted}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('totalAmount', 'Total Amount', e.currentTarget, row.totalAmountFormatted, 'number');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.totalAmountFormatted}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          {p.status === 'CANCELLED' ? (
                            <Badge variant="error">CANCELLED</Badge>
                          ) : (
                            <Badge variant="success">ACTIVE</Badge>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('status', 'Status', e.currentTarget, row.status, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.status}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {hasPermission('PURCHASE_EDIT') && (
                            <button
                              onClick={() => handleOpenModal(p)}
                              className="text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                          )}
                          {hasPermission('PURCHASE_DELETE') && p.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancel(p.id)}
                              className="text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Cancel Purchase"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                    <p className="font-medium text-gray-900 dark:text-slate-200">No purchases found</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      {hasActiveColumnFilters
                        ? 'Try clearing some column filters or expanding the date filter.'
                        : 'No purchases found for the selected criteria.'}
                    </p>
                    {hasActiveColumnFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} /> Reset All Master Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MasterColumnFilter
        isOpen={!!activeFilterPopover}
        onClose={() => setActiveFilterPopover(null)}
        anchorRect={activeFilterPopover?.anchorRect}
        columnKey={activeFilterPopover?.columnKey}
        columnLabel={activeFilterPopover?.columnLabel}
        allValues={activeFilterPopover ? columnDistinctValues[activeFilterPopover.columnKey] || [] : []}
        selectedValues={activeFilterPopover ? columnFilters[activeFilterPopover.columnKey] : null}
        onApplyFilter={(selectedSet) => {
          if (activeFilterPopover) {
            handleApplyFilter(activeFilterPopover.columnKey, selectedSet);
          }
        }}
        sortConfig={columnSort}
        onApplySort={(direction) => {
          if (activeFilterPopover) {
            handleApplySort(activeFilterPopover.columnKey, direction);
          }
        }}
        targetCellValue={activeFilterPopover?.targetCellValue}
        sortType={activeFilterPopover?.sortType || 'text'}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Purchase / Inventory' : 'Add Inventory (Record Purchase)'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Type of Purchase *</label>
              <select
                required
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="" disabled>Select Type of Purchase</option>
                {sortedPurchaseTypes.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Purchase Date *</label>
              <input
                type="date"
                required
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Purchase Number (Optional)</label>
              <input
                type="text"
                placeholder="INV-12345"
                value={form.purchaseNumber}
                onChange={(e) => setForm({ ...form, purchaseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg">
            <input
              type="checkbox"
              id="addToInventory"
              checked={form.addToInventory}
              onChange={(e) => setForm({ ...form, addToInventory: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-slate-600 rounded focus:ring-indigo-500 bg-white dark:bg-slate-800"
            />
            <label htmlFor="addToInventory" className="text-sm font-medium text-indigo-900 dark:text-indigo-200 select-none cursor-pointer flex items-center gap-2">
              <Package size={16} /> Add items to inventory stock automatically
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Purchase Items *</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus size={16} /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => {
                const rowTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                return (
                  <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-start bg-gray-50 dark:bg-slate-900/70 p-2 rounded-lg border border-gray-200 dark:border-slate-800">
                    <div className="flex-1 min-w-[150px]">
                      <input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-24">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                        <option value="dozen">dozen</option>
                        <option value="box">box</option>
                      </select>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-24 px-3 py-2 text-sm font-mono font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg border border-transparent flex items-center justify-end">
                      ₹{rowTotal.toFixed(2)}
                    </div>

                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors mt-0.5"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-4">
                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Total Amount:</span>
                <span className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300">
                  ₹{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Check size={18} /> {editId ? 'Update Purchase' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
