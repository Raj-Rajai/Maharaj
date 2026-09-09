import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CreditCard, IndianRupee, Smartphone, Wallet } from 'lucide-react';

const METHOD_CONFIG = {
  CASH: { label: 'Cash', color: '#10B981', icon: IndianRupee, bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
  UPI: { label: 'UPI / QR', color: '#1E40AF', icon: Smartphone, bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' },
  CARD: { label: 'Credit/Debit Card', color: '#F59E0B', icon: CreditCard, bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
};

export default function PaymentMethodChart({ payments = {} }) {
  const cashTotal = Number(payments?.CASH?.total || 0);
  const upiTotal = Number(payments?.UPI?.total || 0);
  const cardTotal = Number(payments?.CARD?.total || 0);

  const totalPayments = Object.values(payments || {}).reduce((sum, p) => sum + Number(p?.total || 0), 0);
  const totalTxns = Object.values(payments || {}).reduce((sum, p) => sum + Number(p?.count || 0), 0);

  const chartData = [
    { name: 'Cash', value: cashTotal, count: payments?.CASH?.count || 0, color: '#10B981', key: 'CASH' },
    { name: 'UPI', value: upiTotal, count: payments?.UPI?.count || 0, color: '#1E40AF', key: 'UPI' },
    { name: 'Card', value: cardTotal, count: payments?.CARD?.count || 0, color: '#F59E0B', key: 'CARD' },
  ].filter(d => d.value > 0);

  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const pct = totalPayments > 0 ? ((item.value / totalPayments) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-2xl border border-border dark:border-slate-800 text-xs z-50 pointer-events-none select-none">
        <div className="flex items-center gap-1.5 font-bold text-text dark:text-slate-100 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.name}</span>
        </div>
        <p className="font-mono font-bold text-text dark:text-slate-100 text-sm">₹{item.value.toLocaleString('en-IN')}</p>
        <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-0.5">
          {pct}% • {item.count} transactions
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-5 shadow-xs flex flex-col h-full">

      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <Wallet size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-text dark:text-slate-100 text-sm">Payment Methods</h3>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">Distribution of tender types</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono font-bold text-text dark:text-slate-100">₹{totalPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-text-secondary dark:text-slate-400">{totalTxns} total txns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">

        <div className="relative w-full h-[160px] flex items-center justify-center">
          {chartData.length === 0 ? (
            <div className="text-center text-text-secondary dark:text-slate-500 text-xs">
              <CreditCard size={28} className="text-gray-300 dark:text-slate-600 mx-auto mb-1" />
              <p>No payments recorded</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
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
                <span className="text-[10px] font-medium text-text-secondary dark:text-slate-400">Modes</span>
                <span className="text-xs font-bold font-mono text-text dark:text-slate-100">{chartData.length}</span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          {['CASH', 'UPI', 'CARD'].map(k => {
            const conf = METHOD_CONFIG[k];
            const Icon = conf.icon;
            const amount = Number(payments?.[k]?.total || 0);
            const count = Number(payments?.[k]?.count || 0);
            const pct = totalPayments > 0 ? ((amount / totalPayments) * 100).toFixed(0) : 0;

            return (
              <div key={k} className="p-2.5 rounded-lg bg-surface/70 dark:bg-slate-800/60 border border-border/60 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${conf.bg}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-text dark:text-slate-200">{conf.label}</p>
                    <p className="text-[10px] text-text-secondary dark:text-slate-400">{count} txns ({pct}%)</p>
                  </div>
                </div>
                <p className="font-mono font-bold text-text dark:text-slate-100">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
