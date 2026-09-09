import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { acBlue, nonAcBlue, takeAwayBlue, swiggyIcon, zomatoIcon } from '../../assets';

const CHANNELS = [
  { key: 'acSales', label: 'AC Dine-In', color: '#1E40AF', logo: acBlue },
  { key: 'nonAcSales', label: 'Non-AC Dine-In', color: '#3B82F6', logo: nonAcBlue },
  { key: 'selfPickupSales', label: 'Self Pickup', color: '#10B981', logo: takeAwayBlue },
  { key: 'swiggyRevenue', label: 'Swiggy Delivery', color: '#FC8019', logo: swiggyIcon },
  { key: 'zomatoRevenue', label: 'Zomato Delivery', color: '#CB202D', logo: zomatoIcon },
];

export default function ChannelDonutChart({ sales = {} }) {
  const totalRev = Number(sales?.totalRevenue || 0);

  const chartData = CHANNELS.map(ch => {
    const value = Number(sales?.[ch.key] || 0);
    const pct = totalRev > 0 ? ((value / totalRev) * 100).toFixed(1) : 0;
    return {
      name: ch.label,
      value,
      pct,
      color: ch.color,
      logo: ch.logo,
      key: ch.key
    };
  }).filter(item => item.value > 0);

  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-2xl border border-border dark:border-slate-800 text-xs z-50 pointer-events-none select-none">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-md flex items-center justify-center bg-surface dark:bg-slate-800 border border-border/60 dark:border-slate-700 shrink-0">
            <img src={item.logo} alt={item.name} className="w-3.5 h-3.5 object-contain" />
          </div>
          <span className="font-bold text-text dark:text-slate-100 text-xs">{item.name}</span>
        </div>
        <p className="font-mono font-bold text-primary dark:text-blue-400 text-sm">
          ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-0.5 font-medium">
          {item.pct}% of total sales
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col h-full">

      <div className="flex items-center justify-between pb-3 mb-2 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400">
            <PieIcon size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-text dark:text-slate-100 text-sm">Channel Distribution</h3>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">Sales breakdown across dine-in and online</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-text dark:text-slate-100">
          ₹{totalRev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="relative flex-1 w-full min-h-[200px] flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-center text-text-secondary dark:text-slate-400 text-xs py-8">
            <PieIcon size={32} className="text-gray-300 dark:text-slate-600 mx-auto mb-1.5" />
            <p className="font-medium text-text dark:text-slate-200">No channel revenue</p>
            <p className="text-[11px]">Sales channels will appear here once orders are finalized.</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-200 ${
                hoveredIndex !== null ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-text-secondary dark:text-slate-400 tracking-wider">Total</span>
              <span className="text-sm font-bold font-mono text-text dark:text-slate-100">
                ₹{totalRev >= 1000 ? `${(totalRev / 1000).toFixed(1)}k` : totalRev}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 pt-3 mt-1 border-t border-border/60 dark:border-slate-800">
        {CHANNELS.map(ch => {
          const val = Number(sales?.[ch.key] || 0);
          const pct = totalRev > 0 ? ((val / totalRev) * 100).toFixed(1) : '0.0';
          return (
            <div key={ch.key} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-surface dark:bg-slate-800 border border-border/60 dark:border-slate-700 shrink-0">
                  <img src={ch.logo} alt={ch.label} className="w-3.5 h-3.5 object-contain" />
                </div>
                <span className="text-text dark:text-slate-200 font-medium truncate">{ch.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-text-secondary dark:text-slate-400 text-[11px]">{pct}%</span>
                <span className="font-mono font-bold text-text dark:text-slate-100 w-16 text-right">
                  ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
