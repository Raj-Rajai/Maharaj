import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Utensils, Award, Layers, BarChart2, ListOrdered } from 'lucide-react';
import api from '../../services/api';
import useRealtime from '../../hooks/useRealtime';

const COLORS = ['#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

export default function TopItemsChart({ topItems = [], categorySales = [], categories = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState('chart'); // 'chart' (default Recharts bar chart) or 'list' (ranked progress bars)
  const [dbCategories, setDbCategories] = useState(categories || []);

  // Update whenever categories prop from parent changes
  useEffect(() => {
    if (Array.isArray(categories) && categories.length > 0) {
      setDbCategories(categories);
    }
  }, [categories]);

  // Fetch live active categories from backend
  const fetchLiveCategories = async () => {
    try {
      const res = await api.get('/menu/categories');
      const list = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      if (Array.isArray(list) && list.length > 0) {
        setDbCategories(list);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchLiveCategories();
  }, []);

  // Real-time listener: immediately reflect any added, updated, or removed category
  useRealtime({
    'categories:updated': () => {
      fetchLiveCategories();
    }
  });

  // Dynamic category options based purely on database categories + any sales categories
  const categoryOptions = useMemo(() => {
    const list = ['ALL'];
    const added = new Set();

    // 1. Add all categories from DB in their exact configured displayOrder
    (dbCategories || []).forEach(c => {
      const name = c?.name?.trim();
      if (name && !added.has(name.toLowerCase())) {
        added.add(name.toLowerCase());
        list.push(name);
      }
    });

    // 2. Also add any categories from categorySales that might exist
    (categorySales || []).forEach(c => {
      const name = c?.name?.trim();
      if (name && !added.has(name.toLowerCase())) {
        added.add(name.toLowerCase());
        list.push(name);
      }
    });

    // 3. Fallback for any items in topItems with an unlisted category
    (topItems || []).forEach(it => {
      const name = it?.category?.trim();
      if (name && !added.has(name.toLowerCase())) {
        added.add(name.toLowerCase());
        list.push(name);
      }
    });

    return list;
  }, [dbCategories, categorySales, topItems]);

  // If active selected category is removed/deleted from DB, gracefully reset to 'ALL'
  useEffect(() => {
    if (selectedCategory !== 'ALL') {
      const exists = categoryOptions.some(c => c.toLowerCase() === selectedCategory.toLowerCase());
      if (!exists) {
        setSelectedCategory('ALL');
      }
    }
  }, [categoryOptions, selectedCategory]);

  const totalRevenue = useMemo(() => {
    return (topItems || []).reduce((sum, it) => sum + Number(it.revenue || 0), 0);
  }, [topItems]);

  const filteredDishes = useMemo(() => {
    let items = topItems || [];
    if (selectedCategory !== 'ALL') {
      items = items.filter(
        it => (it.category || 'Other').toLowerCase().trim() === selectedCategory.toLowerCase().trim()
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

  const maxRevenue = useMemo(() => {
    if (!filteredDishes.length) return 1;
    return Math.max(...filteredDishes.map(d => d.revenue), 1);
  }, [filteredDishes]);

  const activeCategoryMeta = useMemo(() => {
    if (selectedCategory === 'ALL') {
      return {
        name: 'All Dishes',
        revenue: totalRevenue,
        count: topItems.length,
      };
    }
    const catItems = (topItems || []).filter(
      it => (it.category || 'Other').toLowerCase().trim() === selectedCategory.toLowerCase().trim()
    );
    const catSale = (categorySales || []).find(
      c => (c.name || '').toLowerCase().trim() === selectedCategory.toLowerCase().trim()
    );
    const rev = catSale?.revenue ? Number(catSale.revenue) : catItems.reduce((sum, it) => sum + Number(it.revenue || 0), 0);
    const qty = catSale?.quantity ? Number(catSale.quantity) : catItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    return {
      name: selectedCategory,
      revenue: rev,
      count: qty,
    };
  }, [selectedCategory, totalRevenue, topItems, categorySales]);

  const getCategoryCount = (catKey) => {
    if (catKey === 'ALL') return topItems.length;
    return (topItems || []).filter(
      it => (it.category || 'Other').toLowerCase().trim() === catKey.toLowerCase().trim()
    ).length;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const share = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-2xl border border-border dark:border-slate-800 text-xs min-w-[180px] z-50 pointer-events-none select-none">
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
            <span className="font-mono font-semibold text-text dark:text-slate-100">{share}%</span>
          </div>
        )}
      </div>
    );
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60 shadow-2xs shrink-0">
          #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700/60 shadow-2xs shrink-0">
          #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40 shadow-2xs shrink-0">
          #3
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-md flex items-center justify-center font-semibold text-[10px] bg-gray-50 text-text-secondary dark:bg-slate-800 dark:text-slate-400 border border-gray-200 dark:border-slate-800 shrink-0">
        #{rank}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-3.5 sm:p-4 shadow-xs flex flex-col h-full min-w-0 overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 shrink-0">
            <Utensils size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-text dark:text-slate-100 text-xs sm:text-sm">Top Selling Dishes</h3>
              {selectedCategory !== 'ALL' && (
                <span className="text-[9px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.2 rounded-full border border-blue-200/60 dark:border-blue-900/60">
                  {selectedCategory}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-text-secondary dark:text-slate-400">
              {selectedCategory === 'ALL'
                ? 'Most ordered menu items ranked by revenue'
                : `Top selling dishes in ${selectedCategory}`}
            </p>
          </div>
        </div>

        {/* View Switcher & Counter */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border dark:border-slate-800 bg-surface dark:bg-slate-800/60 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow-2xs font-semibold'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
              title="Ranked Progress View"
            >
              <ListOrdered size={12} />
              <span>Ranked</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-colors ${
                viewMode === 'chart'
                  ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow-2xs font-semibold'
                  : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
              }`}
              title="Bar Chart View"
            >
              <BarChart2 size={12} />
              <span>Chart</span>
            </button>
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-text-secondary dark:text-slate-400 hidden sm:inline">
            Top {filteredDishes.length}
          </span>
        </div>
      </div>

      {/* Category Pills Bar: Full width horizontal scroll */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-2 scrollbar-none no-scrollbar w-full min-w-0">
        {categoryOptions.map((catKey) => {
          const isAll = catKey === 'ALL';
          const isSelected = isAll
            ? selectedCategory === 'ALL'
            : selectedCategory.toLowerCase().trim() === catKey.toLowerCase().trim();
          const displayName = isAll ? 'All Dishes' : catKey;
          const count = getCategoryCount(catKey);

          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                isSelected
                  ? 'bg-primary text-white shadow-2xs font-semibold'
                  : 'bg-surface dark:bg-slate-800/60 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-border dark:border-slate-800'
              }`}
            >
              <span>{displayName}</span>
              <span
                className={`text-[9px] px-1 py-0 rounded-full font-mono ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/70 dark:bg-slate-700/70 text-text-secondary dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between min-h-0">
        {filteredDishes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary dark:text-slate-400 text-xs py-6">
            <Utensils size={24} className="text-gray-300 dark:text-slate-600 mb-1" />
            <p className="font-medium text-text dark:text-slate-200">No sales recorded in {activeCategoryMeta.name}</p>
            <p className="text-[10px]">Finalized bills for this category will rank here.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* Ranked Progress Bar List */
          <div className="space-y-1.5 py-0.5">
            {filteredDishes.map((item) => {
              const share = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : 0;
              const barWidth = Math.max(6, Math.round((item.revenue / maxRevenue) * 100));

              return (
                <div
                  key={item.id || item.name}
                  className="group relative flex flex-col gap-1 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {getRankBadge(item.rank)}
                      <span
                        className="font-semibold text-text dark:text-slate-100 truncate text-[11px]"
                        title={item.fullName}
                      >
                        {item.fullName}
                      </span>
                      {item.category && (
                        <span className="text-[9px] px-1 py-0 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium shrink-0 border border-blue-200/50 dark:border-blue-900/50">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                      <span className="text-text-secondary dark:text-slate-400 text-[10px]">
                        {item.quantity} sold
                      </span>
                      <span className="font-bold text-text dark:text-slate-100">
                        ₹{item.revenue.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] px-1 py-0 rounded bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-slate-400 font-semibold">
                        {share}%
                      </span>
                    </div>
                  </div>

                  {/* Relative Revenue Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Recharts Horizontal Bar Chart with Fixed Non-Overlapping Layout */
          <div className="w-full h-[175px] min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={filteredDishes}
                margin={{ top: 2, right: 15, left: 0, bottom: 2 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: '#64748B' }}
                  tickFormatter={val => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tick={{ fontSize: 9, fill: '#475569', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={105}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={12}>
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

        {/* Footer Summary */}
        <div className="flex items-center justify-between text-[10px] text-text-secondary dark:text-slate-400 pt-1.5 border-t border-gray-100 dark:border-slate-800 px-1 mt-1">
          <span>
            Showing top {filteredDishes.length} items in {selectedCategory === 'ALL' ? 'All Dishes' : selectedCategory}
          </span>
          <span className="font-mono font-bold text-primary dark:text-blue-400">
            ₹{activeCategoryMeta.revenue.toLocaleString('en-IN')} total
          </span>
        </div>
      </div>
    </div>
  );
}
