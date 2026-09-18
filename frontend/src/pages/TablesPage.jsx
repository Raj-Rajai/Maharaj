import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, Clock, Plus, Edit2, Trash2, Grid3x3, Check, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { dineInBlue, acBlue, nonAcBlue, tableBlue } from '../assets';

import { useRouteActive } from '../components/common/RouteKeepAlive';
import useRealtime from '../hooks/useRealtime';

const statusColors = { AVAILABLE: 'success', OCCUPIED: 'info', BILLING: 'warning' };

const typeColors = { AC: 'info', NON_AC: 'neutral' };

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [sessionModal, setSessionModal] = useState(null);
  const [guestCount, setGuestCount] = useState('');
  const [creating, setCreating] = useState(false);
  const [tableModal, setTableModal] = useState(null);
  const [tableForm, setTableForm] = useState({ number: '', capacity: 4, type: 'AC' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalTables, setOriginalTables] = useState([]);
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [pendingDeletes, setPendingDeletes] = useState(new Set());
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const isActive = useRouteActive();

  const fetchTables = async (opts = {}) => {
    try {
      if (!opts.background) setLoading(true);
      const res = await api.get('/tables', { skipCache: true });
      setTables(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch {
      if (!opts.background) toast.error('Failed to load tables');
    } finally {
      if (!opts.background) setLoading(false);
    }
  };

  // Instant real-time push for table updates & sessions
  useRealtime({
    'table:updated': () => {
      if (!isEditMode) fetchTables({ background: true });
    },
    'session:opened': () => {
      fetchTables({ background: true });
    },
    'session:closed': () => {
      fetchTables({ background: true });
    },
    'bill:created': () => {
      fetchTables({ background: true });
    },
    'bill:finalized': () => {
      fetchTables({ background: true });
    },
  }, isActive, ['tables', isEditMode]);

  useEffect(() => {
    if (!isActive) return;
    fetchTables({ background: tables.length > 0 });
    // Gentle 30s background fallback heartbeat (skip if user is actively in edit mode)
    const iv = setInterval(() => {
      if (!isEditMode) fetchTables({ background: true });
    }, 30000);
    return () => clearInterval(iv);
  }, [isActive, isEditMode]);

  const filtered = tables
    .filter(t => !pendingDeletes.has(t.id))
    .filter(t => {
      if (user?.role === 'AC_MASTER' && t.type !== 'AC') return false;
      if (user?.role === 'NON_AC_MASTER' && t.type !== 'NON_AC') return false;

      if (filter === 'ALL') return true;
      if (filter === 'AC' || filter === 'NON_AC') return t.type === filter;
      return t.status === filter;
    });

  const handleEnterEditMode = () => {
    setOriginalTables(JSON.parse(JSON.stringify(tables)));
    setPendingUpdates({});
    setPendingDeletes(new Set());
    setIsEditMode(true);
  };

  const handleCancelEditMode = () => {
    if (originalTables && originalTables.length > 0) {
      setTables(originalTables);
    }
    setPendingUpdates({});
    setPendingDeletes(new Set());
    setIsEditMode(false);
    toast('Table edits cancelled');
  };

  const handleSaveEditMode = async () => {
    const deleteIds = Array.from(pendingDeletes);
    const updateEntries = Object.entries(pendingUpdates);

    if (deleteIds.length === 0 && updateEntries.length === 0) {
      setIsEditMode(false);
      toast('No changes to save');
      return;
    }

    setIsSavingEdits(true);
    try {
      // 1. Process deletes
      for (const id of deleteIds) {
        await api.delete(`/tables/${id}`);
      }
      // 2. Process updates
      for (const [id, data] of updateEntries) {
        await api.patch(`/tables/${id}`, data);
      }
      toast.success('All table changes saved successfully');
      setPendingUpdates({});
      setPendingDeletes(new Set());
      setIsEditMode(false);
      await fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save some table changes');
      await fetchTables();
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleEditTableClick = (table, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const currentData = pendingUpdates[table.id] || table;
    setTableForm({ number: currentData.number, capacity: currentData.capacity, type: currentData.type });
    setTableModal(table);
  };

  const handleDeleteTableClick = (table, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (table.status !== 'AVAILABLE') {
      toast.error(`Cannot delete table ${table.number} because it is ${table.status.toLowerCase()}`);
      return;
    }
    if (isEditMode) {
      setPendingDeletes(prev => {
        const next = new Set(prev);
        next.add(table.id);
        return next;
      });
      setPendingUpdates(prev => {
        const next = { ...prev };
        delete next[table.id];
        return next;
      });
      toast(`Table ${table.number} marked for deletion (click Save to apply)`);
    } else {
      deleteTable(table.id, e);
    }
  };

  const openSession = async () => {
    if (!sessionModal) return;
    setCreating(true);
    try {
      await api.post('/table-sessions', { tableId: sessionModal.id, guestCount: guestCount ? parseInt(guestCount) : undefined });
      toast.success(`Table ${sessionModal.number} opened`);
      setSessionModal(null);
      navigate(`/tables/${sessionModal.id}/order`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to open table'); }
    finally { setCreating(false); }
  };

  const handleTableClick = (table) => {
    if (isEditMode) {
      if (table.status === 'AVAILABLE' && hasPermission('TABLE_EDIT')) {
        handleEditTableClick(table);
      }
      return;
    }
    if (table.status === 'AVAILABLE') { setSessionModal(table); setGuestCount(''); }
    else navigate(`/tables/${table.id}/order`);
  };

  const getSessionInfo = (table) => {
    const session = table.sessions?.find(s => s.status === 'OPEN');
    if (!session) return null;
    const mins = Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000);
    return { captain: session.captain?.name, mins };
  };

  const saveTable = async () => {
    const num = parseInt(tableForm.number);
    const cap = parseInt(tableForm.capacity);
    const typ = tableForm.type;

    if (isNaN(num) || num <= 0) {
      toast.error('Valid table number is required');
      return;
    }
    if (isNaN(cap) || cap <= 0) {
      toast.error('Valid capacity is required');
      return;
    }

    const duplicate = tables.find(t => t.number === num && t.id !== tableModal?.id && !pendingDeletes.has(t.id));
    if (duplicate) {
      toast.error(`Table ${num} already exists`);
      return;
    }

    if (tableModal === 'new') {
      try {
        const data = { number: num, capacity: cap, type: typ };
        await api.post('/tables', data);
        toast.success('Table created');
        setTableModal(null);
        fetchTables();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create table');
      }
      return;
    }

    // Editing an existing table
    if (isEditMode) {
      setTables(prev => prev.map(t => t.id === tableModal.id ? { ...t, number: num, capacity: cap, type: typ } : t));
      setPendingUpdates(prev => ({
        ...prev,
        [tableModal.id]: { number: num, capacity: cap, type: typ }
      }));
      toast.success(`Table ${num} updated (unsaved)`);
      setTableModal(null);
    } else {
      try {
        const data = { number: num, capacity: cap, type: typ };
        await api.patch(`/tables/${tableModal.id}`, data);
        toast.success('Table saved');
        setTableModal(null);
        fetchTables();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save table');
      }
    }
  };

  const deleteTable = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('Delete this table?')) return;
    try { await api.delete(`/tables/${id}`); toast.success('Table deleted'); fetchTables(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const filters = ['ALL', 'AC', 'NON_AC', 'AVAILABLE', 'OCCUPIED', 'BILLING'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
            <img src={dineInBlue} alt="Dine-In" className="w-5 sm:w-6 h-5 sm:h-6 object-contain dark:brightness-0 dark:invert" />
            Dine-In
          </h1>
          <div className="flex items-center gap-1.5 sm:hidden">
            {(hasPermission('TABLE_EDIT') || hasPermission('TABLE_DELETE')) && (
              !isEditMode ? (
                <button
                  type="button"
                  onClick={handleEnterEditMode}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer shadow-xs hover:bg-surface"
                  title="Edit tables"
                >
                  <Edit2 size={13} className="text-primary dark:text-blue-400" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCancelEditMode}
                    disabled={isSavingEdits}
                    className="px-2.5 py-1.5 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                    title="Undo / Cancel edits"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditMode}
                    disabled={isSavingEdits}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                    title="Save all changes"
                  >
                    Save
                  </button>
                </div>
              )
            )}
            {hasPermission('TABLE_CREATE') && (
              <button onClick={() => { setTableForm({ number: '', capacity: 4, type: 'AC' }); setTableModal('new'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-light text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs">
                <Plus size={14} /> Add
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="tablet-tab-bar bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1 w-full sm:w-auto">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`tablet-tab-pill px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${filter === f ? 'bg-primary text-white font-semibold' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
                {f.replace('_', '-')}
              </button>
            ))}
          </div>

          {/* Edit Table / (Cancel + Save) Controls placed at left side of Add Table */}
          {(hasPermission('TABLE_EDIT') || hasPermission('TABLE_DELETE')) && (
            !isEditMode ? (
              <button
                type="button"
                onClick={handleEnterEditMode}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-border dark:border-slate-800 hover:bg-surface dark:hover:bg-slate-800 hover:border-primary/40 dark:hover:border-slate-700 text-text dark:text-slate-200 rounded-lg text-sm font-medium cursor-pointer transition-all whitespace-nowrap shadow-xs"
                title="Enter edit mode to modify or delete tables"
              >
                <Edit2 size={15} className="text-primary dark:text-blue-400" />
                <span>Edit Table</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCancelEditMode}
                  disabled={isSavingEdits}
                  className="flex items-center gap-1 px-3 py-2 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-300 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
                  title="Undo / Cancel edits"
                >
                  <X size={14} className="text-danger" />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditMode}
                  disabled={isSavingEdits}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  title="Save all changes"
                >
                  {isSavingEdits ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Save</span>
                </button>
              </div>
            )
          )}

          {hasPermission('TABLE_CREATE') && (
            <button onClick={() => { setTableForm({ number: '', capacity: 4, type: 'AC' }); setTableModal('new'); }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shadow-xs">
              <Plus size={16} /> Add Table
            </button>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-blue-900 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Edit2 size={15} className="text-primary dark:text-blue-400 shrink-0" />
            <span>
              <strong>Edit Mode:</strong> Click the edit (pencil) or delete (trash) icons on any available table to modify it. Click <strong>Save</strong> to commit changes or <strong>Cancel</strong> to discard.
            </span>
          </div>
          {(pendingDeletes.size > 0 || Object.keys(pendingUpdates).length > 0) && (
            <span className="shrink-0 px-2.5 py-0.5 bg-blue-200/80 dark:bg-blue-900 rounded-full font-mono text-xs font-semibold">
              {pendingDeletes.size + Object.keys(pendingUpdates).length} unsaved change{pendingDeletes.size + Object.keys(pendingUpdates).length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
        {filtered.map(table => {
          const session = getSessionInfo(table);
          const isModified = !!pendingUpdates[table.id];

          return (
            <div key={table.id} onClick={() => handleTableClick(table)}
              className={`bg-white dark:bg-slate-900 rounded-xl border-2 p-2.5 sm:p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.98] relative group ${
                isEditMode
                  ? 'border-dashed border-primary/50 dark:border-blue-500/50 hover:border-primary'
                  : table.status === 'OCCUPIED'
                  ? 'border-primary/40 dark:border-blue-500/50'
                  : table.status === 'BILLING'
                  ? 'border-warning/40 dark:border-amber-500/50'
                  : 'border-border dark:border-slate-800 hover:border-primary/20 dark:hover:border-primary/40'
              }`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img src={tableBlue} alt="Table" className="w-4 sm:w-5 h-4 sm:h-5 object-contain dark:brightness-0 dark:invert" />
                  <span className="text-lg sm:text-2xl font-bold text-text dark:text-slate-100 font-mono">{table.number}</span>
                  {isModified && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                      Edited
                    </span>
                  )}
                </div>

                {isEditMode && table.status === 'AVAILABLE' && (hasPermission('TABLE_EDIT') || hasPermission('TABLE_DELETE')) ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                    {hasPermission('TABLE_EDIT') && (
                      <button
                        type="button"
                        onClick={(e) => handleEditTableClick(table, e)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-primary dark:text-blue-400 shadow-xs cursor-pointer transition-all hover:scale-105"
                        title="Edit Table"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {hasPermission('TABLE_DELETE') && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTableClick(table, e)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900 text-danger dark:text-red-400 shadow-xs cursor-pointer transition-all hover:scale-105"
                        title="Delete Table"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <img
                      src={table.type === 'AC' ? acBlue : nonAcBlue}
                      alt={table.type}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain opacity-75 dark:brightness-0 dark:invert"
                    />
                    <Badge variant={typeColors[table.type]}>{table.type.replace('_', '-')}</Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-text-secondary dark:text-slate-400 text-xs mb-2 sm:mb-3">
                <Users size={13} /> <span>{table.capacity} seats</span>
              </div>
              <Badge variant={statusColors[table.status]}>{table.status}</Badge>
              {session && (
                <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-border dark:border-slate-800 text-[11px] sm:text-xs text-text-secondary dark:text-slate-400 space-y-0.5 sm:space-y-1">
                  <p className="font-medium text-text dark:text-slate-200 truncate">{session.captain}</p>
                  <p className="flex items-center gap-1"><Clock size={11} /> {session.mins}m</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!sessionModal} onClose={() => setSessionModal(null)} title={`Open Table ${sessionModal?.number}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text dark:text-slate-200 mb-1">Guest Count (optional)</label>
            <input type="number" value={guestCount} onChange={e => setGuestCount(e.target.value)} min="1"
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Number of guests" />
          </div>
          <div className="flex gap-2 sm:gap-3 justify-end pt-2">
            <button onClick={() => setSessionModal(null)} className="px-4 py-2 text-xs sm:text-sm text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 rounded-lg cursor-pointer">Cancel</button>
            <button onClick={openSession} disabled={creating}
              className="px-4 py-2 min-h-[42px] text-xs sm:text-sm bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs">
              {creating && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <Plus size={16} /> Open Table
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!tableModal} onClose={() => setTableModal(null)} title={tableModal === 'new' ? 'Add Table' : (isEditMode ? 'Edit Table (Staged)' : 'Edit Table')} size="sm">
        <div className="space-y-3">
          <div><label className="block text-xs sm:text-sm font-medium text-text dark:text-slate-200 mb-1">Table Number</label>
            <input type="number" value={tableForm.number} onChange={e => setTableForm(f => ({ ...f, number: e.target.value }))}
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20" /></div>
          <div><label className="block text-xs sm:text-sm font-medium text-text dark:text-slate-200 mb-1">Capacity (seats)</label>
            <input type="number" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} min="1"
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20" /></div>
          <div><label className="block text-xs sm:text-sm font-medium text-text dark:text-slate-200 mb-1">Type</label>
            <div className="flex gap-2">
              {['AC', 'NON_AC'].map(t => (
                <button key={t} onClick={() => setTableForm(f => ({ ...f, type: t }))}
                  className={`flex-1 min-h-[42px] py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${tableForm.type === t ? 'bg-primary text-white' : 'bg-surface dark:bg-slate-800 text-text-secondary dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                  {t.replace('_', '-')}
                </button>
              ))}
            </div>
          </div>
          <button onClick={saveTable} className="w-full min-h-[42px] py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light active:scale-[0.99] cursor-pointer shadow-xs mt-2">
            {tableModal === 'new' ? 'Save Table' : (isEditMode ? 'Apply Edit' : 'Save Table')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
