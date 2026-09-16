import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Receipt,
  Calendar,
  Eye,
  Printer,
  Download,
  Check,
  X,
  Edit,
  History,
  AlertTriangle,
  Filter,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { acBlue, nonAcBlue, takeAwayBlue, swiggyIcon, zomatoIcon, billBlue, tableBlue } from '../assets';
import MasterColumnFilter from '../components/ui/MasterColumnFilter';
import { useRouteActive } from '../components/common/RouteKeepAlive';
import useRealtime from '../hooks/useRealtime';

const statusVariant = {
  DRAFT: 'warning',
  FINALIZED: 'success',
  CANCELLED: 'danger',
};

export const getBillCategoryAndType = (bill) => {
  const source = bill.order?.orderSource;
  const tableNum =
    bill.session?.table?.number ??
    bill.order?.table?.number ??
    bill.table?.number ??
    bill.tableId;
  const tableType = bill.session?.table?.type ?? bill.order?.table?.type ?? bill.table?.type;

  if (source === 'SWIGGY') {
    return {
      category: 'Take Away',
      type: 'Swiggy',
      categoryIcon: takeAwayBlue,
      typeIcon: swiggyIcon,
      typeVariant: 'warning',
    };
  }
  if (source === 'ZOMATO') {
    return {
      category: 'Take Away',
      type: 'Zomato',
      categoryIcon: takeAwayBlue,
      typeIcon: zomatoIcon,
      typeVariant: 'danger',
    };
  }
  if (source === 'SELF_PICKUP') {
    return {
      category: 'Take Away',
      type: 'Self',
      categoryIcon: takeAwayBlue,
      typeIcon: takeAwayBlue,
      typeVariant: 'success',
    };
  }

  const isAc = tableType === 'AC';
  const numDisplay = tableNum && tableNum !== '-' ? tableNum : '';
  return {
    category: isAc ? 'AC' : 'Non-AC',
    type: numDisplay ? `Table ${numDisplay}` : 'Table',
    categoryIcon: isAc ? acBlue : nonAcBlue,
    typeIcon: tableBlue,
    typeVariant: 'neutral',
  };
};

const TABLE_COLUMNS = [
  { key: 'billNumber', label: 'Bill #', sortType: 'number' },
  { key: 'category', label: 'Category', sortType: 'text' },
  { key: 'type', label: 'Type', sortType: 'text' },
  { key: 'user', label: 'User', sortType: 'text' },
  { key: 'amount', label: 'Amount', sortType: 'number' },
  { key: 'time', label: 'Time', sortType: 'date' },
  { key: 'status', label: 'Status', sortType: 'text' },
];

const getThermalHtml = (bill, settings, validItems) => {
  const src = bill.order?.orderSource;
  let sourceLabel = '';
  if (src === 'SELF_PICKUP') sourceLabel = 'Source: Self Pickup';
  else if (src === 'SWIGGY') sourceLabel = 'Source: Swiggy';
  else if (src === 'ZOMATO') sourceLabel = 'Source: Zomato';
  else {
    const tableNum = bill.session?.table?.number ?? bill.order?.table?.number ?? bill.table?.number ?? bill.tableId ?? '-';
    sourceLabel = `Table: ${tableNum}`;
  }

  const billDate = new Date(bill.createdAt).toLocaleDateString('en-IN');
  const billTime = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bill #${bill.billNumber}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 8px;
          font-size: 12px;
          color: #000;
          line-height: 1.3;
          background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin: 4px 0; }
        th { text-align: left; border-bottom: 1px dashed #000; border-top: 1px dashed #000; padding: 4px 0; font-size: 11px; }
        td { padding: 3px 0; font-size: 12px; vertical-align: top; }
        .final-row { font-weight: bold; font-size: 13px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">${(settings?.restaurantName || 'MAHARAJ VEG VILLA').toUpperCase()}</div>
        ${bill.version > 1 ? `<div class="font-bold">AMENDED BILL - Version ${bill.version}</div>` : ''}
        ${settings?.address ? `<div>${settings.address}</div>` : ''}
        ${settings?.phone ? `<div>Contact: ${settings.phone}</div>` : ''}
        ${settings?.gstin ? `<div>GSTIN: ${settings.gstin}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="row">
        <span>Bill #: ${bill.billNumber}</span>
        <span>Date: ${billDate}</span>
      </div>
      <div class="row">
        <span>${sourceLabel}</span>
        <span>Time: ${billTime}</span>
      </div>
      ${bill.customerName ? `<div class="row"><span>Customer: <strong>${bill.customerName}</strong></span></div>` : ''}
      ${bill.customerPhone ? `<div class="row"><span>Phone: <strong>${bill.customerPhone}</strong></span></div>` : ''}
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">ITEMS</th>
            <th style="width: 20%; text-align: center;">QTY</th>
            <th style="width: 30%; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${(validItems || []).map(item => `
            <tr>
              <td>${item.itemNameSnapshot || item.menuItem?.name || 'Item'}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">₹${(Number(item.priceSnapshot || 0) * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="divider"></div>
      <div class="row">
        <span>TOTAL</span>
        <span>₹${Number(bill.subtotal || 0).toFixed(2)}</span>
      </div>
      ${Number(bill.discount) > 0 ? `
      <div class="row">
        <span>DISCOUNT</span>
        <span>-₹${Number(bill.discount).toFixed(2)}</span>
      </div>` : ''}
      <div class="row">
        <span>SGST (${Number(bill.sgstPercent || 2.5).toFixed(3)}%)</span>
        <span>₹${Number(bill.sgstAmount || 0).toFixed(2)}</span>
      </div>
      <div class="row">
        <span>CGST (${Number(bill.cgstPercent || 2.5).toFixed(3)}%)</span>
        <span>₹${Number(bill.cgstAmount || 0).toFixed(2)}</span>
      </div>
      ${Number(bill.roundOff || 0) !== 0 ? `
      <div class="row">
        <span>ROUND OFF</span>
        <span>₹${Number(bill.roundOff).toFixed(2)}</span>
      </div>` : ''}
      <div class="divider"></div>
      <div class="row final-row">
        <span>FINAL AMOUNT</span>
        <span>₹${Number(bill.total || 0).toFixed(2)}</span>
      </div>
      ${bill.payment ? `
      <div class="row" style="font-size: 11px; margin-top: 4px;">
        <span>PAYMENT (${bill.payment.method})</span>
        <span>PAID</span>
      </div>` : ''}
      <div class="divider"></div>
      <div class="text-center" style="margin-top: 8px;">
        <div>Thank you visit again</div>
      </div>
    </body>
    </html>
  `;
};

export default function BillsPage() {
  const { hasPermission } = useAuth();
  const getTodayStr = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedBill, setSelectedBill] = useState(null);
  const [billDetails, setBillDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [payMethod, setPayMethod] = useState('CASH');
  const [actionLoading, setActionLoading] = useState(false);

  const [isAmendOpen, setIsAmendOpen] = useState(false);
  const [amendBillId, setAmendBillId] = useState(null);
  const [amendBillStatus, setAmendBillStatus] = useState('');
  const [amendItems, setAmendItems] = useState([]);
  const [amendReason, setAmendReason] = useState('');
  const [amendDiscount, setAmendDiscount] = useState('0');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [amendments, setAmendments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const setDatePreset = (preset) => {
    const today = getTodayStr();
    const pad = (n) => String(n).padStart(2, '0');
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setEndDate(today);
    } else if (preset === 'month') {
      const d = new Date();
      setStartDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`);
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const isPresetActive = (preset) => {
    const today = getTodayStr();
    const pad = (n) => String(n).padStart(2, '0');
    if (preset === 'today') return startDate === today && endDate === today;
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      return startDate === yStr && endDate === yStr;
    }
    if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return startDate === dStr && endDate === today;
    }
    if (preset === 'month') {
      const d = new Date();
      const mStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      return startDate === mStr && endDate === today;
    }
    if (preset === 'all') return !startDate && !endDate;
    return false;
  };


  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const isFetchingRef = useRef(false);

  const fetchBills = async (opts = {}) => {
    // Prevent overlapping background requests if one is still in-flight
    if (opts.background && isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (!opts.background) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }

      const params = {};
      if (filter !== 'ALL') params.status = filter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (!startDate && !endDate) params.all = true;

      const res = await api.get('/bills', { params, skipCache: true });
      const newBills = Array.isArray(res.data) ? res.data : res.data.value || [];
      setBills(newBills);
      setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      if (!opts.background) toast.error('Failed to load bills');
    } finally {
      isFetchingRef.current = false;
      if (!opts.background) setLoading(false);
      setIsSyncing(false);
    }
  };

  const [settings, setSettings] = useState(null);
  const [draftCustomerName, setDraftCustomerName] = useState('');
  const [draftCustomerPhone, setDraftCustomerPhone] = useState('');

  const isActive = useRouteActive();

  // Instant real-time push for bill creation, edits, and finalization
  useRealtime({
    'bill:created': () => {
      fetchBills({ background: true });
    },
    'bill:updated': () => {
      fetchBills({ background: true });
    },
    'bill:finalized': () => {
      fetchBills({ background: true });
    },
  }, isActive, ['billing']);

  // 1. Regular polling while route is active (relaxed to 30s as fallback heartbeat)
  useEffect(() => {
    if (!isActive) return;
    fetchBills({ background: bills.length > 0 });
    const iv = setInterval(() => {
      fetchBills({ background: true });
    }, 30000);
    return () => clearInterval(iv);
  }, [isActive, filter, startDate, endDate]);

  // 2. Immediate refetch on window focus / tab visibility
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && isActive) {
        fetchBills({ background: true });
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [isActive]);

  // 3. Immediate refetch on local cache invalidation (e.g. bill generated, settled, or amended)
  useEffect(() => {
    const handleInvalidation = (e) => {
      const url = e.detail?.url || '';
      if (isActive && (url.includes('/bill') || url.includes('/order') || url.includes('/table'))) {
        fetchBills({ background: true });
      }
    };
    window.addEventListener('pos:cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('pos:cache-invalidated', handleInvalidation);
  }, [isActive]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(res.data);
      } catch {

      }
    };
    loadSettings();
  }, []);

  const openViewModal = async (bill) => {
    setSelectedBill(bill);
    setDraftCustomerName(bill.customerName || bill.order?.customerName || '');
    setDraftCustomerPhone(bill.customerPhone || bill.order?.customerPhone || '');
    setLoadingDetails(true);
    try {
      const res = await api.get(`/bills/${bill.id}/print`);
      setBillDetails(res.data);
      if (res.data?.bill) {
        setDraftCustomerName(res.data.bill.customerName || res.data.bill.order?.customerName || '');
        setDraftCustomerPhone(res.data.bill.customerPhone || res.data.bill.order?.customerPhone || '');
      }
    } catch {
      toast.error('Failed to load bill details');
      setBillDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedBill(null);
    setBillDetails(null);
  };

  const handlePrint = async (billId) => {
    try {
      const res = await api.get(`/bills/${billId}/print`);
      const { bill, settings, validItems } = res.data;
      const printWindow = window.open('', '_blank', 'width=450,height=650');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(getThermalHtml(bill, settings, validItems));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch {
      toast.error('Failed to prepare print data');
    }
  };

  const handleDownloadPdf = async (billId) => {
    try {
      const res = await api.get(`/bills/${billId}/print`);
      const { bill, settings, validItems } = res.data;
      const printWindow = window.open('', '_blank', 'width=450,height=650');
      if (!printWindow) {
        toast.error('Please allow popups to download PDF');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(getThermalHtml(bill, settings, validItems));
      printWindow.document.close();
      printWindow.focus();
      toast.success('Select "Save as PDF" in destination');
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const finalize = async (billId) => {
    setActionLoading(true);
    try {
      await api.post(`/bills/${billId}/finalize`, {
        paymentMethod: payMethod,
        customerName: draftCustomerName.trim() || undefined,
        customerPhone: draftCustomerPhone.trim() || undefined,
      });
      toast.success('Bill finalized successfully');
      closeModal();
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize bill');
    } finally {
      setActionLoading(false);
    }
  };

  const cancel = async (billId) => {
    setActionLoading(true);
    try {
      await api.post(`/bills/${billId}/cancel`);
      toast.success('Bill cancelled successfully');
      closeModal();
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel bill');
    } finally {
      setActionLoading(false);
    }
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const openAmendModal = (details) => {
    setAmendBillId(details.bill.id);
    setAmendBillStatus(details.bill.status);
    setDraftCustomerName(details.bill.customerName || details.bill.order?.customerName || '');
    setDraftCustomerPhone(details.bill.customerPhone || details.bill.order?.customerPhone || '');
    const items = details.validItems.map(item => ({
      id: item.id,
      itemName: item.itemNameSnapshot || item.menuItem?.name || 'Item',
      oldQty: item.quantity,
      newQty: item.quantity,
      price: Number(item.priceSnapshot || 0)
    }));
    setAmendItems(items);
    setAmendReason('');
    setAmendDiscount(Number(details.bill.discount || 0).toString());
    setIsAmendOpen(true);
  };

  const calcAmend = () => {
    let subtotal = 0;
    amendItems.forEach(item => {
      subtotal += item.price * item.newQty;
    });
    const discount = Number(amendDiscount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const sgstAmount = taxable * (Number(billDetails?.bill?.sgstPercent || 2.5) / 100);
    const cgstAmount = taxable * (Number(billDetails?.bill?.cgstPercent || 2.5) / 100);
    const rawTotal = taxable + sgstAmount + cgstAmount;
    const total = Math.round(rawTotal);
    const diff = total - Number(billDetails?.bill?.total || 0);
    return { subtotal, total, diff };
  };

  const submitAmend = async () => {
    if (!amendReason) return toast.error("Reason is required");
    const changes = amendItems
      .filter(i => i.oldQty !== i.newQty)
      .map(i => ({ itemName: i.itemName, oldQty: i.oldQty, newQty: i.newQty }));

    const isDiscountChanged = Number(amendDiscount || 0) !== Number(billDetails?.bill?.discount || 0);
    const isCustomerChanged =
      draftCustomerName.trim() !== (billDetails?.bill?.customerName || '').trim() ||
      draftCustomerPhone.trim() !== (billDetails?.bill?.customerPhone || '').trim();

    if (changes.length === 0 && !isDiscountChanged && !isCustomerChanged) return toast.error("No changes made");

    setActionLoading(true);
    try {
      if (amendBillStatus === 'DRAFT') {
        await api.patch(`/bills/${amendBillId}/edit`, {
          changes,
          reason: amendReason,
          discount: Number(amendDiscount || 0),
          customerName: draftCustomerName.trim() || undefined,
          customerPhone: draftCustomerPhone.trim() || undefined,
        });
        toast.success("Bill updated successfully");
      } else {
        await api.post(`/bills/${amendBillId}/amend`, {
          changes,
          reason: amendReason,
          discount: Number(amendDiscount || 0),
          customerName: draftCustomerName.trim() || undefined,
          customerPhone: draftCustomerPhone.trim() || undefined,
        });
        toast.success("Bill amended successfully");
      }
      setIsAmendOpen(false);
      closeModal();
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error?.message || 'Failed to process bill modification');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchHistory = async (billId) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/bills/${billId}/amendments`);
      setAmendments(res.data?.amendments || res.data || []);
    } catch (e) {
      toast.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const settleAmendment = async (amendmentId, method) => {
    try {
      await api.post(`/bills/amendments/${amendmentId}/settle`, { paymentMethod: method });
      toast.success("Settled successfully");
      fetchHistory(selectedBill?.id);
    } catch (e) {
      toast.error("Failed to settle");
    }
  };

  const [columnFilters, setColumnFilters] = useState({});
  const [columnSort, setColumnSort] = useState(null);
  const [activeFilterPopover, setActiveFilterPopover] = useState(null);

  const baseBills = useMemo(() => {
    return bills.filter((b) => b.status !== 'DRAFT' || hasPermission('BILL_VIEW_DRAFT'));
  }, [bills, hasPermission]);

  const billsWithMeta = useMemo(() => {
    return baseBills.map((bill) => {
      const meta = getBillCategoryAndType(bill);
      const creatorRole = bill.creator?.role || bill.user?.role || 'System';
      const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return {
        bill,
        billNumber: `#${bill.billNumber}`,
        rawBillNumber: bill.billNumber,
        version: bill.version,
        category: meta.category,
        categoryIcon: meta.categoryIcon,
        type: meta.type,
        typeIcon: meta.typeIcon,
        typeVariant: meta.typeVariant,
        user: creatorRole,
        amount: Number(bill.total || 0),
        time,
        timestamp: new Date(bill.createdAt).getTime(),
        status: bill.status,
      };
    });
  }, [baseBills]);

  const columnDistinctValues = useMemo(() => {
    const maps = {
      billNumber: new Map(),
      category: new Map(),
      type: new Map(),
      user: new Map(),
      amount: new Map(),
      time: new Map(),
      status: new Map(),
    };

    billsWithMeta.forEach((row) => {

      maps.billNumber.set(row.billNumber, (maps.billNumber.get(row.billNumber) || 0) + 1);

      const prevCat = maps.category.get(row.category);
      maps.category.set(row.category, {
        count: (prevCat?.count || 0) + 1,
        icon: row.categoryIcon,
      });

      const prevType = maps.type.get(row.type);
      maps.type.set(row.type, {
        count: (prevType?.count || 0) + 1,
        icon: row.typeIcon,
      });

      maps.user.set(row.user, (maps.user.get(row.user) || 0) + 1);

      const amtStr = `₹${row.amount.toFixed(2)}`;
      maps.amount.set(amtStr, (maps.amount.get(amtStr) || 0) + 1);

      maps.time.set(row.time, (maps.time.get(row.time) || 0) + 1);

      maps.status.set(row.status, (maps.status.get(row.status) || 0) + 1);
    });

    return {
      billNumber: Array.from(maps.billNumber.entries()).map(([v, count]) => ({ value: v, count })),
      category: Array.from(maps.category.entries()).map(([v, { count, icon }]) => ({ value: v, count, icon })),
      type: Array.from(maps.type.entries()).map(([v, { count, icon }]) => ({ value: v, count, icon })),
      user: Array.from(maps.user.entries()).map(([v, count]) => ({ value: v, count })),
      amount: Array.from(maps.amount.entries()).map(([v, count]) => ({ value: v, count })),
      time: Array.from(maps.time.entries()).map(([v, count]) => ({ value: v, count })),
      status: Array.from(maps.status.entries()).map(([v, count]) => ({ value: v, count })),
    };
  }, [billsWithMeta]);

  const displayedBills = useMemo(() => {
    let list = billsWithMeta.filter((row) => {
      for (const [colKey, selectedSet] of Object.entries(columnFilters)) {
        if (!selectedSet || selectedSet.size === 0) continue;
        if (selectedSet.has('__EMPTY__')) return false;

        let val = row[colKey];
        if (colKey === 'amount') {
          val = `₹${row.amount.toFixed(2)}`;
        }
        if (!selectedSet.has(val)) {
          return false;
        }
      }
      return true;
    });

    if (columnSort?.columnKey && columnSort?.direction) {
      const { columnKey, direction } = columnSort;
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (columnKey === 'amount') {
          cmp = a.amount - b.amount;
        } else if (columnKey === 'time') {
          cmp = a.timestamp - b.timestamp;
        } else if (columnKey === 'billNumber') {
          cmp = Number(a.rawBillNumber || 0) - Number(b.rawBillNumber || 0);
        } else {
          cmp = String(a[columnKey] || '').localeCompare(String(b[columnKey] || ''));
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [billsWithMeta, columnFilters, columnSort]);

  const openFilterForHeader = (colKey, colLabel, element, sortType) => {
    const rect = element.getBoundingClientRect();
    setActiveFilterPopover({
      columnKey: colKey,
      columnLabel: colLabel,
      anchorRect: rect,
      targetCellValue: null,
      sortType: sortType || 'text',
    });
  };

  const openFilterForCell = (colKey, colLabel, element, cellValue, sortType) => {
    const rect = element.getBoundingClientRect();
    setActiveFilterPopover({
      columnKey: colKey,
      columnLabel: colLabel,
      anchorRect: rect,
      targetCellValue: cellValue,
      sortType: sortType || 'text',
    });
  };

  const handleApplyFilter = (columnKey, selectedSet) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!selectedSet || selectedSet.size === 0) {
        delete next[columnKey];
      } else {
        next[columnKey] = selectedSet;
      }
      return next;
    });
  };

  const handleApplySort = (columnKey, direction) => {
    if (!direction) {
      setColumnSort((prev) => (prev?.columnKey === columnKey ? null : prev));
    } else {
      setColumnSort({ columnKey, direction });
    }
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setColumnSort(null);
  };

  const handleExportCSV = () => {
    if (!displayedBills || displayedBills.length === 0) {
      toast.error('No bills available to export');
      return;
    }

    const headers = [
      'Bill NO',
      'Date',
      'Time',
      'Category',
      'Type',
      'Customer Name',
      'Customer Number',
      'SGST Rate',
      'SGST Amount',
      'CGST Rate',
      'CGST Amount',
      'Amount Without Tax',
      'Total Tax',
      'Total Invoice Value',
      'GST Number',
    ];
    const rows = [];
    rows.push(headers);

    let totalSgstAmount = 0;
    let totalCgstAmount = 0;
    let totalAmountWithoutTax = 0;
    let totalTaxAmount = 0;
    let totalInvoiceValue = 0;

    displayedBills.forEach((row) => {
      const { bill } = row;
      const d = new Date(bill.createdAt);
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const subtotal = Number(bill.subtotal || 0);
      const discount = Number(bill.discount || 0);
      const amountWithoutTax = Math.max(0, subtotal - discount);

      const sgstPercent = Number(bill.sgstPercent ?? 2.5);
      const cgstPercent = Number(bill.cgstPercent ?? 2.5);

      const sgstAmount = Number(
        bill.sgstAmount !== undefined && bill.sgstAmount !== null && Number(bill.sgstAmount) > 0
          ? bill.sgstAmount
          : amountWithoutTax * (sgstPercent / 100)
      );
      const cgstAmount = Number(
        bill.cgstAmount !== undefined && bill.cgstAmount !== null && Number(bill.cgstAmount) > 0
          ? bill.cgstAmount
          : amountWithoutTax * (cgstPercent / 100)
      );

      const billTax = Number((sgstAmount + cgstAmount).toFixed(2));
      const billInvoiceVal = Number(bill.total || amountWithoutTax + billTax);

      totalSgstAmount += sgstAmount;
      totalCgstAmount += cgstAmount;
      totalAmountWithoutTax += amountWithoutTax;
      totalTaxAmount += billTax;
      totalInvoiceValue += billInvoiceVal;

      const billNo = bill.billNumber !== undefined && bill.billNumber !== null ? bill.billNumber : (bill.id || '-');
      const customerName = bill.customerName || bill.order?.customerName || bill.customer?.name || '-';
      const customerNumber = bill.customerPhone || bill.customerNumber || bill.order?.customerPhone || '-';
      const gstNumber = bill.customerGst || bill.gstNumber || settings?.gstin || '-';

      rows.push([
        billNo,
        dateStr,
        timeStr,
        row.category,
        row.type,
        customerName,
        customerNumber,
        `${Number(sgstPercent).toFixed(3)}%`,
        sgstAmount.toFixed(2),
        `${Number(cgstPercent).toFixed(3)}%`,
        cgstAmount.toFixed(2),
        amountWithoutTax.toFixed(2),
        billTax.toFixed(2),
        billInvoiceVal.toFixed(2),
        gstNumber,
      ]);
    });

    rows.push([
      'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalSgstAmount.toFixed(2),
      '',
      totalCgstAmount.toFixed(2),
      totalAmountWithoutTax.toFixed(2),
      totalTaxAmount.toFixed(2),
      totalInvoiceValue.toFixed(2),
      '',
    ]);

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `bills_register_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${displayedBills.length} bills to CSV`);
  };

  const hasActiveColumnFilters = Object.keys(columnFilters).length > 0 || !!columnSort;

  return (
    <div className="space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
              <img src={billBlue} alt="Bills" className="w-5 sm:w-6 h-5 sm:h-6 object-contain dark:brightness-0 dark:invert" />
              Bills
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                isSyncing
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              }`}
              title="Live auto-polling active (5s interval)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              {isSyncing ? 'Syncing...' : 'Live Sync'}
            </span>
          </div>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
            Manage, print and finalize customer bills
            {lastSyncTime && <span className="ml-1 opacity-75">• Synced {lastSyncTime}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1 text-xs overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setDatePreset('today')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isPresetActive('today') ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDatePreset('yesterday')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isPresetActive('yesterday') ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDatePreset('7days')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isPresetActive('7days') ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDatePreset('month')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isPresetActive('month') ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDatePreset('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isPresetActive('all') ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
              }`}
            >
              All Time
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 px-3 py-1.5 text-xs text-text dark:text-slate-100 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-text-secondary dark:text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent focus:outline-none text-xs text-text dark:text-slate-100"
                title="Start Date"
              />
            </div>
            <span className="text-text-secondary dark:text-slate-400">to</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent focus:outline-none text-xs text-text dark:text-slate-100"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={clearDates}
                  className="text-text-secondary dark:text-slate-400 hover:text-danger ml-1 p-0.5 cursor-pointer"
                  title="Clear date filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {['ALL', hasPermission('BILL_VIEW_DRAFT') ? 'DRAFT' : null, 'FINALIZED', 'CANCELLED'].filter(Boolean).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  filter === f ? 'bg-primary text-white' : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => fetchBills({ background: true })}
              disabled={isSyncing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-surface dark:hover:bg-slate-800 text-text dark:text-slate-100 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh bills now"
            >
              <RefreshCw size={13} className={`text-text-secondary dark:text-slate-400 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-surface dark:hover:bg-slate-800 text-text dark:text-slate-100 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Export bills to CSV"
            >
              <Download size={14} className="text-primary dark:text-blue-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {hasActiveColumnFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 rounded-xl text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary dark:text-blue-400 flex items-center gap-1.5">
              <Filter size={13} className="text-primary dark:text-blue-400" /> Active Master Filters:
            </span>
            {Object.entries(columnFilters).map(([key, set]) => {
              const col = TABLE_COLUMNS.find((c) => c.key === key);
              const label = col?.label || key;
              const count = set.size;
              const sample = Array.from(set).slice(0, 2).join(', ');
              const more = count > 2 ? ` +${count - 2} more` : '';
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs"
                >
                  <span>{label}: <strong>{sample}{more}</strong></span>
                  <button
                    onClick={() => handleApplyFilter(key, null)}
                    className="text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                    title={`Clear ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {columnSort && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-medium text-[11px] shadow-2xs">
                <span>
                  Sorted: <strong>{TABLE_COLUMNS.find((c) => c.key === columnSort.columnKey)?.label}</strong> (
                  {columnSort.direction === 'asc' ? 'Ascending' : 'Descending'})
                </span>
                <button
                  onClick={() => setColumnSort(null)}
                  className="text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                  title="Clear sort"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-text-secondary dark:text-slate-400 text-[11px]">
              Showing <strong>{displayedBills.length}</strong> of {billsWithMeta.length} bills
            </span>
            <button
              onClick={clearAllFilters}
              className="text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 hover:underline font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
            >
              <RotateCcw size={11} /> Reset All
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-surface dark:bg-slate-800 border-b border-border dark:border-slate-700">
                <tr className="text-left text-text-secondary dark:text-slate-400 text-xs">
                  {TABLE_COLUMNS.map((col) => {
                    const isFiltered = columnFilters[col.key] && columnFilters[col.key].size > 0;
                    const isSorted = columnSort?.columnKey === col.key;
                    return (
                      <th key={col.key} className="px-4 py-3 font-semibold relative group/th">
                        <div className="flex items-center justify-between gap-1.5 select-none">
                          <span className="text-text dark:text-slate-200 font-semibold">{col.label}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForHeader(col.key, col.label, e.currentTarget, col.sortType);
                            }}
                            className={`p-1 rounded transition-all duration-150 cursor-pointer ${
                              isFiltered || isSorted
                                ? 'opacity-100 text-primary dark:text-blue-400 bg-primary/15 dark:bg-primary/25 border border-primary/30 dark:border-blue-500/40 shadow-xs'
                                : 'opacity-60 sm:opacity-0 sm:group-hover/th:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100'
                            }`}
                            title={`Filter or Sort by ${col.label}`}
                          >
                            <Filter size={12} className={isFiltered ? 'fill-primary dark:fill-blue-400 text-primary dark:text-blue-400' : ''} />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 font-semibold text-right text-text dark:text-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800">
                {displayedBills.map((row) => {
                  const { bill } = row;

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-surface/60 dark:hover:bg-slate-800/60 transition-colors"
                    >

                      <td className="px-4 py-3 font-mono font-medium text-text dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center">
                            #{bill.billNumber}
                            {bill.version > 1 && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/20 dark:bg-amber-950/60 text-warning-dark dark:text-amber-400">
                                V{bill.version}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('billNumber', 'Bill #', e.currentTarget, `#${bill.billNumber}`, 'number');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter on Bill #${bill.billNumber}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                              row.category === 'Take Away'
                                ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                                : row.category === 'AC'
                                ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <img src={row.categoryIcon} alt={row.category} className={`w-3.5 h-3.5 object-contain shrink-0 ${row.category === 'AC' || row.category === 'Non-AC' ? 'dark:brightness-0 dark:invert' : ''}`} />
                            {row.category}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('category', 'Category', e.currentTarget, row.category, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ${row.category}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                              row.type === 'Swiggy'
                                ? 'bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300'
                                : row.type === 'Zomato'
                                ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                                : row.type === 'Self'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 font-medium'
                            }`}
                          >
                            <img src={row.typeIcon} alt={row.type} className={`w-3.5 h-3.5 object-contain shrink-0 ${row.type === 'Self' || row.type === 'Dine-In' ? 'dark:brightness-0 dark:invert' : ''}`} />
                            {row.type}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('type', 'Type', e.currentTarget, row.type, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ${row.type}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge variant="neutral">{row.user}</Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('user', 'User', e.currentTarget, row.user, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ${row.user}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-text dark:text-slate-100 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>₹{row.amount.toFixed(2)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('amount', 'Amount', e.currentTarget, `₹${row.amount.toFixed(2)}`, 'number');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ₹${row.amount.toFixed(2)}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-text-secondary dark:text-slate-400 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>{row.time}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('time', 'Time', e.currentTarget, row.time, 'date');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ${row.time}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 relative group/cell">
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge variant={statusVariant[row.status]}>
                            {row.status}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForCell('status', 'Status', e.currentTarget, row.status, 'text');
                            }}
                            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 dark:hover:bg-slate-700 text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 border border-transparent hover:border-border dark:hover:border-slate-700 bg-white dark:bg-slate-800 shadow-xs cursor-pointer"
                            title={`Master filter: ${row.status}`}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openViewModal(bill)}
                            className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="View Bill Details"
                          >
                            <Eye size={16} />
                          </button>
                          {hasPermission('BILL_PRINT') && (
                            <>
                              <button
                                onClick={() => handlePrint(bill.id)}
                                className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Print Thermal Bill"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(bill.id)}
                                className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Download PDF"
                              >
                                <Download size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {displayedBills.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-text-secondary dark:text-slate-400">
                      <Receipt size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="font-medium text-text dark:text-slate-100">No bills found</p>
                      <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                        {hasActiveColumnFilters
                          ? 'Try clearing some column filters or expanding the date range.'
                          : 'No bills found for the selected criteria.'}
                      </p>
                      {hasActiveColumnFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-light shadow-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw size={12} /> Reset All Master Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MasterColumnFilter
        isOpen={!!activeFilterPopover}
        onClose={() => setActiveFilterPopover(null)}
        anchorRect={activeFilterPopover?.anchorRect}
        columnKey={activeFilterPopover?.columnKey}
        columnLabel={activeFilterPopover?.columnLabel}
        allValues={activeFilterPopover ? columnDistinctValues[activeFilterPopover.columnKey] || [] : []}
        selectedValues={activeFilterPopover ? columnFilters[activeFilterPopover.columnKey] : null}
        onApplyFilter={(selectedSet) => {
          if (activeFilterPopover) {
            handleApplyFilter(activeFilterPopover.columnKey, selectedSet);
          }
        }}
        sortConfig={columnSort}
        onApplySort={(direction) => {
          if (activeFilterPopover) {
            handleApplySort(activeFilterPopover.columnKey, direction);
          }
        }}
        targetCellValue={activeFilterPopover?.targetCellValue}
        sortType={activeFilterPopover?.sortType || 'text'}
      />

      <Modal
        isOpen={!!selectedBill}
        onClose={closeModal}
        title={`Bill Details #${selectedBill?.billNumber}`}
        size="lg"
      >
        {selectedBill && (
          <div className="space-y-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : billDetails ? (
              <>

                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[billDetails.bill.status]}>
                      {billDetails.bill.status}
                    </Badge>
                    <span className="text-xs text-text-secondary dark:text-slate-400">
                      Table {billDetails.bill.session?.table?.number ?? billDetails.bill.order?.table?.number ?? billDetails.bill.table?.number ?? billDetails.bill.tableId ?? '-'}
                    </span>
                    {billDetails.bill.version > 1 && (
                      <Badge variant="warning">V{billDetails.bill.version}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {billDetails.bill.version > 1 && (
                      <button onClick={() => fetchHistory(billDetails.bill.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        <History size={14} /> History
                      </button>
                    )}
                    {billDetails.bill.status === 'FINALIZED' && hasPermission('BILL_AMEND') && (
                      <button onClick={() => openAmendModal(billDetails)} className="flex items-center gap-1.5 px-3 py-1.5 bg-warning text-white rounded-lg text-xs font-medium hover:bg-warning-light transition-colors cursor-pointer">
                        <Edit size={14} /> Amend
                      </button>
                    )}
                    {billDetails.bill.status === 'DRAFT' && hasPermission('BILL_EDIT') && (
                      <button onClick={() => openAmendModal(billDetails)} className="flex items-center gap-1.5 px-3 py-1.5 bg-warning text-white rounded-lg text-xs font-medium hover:bg-warning-light transition-colors cursor-pointer">
                        <Edit size={14} /> Edit
                      </button>
                    )}
                    {hasPermission('BILL_PRINT') && (
                      <>
                        <button
                          onClick={() => handlePrint(billDetails.bill.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-light transition-colors cursor-pointer"
                        >
                          <Printer size={14} /> Print
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(billDetails.bill.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface dark:bg-slate-800 text-text dark:text-slate-200 border border-border dark:border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <Download size={14} /> PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Thermal Bill Preview - authentic white receipt paper inside dark container */}
                <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-border dark:border-slate-800 flex justify-center">
                  <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 w-full max-w-sm font-mono text-xs text-slate-900 space-y-2.5">

                    <div className="text-center">
                      <p className="font-bold text-sm text-slate-900 tracking-wide">
                        {(billDetails.settings?.restaurantName || 'MAHARAJ VEG VILLA').toUpperCase()}
                      </p>
                      {billDetails.bill.version > 1 && (
                        <p className="font-bold text-xs mt-1 text-amber-700">AMENDED BILL - Version {billDetails.bill.version}</p>
                      )}
                      {billDetails.settings?.address && (
                        <p className="text-slate-600 text-[11px] mt-0.5">
                          {billDetails.settings.address}
                        </p>
                      )}
                      {billDetails.settings?.phone && (
                        <p className="text-slate-600 text-[11px]">
                          Contact: {billDetails.settings.phone}
                        </p>
                      )}
                      {billDetails.settings?.gstin && (
                        <p className="text-slate-600 text-[11px]">
                          GSTIN: {billDetails.settings.gstin}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400" />

                    <div className="flex justify-between text-[11px]">
                      <span>Bill #: <strong>{billDetails.bill.billNumber}</strong></span>
                      <span>Date: {new Date(billDetails.bill.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Table: <strong>{billDetails.bill.session?.table?.number ?? billDetails.bill.order?.table?.number ?? billDetails.bill.table?.number ?? billDetails.bill.tableId ?? '-'}</strong></span>
                      <span>Time: {new Date(billDetails.bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {(billDetails.bill.customerName || billDetails.bill.customerPhone) && (
                      <div className="text-[11px] text-slate-600 pt-0.5 space-y-0.5">
                        {billDetails.bill.customerName && <div>Customer: <strong className="text-slate-900">{billDetails.bill.customerName}</strong></div>}
                        {billDetails.bill.customerPhone && <div>Phone: <strong className="text-slate-900">{billDetails.bill.customerPhone}</strong></div>}
                      </div>
                    )}

                    <div className="border-t border-dashed border-slate-400" />

                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-dashed border-slate-400 text-slate-900">
                          <th className="text-left py-1 font-semibold">ITEMS</th>
                          <th className="text-center py-1 font-semibold">QTY</th>
                          <th className="text-right py-1 font-semibold">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {billDetails.validItems?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1">{item.itemNameSnapshot || item.menuItem?.name || 'Item'}</td>
                            <td className="py-1 text-center">{item.quantity}</td>
                            <td className="py-1 text-right">
                              ₹{(Number(item.priceSnapshot || 0) * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t border-dashed border-slate-400" />

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>TOTAL</span>
                        <span>₹{Number(billDetails.bill.subtotal).toFixed(2)}</span>
                      </div>
                      {Number(billDetails.bill.discount) > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>DISCOUNT</span>
                          <span>-₹{Number(billDetails.bill.discount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>SGST ({Number(billDetails.bill.sgstPercent || 2.5).toFixed(3)}%)</span>
                        <span>₹{Number(billDetails.bill.sgstAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CGST ({Number(billDetails.bill.cgstPercent || 2.5).toFixed(3)}%)</span>
                        <span>₹{Number(billDetails.bill.cgstAmount).toFixed(2)}</span>
                      </div>
                      {Number(billDetails.bill.roundOff) !== 0 && (
                        <div className="flex justify-between">
                          <span>ROUND OFF</span>
                          <span>₹{Number(billDetails.bill.roundOff).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-dashed border-slate-400 pt-1.5 flex justify-between font-bold text-xs text-slate-900">
                        <span>FINAL AMOUNT</span>
                        <span>₹{Number(billDetails.bill.total).toFixed(2)}</span>
                      </div>
                      {billDetails.bill.payment && (
                        <div className="flex justify-between text-slate-500 text-[10px] pt-1">
                          <span>PAYMENT: {billDetails.bill.payment.method}</span>
                          <span>PAID</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400" />
                    <div className="text-center text-[11px] text-slate-500">
                      Thank you visit again
                    </div>
                  </div>
                </div>

                {billDetails.bill.status === 'DRAFT' && (hasPermission('BILL_FINALIZE') || hasPermission('BILL_CANCEL')) && (
                  <div className="bg-surface dark:bg-slate-800/80 p-4 rounded-xl border border-border dark:border-slate-700 space-y-3">

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-border dark:border-slate-700 space-y-2">
                      <p className="text-xs font-semibold text-text dark:text-slate-100 uppercase tracking-wider">
                        Customer Details (Optional)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-text-secondary dark:text-slate-400 mb-1">
                            Customer Name
                          </label>
                          <input
                            type="text"
                            value={draftCustomerName}
                            onChange={(e) => setDraftCustomerName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-xs text-text dark:text-slate-100 placeholder:text-text-secondary/60 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-secondary dark:text-slate-400 mb-1">
                            Customer Number
                          </label>
                          <input
                            type="tel"
                            value={draftCustomerPhone}
                            onChange={(e) => setDraftCustomerPhone(e.target.value)}
                            placeholder="e.g. 9876543210"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-xs text-text dark:text-slate-100 placeholder:text-text-secondary/60 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {hasPermission('BILL_FINALIZE') && (
                      <>
                        <label className="block text-xs font-semibold text-text dark:text-slate-200 uppercase tracking-wider">
                          Select Payment Method & Finalize
                        </label>
                        <div className="flex gap-2">
                          {['CASH', 'UPI', 'CARD'].map((m) => (
                            <button
                              key={m}
                              onClick={() => setPayMethod(m)}
                              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                payMethod === m
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 text-text dark:text-slate-200 border border-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="flex gap-2 pt-1">
                      {hasPermission('BILL_FINALIZE') && (
                        <button
                          onClick={() => finalize(billDetails.bill.id)}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                        >
                          <Check size={16} /> Finalize Bill (₹{Number(billDetails.bill.total).toFixed(2)})
                        </button>
                      )}
                      {hasPermission('BILL_CANCEL') && (
                        <button
                          onClick={() => cancel(billDetails.bill.id)}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-1 px-4 py-2.5 bg-danger text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                        >
                          <X size={16} /> Cancel Bill
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6 text-text-secondary dark:text-slate-400">
                No bill data found.
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isAmendOpen} onClose={() => setIsAmendOpen(false)} title="Modify Bill" size="md">
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto border border-border dark:border-slate-700 rounded-lg divide-y divide-border dark:divide-slate-700">
            {amendItems.map((item, idx) => (
              <div key={item.id} className="p-3 flex justify-between items-center bg-white dark:bg-slate-800">
                <div className="text-sm font-medium text-text dark:text-slate-100">{item.itemName}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-text-secondary dark:text-slate-400">₹{item.price}</div>
                  <input type="number" min="0" value={item.newQty} onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const newItems = [...amendItems];
                    newItems[idx].newQty = val;
                    setAmendItems(newItems);
                  }} className="w-16 border border-border dark:border-slate-700 bg-white dark:bg-slate-900 text-text dark:text-slate-100 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-primary" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-text dark:text-slate-200">Customer Name (Optional)</label>
              <input
                type="text"
                value={draftCustomerName}
                onChange={(e) => setDraftCustomerName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full border border-border dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 text-text dark:text-slate-100 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-text dark:text-slate-200">Customer Number (Optional)</label>
              <input
                type="tel"
                value={draftCustomerPhone}
                onChange={(e) => setDraftCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full border border-border dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 text-text dark:text-slate-100 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-text dark:text-slate-200">Discount (₹)</label>
              <input type="number" min="0" value={amendDiscount} onChange={(e) => setAmendDiscount(e.target.value)}
                className="w-full border border-border dark:border-slate-700 rounded-lg p-2 text-sm bg-white dark:bg-slate-800 text-text dark:text-slate-100 focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-text dark:text-slate-200">Reason for modification <span className="text-danger">*</span></label>
              <select value={amendReason} onChange={e => setAmendReason(e.target.value)} className="w-full border border-border dark:border-slate-700 rounded-lg p-2 text-sm bg-white dark:bg-slate-800 text-text dark:text-slate-100 focus:outline-none focus:border-primary">
                <option value="">Select a reason...</option>
                <option value="Captain entered wrong quantity">Captain entered wrong quantity</option>
                <option value="Customer correction">Customer correction</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-surface dark:bg-slate-800/60 rounded-lg border border-border dark:border-slate-700 space-y-1">
            <div className="flex justify-between text-sm text-text-secondary dark:text-slate-400">
              <span>Original Total:</span>
              <span className="font-mono text-text dark:text-slate-200">₹{Number(billDetails?.bill?.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-text dark:text-slate-100 mt-1">
              <span>New Estimated Total:</span>
              <span className="font-mono">₹{calcAmend().total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-border dark:border-slate-700">
              <span className="font-medium text-text dark:text-slate-200">Difference:</span>
              <span className={calcAmend().diff > 0 ? 'text-warning-dark dark:text-amber-400 font-bold flex items-center gap-1 font-mono' : calcAmend().diff < 0 ? 'text-success dark:text-emerald-400 font-bold flex items-center gap-1 font-mono' : 'text-text-secondary dark:text-slate-400 font-mono'}>
                {calcAmend().diff > 0 ? (
                  <>
                    <AlertTriangle size={14} /> Additional Payment Required: ₹{calcAmend().diff.toFixed(2)}
                  </>
                ) : calcAmend().diff < 0 ? (
                  `Refund/Credit: ₹${Math.abs(calcAmend().diff).toFixed(2)}`
                ) : '₹0.00'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setIsAmendOpen(false)} className="px-4 py-2 border border-border dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-text dark:text-slate-200 hover:bg-surface dark:hover:bg-slate-700 transition-colors cursor-pointer">Cancel</button>
            <button onClick={submitAmend} disabled={actionLoading} className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning-light disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer">
              {actionLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {amendBillStatus === 'DRAFT' ? 'Confirm Edit' : 'Confirm Amendment'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Amendment History" size="lg">
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : amendments.length > 0 ? (
            amendments.map(am => (
              <div key={am.id} className="p-4 border border-border dark:border-slate-800 rounded-lg bg-surface dark:bg-slate-800/80">
                <div className="flex justify-between items-center mb-2">
                  <Badge variant="warning">Version {am.version}</Badge>
                  <span className="text-xs text-text-secondary dark:text-slate-400">{new Date(am.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-text dark:text-slate-100"><strong>Reason:</strong> {am.reason}</p>
                <div className="text-sm mt-2 text-text dark:text-slate-100">
                  <strong>Changes:</strong>
                  <ul className="list-disc list-inside text-xs mt-1 text-text-secondary dark:text-slate-400">
                    {am.changes?.map((c, i) => (
                      <li key={i}>{c.itemName}: {c.oldQty} &rarr; {c.newQty}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded border border-border dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-text-secondary dark:text-slate-400 font-mono">Original: ₹{Number(am.originalTotal).toFixed(2)}</div>
                    <div className="text-xs text-text-secondary dark:text-slate-400 font-mono">New: ₹{Number(am.newTotal).toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    {am.difference > 0 ? (
                      <div className="text-warning-dark dark:text-amber-400 font-bold text-sm font-mono">Additional Payment: ₹{am.difference}</div>
                    ) : am.difference < 0 ? (
                      <div className="text-success dark:text-emerald-400 font-bold text-sm font-mono">Refund/Credit: ₹{Math.abs(am.difference)}</div>
                    ) : (
                      <div className="text-text-secondary dark:text-slate-400 text-sm font-mono">No difference</div>
                    )}
                    <div className="mt-1">
                      <span className="text-xs text-text-secondary dark:text-slate-400 mr-2">Status:</span>
                      <Badge variant={am.status === 'SETTLED' ? 'success' : 'warning'}>{am.status}</Badge>
                    </div>
                  </div>
                </div>

                {am.status === 'PENDING' && am.difference !== 0 && (
                  <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-border dark:border-slate-700">
                    <select id={`pay-${am.id}`} className="border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary">
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                    <button onClick={() => settleAmendment(am.id, document.getElementById(`pay-${am.id}`).value)} className="bg-primary text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-primary-light transition-colors cursor-pointer">
                      Settle {am.difference > 0 ? 'Payment' : 'Refund'}
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-text-secondary dark:text-slate-400 py-6">No amendments found.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
