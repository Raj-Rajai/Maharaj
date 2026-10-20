import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, BarChart2, Layers, IndianRupee, ShoppingBag } from 'lucide-react';

const CHANNEL_CONFIG = {
  acSales: { label: 'AC Dine-In', color: '#1E40AF', icon: '❄️' },
  nonAcSales: { label: 'Non-AC Dine-In', color: '#3B82F6', icon: '🍽️' },
  selfPickupSales: { label: 'Self Pickup', color: '#10B981', icon: '🛍️' },
  swiggyRevenue: { label: 'Swiggy', color: '#FC8019', icon: '🛵' },
  zomatoRevenue: { label: 'Zomato', color: '#CB202D', icon: '🛵' },
};

export default function RevenueTrendChart({ timeline = [], isSingleDay = false }) {
  const [chartType, setChartType] = useState('area');
  const [metric, setMetric] = useState('revenue');
  const [viewMode, setViewMode] = useState('stacked');

  const data = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    return timeline.map(item => ({
      ...item,
      displayLabel: item.label || item.time || item.date || ''
    }));
  }, [timeline]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const totalVal = metric === 'revenue'
      ? payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0)
      : payload[0]?.payload?.orders || 0;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-border dark:border-slate-800 text-xs min-w-[200px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border dark:border-slate-800">
          <span className="font-semibold text-text dark:text-slate-100">
            {isSingleDay ? `Time: ${label}` : `Date: ${label}`}
          </span>
          <span className="font-bold font-mono text-primary dark:text-blue-400">
            {metric === 'revenue' ? `₹${totalVal.toLocaleString('en-IN')}` : `${totalVal} Orders`}
          </span>
        </div>

        <div className="space-y-1.5">
          {payload.map((entry, idx) => {
            if (metric === 'orders') {
              return (
                <div key={idx} className="flex justify-between items-center text-text-secondary dark:text-slate-400">
                  <span>Total Orders:</span>
                  <span className="font-mono font-semibold text-text dark:text-slate-100">{entry.value}</span>
                </div>
              );
            }

            const conf = CHANNEL_CONFIG[entry.dataKey] || { label: entry.name, color: entry.color, icon: '•' };
            const val = Number(entry.value) || 0;
            if (val === 0 && payload.length > 2) return null;

            return (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conf.color }} />
                  <span className="text-text-secondary dark:text-slate-400 truncate">{conf.label}</span>
                </div>
                <span className="font-mono font-bold text-text dark:text-slate-100">
                  ₹{val.toLocaleString('en-IN')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasData = data.some(d => (metric === 'revenue' ? d.total > 0 : d.orders > 0));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col h-full">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-text dark:text-slate-100 text-sm">
              {metric === 'revenue' ? 'Sales & Revenue Trend' : 'Order Volume Trend'}
            </h3>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">
              {isSingleDay ? 'Hour-by-hour performance breakdown' : 'Daily sales progression over period'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <div className="flex bg-surface dark:bg-slate-800 rounded-lg p-0.5 border border-border dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                metric === 'revenue' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
            >
              <IndianRupee size={12} />
              <span>Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setMetric('orders')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                metric === 'orders' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
            >
              <ShoppingBag size={12} />
              <span>Orders</span>
            </button>
          </div>

          <div className="flex bg-surface dark:bg-slate-800 rounded-lg p-0.5 border border-border dark:border-slate-700">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                chartType === 'area' ? 'bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
              title="Area Chart"
            >
              <TrendingUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                chartType === 'bar' ? 'bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-xs' : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
              title="Bar Chart"
            >
              <BarChart2 size={14} />
            </button>
          </div>

          {metric === 'revenue' && (
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'stacked' ? 'total' : 'stacked')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                viewMode === 'stacked'
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-primary dark:text-blue-300 font-medium'
                  : 'bg-white dark:bg-slate-800 border-border dark:border-slate-700 text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-700'
              }`}
              title="Toggle Channel Breakdown"
            >
              <Layers size={13} />
              <span>{viewMode === 'stacked' ? 'Channels' : 'Total'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full min-h-[280px] sm:min-h-[320px]">
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary dark:text-slate-400 text-xs p-8">
            <TrendingUp size={36} className="text-gray-300 dark:text-slate-600 mb-2" />
            <p className="font-medium text-text dark:text-slate-200">No sales data recorded in this period</p>
            <p className="text-[11px] text-text-secondary dark:text-slate-500 mt-0.5">Orders and bills finalized will graph here automatically.</p>
          </div>
        ) : chartType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorAc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorNonAc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorPickup" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorSwiggy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FC8019" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FC8019" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorZomato" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CB202D" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#CB202D" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (metric === 'revenue' ? `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}` : val)}
              />
              <Tooltip content={<CustomTooltip />} />

              {metric === 'orders' ? (
                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                />
              ) : viewMode === 'total' ? (
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total Revenue"
                  stroke="#1E40AF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
              ) : (
                <>
                  <Area
                    type="monotone"
                    stackId="1"
                    dataKey="acSales"
                    name="AC Dine-In"
                    stroke="#1E40AF"
                    strokeWidth={1.5}
                    fill="url(#colorAc)"
                  />
                  <Area
                    type="monotone"
                    stackId="1"
                    dataKey="nonAcSales"
                    name="Non-AC Dine-In"
                    stroke="#3B82F6"
                    strokeWidth={1.5}
                    fill="url(#colorNonAc)"
                  />
                  <Area
                    type="monotone"
                    stackId="1"
                    dataKey="selfPickupSales"
                    name="Self Pickup"
                    stroke="#10B981"
                    strokeWidth={1.5}
                    fill="url(#colorPickup)"
                  />
                  <Area
                    type="monotone"
                    stackId="1"
                    dataKey="swiggyRevenue"
                    name="Swiggy"
                    stroke="#FC8019"
                    strokeWidth={1.5}
                    fill="url(#colorSwiggy)"
                  />
                  <Area
                    type="monotone"
                    stackId="1"
                    dataKey="zomatoRevenue"
                    name="Zomato"
                    stroke="#CB202D"
                    strokeWidth={1.5}
                    fill="url(#colorZomato)"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (metric === 'revenue' ? `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}` : val)}
              />
              <Tooltip content={<CustomTooltip />} />

              {metric === 'orders' ? (
                <Bar dataKey="orders" name="Orders" fill="#10B981" radius={[4, 4, 0, 0]} />
              ) : viewMode === 'total' ? (
                <Bar dataKey="total" name="Total Revenue" fill="#1E40AF" radius={[4, 4, 0, 0]} />
              ) : (
                <>
                  <Bar dataKey="acSales" stackId="a" name="AC Dine-In" fill="#1E40AF" />
                  <Bar dataKey="nonAcSales" stackId="a" name="Non-AC Dine-In" fill="#3B82F6" />
                  <Bar dataKey="selfPickupSales" stackId="a" name="Self Pickup" fill="#10B981" />
                  <Bar dataKey="swiggyRevenue" stackId="a" name="Swiggy" fill="#FC8019" />
                  <Bar dataKey="zomatoRevenue" stackId="a" name="Zomato" fill="#CB202D" radius={[4, 4, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {metric === 'revenue' && viewMode === 'stacked' && hasData && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 mt-2 border-t border-border/60 dark:border-slate-800 text-xs">
          {Object.entries(CHANNEL_CONFIG).map(([key, conf]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: conf.color }} />
              <span className="text-text-secondary dark:text-slate-400">{conf.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
