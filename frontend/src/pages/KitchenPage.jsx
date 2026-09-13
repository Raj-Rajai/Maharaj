import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, ChefHat, Printer, Edit2, X, Check } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { takeAwayBlue, swiggyIcon, zomatoIcon, kitchenBlue } from '../assets';

import { useRouteActive } from '../components/common/RouteKeepAlive';

const statusColors = { SENT: 'warning', PREPARING: 'info', READY: 'success', SERVED: 'neutral', CANCELLED: 'danger', PENDING: 'neutral' };
const statusOrder = ['SENT', 'PREPARING', 'READY', 'SERVED'];
const nextStatus = { SENT: 'PREPARING', PREPARING: 'READY', READY: 'SERVED' };

export default function KitchenPage() {
  const { hasPermission } = useAuth();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [editModal, setEditModal] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');
  const printRef = useRef();
  const isActive = useRouteActive();

  const fetchKots = async (opts = {}) => {
    try {
      if (!opts.background) setLoading(true);
      const res = await api.get('/kots', { skipCache: true });
      const data = Array.isArray(res.data) ? res.data : res.data.value || [];
      setKots(data);
    } catch {
      if (!opts.background) toast.error('Failed to load KOTs');
    } finally {
      if (!opts.background) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    fetchKots({ background: kots.length > 0 });
    const iv = setInterval(() => fetchKots({ background: true }), 5000);
    return () => clearInterval(iv);
  }, [isActive]);

  const filtered = kots.filter(k => filter === 'ALL' || k.status === filter);

  const advanceItem = async (itemId, newStatus) => {
    try {
      await api.patch(`/kots/items/${itemId}/status`, { status: newStatus });
      toast.success(`Item → ${newStatus}`);
      fetchKots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const openEdit = (item) => {
    setEditModal(item);
    setEditQty(String(item.quantity));
    setEditReason('');
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const qty = parseInt(editQty);
    if (!qty || qty < 1) { toast.error('Invalid quantity'); return; }
    try {
      await api.patch(`/kots/items/${editModal.id}/edit`, { quantity: qty, reason: editReason || undefined });
      toast.success('Item quantity updated');
      setEditModal(null);
      fetchKots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const cancelItem = async (item) => {
    const reason = prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    try {
      await api.patch(`/kots/items/${item.id}/cancel`, { reason: reason || 'Cancelled by kitchen' });
      toast.success('Item cancelled');
      fetchKots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const printKot = (kot) => {
    let sourceLabel = '';
    const src = kot.order?.orderSource;
    if (src === 'SELF_PICKUP') sourceLabel = 'Self Pickup';
    else if (src === 'SWIGGY') sourceLabel = 'Swiggy Delivery';
    else if (src === 'ZOMATO') sourceLabel = 'Zomato Delivery';
    else if (kot.order?.table?.number) sourceLabel = `Table ${kot.order.table.number} (${kot.order.table.type})`;
    else sourceLabel = kot.order?.tableId ? `Table ${kot.order.tableId}` : 'Take Away';

    const time = new Date(kot.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    let html = `<html><head><title>KOT #${kot.kotNumber}</title><style>body{font-family:monospace;font-size:14px;width:80mm;margin:0 auto;padding:8px}h2{text-align:center;margin:4px 0}hr{border:1px dashed #000}.item{display:flex;justify-content:space-between;padding:2px 0}.edited{font-style:italic;color:#666}.cancelled{text-decoration:line-through;color:#999}</style></head><body>`;
    html += `<h2>KOT #${kot.kotNumber}</h2><hr/>`;
    html += `<p style="font-weight:bold;font-size:15px">${sourceLabel}</p>`;
    html += `<p>Time: ${time}</p><hr/>`;
    kot.items?.forEach(item => {
      const cls = item.status === 'CANCELLED' ? 'cancelled' : (item.originalQuantity ? 'edited' : '');
      html += `<div class="item ${cls}"><span>${item.itemNameSnapshot}</span><span>x${item.quantity}</span></div>`;
      if (item.originalQuantity && item.status !== 'CANCELLED') {
        html += `<div class="edited">EDITED: ${item.originalQuantity} → ${item.quantity}</div>`;
      }
      if (item.status === 'CANCELLED') {
        html += `<div class="cancelled">CANCELLED</div>`;
      }
      if (item.notes) html += `<div style="font-size:12px;color:#666">Note: ${item.notes}</div>`;
    });
    html += `<hr/><p style="text-align:center">--- END ---</p></body></html>`;
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
          <img src={kitchenBlue} alt="Kitchen" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
          Kitchen Display
        </h1>
        <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1">
          {['ALL', 'NEW', 'PREPARING', 'READY', 'COMPLETED'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${filter === f ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(kot => (
          <div key={kot.id} className={`bg-white dark:bg-slate-900 rounded-xl border-2 overflow-hidden ${
            kot.status === 'NEW' ? 'border-warning/40 dark:border-amber-500/40' : kot.status === 'PREPARING' ? 'border-primary/40 dark:border-blue-500/40' : kot.status === 'READY' ? 'border-success/40 dark:border-emerald-500/40' : 'border-border dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 bg-surface dark:bg-slate-800 border-b border-border dark:border-slate-700">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="font-bold text-text dark:text-slate-100 font-mono">KOT #{kot.kotNumber}</span>
                {kot.order?.orderSource === 'SELF_PICKUP' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <img src={takeAwayBlue} alt="Self Pickup" className="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
                    Self Pickup
                  </span>
                ) : kot.order?.orderSource === 'SWIGGY' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                    <img src={swiggyIcon} alt="Swiggy" className="w-3.5 h-3.5 object-contain" />
                    Swiggy
                  </span>
                ) : kot.order?.orderSource === 'ZOMATO' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <img src={zomatoIcon} alt="Zomato" className="w-3.5 h-3.5 object-contain" />
                    Zomato
                  </span>
                ) : kot.order?.table?.number ? (
                  <span className="text-xs font-semibold text-text dark:text-slate-100 bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-border dark:border-slate-600">
                    Table {kot.order.table.number} ({kot.order.table.type})
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary dark:text-slate-400">Take Away</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={kot.status === 'NEW' ? 'warning' : kot.status === 'PREPARING' ? 'info' : kot.status === 'READY' ? 'success' : 'neutral'}>{kot.status}</Badge>
                {hasPermission('KOT_PRINT') && (
                  <button onClick={() => printKot(kot)} className="p-1 rounded hover:bg-border dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 cursor-pointer" title="Print KOT"><Printer size={16} /></button>
                )}
              </div>
            </div>
            <div className="p-3 space-y-2">
              {kot.items?.map(item => (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg ${item.status === 'CANCELLED' ? 'bg-red-50/70 dark:bg-red-950/30 opacity-60' : 'bg-surface dark:bg-slate-800/80'}`}>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${item.status === 'CANCELLED' ? 'line-through text-text-secondary dark:text-slate-400' : 'text-text dark:text-slate-100'}`}>{item.itemNameSnapshot}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-text dark:text-slate-200">x{item.quantity}</span>
                      <Badge variant={statusColors[item.status]}>{item.status}</Badge>
                      {item.originalQuantity && item.status !== 'CANCELLED' && <span className="text-xs text-warning font-medium">EDITED: {item.originalQuantity}→{item.quantity}</span>}
                      {item.status === 'CANCELLED' && <span className="text-xs text-danger font-medium">CANCELLED</span>}
                    </div>
                    {item.notes && <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">{item.notes}</p>}
                  </div>
                  {item.status !== 'CANCELLED' && item.status !== 'SERVED' && (
                    <div className="flex items-center gap-1 ml-2">
                      {hasPermission('KOT_EDIT') && nextStatus[item.status] && (
                        <button onClick={() => advanceItem(item.id, nextStatus[item.status])}
                          className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-light cursor-pointer" title={`→ ${nextStatus[item.status]}`}>
                          <Check size={12} />
                        </button>
                      )}
                      {hasPermission('KOT_EDIT') && (
                        <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-border dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 cursor-pointer" title="Edit qty"><Edit2 size={14} /></button>
                      )}
                      {hasPermission('ORDER_CANCEL') && (
                        <button onClick={() => cancelItem(item)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/50 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 cursor-pointer" title="Cancel"><X size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border dark:border-slate-800 text-xs text-text-secondary dark:text-slate-400 flex items-center gap-1">
              <Clock size={12} /> {new Date(kot.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-3 text-center text-text-secondary dark:text-slate-400 py-12">No KOTs</p>}
      </div>

      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title="Edit Item Quantity" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-text dark:text-slate-200">{editModal?.itemNameSnapshot} (current: {editModal?.quantity})</p>
          <div><label className="block text-sm font-medium text-text dark:text-slate-200 mb-1">New Quantity</label>
            <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} min="1"
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" /></div>
          <div><label className="block text-sm font-medium text-text dark:text-slate-200 mb-1">Reason (optional)</label>
            <input type="text" value={editReason} onChange={e => setEditReason(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Customer requested change" /></div>
          <button onClick={saveEdit} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light cursor-pointer">Update Quantity</button>
        </div>
      </Modal>
    </div>
  );
}
