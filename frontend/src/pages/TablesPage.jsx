import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, Clock, Plus, Edit2, Trash2, Grid3x3 } from 'lucide-react';
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
      fetchTables({ background: true });
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
  }, isActive, ['tables']);

  useEffect(() => {
    if (!isActive) return;
    fetchTables({ background: tables.length > 0 });
    // Gentle 30s background fallback heartbeat (primary sync is instant push)
    const iv = setInterval(() => fetchTables({ background: true }), 30000);
    return () => clearInterval(iv);
  }, [isActive]);

  const filtered = tables.filter(t => {

    if (user?.role === 'AC_MASTER' && t.type !== 'AC') return false;
    if (user?.role === 'NON_AC_MASTER' && t.type !== 'NON_AC') return false;

    if (filter === 'ALL') return true;
    if (filter === 'AC' || filter === 'NON_AC') return t.type === filter;
    return t.status === filter;
  });

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
    try {
      const data = { number: parseInt(tableForm.number), capacity: parseInt(tableForm.capacity), type: tableForm.type };
      if (tableModal === 'new') await api.post('/tables', data);
      else await api.patch(`/tables/${tableModal.id}`, data);
      toast.success('Table saved');
      setTableModal(null);
      fetchTables();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deleteTable = async (id, e) => {
    e.stopPropagation();
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
          {hasPermission('TABLE_CREATE') && (
            <button onClick={() => { setTableForm({ number: '', capacity: 4, type: 'AC' }); setTableModal('new'); }}
              className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-light text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs">
              <Plus size={14} /> Add
            </button>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${filter === f ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
                {f.replace('_', '-')}
              </button>
            ))}
          </div>
          {hasPermission('TABLE_CREATE') && (
            <button onClick={() => { setTableForm({ number: '', capacity: 4, type: 'AC' }); setTableModal('new'); }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium cursor-pointer transition-colors whitespace-nowrap">
              <Plus size={16} /> Add Table
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
        {filtered.map(table => {
          const session = getSessionInfo(table);
          return (
            <div key={table.id} onClick={() => handleTableClick(table)}
              className={`bg-white dark:bg-slate-900 rounded-xl border-2 p-3 sm:p-5 cursor-pointer transition-all hover:shadow-md active:scale-[0.98] relative group ${
                table.status === 'OCCUPIED' ? 'border-primary/40 dark:border-blue-500/50' : table.status === 'BILLING' ? 'border-warning/40 dark:border-amber-500/50' : 'border-border dark:border-slate-800 hover:border-primary/20 dark:hover:border-primary/40'
              }`}>
              {table.status === 'AVAILABLE' && (hasPermission('TABLE_EDIT') || hasPermission('TABLE_DELETE')) && (
                <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {hasPermission('TABLE_EDIT') && (
                    <button onClick={(e) => { e.stopPropagation(); setTableForm({ number: table.number, capacity: table.capacity, type: table.type }); setTableModal(table); }}
                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 hover:bg-border dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 cursor-pointer"
                      title="Edit Table"><Edit2 size={12} /></button>
                  )}
                  {hasPermission('TABLE_DELETE') && (
                    <button onClick={(e) => deleteTable(table.id, e)}
                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/50 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 cursor-pointer"
                      title="Delete Table"><Trash2 size={12} /></button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img src={tableBlue} alt="Table" className="w-4 sm:w-5 h-4 sm:h-5 object-contain dark:brightness-0 dark:invert" />
                  <span className="text-lg sm:text-2xl font-bold text-text dark:text-slate-100 font-mono">{table.number}</span>
                </div>
                <div className="flex items-center gap-1">
                  <img
                    src={table.type === 'AC' ? acBlue : nonAcBlue}
                    alt={table.type}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain opacity-75 dark:brightness-0 dark:invert"
                  />
                  <Badge variant={typeColors[table.type]}>{table.type.replace('_', '-')}</Badge>
                </div>
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

      <Modal isOpen={!!tableModal} onClose={() => setTableModal(null)} title={tableModal === 'new' ? 'Add Table' : 'Edit Table'} size="sm">
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
          <button onClick={saveTable} className="w-full min-h-[42px] py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light active:scale-[0.99] cursor-pointer shadow-xs mt-2">Save Table</button>
        </div>
      </Modal>
    </div>
  );
}
