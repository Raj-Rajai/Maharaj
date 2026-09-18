import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Plus, Minus, Send, Receipt, Trash2, ShoppingBag, LogOut, AlertTriangle } from 'lucide-react';
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
  const canCloseTable = user?.role === 'SUPER_ADMIN' || hasPermission('TABLE_EDIT') || hasPermission('ORDER_CANCEL') || hasPermission('ORDER_EDIT') || hasPermission('BILL_FINALIZE');
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
  const [generalNotes, setGeneralNotes] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [finalizing, setFinalizing] = useState(false);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' | 'cart'
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingTable, setClosingTable] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      // Phase 1: Parallel fetch of table info, categories, and active sessions
      const [tabRes, catRes, sessRes] = await Promise.all([
        api.get(`/tables/${tableId}`),
        api.get('/menu/categories'),
        api.get('/table-sessions/active'),
      ]);
      const tableData = tabRes.data;
      setTable(tableData);
      setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data.value || []);

      let menuType = tableData.type;
      if (user?.role === 'AC_MASTER') {
        menuType = 'AC';
      } else if (user?.role === 'NON_AC_MASTER') {
        menuType = 'NON_AC';
      }

      const sessions = Array.isArray(sessRes.data) ? sessRes.data : sessRes.data.value || [];
      const sess = sessions.find((s) => s.tableId === tableId);
      setSession(sess || null);

      // Phase 2: Parallel fetch of menu items and active order (orders[0] already includes items)
      const fetchOps = [
        api.get('/menu/items', { params: { menuType } }),
      ];
      if (sess) {
        fetchOps.push(
          api.get('/orders', { params: { sessionId: sess.id, status: 'ACTIVE' } })
            .catch(() => ({ data: [] }))
        );
      }

      const [itemRes, ordRes] = await Promise.all(fetchOps);
      setMenuItems(Array.isArray(itemRes.data) ? itemRes.data : itemRes.data.value || []);

      if (ordRes) {
        const orders = Array.isArray(ordRes.data) ? ordRes.data : ordRes.data.value || [];
        if (orders.length > 0) {
          setOrder(orders[0]);
        } else {
          setOrder(null);
        }
      } else {
        setOrder(null);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tableId, user?.role]);

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
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: parseFloat(item.price),
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const updateCartQty = (menuItemId, delta) => {
    if (!canOrder) return;
    setCart(prev =>
      prev
        .map(c => {
          if (c.menuItemId === menuItemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean)
    );
  };

  const updateItemNotes = (menuItemId, notes) => {
    if (!canOrder) return;
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, notes } : c));
  };

  const removeFromCart = (menuItemId) => {
    if (!canOrder) return;
    setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const sgstAmount = cartSubtotal * 0.025;
  const cgstAmount = cartSubtotal * 0.025;
  const finalTotal = cartSubtotal + sgstAmount + cgstAmount;

  const createOrderAndSend = async () => {
    if (!canOrder) { toast.error('You do not have permission to place orders'); return; }
    if (cart.length === 0) { toast.error('Add items first'); return; }
    if (!session) { toast.error('No active session'); return; }

    setSending(true);
    try {
      // Single atomic call: creates order (if needed), inserts items, generates KOT, and returns full order
      const res = await api.post('/orders/send-kot', {
        sessionId: session.id,
        tableId,
        items: cart.map(c => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          notes: c.notes?.trim() || undefined,
        })),
        customerNotes: generalNotes.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });

      toast.success('KOT sent to kitchen!');
      setCart([]);
      setGeneralNotes('');
      if (res.data?.order) {
        setOrder(res.data.order);
      } else {
        await loadData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send order');
    } finally {
      setSending(false);
    }
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

  const handleCloseTable = async () => {
    setClosingTable(true);
    try {
      try {
        await api.post(`/tables/${tableId}/close`);
      } catch (tableErr) {
        if (tableErr.response?.status === 404 && session?.id) {
          await api.post(`/table-sessions/${session.id}/close`);
        } else {
          throw tableErr;
        }
      }
      toast.success(`Table ${table?.number || ''} closed successfully`);
      setShowCloseModal(false);
      navigate('/tables');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close table');
    } finally {
      setClosingTable(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/tables')} className="p-2 hover:bg-surface dark:hover:bg-slate-800 rounded-lg text-text-secondary cursor-pointer" title="Back to tables">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2">
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
          <span className="text-xs text-text-secondary dark:text-slate-300 bg-surface dark:bg-slate-800 px-2 py-0.5 sm:py-1 rounded hidden sm:inline">
            {table?.type === 'AC' ? 'AC' : 'Non-AC'} Menu
          </span>
          {table?.status && <Badge variant={table.status === 'OCCUPIED' ? 'info' : 'success'}>{table.status}</Badge>}
        </div>

        {/* Right Action: Close Table & Mobile View Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {canCloseTable && (table?.status === 'OCCUPIED' || table?.status === 'BILLING' || session) && (
            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Close and release table"
            >
              <LogOut size={15} />
              <span>Close Table</span>
            </button>
          )}

          {/* Mobile View Switcher (Menu vs Order/Cart) - Hidden in landscape because side-by-side view is active */}
          <div className="flex md:hidden tablet-order-switcher w-full sm:w-auto bg-surface dark:bg-slate-800 p-1 rounded-lg border border-border dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMobileTab('menu')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer min-h-[34px] ${
                mobileTab === 'menu'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
            >
              Menu Items
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[34px] ${
                mobileTab === 'cart'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
            >
              <span>Order & Cart</span>
              {(cart.length > 0 || (order?.items && order.items.length > 0)) && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  mobileTab === 'cart' ? 'bg-white text-primary' : 'bg-primary text-white'
                }`}>
                  {cart.reduce((s, i) => s + i.quantity, 0) + (order?.items?.filter(i => i.status !== 'CANCELLED').length || 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row tablet-order-split gap-2.5 sm:gap-4 min-h-0 relative">

        {/* Menu Panel */}
        <div className={`flex-[3] flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden tablet-order-menu ${
          mobileTab === 'menu' ? 'flex flex-1 min-h-0' : 'hidden md:flex'
        }`}>
          <div className="tablet-tab-bar p-2 sm:p-3 border-b border-border dark:border-slate-800">
            <button onClick={() => setSelectedCat('ALL')}
              className={`tablet-tab-pill px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${selectedCat === 'ALL' ? 'bg-primary text-white font-semibold' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)}
                className={`tablet-tab-pill px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${selectedCat === c.id ? 'bg-primary text-white font-semibold' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="p-2 sm:p-3 border-b border-border dark:border-slate-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search menu items..."
                className="w-full pl-9 pr-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2.5 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {filteredItems.map(item => {
                const cartItem = cart.find(c => c.menuItemId === item.id);
                const isSelected = !!cartItem;
                return (
                  <div
                    key={item.id}
                    onClick={() => canOrder && addToCart(item)}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between ${
                      !canOrder
                        ? 'border-border dark:border-slate-700/60 bg-white dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-950/40 shadow-xs ring-1 ring-primary/30 dark:ring-blue-500/30 cursor-pointer active:scale-[0.98]'
                        : 'border-border dark:border-slate-700/60 bg-white dark:bg-slate-800/60 hover:border-primary/40 dark:hover:border-blue-500/50 hover:bg-surface/60 dark:hover:bg-slate-800 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-semibold text-text dark:text-slate-100 leading-tight line-clamp-2">
                          {item.name}
                        </h3>
                        {isSelected && (
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary dark:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                            {cartItem.quantity}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-secondary dark:text-slate-400 uppercase tracking-wider block mt-0.5">
                        {item.category?.name || 'Item'}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-border/40 dark:border-slate-700/50">
                      <span className="font-mono text-xs sm:text-base font-bold text-primary dark:text-blue-400">
                        ₹{parseFloat(item.price).toFixed(2)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-medium text-primary dark:text-blue-400 flex items-center gap-0.5">
                        <Plus size={13} /> Add
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-16 text-text-secondary dark:text-slate-400 text-sm">
                  No food items found matching your criteria.
                </div>
              )}
            </div>
          </div>

          {/* Floating Cart Pill on Mobile when in Menu tab */}
          {cart.length > 0 && (
            <div className="md:hidden p-2.5 bg-primary/10 dark:bg-blue-950/40 border-t border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary dark:text-blue-400">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item(s) in Cart
                </span>
                <span className="text-xs font-mono font-bold text-text dark:text-white ml-2">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileTab('cart')}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Review Cart &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Order / Cart Panel */}
        <div className={`flex-[2] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden tablet-order-cart ${
          mobileTab === 'cart' ? 'flex flex-1 min-h-0' : 'hidden md:flex'
        }`}>
          {/* Cart Header */}
          <div className="p-2.5 sm:p-3 border-b border-border dark:border-slate-800 bg-surface/50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-text dark:text-slate-100 text-xs sm:text-sm flex items-center gap-1.5">
                Order Cart
                <Badge variant={table?.type === 'AC' ? 'info' : 'neutral'}>
                  Table {table?.number} ({table?.type?.replace('_', '-')})
                </Badge>
              </h2>
              <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-0.5">
                {cart.length} item types ({cart.reduce((s, i) => s + i.quantity, 0)} total pcs)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('menu')}
                className="md:hidden text-xs text-primary dark:text-blue-400 font-semibold hover:underline"
              >
                + Add Items
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-danger hover:underline cursor-pointer ml-1"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Customer / Order Details Block (Compact & Collapsible) */}
          <div className="px-2.5 py-1.5 bg-surface/30 dark:bg-slate-800/50 border-b border-border dark:border-slate-800 shrink-0 space-y-1">
            <div className="flex items-center justify-between gap-1.5">
              <input
                type="text"
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="Table / Order Notes (optional)..."
                className="flex-1 px-2 py-0.5 text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-md text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                className="text-[11px] font-semibold text-primary dark:text-blue-400 hover:underline shrink-0 whitespace-nowrap px-1 py-0.5"
              >
                {showCustomerDetails || customerName || customerPhone ? 'Hide Info' : '+ Customer'}
              </button>
            </div>
            {(showCustomerDetails || customerName || customerPhone) && (
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/40 dark:border-slate-700/40">
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-2 py-0.5 text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-md text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full px-2 py-0.5 text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-md text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Cart Items List - Guaranteed Scrollable with min-h-[130px] flex-1 */}
          <div className="flex-1 min-h-[130px] overflow-y-auto divide-y divide-border dark:divide-slate-800 touch-pan-y">
            {cart.map(item => (
              <div key={item.menuItemId} className="p-2 space-y-1 hover:bg-surface/30 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex-1 mr-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-text dark:text-slate-100 leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] font-mono text-text-secondary dark:text-slate-400 mt-0.5">
                      ₹{item.price.toFixed(2)} × {item.quantity} = <strong className="text-text dark:text-slate-100 font-bold">₹{(item.price * item.quantity).toFixed(2)}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.menuItemId, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-300 hover:bg-border/60 dark:hover:bg-slate-700 cursor-pointer active:scale-95"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold font-mono text-text dark:text-slate-100 w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.menuItemId, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-300 hover:bg-border/60 dark:hover:bg-slate-700 cursor-pointer active:scale-95"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.menuItemId)}
                      className="w-6 h-6 flex items-center justify-center text-danger hover:bg-red-50 dark:hover:bg-red-950/40 rounded ml-0.5 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {/* Note display or expandable input */}
                {activeNoteId === item.menuItemId || item.notes ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={e => updateItemNotes(item.menuItemId, e.target.value)}
                      placeholder="Item note (e.g. crispy)"
                      className="flex-1 text-[11px] px-2 py-0.5 min-h-[24px] bg-surface/50 dark:bg-slate-800/60 border border-border/80 dark:border-slate-700 rounded text-text dark:text-slate-100 placeholder:text-text-secondary/70 focus:outline-none focus:bg-white dark:focus:bg-slate-800"
                    />
                    {!item.notes && (
                      <button
                        type="button"
                        onClick={() => setActiveNoteId(null)}
                        className="text-[10px] text-text-secondary hover:text-text px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveNoteId(item.menuItemId)}
                    className="text-[10px] text-primary/70 dark:text-blue-400/70 hover:underline cursor-pointer italic block"
                  >
                    + note
                  </button>
                )}
              </div>
            ))}

            {/* Empty cart state */}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-36 text-text-secondary dark:text-slate-400 text-xs">
                <ShoppingBag size={28} className="opacity-30 mb-1.5" />
                <p className="font-medium">Cart is empty</p>
                <p className="text-[11px] opacity-75 mt-0.5">Click menu items on the left to add</p>
              </div>
            )}

            {/* Existing Active Table Orders */}
            {order?.items && order.items.filter(i => i.status !== 'CANCELLED').length > 0 && (
              <div className="border-t border-border dark:border-slate-800 bg-surface/20 dark:bg-slate-800/20">
                <div className="px-2.5 sm:px-3 py-1.5 bg-surface/80 dark:bg-slate-800/80 border-b border-border/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-secondary dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt size={12} />
                    Already Sent to Kitchen ({order.items.filter(i => i.status !== 'CANCELLED').length})
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-text dark:text-slate-200">
                    ₹{order.items.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + parseFloat(i.priceSnapshot) * i.quantity, 0).toFixed(2)}
                  </span>
                </div>
                <div className="divide-y divide-border/40 dark:divide-slate-800/50">
                  {order.items.filter(i => i.status !== 'PENDING' && i.status !== 'CANCELLED').map(item => (
                    <div key={item.id} className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 text-xs">
                      <div className="pr-2 min-w-0">
                        <p className="font-medium text-text dark:text-slate-200 truncate">{item.itemNameSnapshot}</p>
                        <p className="text-[10px] text-text-secondary dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>×{item.quantity}</span>
                          <span>•</span>
                          <Badge variant={item.status === 'SERVED' ? 'success' : item.status === 'READY' ? 'success' : 'warning'}>{item.status}</Badge>
                          {item.notes && <span className="text-primary dark:text-blue-400 italic truncate max-w-[100px]">({item.notes})</span>}
                        </p>
                      </div>
                      <span className="font-mono text-text dark:text-slate-200 whitespace-nowrap text-xs">₹{(parseFloat(item.priceSnapshot) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {order.items.filter(i => i.status === 'CANCELLED').map(item => (
                    <div key={item.id} className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 text-xs opacity-50 bg-red-50/40 dark:bg-red-950/20">
                      <div className="pr-2 min-w-0">
                        <p className="line-through text-text-secondary dark:text-slate-400 truncate">{item.itemNameSnapshot}</p>
                        <Badge variant="danger">CANCELLED</Badge>
                      </div>
                      <span className="font-mono line-through text-text-secondary whitespace-nowrap text-xs">₹{(parseFloat(item.priceSnapshot) * (item.originalQuantity || item.quantity)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cart Bill Breakdown & Actions - Ultra-Compact Single Bar */}
          <div className="p-2 sm:p-2.5 border-t border-border dark:border-slate-800 bg-surface/80 dark:bg-slate-800/90 shrink-0 z-10">
            {cart.length > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-text-secondary dark:text-slate-400 truncate">
                    ₹{cartSubtotal.toFixed(2)} + ₹{(sgstAmount + cgstAmount).toFixed(2)} GST
                  </div>
                  <div className="text-sm sm:text-base font-bold text-primary dark:text-blue-400 font-mono leading-tight">
                    ₹{finalTotal.toFixed(2)}
                  </div>
                </div>
                {canOrder && (
                  <button
                    type="button"
                    onClick={createOrderAndSend}
                    disabled={sending}
                    className="px-3.5 sm:px-4 py-2 bg-primary dark:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-primary-light dark:hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0 whitespace-nowrap"
                  >
                    {sending ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                    <span>Send to Kitchen</span>
                  </button>
                )}
              </div>
            ) : order?.items && order.items.filter(i => i.status !== 'CANCELLED').length > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-text-secondary dark:text-slate-400 block">Table Total</span>
                  <span className="font-mono font-bold text-text dark:text-slate-100 text-xs sm:text-sm">
                    ₹{order.items.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + parseFloat(i.priceSnapshot) * i.quantity, 0).toFixed(2)}
                  </span>
                </div>
                {canBill && (
                  <button
                    type="button"
                    onClick={openBillModal}
                    className="px-3.5 sm:px-4 py-2 bg-success text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-green-600 active:scale-[0.99] flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Receipt size={14} /> Generate Bill
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-1 text-[11px] text-text-secondary dark:text-slate-400 italic">
                Cart is empty
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
              <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">SGST ({Number(billPreview.sgstPercent || 2.5).toFixed(3)}%)</span><span className="font-mono text-text dark:text-slate-100">₹{parseFloat(billPreview.sgstAmount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary dark:text-slate-400">CGST ({Number(billPreview.cgstPercent || 2.5).toFixed(3)}%)</span><span className="font-mono text-text dark:text-slate-100">₹{parseFloat(billPreview.cgstAmount).toFixed(2)}</span></div>
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

      {/* Close Table Confirmation Modal */}
      <Modal isOpen={showCloseModal} onClose={() => !closingTable && setShowCloseModal(false)} title={`Close Table ${table?.number || ''}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="text-xs space-y-1.5">
              <p className="font-semibold text-sm">Release Table {table?.number}?</p>
              <p className="text-red-700 dark:text-red-300/90 leading-relaxed">
                This will close the active session and release this table back to <span className="font-semibold text-green-600 dark:text-green-400">AVAILABLE</span>.
              </p>
              {order?.items && order.items.some(i => i.status !== 'CANCELLED') && (
                <p className="font-medium text-amber-700 dark:text-amber-400 pt-1">
                  ⚠️ Note: Unbilled items and active KOTs for this table will be cancelled.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={closingTable}
              onClick={() => setShowCloseModal(false)}
              className="px-4 py-2 border border-border dark:border-slate-700 rounded-lg text-xs font-medium text-text-secondary dark:text-slate-300 hover:bg-surface dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={closingTable}
              onClick={handleCloseTable}
              className="px-4 py-2 bg-danger text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {closingTable ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Closing...</span>
                </>
              ) : (
                <>
                  <LogOut size={14} />
                  <span>Confirm & Close Table</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
