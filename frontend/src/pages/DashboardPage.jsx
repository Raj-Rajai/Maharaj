import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  TrendingUp, ShoppingBag, Utensils, Smartphone, 
  Users, Receipt, CreditCard, Banknote, Clock, 
  ArrowRight, RefreshCw, Activity, CheckCircle2,
  Flame, ChevronRight, IndianRupee, Layers,
  Package, AlertTriangle
} from 'lucide-react';
import { 
  dashboardBlue, dineInBlue, takeAwayBlue, 
  kitchenBlue, billBlue, acBlue, nonAcBlue,
  swiggyIcon, zomatoIcon, tableBlue, inventoryBlue
} from '../assets';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import HourlyWaveChart from '../components/dashboard/HourlyWaveChart';
import QuickOperations from '../components/dashboard/QuickOperations';
import { useRouteActive } from '../components/common/RouteKeepAlive';

export default function DashboardPage() {
  const isActive = useRouteActive();
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    dineInRevenue: 0,
    onlineRevenue: 0,
    acSales: 0,
    nonAcSales: 0,
    selfPickupSales: 0,
    swiggyRevenue: 0,
    zomatoRevenue: 0,
    avgOrderValue: 0,
    timeline: []
  });
  const [ordersData, setOrdersData] = useState({ totalOrders: 0 });
  const [tablesData, setTablesData] = useState({
    occupied: 0,
    total: 0,
    acOccupied: 0,
    acTotal: 0,
    nonAcOccupied: 0,
    nonAcTotal: 0
  });
  const [kotsData, setKotsData] = useState({ pending: 0, preparing: 0 });
  const [paymentsData, setPaymentsData] = useState({
    cash: 0,
    cashCount: 0,
    upi: 0,
    upiCount: 0,
    card: 0,
    cardCount: 0
  });
  const [stockData, setStockData] = useState({
    totalItems: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    stockHealthPct: 100,
    lowStockItems: []
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live second clock ticker
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchData = async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      
      // Sequential calls to avoid Supabase connection pool exhaustion
      const salesRes = await api.get(`/reports/sales?startDate=${todayStr}&endDate=${todayStr}`).catch(() => ({ data: {} }));
      const tablesRes = await api.get('/tables').catch(() => ({ data: [] }));
      const kotsRes = await api.get('/kots').catch(() => ({ data: [] }));
      const paymentsRes = await api.get(`/reports/payments?startDate=${todayStr}&endDate=${todayStr}`).catch(() => ({ data: {} }));
      const inventoryRes = await api.get('/inventory').catch(() => api.get('/reports/inventory')).catch(() => ({ data: [] }));

      const s = salesRes.data || {};
      setSalesData({
        totalSales: Number(s.totalRevenue || 0),
        dineInRevenue: Number(s.dineInRevenue || 0),
        onlineRevenue: Number(s.takeAwayRevenue ?? s.onlineRevenue ?? 0),
        acSales: Number(s.acSales || 0),
        nonAcSales: Number(s.nonAcSales || 0),
        selfPickupSales: Number(s.selfPickupSales || 0),
        swiggyRevenue: Number(s.swiggyRevenue || 0),
        zomatoRevenue: Number(s.zomatoRevenue || 0),
        avgOrderValue: Number(s.avgOrderValue || 0),
        timeline: s.timeline || []
      });

      setOrdersData({ totalOrders: Number(s.totalOrders || 0) });
      
      const tables = tablesRes.data || [];
      const acTables = tables.filter(t => t.type === 'AC');
      const nonAcTables = tables.filter(t => t.type === 'NON_AC');

      setTablesData({
        total: tables.length,
        occupied: tables.filter(t => t.status === 'OCCUPIED').length,
        acTotal: acTables.length,
        acOccupied: acTables.filter(t => t.status === 'OCCUPIED').length,
        nonAcTotal: nonAcTables.length,
        nonAcOccupied: nonAcTables.filter(t => t.status === 'OCCUPIED').length,
      });

      const rawKots = Array.isArray(kotsRes?.data) ? kotsRes.data : (kotsRes?.data?.value || []);
      
      const isKotCompleted = (kot) => {
        if (kot.status === 'COMPLETED') return true;
        if (kot.order?.status === 'COMPLETED' || kot.order?.status === 'CANCELLED') return true;
        const nonCancelled = (kot.items || []).filter(i => i.status !== 'CANCELLED');
        if (nonCancelled.length > 0 && nonCancelled.every(i => i.status === 'SERVED')) return true;
        return false;
      };

      const activeKots = rawKots.filter(k => !isKotCompleted(k));
      const activeItems = activeKots
        .flatMap(k => k.items || [])
        .filter(i => i.status !== 'CANCELLED' && i.status !== 'SERVED');

      const pendingPrepCount = activeItems.filter(i => i.status === 'SENT' || i.status === 'PENDING').length;
      const inKitchenCount = activeItems.filter(i => i.status === 'PREPARING').length;
      const readyCount = activeItems.filter(i => i.status === 'READY').length;

      setKotsData({
        pending: pendingPrepCount,
        preparing: inKitchenCount,
        ready: readyCount,
        total: activeKots.length
      });

      const p = paymentsRes.data || {};
      setPaymentsData({
        cash: Number(p.CASH?.total ?? p.cash?.total ?? p.cash ?? 0),
        cashCount: Number(p.CASH?.count ?? p.cash?.count ?? 0),
        upi: Number(p.UPI?.total ?? p.upi?.total ?? p.upi ?? 0),
        upiCount: Number(p.UPI?.count ?? p.upi?.count ?? 0),
        card: Number(p.CARD?.total ?? p.card?.total ?? p.card ?? 0),
        cardCount: Number(p.CARD?.count ?? p.card?.count ?? 0),
      });

      // Process Stock / Inventory Status
      const rawInv = inventoryRes.data;
      let totalInvItems = 0;
      let lowStockCount = 0;
      let inStockCount = 0;
      let outOfStockCount = 0;
      let lowStockList = [];

      if (Array.isArray(rawInv)) {
        totalInvItems = rawInv.length;
        rawInv.forEach(item => {
          const stock = Number(item.currentStock) || 0;
          const threshold = Number(item.lowStockThreshold) || 0;
          if (stock <= 0) {
            outOfStockCount += 1;
            lowStockCount += 1;
            lowStockList.push({ name: item.name, currentStock: stock, unit: item.unit || 'kg', threshold });
          } else if (stock <= threshold) {
            lowStockCount += 1;
            lowStockList.push({ name: item.name, currentStock: stock, unit: item.unit || 'kg', threshold });
          } else {
            inStockCount += 1;
          }
        });
      } else if (rawInv && typeof rawInv === 'object') {
        totalInvItems = rawInv.totalItems || 0;
        lowStockCount = rawInv.lowStockCount || 0;
        inStockCount = Math.max(0, totalInvItems - lowStockCount);
        lowStockList = rawInv.lowStockItems || [];
      }

      const stockHealthPct = totalInvItems > 0 ? Math.round((inStockCount / totalInvItems) * 100) : 100;

      setStockData({
        totalItems: totalInvItems,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        stockHealthPct,
        lowStockItems: lowStockList.slice(0, 3)
      });

      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (showToast) {
        toast.success('Dashboard live metrics updated', { id: 'dash-refresh' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    fetchData(false);
    const interval = setInterval(() => fetchData(false), 45000);
    return () => clearInterval(interval);
  }, [isActive]);

  const totalPayments = paymentsData.cash + paymentsData.upi + paymentsData.card;
  const cashPct = totalPayments > 0 ? (paymentsData.cash / totalPayments) * 100 : 0;
  const upiPct = totalPayments > 0 ? (paymentsData.upi / totalPayments) * 100 : 0;
  const cardPct = totalPayments > 0 ? (paymentsData.card / totalPayments) * 100 : 0;

  const totalRev = salesData.totalSales;
  const totalOccupiedPct = tablesData.total > 0 ? Math.round((tablesData.occupied / tablesData.total) * 100) : 0;
  const acOccupiedPct = tablesData.acTotal > 0 ? Math.round((tablesData.acOccupied / tablesData.acTotal) * 100) : 0;
  const nonAcOccupiedPct = tablesData.nonAcTotal > 0 ? Math.round((tablesData.nonAcOccupied / tablesData.nonAcTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-text-secondary animate-pulse">Initializing Operations Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Live Telemetry Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs animate-fade-in-down">
        <div>
          <div className="flex items-center gap-2.5">
            <img src={dashboardBlue} alt="Dashboard" className="w-7 h-7 object-contain animate-float-gentle dark:brightness-0 dark:invert" />
            <h1 className="text-2xl font-black tracking-tight text-text dark:text-white">
              Operations Hub
            </h1>
          </div>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
            Real-time floor velocity, kitchen queue, and live financial metrics
          </p>
        </div>

        {/* Live Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pulsing Beacon Pill */}
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-beacon-green absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Live Monitor</span>
            {lastUpdated && (
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 border-l border-emerald-200 dark:border-emerald-800 pl-2">
                {lastUpdated}
              </span>
            )}
          </div>

          {/* Clock Widget */}
          <div className="hidden sm:flex items-center gap-1.5 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 px-3 py-1.5 rounded-full text-xs font-mono text-text dark:text-slate-200 shadow-2xs">
            <Clock size={13} className="text-text-secondary dark:text-slate-400" />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Refresh Action Button */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-surface dark:hover:bg-slate-700 active:scale-95 border border-border dark:border-slate-700 rounded-full text-xs font-semibold text-text dark:text-slate-200 shadow-2xs transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh Live Metrics"
          >
            <RefreshCw size={13} className={`text-primary dark:text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Quick Operations Launchpad (Customizable shortcuts to all functions) */}
      <QuickOperations />

      {/* Top 4 Kinetic KPI Cards (Staggered Animation + Hover Lift) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today's Revenue */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 group animate-fade-in-up stagger-1">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-text-secondary dark:text-slate-400 uppercase tracking-wider block">Today's Revenue</span>
              <div className="text-2xl font-black text-text dark:text-slate-100 font-mono mt-1.5 flex items-baseline gap-0.5">
                <span className="text-primary dark:text-blue-400 font-bold">₹</span>
                <AnimatedNumber value={salesData.totalSales} decimals={2} />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-secondary dark:text-slate-400 mt-1">
                <span>Avg Order:</span>
                <span className="font-mono font-semibold text-text dark:text-slate-200">₹{salesData.avgOrderValue.toFixed(2)}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-primary dark:text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-xs">
              <IndianRupee size={22} />
            </div>
          </div>
          {/* Mini Channel Pills */}
          <div className="mt-3 pt-3 border-t border-border/60 dark:border-slate-800 flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400">
            <span>AC: <strong className="text-blue-700 dark:text-blue-400 font-mono">₹{salesData.acSales.toLocaleString('en-IN')}</strong></span>
            <span>Non-AC: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">₹{salesData.nonAcSales.toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-300 group animate-fade-in-up stagger-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-text-secondary dark:text-slate-400 uppercase tracking-wider block">Orders Served</span>
              <div className="text-2xl font-black text-text dark:text-slate-100 font-mono mt-1.5">
                <AnimatedNumber value={ordersData.totalOrders} decimals={0} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                <CheckCircle2 size={12} />
                <span>Finalized today</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-xs">
              <ShoppingBag size={22} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 dark:border-slate-800 flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400">
            <span>Dine-In + Online Parcel Volume</span>
          </div>
        </div>

        {/* Card 3: Dine-In Revenue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300 group animate-fade-in-up stagger-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-text-secondary dark:text-slate-400 uppercase tracking-wider block">Dine-In Revenue</span>
              <div className="text-2xl font-black text-text dark:text-slate-100 font-mono mt-1.5 flex items-baseline gap-0.5">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">₹</span>
                <AnimatedNumber value={salesData.dineInRevenue} decimals={2} />
              </div>
              <div className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">
                {totalRev > 0 ? `${((salesData.dineInRevenue / totalRev) * 100).toFixed(1)}% of total sales` : '0% of total'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-xs">
              <Utensils size={22} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 dark:border-slate-800 flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400">
            <span>AC & Non-AC Hall Collections</span>
          </div>
        </div>

        {/* Card 4: Take Away & Online Deliveries */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800 transition-all duration-300 group animate-fade-in-up stagger-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-text-secondary dark:text-slate-400 uppercase tracking-wider block">Take Away & Online</span>
              <div className="text-2xl font-black text-text dark:text-slate-100 font-mono mt-1.5 flex items-baseline gap-0.5">
                <span className="text-amber-600 dark:text-amber-400 font-bold">₹</span>
                <AnimatedNumber value={salesData.onlineRevenue} decimals={2} />
              </div>
              <div className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">
                {totalRev > 0 ? `${((salesData.onlineRevenue / totalRev) * 100).toFixed(1)}% of total sales` : '0% of total'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-xs">
              <Smartphone size={22} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 dark:border-slate-800 flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400">
            <span>Swiggy: <strong className="font-mono text-orange-600 dark:text-orange-400">₹{salesData.swiggyRevenue.toLocaleString('en-IN')}</strong></span>
            <span>Zomato: <strong className="font-mono text-red-600 dark:text-red-400">₹{salesData.zomatoRevenue.toLocaleString('en-IN')}</strong></span>
          </div>
        </div>
      </div>

      {/* Row 2: Live Hourly Velocity Wave Chart + Real-Time Channel Share */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hourly Sales Velocity Wave (lg:col-span-7) */}
        <div className="lg:col-span-7 animate-fade-in-up stagger-5">
          <HourlyWaveChart timeline={salesData.timeline} />
        </div>

        {/* Multi-Channel Live Revenue Split (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 dark:hover:border-primary/50 hover:shadow-md transition-all duration-300 animate-fade-in-up stagger-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-text dark:text-slate-100 text-sm">Channel Market Share</h3>
                  <p className="text-[11px] text-text-secondary dark:text-slate-400">Live contribution by dining channel</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-primary dark:text-blue-400 bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-md">
                ₹{totalRev.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Proportional Multi-Segment Progress Bar */}
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex my-3.5 shadow-inner">
              {totalRev > 0 ? (
                <>
                  <div
                    style={{ width: `${(salesData.acSales / totalRev) * 100}%` }}
                    className="bg-blue-700 h-full transition-all duration-1000 ease-out"
                    title={`AC: ₹${salesData.acSales}`}
                  />
                  <div
                    style={{ width: `${(salesData.nonAcSales / totalRev) * 100}%` }}
                    className="bg-blue-400 h-full transition-all duration-1000 ease-out"
                    title={`Non-AC: ₹${salesData.nonAcSales}`}
                  />
                  <div
                    style={{ width: `${(salesData.selfPickupSales / totalRev) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all duration-1000 ease-out"
                    title={`Self Pickup: ₹${salesData.selfPickupSales}`}
                  />
                  <div
                    style={{ width: `${(salesData.swiggyRevenue / totalRev) * 100}%` }}
                    className="bg-orange-500 h-full transition-all duration-1000 ease-out"
                    title={`Swiggy: ₹${salesData.swiggyRevenue}`}
                  />
                  <div
                    style={{ width: `${(salesData.zomatoRevenue / totalRev) * 100}%` }}
                    className="bg-red-500 h-full transition-all duration-1000 ease-out"
                    title={`Zomato: ₹${salesData.zomatoRevenue}`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-700" />
              )}
            </div>

            {/* Channel Rows */}
            <div className="space-y-2 mt-2">
              {[
                { name: 'AC Dine-In', value: salesData.acSales, color: 'bg-blue-700', logo: acBlue },
                { name: 'Non-AC Dine-In', value: salesData.nonAcSales, color: 'bg-blue-400', logo: nonAcBlue },
                { name: 'Self Pickup', value: salesData.selfPickupSales, color: 'bg-emerald-500', logo: takeAwayBlue },
                { name: 'Swiggy', value: salesData.swiggyRevenue, color: 'bg-orange-500', logo: swiggyIcon },
                { name: 'Zomato', value: salesData.zomatoRevenue, color: 'bg-red-500', logo: zomatoIcon },
              ].map(ch => {
                const pct = totalRev > 0 ? ((ch.value / totalRev) * 100).toFixed(1) : '0.0';
                return (
                  <div
                    key={ch.name}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface dark:hover:bg-slate-800/60 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${ch.color}`} />
                      <img src={ch.logo} alt={ch.name} className="w-4 h-4 object-contain" />
                      <span className="font-medium text-text dark:text-slate-200">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-text-secondary dark:text-slate-400 font-mono">{pct}%</span>
                      <span className="font-mono font-bold text-text dark:text-slate-100 w-20 text-right">
                        ₹{ch.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            to="/reports"
            className="mt-3 pt-2.5 border-t border-border dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 group"
          >
            <span>Explore deep reports & charts</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Row 3: Live Operations Monitoring (Tables, Kitchen KOTs, Stock Reports, Payment Split) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Floor Tables Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 flex flex-col justify-between group animate-fade-in-up stagger-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={16} />
                </div>
                <h3 className="text-sm font-bold text-text dark:text-slate-100">Dine-In Floor</h3>
              </div>
              <span className="text-xs font-mono font-semibold text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                {totalOccupiedPct}% Full
              </span>
            </div>

            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black text-primary dark:text-blue-400 font-mono">
                  <AnimatedNumber value={tablesData.occupied} />
                </p>
                <span className="text-base text-text-secondary dark:text-slate-400 font-normal font-mono">/ {tablesData.total} Tables Occupied</span>
              </div>
              {/* Overall Progress Bar */}
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  style={{ width: `${totalOccupiedPct}%` }}
                  className="bg-primary dark:bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                />
              </div>
            </div>

            {/* Split Breakdown */}
            <div className="space-y-2 mt-4 pt-3 border-t border-border/70 dark:border-slate-800 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary dark:text-slate-400 flex items-center gap-1">
                    <img src={acBlue} alt="AC" className="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
                    AC Hall:
                  </span>
                  <span className="font-mono font-medium text-text dark:text-slate-200">{tablesData.acOccupied} / {tablesData.acTotal} tables</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${acOccupiedPct}%` }}
                    className="bg-blue-600 dark:bg-blue-400 h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary dark:text-slate-400 flex items-center gap-1">
                    <img src={nonAcBlue} alt="Non-AC" className="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
                    Non-AC Hall:
                  </span>
                  <span className="font-mono font-medium text-text dark:text-slate-200">{tablesData.nonAcOccupied} / {tablesData.nonAcTotal} tables</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${nonAcOccupiedPct}%` }}
                    className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>
            </div>
          </div>

          <Link
            to="/tables"
            className="mt-4 pt-2.5 border-t border-border/70 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 group"
          >
            <span>Manage Dining Tables</span>
            <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </Link>
        </div>

        {/* Live Kitchen Queue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800 transition-all duration-300 flex flex-col justify-between group animate-fade-in-up stagger-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Flame size={16} />
                </div>
                <h3 className="text-sm font-bold text-text dark:text-slate-100">Kitchen Queue (KOT)</h3>
              </div>
              {kotsData.total > 0 ? (
                <span className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-full shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-beacon-amber absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Active Orders ({kotsData.total})
                </span>
              ) : (
                <span className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Queue Clear
                </span>
              )}
            </div>

            <div className="my-2">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                  <AnimatedNumber value={kotsData.total} />
                </p>
                <span className="text-sm font-semibold text-text-secondary dark:text-slate-400 tracking-wide">
                  {kotsData.total === 1 ? 'KOT In Progress' : 'KOTs In Progress'}
                </span>
              </div>
              <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                {kotsData.total > 0
                  ? `${kotsData.pending} awaiting prep, ${kotsData.preparing} in kitchen`
                  : 'All kitchen tickets up to date'}
              </p>
            </div>

            {/* KOT Status Tiles */}
            <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-border/70 dark:border-slate-800">
              <div className="bg-surface/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-border/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-text-secondary dark:text-slate-400 block">Pending Prep</span>
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  <AnimatedNumber value={kotsData.pending} />
                </span>
              </div>
              <div className="bg-surface/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-border/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-text-secondary dark:text-slate-400 block">In Kitchen</span>
                <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  <AnimatedNumber value={kotsData.preparing} />
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/kitchen"
            className="mt-4 pt-2.5 border-t border-border/70 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 group"
          >
            <span>Open Kitchen Display</span>
            <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </Link>
        </div>

        {/* Stock Reports / Live Inventory Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-800 transition-all duration-300 flex flex-col justify-between group animate-fade-in-up stagger-7">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package size={16} />
                </div>
                <h3 className="text-sm font-bold text-text dark:text-slate-100">Stock Reports</h3>
              </div>
              {stockData.lowStockCount > 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  {stockData.lowStockCount} Low Stock
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Optimal Stock
                </span>
              )}
            </div>

            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <p className={`text-3xl font-black font-mono ${stockData.lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <AnimatedNumber value={stockData.inStockCount} />
                </p>
                <span className="text-base text-text-secondary dark:text-slate-400 font-normal font-mono">/ {stockData.totalItems} In Stock</span>
              </div>
              {/* Overall Progress Bar */}
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  style={{ width: `${stockData.stockHealthPct}%` }}
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    stockData.lowStockCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Stock Status Tiles */}
            <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-border/70 dark:border-slate-800">
              <div className="bg-surface dark:bg-slate-800/80 p-2.5 rounded-xl border border-border/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-text-secondary dark:text-slate-400 block">In Stock</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  <AnimatedNumber value={stockData.inStockCount} />
                </span>
              </div>
              <div className="bg-surface dark:bg-slate-800/80 p-2.5 rounded-xl border border-border/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-text-secondary dark:text-slate-400 block">Low Stock</span>
                <span className={`text-base font-bold font-mono ${stockData.lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-secondary dark:text-slate-400'}`}>
                  <AnimatedNumber value={stockData.lowStockCount} />
                </span>
              </div>
            </div>

            {/* Quick alert indicator */}
            {stockData.lowStockItems.length > 0 ? (
              <div className="mt-2.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/50 px-2.5 py-1.5 rounded-lg border border-amber-200/70 dark:border-amber-800/70 truncate flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  Needs restock: {stockData.lowStockItems.map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}
                </span>
              </div>
            ) : (
              <div className="mt-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 px-2.5 py-1.5 rounded-lg border border-emerald-200/70 dark:border-emerald-800/70 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>All ingredients & supplies optimal</span>
              </div>
            )}
          </div>

          <Link
            to="/inventory"
            className="mt-4 pt-2.5 border-t border-border/70 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 group"
          >
            <span>Manage Inventory & Stock</span>
            <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </Link>
        </div>

        {/* Payment Collections & Methods */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-border dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-300 flex flex-col justify-between group animate-fade-in-up stagger-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Receipt size={16} />
                </div>
                <h3 className="text-sm font-bold text-text dark:text-slate-100">Payment Collections</h3>
              </div>
              <span className="text-xs font-mono font-bold text-text dark:text-slate-100">
                ₹{totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Methods with Animated Progress Bars */}
            <div className="space-y-3 my-2">
              {/* Cash */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-text dark:text-slate-200 font-medium">
                    <Banknote size={13} className="text-emerald-600 dark:text-emerald-400" />
                    Cash:
                  </span>
                  <span className="font-mono font-bold text-text dark:text-slate-100">
                    ₹<AnimatedNumber value={paymentsData.cash} decimals={2} />
                    <span className="text-[10px] text-text-secondary dark:text-slate-400 font-normal ml-1">({cashPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cashPct}%` }}
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>

              {/* UPI */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-text dark:text-slate-200 font-medium">
                    <Smartphone size={13} className="text-blue-600 dark:text-blue-400" />
                    UPI / QR:
                  </span>
                  <span className="font-mono font-bold text-text dark:text-slate-100">
                    ₹<AnimatedNumber value={paymentsData.upi} decimals={2} />
                    <span className="text-[10px] text-text-secondary dark:text-slate-400 font-normal ml-1">({upiPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${upiPct}%` }}
                    className="bg-blue-600 dark:bg-blue-400 h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>

              {/* Card */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-text dark:text-slate-200 font-medium">
                    <CreditCard size={13} className="text-purple-600 dark:text-purple-400" />
                    Cards / POS:
                  </span>
                  <span className="font-mono font-bold text-text dark:text-slate-100">
                    ₹<AnimatedNumber value={paymentsData.card} decimals={2} />
                    <span className="text-[10px] text-text-secondary dark:text-slate-400 font-normal ml-1">({cardPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cardPct}%` }}
                    className="bg-purple-600 dark:bg-purple-400 h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>
            </div>
          </div>

          <Link
            to="/reports"
            className="mt-4 pt-2.5 border-t border-border/70 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 group"
          >
            <span>View Payment Reports</span>
            <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </Link>
        </div>
      </div>
    </div>
  );
}
