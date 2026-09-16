import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  BarChart3, IndianRupee, ShoppingBag, CreditCard, Smartphone,
  Download, FileText, Calendar, Utensils, Truck, ArrowRight,
  AlertCircle, TrendingUp, Layers, Filter
} from 'lucide-react';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import {
  acBlue, nonAcBlue, takeAwayBlue, swiggyIcon, zomatoIcon,
  reportsBlue, tableBlue
} from '../assets';
import {
  RevenueTrendChart,
  ChannelDonutChart,
  PaymentMethodChart,
  TopItemsChart,
  TablePerformanceChart,
} from '../components/reports';

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  
  const getTodayStr = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [activePreset, setActivePreset] = useState('today');
  const [selectedSegment, setSelectedSegment] = useState('all'); // 'all' | 'dinein' | 'takeaway'

  const [sales, setSales] = useState(null);
  const [orders, setOrders] = useState(null);
  const [payments, setPayments] = useState(null);
  const [onlineOrders, setOnlineOrders] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [tablesData, setTablesData] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      // Single API call instead of 6 parallel calls — avoids DB connection exhaustion
      const { data } = await api.get('/reports/dashboard', { params });
      setSales(data.sales || {});
      setOrders(data.orders || {});
      setPayments(data.payments || {});
      setOnlineOrders(data.onlineOrders || {});
      setPurchases(data.purchases || { totalPurchaseAmount: 0, bySupplier: {} });
      setTablesData(data.tables || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  useOnRouteActive(() => {
    fetchReports();
  });

  const setPreset = (type) => {
    setActivePreset(type);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      const today = format(now);
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = format(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === 'week') {
      const curr = new Date();
      const day = curr.getDay(); // 0 is Sun, 1 is Mon
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(curr.setDate(curr.getDate() + diffToMonday));
      setStartDate(format(monday));
      setEndDate(format(now));
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(now));
    } else if (type === '30days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setStartDate(format(past));
      setEndDate(format(now));
    }
  };

  const fetchPeriodData = async (period) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = startDate;
    let end = endDate;
    let title = `Custom Report (${start} to ${end})`;

    if (period === 'daily') {
      start = format(now);
      end = format(now);
      title = `Daily Sales Report (${start})`;
    } else if (period === 'monthly') {
      start = format(new Date(now.getFullYear(), now.getMonth(), 1));
      end = format(now);
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      title = `Monthly Sales Report (${monthName})`;
    }

    const params = { startDate: start, endDate: end };
    // Sequential calls to avoid connection pool exhaustion
    const dashRes = await api.get('/reports/dashboard', { params });
    const billsRes = await api.get('/bills', { params }).catch(() => ({ data: [] }));

    return {
      title,
      start,
      end,
      sales: dashRes.data.sales || {},
      orders: dashRes.data.orders || {},
      payments: dashRes.data.payments || {},
      onlineOrders: dashRes.data.onlineOrders || {},
      purchases: dashRes.data.purchases || { totalPurchaseAmount: 0, bySupplier: {} },
      bills: Array.isArray(billsRes.data) ? billsRes.data : billsRes.data?.value || []
    };
  };

  const handleDownloadPDF = async (period = 'daily') => {
    setDownloading(true);
    try {
      const { title, start, end, sales: s, orders: o, payments: p, onlineOrders: onl, purchases: pu } = await fetchPeriodData(period);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup blocked. Please allow popups to view/print report.');
        return;
      }

      const totalRevenue = Number(s.totalRevenue || 0);
      const dineInRevenue = Number(s.dineInRevenue || 0);
      const takeAwayRevenue = Number(s.takeAwayRevenue || s.onlineRevenue || 0);
      const acSales = Number(s.acSales || 0);
      const nonAcSales = Number(s.nonAcSales || 0);
      const selfPickupSales = Number(s.selfPickupSales || 0);
      const totalOrdersCount = Number(s.totalOrders || 0);
      const avgOrderVal = Number(s.avgOrderValue || 0);
      const taxAmount = Number(s.taxCollected || 0);
      const purchaseCost = Number(s.purchaseCost || pu?.totalPurchaseAmount || 0);
      const netSalesAfterPurchases = Number(s.netSalesAfterPurchases ?? (totalRevenue - purchaseCost));
      const hasPurchasesInReports = !!s.includePurchasesInReports;

      const cashData = p.CASH || { count: 0, total: 0 };
      const upiData = p.UPI || { count: 0, total: 0 };
      const cardData = p.CARD || { count: 0, total: 0 };
      const otherMethods = Object.keys(p).filter(k => !['CASH', 'UPI', 'CARD'].includes(k));

      const swiggyCount = Number(onl.swiggyOrders || 0);
      const swiggyRev = Number(s.swiggyRevenue ?? onl.swiggyRevenue ?? 0);
      const zomatoCount = Number(onl.zomatoOrders || 0);
      const zomatoRev = Number(s.zomatoRevenue ?? onl.zomatoRevenue ?? 0);
      const totalTakeAwayRev = Number(s.takeAwayRevenue || onl.totalTakeAwayRevenue || onl.totalOnlineRevenue || 0);

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            body { padding: 32px; color: #1e293b; background: #ffffff; font-size: 13px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; }
            .header h1 { font-size: 24px; color: #1e40af; margin-bottom: 4px; font-weight: 800; letter-spacing: -0.5px; }
            .header h2 { font-size: 16px; color: #334155; font-weight: 600; }
            .header .meta { font-size: 12px; color: #64748b; margin-top: 6px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .kpi-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
            .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }
            .kpi-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
            .kpi-val { font-size: 18px; font-weight: 700; color: #0f172a; font-family: monospace; }
            .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
            .section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #ffffff; }
            .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
            th { background: #f8fafc; font-weight: 600; color: #475569; }
            td.num, th.num { text-align: right; font-family: monospace; }
            .highlight-row { font-weight: 700; background: #f8fafc; }
            .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print {
              body { padding: 16px; }
              @page { margin: 1cm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MAHARAJ VEG VILLA</h1>
            <h2>${title}</h2>
            <div class="meta">Generated: ${new Date().toLocaleString('en-IN')} &bull; Date Range: ${start} to ${end}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Total Revenue</div>
              <div class="kpi-val">₹${totalRevenue.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Dine-in Revenue</div>
              <div class="kpi-val">₹${dineInRevenue.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Take Away Revenue</div>
              <div class="kpi-val">₹${takeAwayRevenue.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Total Orders</div>
              <div class="kpi-val">${totalOrdersCount}</div>
            </div>
          </div>
          
          <div class="kpi-grid-5">
            <div class="kpi-card">
              <div class="kpi-title">AC Sales</div>
              <div class="kpi-val">₹${acSales.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Non-AC Sales</div>
              <div class="kpi-val">₹${nonAcSales.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Self Pickup</div>
              <div class="kpi-val">₹${selfPickupSales.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Swiggy Sales</div>
              <div class="kpi-val">₹${swiggyRev.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Zomato Sales</div>
              <div class="kpi-val">₹${zomatoRev.toFixed(2)}</div>
            </div>
          </div>

          ${hasPurchasesInReports ? `
          <div class="section" style="margin-bottom: 24px; border: 1px solid #fed7aa; background: #fffdfa;">
            <div class="section-title" style="color: #9a3412;">
              <span>Purchase Expenses & Net Sales</span>
              <span style="font-size: 11px; font-weight: 600; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 4px;">Include Purchases in Reports: ON</span>
            </div>
            <table>
              <tbody>
                <tr>
                  <td><strong>Total Purchases in Period</strong></td>
                  <td class="num" style="color: #b45309; font-weight: 700; font-size: 13px;">₹${purchaseCost.toFixed(2)}</td>
                </tr>
                <tr class="highlight-row">
                  <td><strong>Net Sales After Purchases</strong></td>
                  <td class="num" style="color: ${netSalesAfterPurchases >= 0 ? '#15803d' : '#b91c1c'}; font-weight: 800; font-size: 14px;">
                    ₹${netSalesAfterPurchases.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size: 11px; color: #78716c; font-style: italic;">
                    * Note: This is an operating estimate. Purchased inventory items may remain unconsumed in stock.
                  </td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 14px;">
              <div style="font-size: 12px; font-weight: 700; color: #431407; margin-bottom: 6px;">Purchases by Type of Purchase</div>
              <table>
                <thead>
                  <tr>
                    <th>Type of Purchase</th>
                    <th class="num">Entries / Invoices</th>
                    <th class="num">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${pu?.bySupplier && Object.keys(pu.bySupplier).length > 0 ? Object.entries(pu.bySupplier).map(([sup, data]) => `
                    <tr>
                      <td><strong>${sup}</strong></td>
                      <td class="num">${data.count || 0}</td>
                      <td class="num">₹${Number(data.amount || 0).toFixed(2)}</td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="3" style="text-align: center; color: #94a3b8;">No purchases recorded in this period</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}

          <div class="section-grid">
            <div class="section">
              <div class="section-title">Payment Breakdown</div>
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th class="num">Txns</th>
                    <th class="num">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>CASH</strong></td>
                    <td class="num">${cashData.count || 0}</td>
                    <td class="num">₹${Number(cashData.total || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>UPI</strong></td>
                    <td class="num">${upiData.count || 0}</td>
                    <td class="num">₹${Number(upiData.total || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>CARD</strong></td>
                    <td class="num">${cardData.count || 0}</td>
                    <td class="num">₹${Number(cardData.total || 0).toFixed(2)}</td>
                  </tr>
                  ${otherMethods.map(m => `
                    <tr>
                      <td><strong>${m}</strong></td>
                      <td class="num">${p[m]?.count || 0}</td>
                      <td class="num">₹${Number(p[m]?.total || 0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr class="highlight-row">
                    <td>Total</td>
                    <td class="num">${Object.values(p).reduce((sum, item) => sum + (item.count || 0), 0)}</td>
                    <td class="num">₹${Object.values(p).reduce((sum, item) => sum + (Number(item.total) || 0), 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Take Away & Online Orders</div>
              <table>
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th class="num">Orders</th>
                    <th class="num">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Self Pickup</strong></td>
                    <td class="num">${onl.selfPickupOrders || 0}</td>
                    <td class="num">₹${selfPickupSales.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>Swiggy</strong></td>
                    <td class="num">${swiggyCount}</td>
                    <td class="num">₹${swiggyRev.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>Zomato</strong></td>
                    <td class="num">${zomatoCount}</td>
                    <td class="num">₹${zomatoRev.toFixed(2)}</td>
                  </tr>
                  <tr class="highlight-row">
                    <td>Total Take Away</td>
                    <td class="num">${(Number(onl.selfPickupOrders) || 0) + swiggyCount + zomatoCount}</td>
                    <td class="num">₹${totalTakeAwayRev.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Order Performance & Tax Summary</div>
            <table>
              <tbody>
                <tr>
                  <td>Average Order Value</td>
                  <td class="num"><strong>₹${avgOrderVal.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td>GST / Tax Collected</td>
                  <td class="num"><strong>₹${taxAmount.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td>Dine-in Orders (Total)</td>
                  <td class="num">${o.dineIn?.total || 0}</td>
                </tr>
                <tr>
                  <td>Online Delivery Orders (Total)</td>
                  <td class="num">${o.online?.total || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            Maharaj Veg Villa POS System &bull; Confidential &bull; Generated Automatically
          </div>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
      toast.success('Report print window opened');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF report');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCSV = async (period = 'daily') => {
    setDownloading(true);
    try {
      const { start, end, sales: s, orders: o, payments: p, onlineOrders: onl, purchases: pu, bills: bList } = await fetchPeriodData(period);

      let filename = `report_daily_${start}.csv`;
      if (period === 'monthly') {
        const d = new Date(start);
        const pad = (n) => String(n).padStart(2, '0');
        filename = `report_monthly_${d.getFullYear()}_${pad(d.getMonth() + 1)}.csv`;
      } else if (period === 'custom') {
        filename = `report_${start}_to_${end}.csv`;
      }

      let settingsData = null;
      try {
        const sRes = await api.get('/settings');
        settingsData = sRes.data;
      } catch {
        // ignore
      }

      const rows = [];
      rows.push(['Maharaj Veg Villa - Sales & Performance Report']);
      rows.push([`Period: ${start} to ${end}`]);
      rows.push([`Generated At: ${new Date().toLocaleString('en-IN')}`]);
      rows.push([]);

      // 1. BILLS REGISTER (Formatted with Category, Date & Time, Type, Customer Name, Customer Number, SGST Rate, SGST Amount, CGST Rate, CGST Amount, Amount Without Tax, Total Tax, Total Invoice Value, GST Number, Total at the end)
      rows.push(['--- BILLS REGISTER ---']);
      rows.push([
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
      ]);

      let totalSgstAmount = 0;
      let totalCgstAmount = 0;
      let totalAmountWithoutTax = 0;
      let totalTaxAmount = 0;
      let totalInvoiceValue = 0;
      const periodBills = Array.isArray(bList) ? bList : [];

      if (periodBills.length > 0) {
        periodBills.forEach((bill) => {
          const src = bill.order?.orderSource;
          const tableNum = bill.session?.table?.number ?? bill.order?.table?.number ?? bill.table?.number ?? bill.tableId;
          const tableType = bill.session?.table?.type ?? bill.order?.table?.type ?? bill.table?.type;

          let category = 'Take Away';
          let type = 'Self';
          if (src === 'SWIGGY') {
            category = 'Take Away';
            type = 'Swiggy';
          } else if (src === 'ZOMATO') {
            category = 'Take Away';
            type = 'Zomato';
          } else if (src === 'SELF_PICKUP') {
            category = 'Take Away';
            type = 'Self';
          } else {
            category = tableType === 'AC' ? 'AC' : 'Non-AC';
            type = tableNum && tableNum !== '-' ? `Table ${tableNum}` : 'Table';
          }

          const d = new Date(bill.createdAt);
          const pad = (n) => String(n).padStart(2, '0');
          const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

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
          const gstNumber = bill.customerGst || bill.gstNumber || settingsData?.gstin || '-';

          rows.push([
            billNo,
            dateStr,
            timeStr,
            category,
            type,
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
      } else {
        rows.push(['No bills recorded in this period', '', '', '', '', '', '', '', '0.00', '', '0.00', '0.00', '0.00', '0.00', '']);
        rows.push(['Total', '', '', '', '', '', '', '', '0.00', '', '0.00', '0.00', '0.00', '0.00', '']);
      }
      rows.push([]);

      rows.push(['--- SALES SUMMARY ---']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Revenue (INR)', Number(s.totalRevenue || 0).toFixed(2)]);
      rows.push(['Dine-in Revenue (INR)', Number(s.dineInRevenue || 0).toFixed(2)]);
      rows.push(['Take Away Revenue (INR)', Number(s.takeAwayRevenue || s.onlineRevenue || 0).toFixed(2)]);
      rows.push(['AC Sales (INR)', Number(s.acSales || 0).toFixed(2)]);
      rows.push(['Non-AC Sales (INR)', Number(s.nonAcSales || 0).toFixed(2)]);
      rows.push(['Self Pickup Sales (INR)', Number(s.selfPickupSales || 0).toFixed(2)]);
      rows.push(['Swiggy Sales (INR)', Number(s.swiggyRevenue ?? onl.swiggyRevenue ?? 0).toFixed(2)]);
      rows.push(['Zomato Sales (INR)', Number(s.zomatoRevenue ?? onl.zomatoRevenue ?? 0).toFixed(2)]);
      rows.push(['Total Orders Count', s.totalOrders || 0]);
      rows.push(['Average Order Value (INR)', Number(s.avgOrderValue || 0).toFixed(2)]);
      rows.push(['Tax Collected (INR)', Number(s.taxCollected || 0).toFixed(2)]);
      rows.push([]);

      if (s.includePurchasesInReports) {
        rows.push(['--- PURCHASES & NET SALES (SETTINGS ENABLED) ---']);
        rows.push(['Total Purchases in Period (INR)', Number(s.purchaseCost || pu?.totalPurchaseAmount || 0).toFixed(2)]);
        rows.push(['Net Sales After Purchases (INR)', Number(s.netSalesAfterPurchases || 0).toFixed(2)]);
        rows.push(['Note', 'Calculated by deducting total purchase entries in period from total revenue']);
        rows.push([]);
      }

      rows.push(['--- PURCHASES BY TYPE OF PURCHASE ---']);
      rows.push(['Type of Purchase', 'Invoices / Entries Count', 'Total Amount (INR)']);
      if (pu?.bySupplier && Object.keys(pu.bySupplier).length > 0) {
        Object.entries(pu.bySupplier).forEach(([sup, data]) => {
          rows.push([sup, data.count || 0, Number(data.amount || 0).toFixed(2)]);
        });
        rows.push(['Total Purchases', Object.values(pu.bySupplier).reduce((sum, d) => sum + (d.count || 0), 0), Number(pu.totalPurchaseAmount || 0).toFixed(2)]);
      } else {
        rows.push(['No purchases recorded in this period', 0, '0.00']);
      }
      rows.push([]);

      rows.push(['--- PAYMENT BREAKDOWN ---']);
      rows.push(['Payment Method', 'Transaction Count', 'Total Amount (INR)']);
      const methods = ['CASH', 'UPI', 'CARD', ...Object.keys(p).filter(k => !['CASH', 'UPI', 'CARD'].includes(k))];
      const uniqueMethods = [...new Set(methods)];
      uniqueMethods.forEach(m => {
        const item = p[m] || { count: 0, total: 0 };
        rows.push([m, item.count || 0, Number(item.total || 0).toFixed(2)]);
      });
      rows.push([]);

      rows.push(['--- TAKE AWAY & ONLINE ORDERS BREAKDOWN ---']);
      rows.push(['Channel', 'Orders Count', 'Total Revenue (INR)']);
      rows.push(['Self Pickup', onl.selfPickupOrders || 0, Number(s.selfPickupSales || onl.selfPickupRevenue || 0).toFixed(2)]);
      rows.push(['Swiggy', onl.swiggyOrders || 0, Number(s.swiggyRevenue ?? onl.swiggyRevenue ?? 0).toFixed(2)]);
      rows.push(['Zomato', onl.zomatoOrders || 0, Number(s.zomatoRevenue ?? onl.zomatoRevenue ?? 0).toFixed(2)]);
      rows.push(['Total Take Away', (Number(onl.selfPickupOrders) || 0) + (Number(onl.swiggyOrders) || 0) + (Number(onl.zomatoOrders) || 0), Number(s.takeAwayRevenue || onl.totalTakeAwayRevenue || onl.totalOnlineRevenue || 0).toFixed(2)]);
      rows.push([]);

      rows.push(['--- ORDERS SUMMARY ---']);
      rows.push(['Order Type', 'Total Count']);
      rows.push(['Dine-in', o.dineIn?.total || 0]);
      rows.push(['Online Delivery', o.online?.total || 0]);

      const csvContent = rows
        .map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`CSV ${filename} downloaded`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  const totalRev = Number(sales?.totalRevenue || 0);
  const dineInRev = Number(sales?.dineInRevenue || 0);
  const takeAwayRev = Number(sales?.takeAwayRevenue || sales?.onlineRevenue || 0);
  const acSales = Number(sales?.acSales || 0);
  const nonAcSales = Number(sales?.nonAcSales || 0);
  const selfPickupSales = Number(sales?.selfPickupSales || 0);
  const totalOrders = Number(sales?.totalOrders || 0);

  const cashInfo = payments?.CASH || { count: 0, total: 0 };
  const upiInfo = payments?.UPI || { count: 0, total: 0 };
  const cardInfo = payments?.CARD || { count: 0, total: 0 };

  const swiggyCount = Number(onlineOrders?.swiggyOrders || 0);
  const swiggyRevenue = Number(sales?.swiggyRevenue ?? onlineOrders?.swiggyRevenue ?? 0);
  const zomatoCount = Number(onlineOrders?.zomatoOrders || 0);
  const zomatoRevenue = Number(sales?.zomatoRevenue ?? onlineOrders?.zomatoRevenue ?? 0);

  // Filtered timeline based on active segment filter
  const filteredTimeline = (sales?.timeline || []).map(item => {
    if (selectedSegment === 'dinein') {
      return {
        ...item,
        selfPickupSales: 0,
        swiggyRevenue: 0,
        zomatoRevenue: 0,
        takeAway: 0,
        total: (item.acSales || 0) + (item.nonAcSales || 0) || item.dineIn || 0,
      };
    } else if (selectedSegment === 'takeaway') {
      return {
        ...item,
        acSales: 0,
        nonAcSales: 0,
        dineIn: 0,
        total: (item.selfPickupSales || 0) + (item.swiggyRevenue || 0) + (item.zomatoRevenue || 0) || item.takeAway || 0,
      };
    }
    return item;
  });

  // Filtered sales data for channel donut
  const filteredSalesForDonut = {
    ...sales,
    acSales: selectedSegment === 'takeaway' ? 0 : acSales,
    nonAcSales: selectedSegment === 'takeaway' ? 0 : nonAcSales,
    selfPickupSales: selectedSegment === 'dinein' ? 0 : selfPickupSales,
    swiggyRevenue: selectedSegment === 'dinein' ? 0 : swiggyRevenue,
    zomatoRevenue: selectedSegment === 'dinein' ? 0 : zomatoRevenue,
    totalRevenue: selectedSegment === 'dinein'
      ? acSales + nonAcSales
      : selectedSegment === 'takeaway'
      ? selfPickupSales + swiggyRevenue + zomatoRevenue
      : totalRev,
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
            <img src={reportsBlue} alt="Reports" className="w-5 sm:w-6 h-5 sm:h-6 object-contain dark:brightness-0 dark:invert" />
            Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-slate-400 mt-0.5">
            Interactive sales performance, visual trends, and multi-channel metrics
          </p>
        </div>

        {/* Date Filter Presets & Date Picker */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-slate-800 p-1 shadow-xs overflow-x-auto no-scrollbar w-full sm:w-auto">
            {[
              { label: 'Today', key: 'today' },
              { label: 'Yesterday', key: 'yesterday' },
              { label: 'This Week', key: 'week' },
              { label: 'This Month', key: 'month' },
              { label: 'Last 30 Days', key: '30days' },
            ].map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  activePreset === p.key
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-white dark:bg-slate-900 border border-border dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-xs w-full sm:w-auto">
            <Calendar size={14} className="text-text-secondary dark:text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setActivePreset('custom');
              }}
              className="text-xs font-medium text-text dark:text-slate-100 bg-transparent border-0 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-text-secondary dark:text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setActivePreset('custom');
              }}
              className="text-xs font-medium text-text dark:text-slate-100 bg-transparent border-0 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Quick Channel Segment Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-border dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary dark:text-slate-400 px-2">
          <Filter size={15} className="text-primary dark:text-blue-400" />
          <span>Channel View:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSegment('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedSegment === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 bg-white dark:bg-slate-900 border border-border/60 dark:border-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>All Channels</span>
            <span className="font-mono text-[11px] opacity-90 ml-1">₹{totalRev.toLocaleString('en-IN')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedSegment('dinein')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedSegment === 'dinein'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 bg-white dark:bg-slate-900 border border-border/60 dark:border-slate-800'
            }`}
          >
            <Utensils size={14} />
            <span>Dine-In Only</span>
            <span className="font-mono text-[11px] opacity-90 ml-1">₹{dineInRev.toLocaleString('en-IN')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedSegment('takeaway')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedSegment === 'takeaway'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 bg-white dark:bg-slate-900 border border-border/60 dark:border-slate-800'
            }`}
          >
            <Truck size={14} />
            <span>Take Away & Deliveries</span>
            <span className="font-mono text-[11px] opacity-90 ml-1">₹{takeAwayRev.toLocaleString('en-IN')}</span>
          </button>
        </div>
      </div>

      {/* Export Action Bar */}
      <Card className="bg-gradient-to-r from-surface to-white dark:from-slate-900 dark:to-slate-800 border-border/80 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary dark:text-blue-400">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-text dark:text-slate-100 text-sm">Download Export Reports</h3>
              <p className="text-xs text-text-secondary dark:text-slate-400">Instant printable PDF or Excel-compatible CSV exports</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Daily Download Buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-border dark:border-slate-800">
              <span className="text-xs font-medium text-text-secondary dark:text-slate-400 px-2">Daily:</span>
              {hasPermission('REPORT_PDF') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadPDF('daily')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Daily PDF"
                >
                  <FileText size={14} className="text-danger dark:text-rose-400" />
                  PDF
                </button>
              )}
              {hasPermission('REPORT_CSV') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadCSV('daily')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Daily CSV"
                >
                  <Download size={14} className="text-success dark:text-emerald-400" />
                  CSV
                </button>
              )}
            </div>

            {/* Monthly Download Buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-border dark:border-slate-800">
              <span className="text-xs font-medium text-text-secondary dark:text-slate-400 px-2">Monthly:</span>
              {hasPermission('REPORT_PDF') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadPDF('monthly')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Monthly PDF"
                >
                  <FileText size={14} className="text-danger dark:text-rose-400" />
                  PDF
                </button>
              )}
              {hasPermission('REPORT_CSV') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadCSV('monthly')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Monthly CSV"
                >
                  <Download size={14} className="text-success dark:text-emerald-400" />
                  CSV
                </button>
              )}
            </div>

            {/* Current Selection Export */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-border dark:border-slate-800">
              <span className="text-xs font-medium text-text-secondary dark:text-slate-400 px-2">Selected:</span>
              {hasPermission('REPORT_PDF') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadPDF('custom')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Print Selected Range PDF"
                >
                  <FileText size={14} className="text-primary dark:text-blue-400" />
                  PDF
                </button>
              )}
              {hasPermission('REPORT_CSV') && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownloadCSV('custom')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text dark:text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Selected Range CSV"
                >
                  <Download size={14} className="text-primary dark:text-blue-400" />
                  CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:border-success/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Total Revenue</p>
                  <p className="text-2xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                    ₹{totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-slate-400 mt-1">
                    <span>Avg Order:</span>
                    <span className="font-mono font-medium text-text dark:text-slate-200">₹{Number(sales?.avgOrderValue || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-success/10 dark:bg-emerald-950/60 rounded-xl text-success dark:text-emerald-400">
                  <IndianRupee size={22} />
                </div>
              </div>
            </Card>

            <Card className="hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Dine-in Revenue</p>
                  <p className="text-2xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                    ₹{dineInRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-slate-400 mt-1">
                    <span>{totalRev > 0 ? `${((dineInRev / totalRev) * 100).toFixed(1)}% share` : '0%'}</span>
                    <span className="text-border dark:text-slate-700">|</span>
                    <span className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-medium">AC: ₹{acSales.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-primary/10 dark:bg-primary/20 rounded-xl text-primary dark:text-blue-400">
                  <Utensils size={22} />
                </div>
              </div>
            </Card>

            <Card className="hover:border-warning/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Take Away & Delivery</p>
                  <p className="text-2xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                    ₹{takeAwayRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-slate-400 mt-1">
                    <span>{totalRev > 0 ? `${((takeAwayRev / totalRev) * 100).toFixed(1)}% share` : '0%'}</span>
                    <span className="text-border dark:text-slate-700">|</span>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">Pickup: ₹{selfPickupSales.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-warning/10 dark:bg-amber-950/60 rounded-xl text-warning dark:text-amber-400">
                  <Truck size={22} />
                </div>
              </div>
            </Card>

            <Card className="hover:border-primary-light/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Total Orders</p>
                  <p className="text-2xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">{totalOrders}</p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                    Tax (GST): <span className="font-mono font-medium text-text dark:text-slate-200">₹{Number(sales?.taxCollected || 0).toFixed(2)}</span>
                  </p>
                </div>
                <div className="p-2.5 bg-primary-light/10 dark:bg-blue-950/60 rounded-xl text-primary-light dark:text-blue-300">
                  <BarChart3 size={22} />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row 1: Interactive Revenue Trend & Channel Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <RevenueTrendChart
                timeline={filteredTimeline}
                isSingleDay={startDate === endDate}
              />
            </div>
            <div className="lg:col-span-4">
              <ChannelDonutChart sales={filteredSalesForDonut} />
            </div>
          </div>

          {/* Charts Row 2: Payment Methods, Top Selling Items, Dine-In Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PaymentMethodChart payments={payments} />
            <TopItemsChart
              topItems={sales?.topItems || []}
              categorySales={sales?.categorySales || []}
            />
            <TablePerformanceChart tables={tablesData || []} />
          </div>
          
          {/* Sales Channels Breakdown Cards */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-text dark:text-slate-100">Channel Revenue Summary</h3>
              <span className="text-xs text-text-secondary dark:text-slate-400">Direct breakdown across AC, Non-AC & Online deliveries</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <Card className="hover:border-blue-400/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">AC Sales</p>
                    <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                      ₹{acSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">Dine-In AC Section</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
                    <img src={acBlue} alt="AC" className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-emerald-400/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Non-AC Sales</p>
                    <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                      ₹{nonAcSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">Dine-In Non-AC Section</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
                    <img src={nonAcBlue} alt="Non-AC" className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-teal-400/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Self Pickup</p>
                    <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                      ₹{selfPickupSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">Self Pickup Orders</p>
                  </div>
                  <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 rounded-xl">
                    <img src={takeAwayBlue} alt="Self Pickup" className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-orange-400/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Swiggy Sales</p>
                    <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                      ₹{swiggyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">{swiggyCount} delivery orders</p>
                  </div>
                  <div className="p-2.5 bg-orange-50 dark:bg-orange-950/60 rounded-xl">
                    <img src={swiggyIcon} alt="Swiggy" className="w-5 h-5 object-contain" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-red-400/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Zomato Sales</p>
                    <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-1.5">
                      ₹{zomatoRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">{zomatoCount} delivery orders</p>
                  </div>
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/60 rounded-xl">
                    <img src={zomatoIcon} alt="Zomato" className="w-5 h-5 object-contain" />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Purchase-Adjusted Metrics & Supplier Breakdown */}
          {sales?.includePurchasesInReports ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-warning/30 bg-warning/5 dark:bg-amber-950/20 dark:border-amber-900/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Purchase Expenses</p>
                      <p className="text-2xl font-bold font-mono text-warning mt-1.5">
                        ₹{Number(sales?.purchaseCost || purchases?.totalPurchaseAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">Total purchases recorded in this period</p>
                    </div>
                    <div className="p-2.5 bg-warning/10 dark:bg-amber-950/60 rounded-xl text-warning dark:text-amber-400">
                      <ShoppingBag size={22} />
                    </div>
                  </div>
                </Card>

                <Card className="border-success/30 bg-success/5 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider">Net Sales After Purchases</p>
                      <p className={`text-2xl font-bold font-mono mt-1.5 ${Number(sales?.netSalesAfterPurchases || 0) >= 0 ? 'text-success dark:text-emerald-400' : 'text-danger dark:text-rose-400'}`}>
                        ₹{Number(sales?.netSalesAfterPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 italic">
                        This is gross sales minus purchases — raw stock may remain in inventory.
                      </p>
                    </div>
                    <div className="p-2.5 bg-success/10 dark:bg-emerald-950/60 rounded-xl text-success dark:text-emerald-400">
                      <IndianRupee size={22} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Purchases by Supplier Table */}
              <Card>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Truck size={18} className="text-primary dark:text-blue-400" />
                    <h3 className="font-semibold text-text dark:text-slate-100">Purchases by Type of Purchase</h3>
                  </div>
                  <span className="text-xs text-text-secondary dark:text-slate-400">
                    Total Purchases: <strong className="font-mono text-text dark:text-slate-100">₹{Number(purchases?.totalPurchaseAmount || sales?.purchaseCost || 0).toFixed(2)}</strong>
                  </span>
                </div>

                {purchases?.bySupplier && Object.keys(purchases.bySupplier).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border dark:border-slate-800 text-xs text-text-secondary dark:text-slate-400 bg-surface/50 dark:bg-slate-800/50">
                          <th className="py-2.5 px-3 font-semibold">Type of Purchase</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Invoices / Entries</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total Amount (₹)</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Share of Purchases</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-slate-800 text-xs">
                        {Object.entries(purchases.bySupplier).map(([sup, data]) => {
                          const total = Number(purchases?.totalPurchaseAmount || sales?.purchaseCost || 1);
                          const pct = total > 0 ? ((data.amount / total) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={sup} className="hover:bg-surface/50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-text dark:text-slate-100">{sup}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-text-secondary dark:text-slate-400">{data.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-text dark:text-slate-100">
                                ₹{Number(data.amount || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-text-secondary dark:text-slate-400">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary dark:text-slate-400 py-3 text-center">No purchases recorded for this period.</p>
                )}
              </Card>
            </div>
          ) : (
            /* Informational Banner when Include Purchases in Reports is OFF */
            <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-950 dark:text-blue-100">Purchase Expense Reporting is Disabled</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                      To view supplier purchase breakdowns, purchase costs, and net sales after expenses in these reports, turn on the <strong>"Include Purchases in Reports"</strong> toggle in Settings.
                    </p>
                  </div>
                </div>
                <Link
                  to="/settings"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Open Settings</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </Card>
          )}

          {/* Payment Breakdown & Online Orders Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Breakdown */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-primary dark:text-blue-400" />
                  <h3 className="font-semibold text-text dark:text-slate-100">Payment Breakdown Details</h3>
                </div>
                <span className="text-xs text-text-secondary dark:text-slate-400">
                  Total: <strong className="font-mono text-text dark:text-slate-100">₹{totalRev.toFixed(2)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* CASH */}
                <div className="bg-surface dark:bg-slate-800/60 rounded-xl p-4 border border-border/60 dark:border-slate-700 hover:border-border dark:hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between text-text-secondary dark:text-slate-400 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">Cash</span>
                    <IndianRupee size={14} className="text-success dark:text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold font-mono text-text dark:text-slate-100">
                    ₹{Number(cashInfo.total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 font-medium">
                    {cashInfo.count || 0} transactions
                  </p>
                </div>

                {/* UPI */}
                <div className="bg-surface dark:bg-slate-800/60 rounded-xl p-4 border border-border/60 dark:border-slate-700 hover:border-border dark:hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between text-text-secondary dark:text-slate-400 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">UPI</span>
                    <Smartphone size={14} className="text-primary dark:text-blue-400" />
                  </div>
                  <p className="text-lg font-bold font-mono text-text dark:text-slate-100">
                    ₹{Number(upiInfo.total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 font-medium">
                    {upiInfo.count || 0} transactions
                  </p>
                </div>

                {/* CARD */}
                <div className="bg-surface dark:bg-slate-800/60 rounded-xl p-4 border border-border/60 dark:border-slate-700 hover:border-border dark:hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between text-text-secondary dark:text-slate-400 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">Card</span>
                    <CreditCard size={14} className="text-warning dark:text-amber-400" />
                  </div>
                  <p className="text-lg font-bold font-mono text-text dark:text-slate-100">
                    ₹{Number(cardInfo.total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 font-medium">
                    {cardInfo.count || 0} transactions
                  </p>
                </div>
              </div>

              {/* Other methods if present */}
              {payments && Object.keys(payments).filter(k => !['CASH', 'UPI', 'CARD'].includes(k)).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border dark:border-slate-800 space-y-2">
                  {Object.keys(payments).filter(k => !['CASH', 'UPI', 'CARD'].includes(k)).map(key => (
                    <div key={key} className="flex justify-between items-center text-xs py-1">
                      <span className="text-text-secondary dark:text-slate-400 font-medium">{key}</span>
                      <span className="font-mono text-text dark:text-slate-100 font-bold">
                        ₹{Number(payments[key]?.total || 0).toFixed(2)} ({payments[key]?.count || 0} txns)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Online Orders Breakdown */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone size={18} className="text-primary dark:text-blue-400" />
                  <h3 className="font-semibold text-text dark:text-slate-100">Online Delivery Channels</h3>
                </div>
                <span className="text-xs text-text-secondary dark:text-slate-400">
                  Total: <strong className="font-mono text-text dark:text-slate-100">₹{Number(onlineOrders?.totalOnlineRevenue || 0).toFixed(2)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Swiggy */}
                <div className="bg-surface dark:bg-slate-800/60 rounded-xl p-4 border border-border/60 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-900/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900/60">
                      <img src={swiggyIcon} alt="Swiggy" className="w-3.5 h-3.5 object-contain" />
                      Swiggy
                    </span>
                    <span className="text-xs text-text-secondary dark:text-slate-400 font-medium font-mono">
                      {swiggyCount} orders
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-2">
                    ₹{swiggyRevenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                    Avg: <span className="font-mono">₹{swiggyCount > 0 ? (swiggyRevenue / swiggyCount).toFixed(2) : '0.00'}</span> / order
                  </p>
                </div>

                {/* Zomato */}
                <div className="bg-surface dark:bg-slate-800/60 rounded-xl p-4 border border-border/60 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-900/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60">
                      <img src={zomatoIcon} alt="Zomato" className="w-3.5 h-3.5 object-contain" />
                      Zomato
                    </span>
                    <span className="text-xs text-text-secondary dark:text-slate-400 font-medium font-mono">
                      {zomatoCount} orders
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-text dark:text-slate-100 mt-2">
                    ₹{zomatoRevenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                    Avg: <span className="font-mono">₹{zomatoCount > 0 ? (zomatoRevenue / zomatoCount).toFixed(2) : '0.00'}</span> / order
                  </p>
                </div>
              </div>

              {/* Online Orders Summary Row */}
              <div className="mt-4 p-3 bg-surface/70 dark:bg-slate-800/70 rounded-lg flex items-center justify-between text-xs border border-border/40 dark:border-slate-700">
                <span className="text-text-secondary dark:text-slate-400">Total Online Deliveries:</span>
                <span className="font-mono font-semibold text-text dark:text-slate-100">
                  {swiggyCount + zomatoCount} orders &bull; ₹{Number(onlineOrders?.totalOnlineRevenue || 0).toFixed(2)}
                </span>
              </div>
            </Card>
          </div>

          {/* Orders Status & Volume Summary */}
          {orders && (
            <Card>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-primary dark:text-blue-400" />
                  <h3 className="font-semibold text-text dark:text-slate-100">Order Volumes & Status Distribution</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface dark:bg-slate-800/60 rounded-xl border border-border/60 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text dark:text-slate-100">Dine-in Orders</span>
                    <span className="text-base font-bold font-mono text-primary dark:text-blue-400">{orders.dineIn?.total || 0}</span>
                  </div>
                  {orders.dineIn?.byStatus && Object.keys(orders.dineIn.byStatus).length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/40 dark:border-slate-700">
                      {Object.entries(orders.dineIn.byStatus).map(([status, count]) => (
                        <span key={status} className="px-2 py-0.5 rounded text-xs bg-white dark:bg-slate-900 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-400 font-mono">
                          {status}: <strong className="text-text dark:text-slate-200">{count}</strong>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">No status details available</p>
                  )}
                </div>

                <div className="p-4 bg-surface dark:bg-slate-800/60 rounded-xl border border-border/60 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text dark:text-slate-100">Online Orders</span>
                    <span className="text-base font-bold font-mono text-primary dark:text-blue-400">{orders.online?.total || 0}</span>
                  </div>
                  {orders.online?.byStatus && Object.keys(orders.online.byStatus).length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/40 dark:border-slate-700">
                      {Object.entries(orders.online.byStatus).map(([status, count]) => (
                        <span key={status} className="px-2 py-0.5 rounded text-xs bg-white dark:bg-slate-900 border border-border dark:border-slate-700 text-text-secondary dark:text-slate-400 font-mono">
                          {status}: <strong className="text-text dark:text-slate-200">{count}</strong>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">No status details available</p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
