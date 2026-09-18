import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Package, Plus, Edit, Trash2, BarChart3, AlertTriangle, History, Filter, RotateCcw, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { inventoryBlue } from '../assets';
import MasterColumnFilter from '../components/ui/MasterColumnFilter';
import Pagination from '../components/ui/Pagination';

const INVENTORY_COLUMNS = [
  { key: 'name', label: 'Item Name', sortType: 'text' },
  { key: 'currentStock', label: 'Current Stock', sortType: 'number' },
  { key: 'unit', label: 'Unit', sortType: 'text' },
  { key: 'lowStockThreshold', label: 'Threshold', sortType: 'number' },
  { key: 'status', label: 'Status', sortType: 'text' },
];

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [columnFilters, setColumnFilters] = useState({});
  const [columnSort, setColumnSort] = useState(null);
  const [activeFilterPopover, setActiveFilterPopover] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, columnSort]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);

  const [addForm, setAddForm] = useState({ name: '', currentStock: '', unit: 'kg', lowStockThreshold: '0' });
  const [editForm, setEditForm] = useState({ name: '', unit: '', lowStockThreshold: '' });

  const ADJUSTMENT_REASONS = [
    'Used',
    'Buyed Inventory',
    'Wastage',
    'Damaged',
    'Counting correction',
    'Stock received outside purchase',
    'Other'
  ];
  const [adjustDirection, setAdjustDirection] = useState('reduce');
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: ADJUSTMENT_REASONS[0], notes: '' });

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await api.get('/inventory');
      setItems(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useOnRouteActive(() => {
    fetchItems();
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', {
        name: addForm.name,
        currentStock: parseFloat(addForm.currentStock) || 0,
        unit: addForm.unit,
        lowStockThreshold: parseFloat(addForm.lowStockThreshold) || 0
      });
      toast.success('Inventory item added');
      setAddModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item');
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({
      name: item.name,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold?.toString() || '0'
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/inventory/${editItem.id}`, {
        name: editForm.name,
        unit: editForm.unit,
        lowStockThreshold: parseFloat(editForm.lowStockThreshold) || 0
      });
      toast.success('Inventory item updated');
      setEditItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update item');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/inventory/${deleteItem.id}`);
      toast.success('Inventory item deleted');
      setDeleteItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const rawQty = parseFloat(adjustForm.quantity);
    if (isNaN(rawQty) || rawQty <= 0) {
      toast.error('Please enter a valid quantity greater than 0');
      return;
    }
    const finalQty = adjustDirection === 'reduce' ? -Math.abs(rawQty) : Math.abs(rawQty);

    try {
      const fullNotes = adjustForm.notes ? `[${adjustForm.reason}] ${adjustForm.notes}` : `[${adjustForm.reason}]`;
      await api.post('/inventory/adjust', {
        inventoryItemId: adjustItem.id,
        quantity: finalQty,
        type: 'MANUAL_ADJUSTMENT',
        notes: fullNotes
      });
      toast.success('Stock adjusted successfully');
      setAdjustItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error?.message || 'Failed to adjust stock');
    }
  };

  const openHistory = async (item) => {
    setHistoryItem(item);
    setTransactionsLoading(true);
    setTransactions([]);
    try {
      const res = await api.get(`/inventory/${item.id}`);
      setTransactions(res.data?.transactions || res.data?.value?.transactions || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const itemsWithMeta = useMemo(() => {
    return items.map((item) => {
      const stock = parseFloat(item.currentStock) || 0;
      const threshold = parseFloat(item.lowStockThreshold) || 0;
      const isLow = stock <= threshold;
      const status = isLow ? 'Low Stock' : 'In Stock';
      const stockFormatted = stock.toFixed(2);
      const thresholdFormatted = threshold.toFixed(2);

      return {
        item,
        id: item.id,
        name: item.name || '',
        currentStock: stockFormatted,
        rawCurrentStock: stock,
        unit: item.unit || '',
        lowStockThreshold: thresholdFormatted,
        rawLowStockThreshold: threshold,
        status,
        isLow,
      };
    });
  }, [items]);

  const columnDistinctValues = useMemo(() => {
    const maps = {
      name: new Map(),
      currentStock: new Map(),
      unit: new Map(),
      lowStockThreshold: new Map(),
      status: new Map(),
    };

    itemsWithMeta.forEach((row) => {
      maps.name.set(row.name, (maps.name.get(row.name) || 0) + 1);
      maps.currentStock.set(row.currentStock, (maps.currentStock.get(row.currentStock) || 0) + 1);
      maps.unit.set(row.unit, (maps.unit.get(row.unit) || 0) + 1);
      maps.lowStockThreshold.set(row.lowStockThreshold, (maps.lowStockThreshold.get(row.lowStockThreshold) || 0) + 1);
      maps.status.set(row.status, (maps.status.get(row.status) || 0) + 1);
    });

    return {
      name: Array.from(maps.name.entries()).map(([v, count]) => ({ value: v, count })),
      currentStock: Array.from(maps.currentStock.entries()).map(([v, count]) => ({ value: v, count })),
      unit: Array.from(maps.unit.entries()).map(([v, count]) => ({ value: v, count })),
      lowStockThreshold: Array.from(maps.lowStockThreshold.entries()).map(([v, count]) => ({ value: v, count })),
      status: Array.from(maps.status.entries()).map(([v, count]) => ({ value: v, count })),
    };
  }, [itemsWithMeta]);

  const displayedItems = useMemo(() => {
    let list = itemsWithMeta.filter((row) => {

      for (const [colKey, selectedSet] of Object.entries(columnFilters)) {
        if (!selectedSet || selectedSet.size === 0) continue;
        if (selectedSet.has('__EMPTY__')) return false;

        const val = row[colKey];
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
        if (columnKey === 'currentStock') {
          cmp = a.rawCurrentStock - b.rawCurrentStock;
        } else if (columnKey === 'lowStockThreshold') {
          cmp = a.rawLowStockThreshold - b.rawLowStockThreshold;
        } else {
          cmp = String(a[colKey] || '').localeCompare(String(b[colKey] || ''));
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [itemsWithMeta, columnFilters, columnSort]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedItems.slice(start, start + pageSize);
  }, [displayedItems, currentPage, pageSize]);

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
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-white flex items-center gap-2">
          <img src={inventoryBlue} alt="Inventory" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
          Inventory Management
        </h1>
        {hasPermission('INVENTORY_CREATE') && (
          <button
            onClick={() => {
              setAddForm({ name: '', currentStock: '', unit: 'kg', lowStockThreshold: '0' });
              setAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors w-full sm:w-auto min-h-[42px] cursor-pointer shadow-xs"
          >
            <Plus size={18} /> Add Item
          </button>
        )}
      </div>

      {hasActiveColumnFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary dark:text-blue-400 flex items-center gap-1.5">
              <Filter size={13} className="text-primary dark:text-blue-400" /> Active Master Filters:
            </span>
            {Object.entries(columnFilters).map(([key, set]) => {
              const col = INVENTORY_COLUMNS.find((c) => c.key === key);
              const label = col?.label || key;
              const count = set.size;
              const sample = Array.from(set).slice(0, 2).join(', ');
              const more = count > 2 ? ` +${count - 2} more` : '';
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs"
                >
                  <span>{label}: <strong>{sample}{more}</strong></span>
                  <button
                    onClick={() => handleApplyFilter(key, null)}
                    className="text-text-secondary dark:text-slate-400 hover:text-danger p-0.5 transition-colors"
                    title={`Clear ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {columnSort && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs">
                <span>
                  Sorted: <strong>{INVENTORY_COLUMNS.find((c) => c.key === columnSort.columnKey)?.label}</strong> (
                  {columnSort.direction === 'asc' ? 'Ascending' : 'Descending'})
                </span>
                <button
                  onClick={() => setColumnSort(null)}
                  className="text-text-secondary dark:text-slate-400 hover:text-danger p-0.5 transition-colors"
                  title="Clear sort"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-text-secondary dark:text-slate-400 text-[11px]">
              Showing <strong>{displayedItems.length}</strong> of {itemsWithMeta.length} items
            </span>
            <button
              onClick={clearAllFilters}
              className="text-primary dark:text-blue-400 hover:text-primary-dark hover:underline font-semibold flex items-center gap-1 text-[11px] transition-colors"
            >
              <RotateCcw size={11} /> Reset All
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead className="bg-surface dark:bg-slate-800/80 border-b border-border dark:border-slate-700">
              <tr className="text-left text-text-secondary dark:text-slate-400">
                {INVENTORY_COLUMNS.map((col) => {
                  const isFiltered = columnFilters[col.key] && columnFilters[col.key].size > 0;
                  const isSorted = columnSort?.columnKey === col.key;
                  return (
                    <th key={col.key} className="px-5 py-4 tablet-table-cell font-medium relative group/th">
                      <div className="flex items-center justify-between gap-1.5 select-none">
                        <span>{col.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilterForHeader(col.key, col.label, e.currentTarget, col.sortType);
                          }}
                          className={`p-1 rounded transition-all duration-150 cursor-pointer ${
                            isFiltered || isSorted
                              ? 'opacity-100 text-primary bg-primary/15 border border-primary/30 shadow-xs'
                              : 'opacity-60 sm:opacity-0 sm:group-hover/th:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
                          }`}
                          title={`Master Filter: ${col.label}`}
                        >
                          <Filter size={12} className={isFiltered ? 'fill-primary text-primary' : ''} />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="px-5 py-4 tablet-table-cell font-medium text-right text-text-secondary dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-800">
              {displayedItems.length > 0 ? (
                paginatedItems.map((row) => {
                  const item = row.item;
                  const stock = row.rawCurrentStock;
                  const threshold = row.rawLowStockThreshold;
                  const isLow = row.isLow;

                  return (
                    <tr key={item.id} className={`hover:bg-surface/50 dark:hover:bg-slate-800/50 transition-colors ${isLow ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30' : ''}`}>

                      <td className="px-5 py-4 tablet-table-cell font-medium text-text dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('name', 'Item Name', e.currentTarget, row.name, 'text');
                            }}
                            className="opacity-40 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.name}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 tablet-table-cell font-mono font-medium text-text dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.currentStock}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('currentStock', 'Current Stock', e.currentTarget, row.currentStock, 'number');
                            }}
                            className="opacity-40 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.currentStock}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 tablet-table-cell text-text-secondary dark:text-slate-300 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.unit}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('unit', 'Unit', e.currentTarget, row.unit, 'text');
                            }}
                            className="opacity-40 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.unit}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 tablet-table-cell font-mono text-text-secondary dark:text-slate-300 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.lowStockThreshold}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('lowStockThreshold', 'Threshold', e.currentTarget, row.lowStockThreshold, 'number');
                            }}
                            className="opacity-40 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.lowStockThreshold}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 tablet-table-cell relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          {isLow ? (
                            <Badge variant="danger" className="flex items-center w-fit gap-1">
                              <AlertTriangle size={12} /> Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('status', 'Status', e.currentTarget, row.status, 'text');
                            }}
                            className="opacity-40 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
                            title={`Master filter: ${row.status}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 tablet-table-cell text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openHistory(item)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                            title="View History"
                          >
                            <History size={16} />
                          </button>
                          {hasPermission('INVENTORY_ADJUST') && (
                            <button
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustDirection('reduce');
                                setAdjustForm({ quantity: '', reason: 'Used', notes: '' });
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                              title="Adjust Stock"
                            >
                              <BarChart3 size={16} />
                            </button>
                          )}
                          {hasPermission('INVENTORY_EDIT') && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                                title="Edit Item"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteItem(item)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-text-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={32} className="text-border" />
                      <p className="font-medium text-text">
                        {hasActiveColumnFilters ? 'No matching inventory items found' : 'No inventory items found. Add some to get started.'}
                      </p>
                      {hasActiveColumnFilters && (
                        <p className="text-xs text-text-secondary">
                          Try adjusting or clearing your Master Column Filters.
                        </p>
                      )}
                      {hasActiveColumnFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-light shadow-xs transition-colors"
                        >
                          <RotateCcw size={12} /> Reset All Master Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && displayedItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={displayedItems.length}
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

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Inventory Item" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Item Name</label>
            <input required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. Potatoes" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Initial Stock</label>
              <input required type="number" step="0.01" value={addForm.currentStock} onChange={e => setAddForm({ ...addForm, currentStock: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Unit</label>
              <input required value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="kg, liters, pcs" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Low Stock Threshold</label>
            <input required type="number" step="0.01" value={addForm.lowStockThreshold} onChange={e => setAddForm({ ...addForm, lowStockThreshold: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="0.00" />
          </div>
          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t border-border dark:border-slate-800">
            <button type="button" onClick={() => setAddModalOpen(false)} className="w-full sm:w-auto px-4 py-2.5 text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors min-h-[42px] flex items-center justify-center cursor-pointer">Cancel</button>
            <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors min-h-[42px] flex items-center justify-center cursor-pointer shadow-xs">Add Item</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item" size="md">
        {editItem && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Item Name</label>
              <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Unit</label>
                <input required value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Low Stock Threshold</label>
                <input required type="number" step="0.01" value={editForm.lowStockThreshold} onChange={e => setEditForm({ ...editForm, lowStockThreshold: e.target.value })} className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 italic">Note: Stock levels must be modified using the "Adjust Stock" feature.</p>
            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t border-border dark:border-slate-800">
              <button type="button" onClick={() => setEditItem(null)} className="w-full sm:w-auto px-4 py-2.5 text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors min-h-[42px] flex items-center justify-center cursor-pointer">Cancel</button>
              <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors min-h-[42px] flex items-center justify-center cursor-pointer shadow-xs">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete Item" size="sm">
        {deleteItem && (
          <div className="space-y-4">
            <p className="text-text dark:text-slate-100">Are you sure you want to delete <span className="font-semibold">{deleteItem.name}</span>?</p>
            <p className="text-sm text-text-secondary dark:text-slate-400">This will permanently remove the item and its history. This action cannot be undone.</p>
            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t border-border dark:border-slate-800">
              <button onClick={() => setDeleteItem(null)} className="w-full sm:w-auto px-4 py-2.5 text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors min-h-[42px] flex items-center justify-center cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="w-full sm:w-auto px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors min-h-[42px] flex items-center justify-center cursor-pointer shadow-xs">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!adjustItem} onClose={() => setAdjustItem(null)} title={`Adjust Stock: ${adjustItem?.name || ''}`} size="md">
        {adjustItem && (() => {
          const current = parseFloat(adjustItem.currentStock) || 0;
          const rawAdj = parseFloat(adjustForm.quantity) || 0;
          const delta = adjustDirection === 'reduce' ? -Math.abs(rawAdj) : Math.abs(rawAdj);
          const newStock = current + delta;

          return (
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="bg-surface dark:bg-slate-800/80 p-4 rounded-lg flex items-center justify-between border border-border dark:border-slate-700">
                <div>
                  <span className="text-xs text-text-secondary dark:text-slate-400 font-medium uppercase tracking-wider block">Current Stock</span>
                  <span className="font-mono text-xl font-bold text-text dark:text-slate-100">{current.toFixed(2)} <span className="text-sm font-normal text-text-secondary dark:text-slate-400">{adjustItem.unit}</span></span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-secondary dark:text-slate-400 font-medium uppercase tracking-wider block">After Adjustment</span>
                  <span className={`font-mono text-xl font-bold ${newStock < 0 ? 'text-red-600 dark:text-red-400' : 'text-primary dark:text-blue-400'}`}>
                    {newStock.toFixed(2)} <span className="text-sm font-normal text-text-secondary dark:text-slate-400">{adjustItem.unit}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-200 mb-1.5 uppercase tracking-wider">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('reduce')}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer ${
                      adjustDirection === 'reduce'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-300 border-border dark:border-slate-700 hover:bg-surface dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>−</span> Deduct / Used
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('add')}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer ${
                      adjustDirection === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-300 border-border dark:border-slate-700 hover:bg-surface dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>+</span> Add / Buyed
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-200 mb-1.5 uppercase tracking-wider">Reason *</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => {
                    const r = e.target.value;
                    setAdjustForm({ ...adjustForm, reason: r });
                    if (['Used', 'Wastage', 'Damaged'].includes(r)) {
                      setAdjustDirection('reduce');
                    } else if (['Buyed Inventory', 'Stock received outside purchase'].includes(r)) {
                      setAdjustDirection('add');
                    }
                  }}
                  className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-200 mb-1.5 uppercase tracking-wider">
                  Quantity ({adjustItem.unit}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-text-secondary dark:text-slate-400">
                    {adjustDirection === 'reduce' ? '−' : '+'}
                  </span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adjustForm.quantity}
                    onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. 5 or 2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-200 mb-1.5 uppercase tracking-wider">Notes (Optional)</label>
                <input
                  value={adjustForm.notes}
                  onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm min-h-[42px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Additional details (e.g. used for party, bought from local market)..."
                />
              </div>

              {newStock < 0 && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-lg border border-red-200 dark:border-red-900/50">
                  Cannot reduce below zero stock! (Available: {current} {adjustItem.unit})
                </div>
              )}

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t border-border dark:border-slate-800">
                <button type="button" onClick={() => setAdjustItem(null)} className="w-full sm:w-auto px-4 py-2.5 text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors min-h-[42px] flex items-center justify-center cursor-pointer">Cancel</button>
                <button
                  type="submit"
                  disabled={newStock < 0 || !adjustForm.quantity || parseFloat(adjustForm.quantity) <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[42px] flex items-center justify-center cursor-pointer"
                >
                  Confirm Adjustment ({adjustDirection === 'reduce' ? '-' : '+'}{rawAdj || 0} {adjustItem.unit})
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      <Modal isOpen={!!historyItem} onClose={() => setHistoryItem(null)} title={`Stock History: ${historyItem?.name}`} size="lg">
        <div className="space-y-4">
          {transactionsLoading ? (
            <div className="py-12 flex justify-center"><Spinner size="md" /></div>
          ) : transactions.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <div className="relative border-l-2 border-border dark:border-slate-800 ml-3 space-y-6 pb-2">
                {transactions.map((tx, idx) => {
                  const isPositive = parseFloat(tx.quantity) > 0;

                  let badgeType = 'default';
                  let txLabel = tx.type;

                  if (tx.type === 'PURCHASE') { badgeType = 'success'; txLabel = 'Purchase'; }
                  else if (tx.type === 'PURCHASE_REVERSAL') { badgeType = 'danger'; txLabel = 'Purchase Reversal'; }
                  else if (tx.type === 'MANUAL_ADJUSTMENT') { badgeType = 'info'; txLabel = 'Adjustment'; }

                  return (
                    <div key={tx.id || idx} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="bg-surface dark:bg-slate-800/80 rounded-lg border border-border dark:border-slate-700 p-3 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-secondary dark:text-slate-400">
                              {tx.createdAt ? format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown Date'}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant={badgeType}>{txLabel}</Badge>
                              {tx.reference && <span className="text-xs text-text-secondary dark:text-slate-400 font-mono">Ref: {tx.reference}</span>}
                            </div>
                          </div>
                          <div className={`font-mono font-bold text-lg ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPositive ? '+' : ''}{parseFloat(tx.quantity).toFixed(2)} <span className="text-sm font-normal text-text-secondary dark:text-slate-400">{historyItem?.unit}</span>
                          </div>
                        </div>
                        {tx.notes && (
                          <p className="text-sm text-text-secondary dark:text-slate-300 mt-1 bg-white dark:bg-slate-900/70 p-2 rounded border border-border/50 dark:border-slate-700/60">
                            {tx.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary dark:text-slate-400">
              No transactions found for this item.
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
