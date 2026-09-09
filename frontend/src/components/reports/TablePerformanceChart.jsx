import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { tableBlue, acBlue, nonAcBlue } from '../../assets';

export default function TablePerformanceChart({ tables = [] }) {
  const data = (tables || []).slice(0, 7).map(t => ({
    ...t,
    displayName: `Table ${t.tableNumber}`,
    revenue: Number(t.revenue || 0),
    ordersCount: Number(t.ordersCount || 0),
    isAc: t.type === 'AC'
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const t = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl shadow-xl border border-border dark:border-slate-800 text-xs min-w-[150px]">
        <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-border dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-text dark:text-slate-100">
            <img src={tableBlue} alt="Table" className="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
            <span>Table {t.tableNumber}</span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${t.isAc ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300'}`}>
            {t.type}
          </span>
        </div>
        <div className="flex items-center justify-between text-text-secondary dark:text-slate-400">
          <span>Turnover / Bills:</span>
          <span className="font-mono font-semibold text-text dark:text-slate-100">{t.ordersCount}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-text-secondary dark:text-slate-400">Revenue:</span>
          <span className="font-mono font-bold text-primary dark:text-blue-400">₹{t.revenue.toLocaleString('en-IN')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <img src={tableBlue} alt="Table" className="w-4 h-4 object-contain dark:brightness-0 dark:invert" />
          </div>
          <div>
            <h3 className="font-semibold text-text dark:text-slate-100 text-sm">Dine-In Table Revenue</h3>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">Performance by table number & section</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-[11px] text-text-secondary dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E40AF]" /> AC
          </span>
          <span className="flex items-center gap-1 text-[11px] text-text-secondary dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" /> Non-AC
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary dark:text-slate-400 text-xs py-8">
          <img src={tableBlue} alt="Table" className="w-8 h-8 object-contain opacity-30 mb-1.5 dark:brightness-0 dark:invert" />
          <p className="font-medium text-text dark:text-slate-200">No dine-in orders recorded</p>
          <p className="text-[11px]">Completed table sessions will be ranked here.</p>
        </div>
      ) : (
        <div className="w-full flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="tableNumber"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
                tickFormatter={val => `T-${val}`}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={val => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isAc ? '#1E40AF' : '#60A5FA'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
