import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  ShoppingBag, Search, Plus, Minus, Trash2, Send, Receipt,
  Clock, CheckCircle, RefreshCw, FileText, ArrowRight, Smartphone
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { swiggyIcon, zomatoIcon, takeAwayBlue } from '../assets';

const CHANNELS = [
  {
    id: 'SELF_PICKUP',
    name: 'Self Pickup Parcel',
    shortName: 'Self Pickup',
    menuType: 'NON_AC',
    badgeVariant: 'success',
    colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    activeTabClass: 'bg-emerald-600 text-white shadow-sm',
    badgeText: 'Non-AC Menu Prices',
    logo: takeAwayBlue,
    icon: ShoppingBag,
  },
  {
    id: 'SWIGGY',
    name: 'Swiggy Delivery',
    shortName: 'Swiggy',
    menuType: 'SWIGGY',
    badgeVariant: 'warning',
    colorClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    activeTabClass: 'bg-orange-500 text-white shadow-sm',
    badgeText: 'Swiggy Menu Prices',
    logo: swiggyIcon,
    icon: Smartphone,
  },
  {
    id: 'ZOMATO',
    name: 'Zomato Delivery',
    shortName: 'Zomato',
    menuType: 'ZOMATO',
    badgeVariant: 'danger',
    colorClass: 'bg-red-600 hover:bg-red-700 text-white',
    activeTabClass: 'bg-red-600 text-white shadow-sm',
    badgeText: 'Zomato Menu Prices',
    logo: zomatoIcon,
    icon: Smartphone,
  },
];

export default function TakeAwayPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canOrder = hasPermission('ORDER_CREATE') || hasPermission('ONLINE_ORDER_CREATE');
  const canViewSelfPickup = hasPermission('MENU_NON_AC_VIEW') || hasPermission('ORDER_CREATE');
  const canViewSwiggy = hasPermission('ONLINE_ORDER_VIEW') || hasPermission('MENU_SWIGGY_VIEW');
  const canViewZomato = hasPermission('ONLINE_ORDER_VIEW') || hasPermission('MENU_ZOMATO_VIEW');

  const visibleChannels = useMemo(() => {
    return CHANNELS.filter(ch => {
      if (ch.id === 'SELF_PICKUP') return canViewSelfPickup;
      if (ch.id === 'SWIGGY') return canViewSwiggy;
      if (ch.id === 'ZOMATO') return canViewZomato;
      return true;
    });
  }, [canViewSelfPickup, canViewSwiggy, canViewZomato]);

  // Channel & view states
  const [selectedChannel, setSelectedChannel] = useState('SELF_PICKUP');
  const [activeView, setActiveView] = useState('pos'); // 'pos' | 'history'
  const [mobilePosTab, setMobilePosTab] = useState('menu'); // 'menu' | 'cart' on mobile

  useEffect(() => {
    if (visibleChannels.length > 0 && !visibleChannels.some(c => c.id === selectedChannel)) {
      setSelectedChannel(visibleChannels[0].id);
    }
  }, [visibleChannels, selectedChannel]);

  // Data states
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Cart state
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success modal state
  const [createdResult, setCreatedResult] = useState(null);

  // History state
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activeChannelConfig = CHANNELS.find(c => c.id === selectedChannel) || CHANNELS[0];

  // Fetch categories & menu items for active channel
  const loadMenuData = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const catRes = await api.get('/menu/categories');
      const itemRes = await api.get('/menu/items', { params: { menuType: activeChannelConfig.menuType } });
      setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data.value || []);
      setMenuItems(Array.isArray(itemRes.data) ? itemRes.data : itemRes.data.value || []);
    } catch {
      toast.error('Failed to load menu items');
    } finally {
      setLoadingMenu(false);
    }
  }, [activeChannelConfig.menuType]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  useOnRouteActive(() => {
    loadMenuData();
  });

  // When changing channel, reset cart if switching menu type
  const handleChannelChange = (channelId) => {
    if (channelId !== selectedChannel) {
      if (cart.length > 0) {
        if (window.confirm('Switching channels will clear your current cart. Continue?')) {
          setCart([]);
          setSelectedChannel(channelId);
          setSelectedCat('ALL');
          setSearchQ('');
        }
      } else {
        setSelectedChannel(channelId);
        setSelectedCat('ALL');
        setSearchQ('');
      }
    }
  };

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    if (!item.active) return false;
    if (selectedCat !== 'ALL' && item.categoryId !== selectedCat) return false;
    if (searchQ && !item.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  // Cart operations
  const addToCart = (item) => {
    if (!canOrder) {
      toast.error('You do not have permission to place take away orders');
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
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
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNotes('');
    setExternalOrderId('');
  };

  // Cart calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const sgstAmount = Number((cartSubtotal * 0.025).toFixed(2));
  const cgstAmount = Number((cartSubtotal * 0.025).toFixed(2));
  const grandTotal = cartSubtotal + sgstAmount + cgstAmount;
  const finalTotal = Math.round(grandTotal);

  // Submit Take Away Order
  // Flow 1: generateKot = true ("Generate KOT then Bill")
  // Flow 2: generateKot = false ("Direct Bill")
  const handleSubmitOrder = async (generateKot) => {
    if (!canOrder) {
      toast.error('You do not have permission to place take away orders');
      return;
    }
    if (cart.length === 0) {
      toast.error('Add items to cart first');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderSource: selectedChannel,
        items: cart.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
        generateKot,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerNotes: [externalOrderId ? `Order #${externalOrderId}` : null, customerNotes].filter(Boolean).join(' - ') || undefined,
      };

      const res = await api.post('/orders/take-away', payload);
      const data = res.data;

      if (generateKot) {
        toast.success(`KOT #${data.kot?.kotNumber} sent to kitchen & Draft Bill #${data.bill?.billNumber} created!`);
      } else {
        toast.success(`Draft Bill #${data.bill?.billNumber} created directly in Bills!`);
      }

      setCreatedResult({
        channel: activeChannelConfig.name,
        order: data.order,
        kot: data.kot,
        bill: data.bill,
        generateKot,
      });

      clearCart();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create take away order');
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch orders history
  const fetchOrdersHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/orders', {
        params: { status: 'ACTIVE' },
      });
      const allOrders = Array.isArray(res.data) ? res.data : res.data.value || [];
      const takeAwayOrders = allOrders.filter(o =>
        ['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(o.orderSource)
      );
      setOrdersHistory(takeAwayOrders);
    } catch {
      toast.error('Failed to load order history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeView === 'history') {
      fetchOrdersHistory();
    }
  }, [activeView]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Top Header & Channel Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 rounded-xl flex items-center justify-center shrink-0">
              <img src={takeAwayBlue} alt="Take Away" className="w-5 sm:w-6 h-5 sm:h-6 object-contain dark:brightness-0 dark:invert" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2">
                Take Away & Parcels
              </h1>
              <p className="text-[11px] sm:text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                Self Pickup, Swiggy, and Zomato order management with dual billing flows
              </p>
            </div>
          </div>

          {/* Channels Selector & View Switcher */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
            {/* Channel Tabs */}
            <div className="flex gap-1 sm:gap-1.5 bg-surface dark:bg-slate-800 p-1 rounded-xl border border-border dark:border-slate-700 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {visibleChannels.map(ch => {
                const Icon = ch.icon;
                const isActive = selectedChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleChannelChange(ch.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive ? ch.activeTabClass : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.shortName} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0 ${ch.id === 'SELF_PICKUP' ? 'dark:brightness-0 dark:invert' : ''}`} />
                    ) : (
                      <Icon size={14} className="shrink-0" />
                    )}
                    <span>{ch.name}</span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher */}
            <div className="flex gap-1 bg-surface dark:bg-slate-800 p-1 rounded-xl border border-border dark:border-slate-700 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => setActiveView('pos')}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeView === 'pos' ? 'bg-white dark:bg-slate-700 text-primary dark:text-blue-300 shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100'
                }`}
              >
                Order POS
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeView === 'history' ? 'bg-white dark:bg-slate-700 text-primary dark:text-blue-300 shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100'
                }`}
              >
                Active Orders
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Order Confirmation Notification (non-intrusive) */}
      {createdResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  Take Away Order #{createdResult.order?.id?.slice(0, 8)} Placed ({createdResult.channel})
                </span>
                {createdResult.kot && (
                  <Badge variant="primary" className="font-mono text-xs">
                    KOT #{createdResult.kot.kotNumber} → Kitchen
                  </Badge>
                )}
                {createdResult.bill && (
                  <Badge variant="warning" className="font-mono text-xs">
                    Draft Bill #{createdResult.bill.billNumber} → Bills
                  </Badge>
                )}
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                  ₹{Number(createdResult.bill?.total || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                {createdResult.generateKot
                  ? 'KOT sent to kitchen display & draft bill created in bills. Cart cleared, ready for next order.'
                  : 'Draft bill created directly in bills. Cart cleared, ready for next order.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => navigate('/bills')}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View in Bills</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCreatedResult(null)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
            >
              Take Next Order
            </button>
          </div>
        </div>
      )}

      {/* POS View */}
      {activeView === 'pos' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Mobile View Switcher (Menu vs Cart) */}
          <div className="flex lg:hidden w-full bg-surface dark:bg-slate-800 p-1 rounded-lg border border-border dark:border-slate-700 mb-2.5">
            <button
              type="button"
              onClick={() => setMobilePosTab('menu')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mobilePosTab === 'menu'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
            >
              Menu Items
            </button>
            <button
              type="button"
              onClick={() => setMobilePosTab('cart')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mobilePosTab === 'cart'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
            >
              <span>Order Cart</span>
              {cart.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  mobilePosTab === 'cart' ? 'bg-white text-primary' : 'bg-primary text-white'
                }`}>
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 min-h-0 overflow-hidden relative">
            {/* Left: Menu & Food Selector */}
            <div className={`flex-[3] flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden ${
              mobilePosTab === 'menu' ? 'flex flex-1 min-h-[55vh]' : 'hidden lg:flex'
            }`}>
              {/* Active Channel Info Banner */}
              <div className="px-3 sm:px-4 py-2 bg-surface dark:bg-slate-800 border-b border-border dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-text dark:text-slate-200">Channel:</span>
                  <div className="flex items-center gap-1">
                    {activeChannelConfig.logo && (
                      <img src={activeChannelConfig.logo} alt={activeChannelConfig.shortName} className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
                    )}
                    <Badge variant={activeChannelConfig.badgeVariant}>{activeChannelConfig.name}</Badge>
                  </div>
                  <span className="text-[10px] sm:text-xs text-text-secondary dark:text-slate-300 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-border dark:border-slate-600 font-medium">
                    {activeChannelConfig.badgeText}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-text-secondary dark:text-slate-400">
                  {filteredItems.length} items
                </span>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 p-2 sm:p-3 border-b border-border dark:border-slate-800 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCat('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCat === 'ALL'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 border border-border/60 dark:border-slate-700'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCat(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCat === c.id
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 border border-border/60 dark:border-slate-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="p-2 sm:p-3 border-b border-border dark:border-slate-800">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder={`Search ${activeChannelConfig.shortName} food items...`}
                    className="w-full pl-9 pr-4 py-2 bg-surface/50 dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-base sm:text-sm text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Menu Items Grid */}
              <div className="flex-1 overflow-auto p-2.5 sm:p-4">
                {loadingMenu ? (
                  <div className="flex items-center justify-center h-64">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
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
                              ₹{Number(item.price).toFixed(2)}
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
                )}
              </div>

              {/* Floating Cart Pill on Mobile when in Menu tab */}
              {cart.length > 0 && (
                <div className="lg:hidden p-2.5 bg-primary/10 dark:bg-blue-950/40 border-t border-primary/20 flex items-center justify-between">
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
                    onClick={() => setMobilePosTab('cart')}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Review Cart &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Right: Cart & Dual Billing Flows */}
            <div className={`flex-[2] flex-col bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden ${
              mobilePosTab === 'cart' ? 'flex flex-1 min-h-[55vh]' : 'hidden lg:flex'
            }`}>
              {/* Cart Header */}
              <div className="p-3 sm:p-4 border-b border-border dark:border-slate-800 bg-surface/50 dark:bg-slate-800/80 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-text dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    Order Cart
                    <Badge variant={activeChannelConfig.badgeVariant}>{activeChannelConfig.shortName}</Badge>
                  </h2>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                    {cart.length} item types ({cart.reduce((s, i) => s + i.quantity, 0)} total pcs)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobilePosTab('menu')}
                    className="lg:hidden text-xs text-primary dark:text-blue-400 font-semibold hover:underline"
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

            {/* Optional Order Details for Delivery/Notes */}
            <div className="p-3 bg-surface/30 dark:bg-slate-800/50 border-b border-border dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary dark:text-slate-400 mb-1">
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-2.5 py-1.5 min-h-[36px] text-base sm:text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary dark:text-slate-400 mb-1">
                    Customer Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-2.5 py-1.5 min-h-[36px] text-base sm:text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              {(selectedChannel === 'SWIGGY' || selectedChannel === 'ZOMATO') && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-slate-400 mb-1">
                    Platform Order ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={externalOrderId}
                    onChange={e => setExternalOrderId(e.target.value)}
                    placeholder={`e.g. ${selectedChannel === 'SWIGGY' ? 'SWG-94821' : 'ZOM-19402'}`}
                    className="w-full px-3 py-1.5 min-h-[36px] text-base sm:text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-slate-400 mb-1">
                  Customer / Parcel Notes (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={e => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Extra chutney, less spicy, parcel bag"
                  className="w-full px-3 py-1.5 min-h-[36px] text-base sm:text-xs bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-auto divide-y divide-border dark:divide-slate-800">
              {cart.map(item => (
                <div key={item.menuItemId} className="p-2.5 sm:p-3 space-y-1.5 hover:bg-surface/30 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-2">
                      <p className="text-xs sm:text-sm font-semibold text-text dark:text-slate-100 leading-tight">{item.name}</p>
                      <p className="text-xs font-mono text-text-secondary dark:text-slate-400 mt-0.5">
                        ₹{item.price.toFixed(2)} × {item.quantity} = <strong className="text-text dark:text-slate-100">₹{(item.price * item.quantity).toFixed(2)}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.menuItemId, -1)}
                        className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-300 hover:bg-border/60 dark:hover:bg-slate-700 cursor-pointer active:scale-95"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs sm:text-sm font-bold font-mono text-text dark:text-slate-100 w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.menuItemId, 1)}
                        className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-300 hover:bg-border/60 dark:hover:bg-slate-700 cursor-pointer active:scale-95"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.menuItemId)}
                        className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-danger hover:bg-red-50 dark:hover:bg-red-950/40 rounded ml-1 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={e => updateItemNotes(item.menuItemId, e.target.value)}
                    placeholder="Item note (e.g. crispy)"
                    className="w-full text-base sm:text-[11px] px-2 py-1 min-h-[32px] sm:min-h-0 bg-surface/50 dark:bg-slate-800/60 border border-border/80 dark:border-slate-700 rounded text-text dark:text-slate-100 placeholder:text-text-secondary/70 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              ))}
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-text-secondary dark:text-slate-400 text-sm">
                  <ShoppingBag size={32} className="opacity-30 mb-2" />
                  <p>Cart is empty</p>
                  <p className="text-xs opacity-75 mt-0.5">Click menu items on the left to add</p>
                </div>
              )}
            </div>

            {/* Cart Bill Breakdown */}
            <div className="p-4 border-t border-border dark:border-slate-800 bg-surface/40 dark:bg-slate-800/80 space-y-2">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-text-secondary dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-text dark:text-slate-200">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-secondary dark:text-slate-400">
                  <span>SGST (2.5%)</span>
                  <span className="font-mono text-text dark:text-slate-200">₹{sgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-secondary dark:text-slate-400">
                  <span>CGST (2.5%)</span>
                  <span className="font-mono text-text dark:text-slate-200">₹{cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-text dark:text-slate-100 pt-2 border-t border-border dark:border-slate-700">
                  <span>Final Total</span>
                  <span className="font-mono text-primary dark:text-blue-400 text-base">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Dual Billing Action Buttons */}
              {canOrder ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {/* Option One: Generate KOT then Bill */}
                  <button
                    type="button"
                    disabled={submitting || cart.length === 0}
                    onClick={() => handleSubmitOrder(true)}
                    className="py-3 px-2 bg-primary dark:bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-primary-light dark:hover:bg-blue-500 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-xs cursor-pointer text-center"
                    title="Creates order, sends KOT to kitchen, and creates draft bill"
                  >
                    <div className="flex items-center gap-1.5">
                      <Send size={14} />
                      <span>KOT then Bill</span>
                    </div>
                    <span className="text-[10px] font-normal opacity-85">Send to Kitchen & Bill</span>
                  </button>

                  {/* Option Two: Direct Bill */}
                  <button
                    type="button"
                    disabled={submitting || cart.length === 0}
                    onClick={() => handleSubmitOrder(false)}
                    className="py-3 px-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-xs cursor-pointer text-center"
                    title="Directly creates draft bill without generating kitchen KOT"
                  >
                    <div className="flex items-center gap-1.5">
                      <Receipt size={14} />
                      <span>Direct Bill</span>
                    </div>
                    <span className="text-[10px] font-normal opacity-85">Skip Kitchen KOT</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-surface dark:bg-slate-800/60 border border-border dark:border-slate-700 rounded-lg text-xs text-text-secondary dark:text-slate-400 text-center">
                  Read-only view: You do not have permission to place orders.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* History / Active Orders View */}
      {activeView === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-text dark:text-slate-100 text-base">Active Take Away Orders</h2>
            <button
              type="button"
              onClick={fetchOrdersHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary dark:text-blue-400 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg cursor-pointer transition-colors"
            >
              <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-surface dark:bg-slate-800 border-b border-border dark:border-slate-700">
                <tr className="text-left text-text-secondary dark:text-slate-400 text-xs">
                  <th className="px-4 py-3 font-semibold">Order ID</th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Bill Status</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800">
                {ordersHistory.map(ord => {
                  const channelCfg = CHANNELS.find(c => c.id === ord.orderSource) || CHANNELS[0];
                  return (
                    <tr key={ord.id} className="hover:bg-surface/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-text dark:text-slate-200">
                        #{ord.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {channelCfg.logo && (
                            <img src={channelCfg.logo} alt={channelCfg.shortName} className="w-4 h-4 object-contain" />
                          )}
                          <Badge variant={channelCfg.badgeVariant}>{channelCfg.shortName}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text dark:text-slate-200">
                        {ord.items?.length || 0} items
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {ord.bill ? (
                          <Badge variant={ord.bill.status === 'FINALIZED' ? 'success' : 'warning'}>
                            Bill #{ord.bill.billNumber} ({ord.bill.status})
                          </Badge>
                        ) : (
                          <span className="text-text-secondary dark:text-slate-400 italic">No Bill</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary dark:text-slate-400">
                        {new Date(ord.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ord.bill ? (
                          <button
                            type="button"
                            onClick={() => navigate('/bills')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary dark:text-blue-400 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg cursor-pointer"
                          >
                            <Receipt size={13} />
                            View Bill
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {ordersHistory.length === 0 && !loadingHistory && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-secondary dark:text-slate-400 text-sm">
                      No active take away orders.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
