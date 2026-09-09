import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';

export default function HourlyWaveChart({ timeline = [] }) {

  const data = (timeline || []).map(item => ({
    ...item,
    displayLabel: item.time || (item.hour !== undefined ? `${item.hour}:00` : ''),
    revenue: Number(item.total || 0),
    orders: Number(item.orders || 0),
  }));

  const hasSales = data.some(d => d.revenue > 0);

  const peak = data.reduce(
    (max, cur) => (cur.revenue > max.revenue ? cur : max),
    { revenue: 0, displayLabel: '-' }
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl shadow-xl border border-border dark:border-slate-800 text-xs min-w-[140px] animate-fade-in-down">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border dark:border-slate-800">
          <span className="font-semibold text-text dark:text-slate-100 flex items-center gap-1">
            <Clock size={12} className="text-primary dark:text-blue-400" />
            {item.displayLabel}
          </span>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
            {item.orders} {item.orders === 1 ? 'order' : 'orders'}
          </span>
        </div>
        <div className="flex justify-between items-center text-text dark:text-slate-100 font-bold font-mono">
          <span className="text-text-secondary dark:text-slate-400 text-[11px] font-normal">Revenue:</span>
          <span>₹{item.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between group hover:border-primary/40 dark:hover:border-blue-500/40 hover:shadow-md transition-all duration-300">

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-primary dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="font-bold text-text dark:text-slate-100 text-sm">Today's Hourly Rhythm</h3>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">Sales velocity across operational hours</p>
          </div>
        </div>

        {hasSales && peak.revenue > 0 && (
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-text-secondary dark:text-slate-400 block uppercase tracking-wider font-semibold">Peak Window</span>
            <span className="text-xs font-bold text-primary dark:text-blue-300 font-mono bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/60">
              {peak.displayLabel} • ₹{peak.revenue.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      <div className="w-full h-44 mt-1">
        {!hasSales ? (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary dark:text-slate-400 text-xs bg-surface/50 dark:bg-slate-800/40 rounded-xl border border-dashed border-border/70 dark:border-slate-800 p-4">
            <Clock size={24} className="text-slate-300 dark:text-slate-600 mb-1.5 animate-pulse" />
            <p className="font-medium text-text dark:text-slate-200">No hourly transactions yet today</p>
            <p className="text-[11px] text-text-secondary dark:text-slate-500">New orders will stream into this wave in real-time.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="dashWaveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Hourly Sales"
                stroke="#1E40AF"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#dashWaveGradient)"
                activeDot={{
                  r: 5,
                  fill: '#1E40AF',
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                  className: 'animate-pulse'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
