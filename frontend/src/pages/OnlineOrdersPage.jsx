import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Smartphone, Plus, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';

const statusVariant = { NEW: 'info', ACCEPTED: 'info', PREPARING: 'warning', READY: 'success', COMPLETED: 'success', CANCELLED: 'danger' };
const statusFlow = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

export default function OnlineOrdersPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('ONLINE_ORDER_CREATE');
  const canEdit = hasPermission('ONLINE_ORDER_EDIT');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('SWIGGY');
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form, setForm] = useState({ platform: 'SWIGGY', externalOrderId: '', customerName: '', items: [{ name: '', quantity: 1, price: '' }], subtotal: 0, discount: 0, charges: 0, total: 0, notes: '' });

  const fetchOrders = async () => {
    try {
      const res = await api.get('/online-orders');
      setOrders(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter(o => o.platform === platform);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { name: '', quantity: 1, price: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0);
      return { ...f, items, subtotal, total: subtotal - (parseFloat(f.discount) || 0) + (parseFloat(f.charges) || 0) };
    });
  };

  const submitOrder = async () => {
    try {
      await api.post('/online-orders', {
        platform: form.platform, externalOrderId: form.externalOrderId, customerName: form.customerName || undefined,
        items: form.items.map(i => ({ name: i.name, quantity: parseInt(i.quantity), price: parseFloat(i.price) })),
        subtotal: form.subtotal, discount: parseFloat(form.discount) || 0, charges: parseFloat(form.charges) || 0,
        total: form.total, notes: form.notes || undefined
      });
      toast.success('Online order created');
      setAddModal(false);
      setForm({ platform, externalOrderId: '', customerName: '', items: [{ name: '', quantity: 1, price: '' }], subtotal: 0, discount: 0, charges: 0, total: 0, notes: '' });
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/online-orders/${id}/status`, { status });
      toast.success('Status updated');
      setDetailModal(null);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Smartphone size={24} className="text-primary" />
          <h1 className="text-xl font-bold text-text dark:text-slate-100">Online Orders</h1>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1">
            {['SWIGGY', 'ZOMATO'].map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`px-3.5 sm:px-4 py-1.5 min-h-[38px] rounded-md text-xs font-semibold transition-colors cursor-pointer ${platform === p ? (p === 'SWIGGY' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white') : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>{p}</button>
            ))}
          </div>
          {canCreate && (
            <button onClick={() => { setForm(f => ({ ...f, platform })); setAddModal(true); }}
              className="flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors cursor-pointer shadow-xs">
              <Plus size={16} /> Add Order
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-surface dark:bg-slate-800/80 border-b border-border dark:border-slate-700">
              <tr className="text-left text-text-secondary dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-800">
              {filtered.map(o => (
                <tr key={o.id} onClick={() => setDetailModal(o)} className="hover:bg-surface/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-text dark:text-slate-100">{o.externalOrderId}</td>
                  <td className="px-4 py-3 text-text dark:text-slate-200">{o.customerName || '-'}</td>
                  <td className="px-4 py-3 font-mono font-medium text-text dark:text-slate-100">₹{parseFloat(o.total).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant[o.status]}>{o.status}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary dark:text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-text-secondary dark:text-slate-400">No {platform} orders</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Order Modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title={`Add ${form.platform} Order`} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1">External Order ID *</label>
              <input value={form.externalOrderId} onChange={e => setForm(f => ({ ...f, externalOrderId: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1">Customer Name</label>
              <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text dark:text-slate-200">Items</label>
              <button onClick={addItem} className="text-xs text-primary dark:text-blue-400 hover:underline flex items-center gap-1 min-h-[36px] cursor-pointer"><Plus size={14} /> Add</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center mb-2.5">
                <input placeholder="Item name" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                  className="flex-1 min-w-[130px] px-3 py-2 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="1"
                    className="w-16 px-2 py-2 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <input type="number" placeholder="Price" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)}
                    className="w-24 px-3 py-2 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-base sm:text-sm min-h-[42px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-danger p-2 min-h-[42px] min-w-[42px] inline-flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-surface dark:bg-slate-800/60 rounded-lg p-3 text-sm space-y-1 text-text dark:text-slate-200 border border-border dark:border-slate-700">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">₹{form.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">₹{form.total.toFixed(2)}</span></div>
          </div>
          <button onClick={submitOrder} className="w-full py-2.5 min-h-[42px] bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors cursor-pointer shadow-xs">Save Order</button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title={`Order ${detailModal?.externalOrderId}`}>
        {detailModal && (
          <div className="space-y-4">
            <div className="bg-surface dark:bg-slate-800/60 rounded-lg p-4 text-sm space-y-2 text-text dark:text-slate-200 border border-border dark:border-slate-700">
              <div className="flex justify-between"><span>Platform</span><Badge variant={detailModal.platform === 'SWIGGY' ? 'warning' : 'danger'}>{detailModal.platform}</Badge></div>
              <div className="flex justify-between"><span>Total</span><span className="font-mono font-semibold">₹{parseFloat(detailModal.total).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Status</span><Badge variant={statusVariant[detailModal.status]}>{detailModal.status}</Badge></div>
            </div>
            {canEdit && detailModal.status !== 'COMPLETED' && detailModal.status !== 'CANCELLED' && (
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                {statusFlow.slice(statusFlow.indexOf(detailModal.status) + 1).map(s => (
                  <button key={s} onClick={() => updateStatus(detailModal.id, s)}
                    className="flex-1 py-2.5 min-h-[42px] bg-primary/10 text-primary dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors cursor-pointer flex items-center justify-center">→ {s}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
