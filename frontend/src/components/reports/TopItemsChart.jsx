import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Utensils, Award, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

const COLORS = ['#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];
const STANDARD_ORDER = ['Starters', 'Main Course', 'Breads', 'Rice', 'Beverages', 'Desserts'];
const ITEMS_PER_PAGE = 4;

export default function TopItemsChart({ topItems = [], categorySales = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [catPage, setCatPage] = useState(0);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    (categorySales || []).forEach(c => c?.name && set.add(c.name));
    (topItems || []).forEach(it => it?.category && set.add(it.category));

    STANDARD_ORDER.forEach(c => set.add(c));

    const extra = Array.from(set).filter(c => !STANDARD_ORDER.includes(c)).sort();
    const ordered = [...STANDARD_ORDER.filter(c => set.has(c)), ...extra];

    return ['ALL', ...ordered];
  }, [categorySales, topItems]);

  const totalPages = Math.max(1, Math.ceil(categoryOptions.length / ITEMS_PER_PAGE));
  const currentCategoryPage = useMemo(() => {
    const start = catPage * ITEMS_PER_PAGE;
    return categoryOptions.slice(start, start + ITEMS_PER_PAGE);
  }, [categoryOptions, catPage]);

  const totalRevenue = useMemo(() => {
    return (topItems || []).reduce((sum, it) => sum + Number(it.revenue || 0), 0);
  }, [topItems]);

  const filteredDishes = useMemo(() => {
    let items = topItems || [];
    if (selectedCategory !== 'ALL') {
      items = items.filter(
        it => (it.category || 'Other').toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    return items.slice(0, 6).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      displayName: item.name.length > 15 ? item.name.substring(0, 13) + '…' : item.name,
      fullName: item.name,
      category: item.category || 'Other',
      revenue: Number(item.revenue || 0),
      quantity: Number(item.quantity || 0),
    }));
  }, [topItems, selectedCategory]);

  const activeCategoryMeta = useMemo(() => {
    if (selectedCategory === 'ALL') {
      return {
        name: 'All Dishes',
        revenue: totalRevenue,
        count: topItems.length,
      };
    }
    const catItems = (topItems || []).filter(
      it => (it.category || 'Other').toLowerCase() === selectedCategory.toLowerCase()
    );
    const rev = catItems.reduce((sum, it) => sum + Number(it.revenue || 0), 0);
    const qty = catItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    return {
      name: selectedCategory,
      revenue: rev,
      count: qty,
    };
  }, [selectedCategory, totalRevenue, topItems]);

  const yAxisWidth = selectedCategory === 'ALL' ? 140 : 105;

  const CustomYAxisTick = ({ x, y, payload }) => {
    const item = filteredDishes.find(d => d.displayName === payload.value || d.fullName === payload.value);
    const cat = item?.category || '';
    const shortCat = cat.length > 7 ? cat.substring(0, 6) + '…' : cat;

    return (
      <g transform={`translate(${x},${y})`}>

        {selectedCategory === 'ALL' && cat && (
          <text
            x={-(yAxisWidth - 4)}
            y={0}
            dy={4}
            textAnchor="start"
            fontSize={9.5}
            fill="#2563EB"
            fontWeight={600}
            opacity={0.9}
          >
            {shortCat}
          </text>
        )}

        <text
          x={-5}
          y={0}
          dy={4}
          textAnchor="end"
          fontSize={11}
          fill="#334155"
          className="fill-slate-700 dark:fill-slate-300"
          fontWeight={500}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-border dark:border-slate-800 text-xs min-w-[170px] z-50">
        <div className="flex items-center gap-1.5 font-bold text-text dark:text-slate-100 mb-1">
          <Award size={14} className="text-amber-500 shrink-0" />
          <span className="truncate">#{item.rank} {item.fullName || item.name}</span>
        </div>
        {item.category && (
          <div className="inline-block px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold mb-1.5">
            {item.category}
          </div>
        )}
        <div className="pt-2 border-t border-border dark:border-slate-800 flex items-center justify-between">
          <span className="text-text-secondary dark:text-slate-400">Quantity Sold:</span>
          <span className="font-mono font-bold text-text dark:text-slate-100">{item.quantity}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-text-secondary dark:text-slate-400">Total Revenue:</span>
          <span className="font-mono font-bold text-primary dark:text-blue-400">₹{item.revenue.toLocaleString('en-IN')}</span>
        </div>
        {totalRevenue > 0 && (
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-border dark:border-slate-800 text-[11px]">
            <span className="text-text-secondary dark:text-slate-400">Menu Share:</span>
            <span className="font-mono font-semibold text-text dark:text-slate-100">
              {((item.revenue / totalRevenue) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col h-full">

      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 shrink-0">
            <Utensils size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-text dark:text-slate-100 text-sm">Top Selling Dishes</h3>
              {selectedCategory !== 'ALL' && (
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-900/60">
                  {selectedCategory}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary dark:text-slate-400">
              {selectedCategory === 'ALL'
                ? 'Most ordered menu items ranked by revenue'
                : `Top selling dishes in ${selectedCategory}`}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-text-secondary dark:text-slate-400">
          Top {filteredDishes.length} Items
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">

        <div className="w-full md:w-36 lg:w-40 shrink-0 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border dark:border-slate-800 md:pr-3 pb-2 md:pb-0">
          <div>
            <div className="flex items-center justify-between px-1 py-1 mb-1.5 text-[10px] font-bold text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Layers size={11} className="text-primary dark:text-blue-400" /> Categories
              </span>
              <span className="text-[9px] bg-gray-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.2 rounded font-mono">
                {categoryOptions.length - 1}
              </span>
            </div>

            <div className="space-y-1">
              {currentCategoryPage.map((catKey) => {
                const isAll = catKey === 'ALL';
                const isSelected = isAll
                  ? selectedCategory === 'ALL'
                  : selectedCategory.toLowerCase() === catKey.toLowerCase();
                const displayName = isAll ? 'All Dishes' : catKey;

                const itemCount = isAll
                  ? topItems.length
                  : topItems.filter(it => (it.category || 'Other').toLowerCase() === catKey.toLowerCase()).length;

                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text dark:text-slate-300 hover:bg-gray-100/90 dark:hover:bg-slate-800 bg-gray-50/60 dark:bg-slate-800/40 border border-gray-100/80 dark:border-slate-800'
                    }`}
                    title={displayName}
                  >
                    <span className="truncate">{displayName}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ml-1 shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'text-text-secondary dark:text-slate-400'
                      }`}
                    >
                      {itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/70 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCatPage(p => Math.max(0, p - 1))}
                disabled={catPage === 0}
                className="p-1 rounded text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous categories"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[10px] font-mono text-text-secondary dark:text-slate-400 font-medium">
                {catPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCatPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={catPage >= totalPages - 1}
                className="p-1 rounded text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next categories"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {filteredDishes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary dark:text-slate-400 text-xs py-8">
              <Utensils size={28} className="text-gray-300 dark:text-slate-600 mb-1.5" />
              <p className="font-medium text-text dark:text-slate-200">No sales recorded in {activeCategoryMeta.name}</p>
              <p className="text-[11px]">Finalized bills for this category will rank here.</p>
            </div>
          ) : (
            <div className="w-full h-[225px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={filteredDishes}
                  margin={{ top: 5, right: 25, left: 5, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={val => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="displayName"
                    tick={<CustomYAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    width={yAxisWidth}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={16}>
                    {filteredDishes.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800 px-1 mt-1">
            <span>
              Showing top {filteredDishes.length} items in {selectedCategory === 'ALL' ? 'All Dishes' : selectedCategory}
            </span>
            <span className="font-mono font-medium text-primary dark:text-blue-400">
              ₹{activeCategoryMeta.revenue.toLocaleString('en-IN')} total
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
