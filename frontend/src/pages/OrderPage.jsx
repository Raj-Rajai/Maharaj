import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Plus, Minus, Send, Receipt, Trash2 } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { acBlue, nonAcBlue, tableBlue } from '../assets';

export default function OrderPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canOrder = hasPermission('ORDER_CREATE');
  const canBill = hasPermission('BILL_VIEW_DRAFT');
  const [table, setTable] = useState(null);
  const [session, setSession] = useState(null);
  const [order, setOrder] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [billPreview, setBillPreview] = useState(null);
  const [discount, setDiscount] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [finalizing, setFinalizing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Sequential calls to avoid Supabase connection pool exhaustion
      const tabRes = await api.get(`/tables/${tableId}`);
      const catRes = await api.get('/menu/categories');
      const sessRes = await api.get('/table-sessions/active');
      const tableData = tabRes.data;
      setTable(tableData);
      setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data.value || []);

      let menuType = tableData.type;
      if (user?.role === 'AC_MASTER') {
        menuType = 'AC';
      } else if (user?.role === 'NON_AC_MASTER') {
        menuType = 'NON_AC';
      }
      const itemRes = await api.get('/menu/items', { params: { menuType } });
      setMenuItems(Array.isArray(itemRes.data) ? itemRes.data : itemRes.data.value || []);

      const sessions = Array.isArray(sessRes.data) ? sessRes.data : sessRes.data.value || [];
      const sess = sessions.find(s => s.tableId === tableId);
      setSession(sess || null);
      if (sess) {
        try {
          const ordRes = await api.get('/orders', { params: { sessionId: sess.id, status: 'ACTIVE' } });
          const orders = Array.isArray(ordRes.data) ? ordRes.data : ordRes.data.value || [];
          if (orders.length > 0) {
            const fullOrd = await api.get(`/orders/${orders[0].id}`);
            setOrder(fullOrd.data);
          }
        } catch {}
      }
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [tableId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredItems = menuItems.filter(item => {
    if (!item.active) return false;
    if (selectedCat !== 'ALL' && item.categoryId !== selectedCat) return false;
    if (searchQ && !item.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const addToCart = (item) => {
    if (!canOrder) {
      toast.error('You do not have permission to add order items');
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: parseFloat(item.price), quantity: 1, notes: '' }];
    });
  };

  const updateCartQty = (menuItemId, delta) => {
    if (!canOrder) return;
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (menuItemId) => {
    if (!canOrder) return;
    setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  };

  const createOrderAndSend = async () => {
    if (!canOrder) { toast.error('You do not have permission to place orders'); return; }
    if (cart.length === 0) { toast.error('Add items first'); return; }
    setSending(true);
    try {
      let orderId = order?.id;
      if (!orderId) {
        if (!session) { toast.error('No active session'); return; }
        const res = await api.post('/orders', { sessionId: session.id });
        orderId = res.data.id;
      }
      await api.post(`/orders/${orderId}/items`, { items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes || undefined })) });
      await api.post('/kots', { orderId });
      toast.success('KOT sent to kitchen!');
      setCart([]);
      await loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send order'); }
    finally { setSending(false); }
  };

  const openBillModal = async () => {
    if (!order) { toast.error('No active order'); return; }
    try {
      const res = await api.post('/bills/preview', { orderId: order.id, discount: 0 });
      setBillPreview(res.data);
      setBillModal(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to preview bill'); }
  };

  const refreshPreview = async () => {
    if (!order) return;
    try {
      const res = await api.post('/bills/preview', { orderId: order.id, discount: parseFloat(discount) || 0 });
      setBillPreview(res.data);
    } catch {}
  };

  const createDraftBill = async () => {
    setFinalizing(true);
    try {
      await api.post('/bills', {
        orderId: order.id,
        discount: 0,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      toast.success('Draft bill created. An authorized user will finalize it.');
      navigate('/tables');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create bill'); }
    finally { setFinalizing(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="h-full flex flex-col">

      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate('/tables')} className="p-2 hover:bg-white rounded-lg text-text-secondary"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-text dark:text-white flex items-center gap-2">
          <img src={tableBlue} alt="Table" className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
          Table {table?.number}
        </h1>
        <div className="flex items-center gap-1.5">
          <img
            src={table?.type === 'AC' ? acBlue : nonAcBlue}
            alt={table?.type}
            className="w-4 h-4 object-contain opacity-75 dark:brightness-0 dark:invert"
          />
          <Badge variant={table?.type === 'AC' ? 'info' : 'neutral'}>{table?.type?.replace('_', '-')}</Badge>
        </div>
        <span className="text-xs text-text-secondary dark:text-slate-300 bg-surface dark:bg-slate-800 px-2 py-1 rounded">{table?.type === 'AC' ? 'AC' : 'Non-AC'} Menu</span>
        {table?.status && <Badge variant={table.status === 'OCCUPIED' ? 'info' : 'success'}>{table.status}</Badge>}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">

        <div className="flex-[3] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden">
          <div className="flex gap-1 p-3 border-b border-border dark:border-slate-800 overflow-x-auto">
            <button onClick={() => setSelectedCat('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${selectedCat === 'ALL' ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${selectedCat === c.id ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="p-3 border-b border-border dark:border-slate-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search menu..."
                className="w-full pl-9 pr-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredItems.map(item => (
                <button key={item.id} onClick={() => canOrder && addToCart(item)}
                  disabled={!canOrder}
                  className={`text-left p-3 rounded-lg border border-border dark:border-slate-800 bg-white dark:bg-slate-800/60 transition-all ${
                    canOrder
                      ? 'hover:border-primary/40 dark:hover:border-blue-500/50 hover:bg-primary/5 dark:hover:bg-slate-800 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  }`}>
                  <p className="text-sm font-medium text-text dark:text-slate-100 truncate">{item.name}</p>
                  <p className="text-sm font-mono text-primary dark:text-blue-400 font-semibold mt-1">₹{parseFloat(item.price).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-[2] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-800">
            <h2 className="font-semibold text-text dark:text-slate-100">Current Order</h2>
            {order && <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">{order.items?.filter(i => i.status !== 'CANCELLED').length || 0} active items</p>}
          </div>

          <div className="flex-1 overflow-auto">
            {order?.items?.filter(i => i.status !== 'PENDING' && i.status !== 'CANCELLED').map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2 border-b border-border dark:border-slate-800 bg-surface/50 dark:bg-slate-800/40">
                <div>
                  <p className="text-sm text-text-secondary dark:text-slate-300">{item.itemNameSnapshot}</p>
                  <p className="text-xs text-text-secondary dark:text-slate-400">×{item.quantity} • <Badge variant={item.status === 'SERVED' ? 'success' : item.status === 'READY' ? 'success' : 'warning'}>{item.status}</Badge></p>
                </div>
                <span className="font-mono text-sm text-text-secondary dark:text-slate-300">₹{(parseFloat(item.priceSnapshot) * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            {order?.items?.filter(i => i.status === 'CANCELLED').map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2 border-b border-border dark:border-slate-800 bg-red-50/50 dark:bg-red-950/30 opacity-60">
                <div>
                  <p className="text-sm text-text-secondary dark:text-slate-400 line-through">{item.itemNameSnapshot}</p>
                  <p className="text-xs"><Badge variant="danger">CANCELLED</Badge></p>
                </div>
                <span className="font-mono text-sm text-text-secondary dark:text-slate-400 line-through">₹{(parseFloat(item.priceSnapshot) * (item.originalQuantity || item.quantity)).toFixed(2)}</span>
              </div>
            ))}

            {cart.length > 0 && (
              <div className="border-t-2 border-primary/20 dark:border-blue-500/30">
                <p className="px-4 py-2 text-xs font-medium text-primary dark:text-blue-400 bg-primary/5 dark:bg-blue-950/40">New Items</p>
                {cart.map(item => (
                  <div key={item.menuItemId} className="flex items-center justify-between px-4 py-2 border-b border-border dark:border-slate-800">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text dark:text-slate-100">{item.name}</p>
                      <p className="text-xs font-mono text-text-secondary dark:text-slate-400">₹{item.price.toFixed(2)}</p>
                    </div>
                    {canOrder && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQty(item.menuItemId, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 text-text-secondary dark:text-slate-300 hover:bg-border dark:hover:bg-slate-700 cursor-pointer"><Minus size={12} /></button>
                        <span className="text-sm font-medium font-mono text-text dark:text-slate-100 w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.menuItemId, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 text-text-secondary dark:text-slate-300 hover:bg-border dark:hover:bg-slate-700 cursor-pointer"><Plus size={12} /></button>
                        <button onClick={() => removeFromCart(item.menuItemId)} className="ml-1 text-danger hover:text-red-700 cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    )}
                    <span className="font-mono text-sm text-text dark:text-slate-100 ml-3 w-16 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {!order && cart.length === 0 && (
              <div className="flex items-center justify-center h-32 text-text-secondary dark:text-slate-400 text-sm">Click menu items to add</div>
            )}
          </div>

          <div className="p-4 border-t border-border dark:border-slate-800 space-y-2">
            {cart.length > 0 && (
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-secondary dark:text-slate-400">New items total:</span>
                <span className="font-mono font-semibold text-text dark:text-slate-100">₹{cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}</span>
              </div>
            )}
            {cart.length > 0 && canOrder && (
              <button onClick={createOrderAndSend} disabled={sending}
                className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                Send to Kitchen (KOT)
              </button>
            )}
            {order && cart.length === 0 && canBill && (
              <button onClick={openBillModal}
                className="w-full py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center justify-center gap-2 cursor-pointer">
                <Receipt size={16} /> Generate Bill
              </button>
            )}
            {!canOrder && !canBill && (
              <div className="p-3 bg-surface dark:bg-slate-800/60 border border-border dark:border-slate-700 rounded-lg text-xs text-text-secondary dark:text-slate-400 text-center">
                Read-only view: You do not have permissions to modify orders or generate bills.
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={billModal} onClose={() => setBillModal(false)} title="Generate Bill" size="md">
        <div className="space-y-4">

          <div className="bg-surface/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-border dark:border-slate-700 space-y-2.5">
            <p className="text-xs font-semibold text-text dark:text-slate-200 uppercase tracking-wider">
              Customer Details (Optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-text-secondary dark:text-slate-400 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-1.5 border border-border dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary dark:text-slate-400 mb-1">
                  Customer Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-1.5 border border-border dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="hidden">
            <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1">Discount (₹)</label>
            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} onBlur={refreshPreview} min="0"
              className="w-full px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {billPreview && (
            <div className="bg-surface dark:bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">Subtotal</span><span className="font-mono font-medium text-text dark:text-slate-100">₹{parseFloat(billPreview.subtotal).toFixed(2)}</span></div>
              {parseFloat(billPreview.discount) > 0 && (
                <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">Discount</span><span className="font-mono text-danger">-₹{parseFloat(billPreview.discount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">SGST ({billPreview.sgstPercent}%)</span><span className="font-mono text-text dark:text-slate-100">₹{parseFloat(billPreview.sgstAmount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">CGST ({billPreview.cgstPercent}%)</span><span className="font-mono text-text dark:text-slate-100">₹{parseFloat(billPreview.cgstAmount).toFixed(2)}</span></div>
              <div className="border-t border-border dark:border-slate-700 pt-2 flex justify-between font-semibold text-text dark:text-slate-100">
                <span>Total</span><span className="font-mono text-lg text-primary dark:text-blue-400">₹{parseFloat(billPreview.total).toFixed(2)}</span>
              </div>
            </div>
          )}

          <button onClick={createDraftBill} disabled={finalizing}
            className="w-full py-2.5 bg-success text-white rounded-lg font-medium text-sm hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
            {finalizing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Receipt size={16} />}
            Create Draft Bill
          </button>
        </div>
      </Modal>
    </div>
  );
}
