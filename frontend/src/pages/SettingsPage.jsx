import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Settings, Store, Phone, MapPin, FileText, Percent, Save } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { settingsBlue } from '../assets';

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('SETTINGS_EDIT');

  const [settings, setSettings] = useState({
    restaurantName: 'Maharaj Veg Villa',
    address: '',
    phone: '',
    gstin: '',
    sgstPercent: '2.5',
    cgstPercent: '2.5',
    includePurchasesInReports: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setSettings({
          restaurantName: res.data.restaurantName || '',
          address: res.data.address || '',
          phone: res.data.phone || '',
          gstin: res.data.gstin || '',
          sgstPercent: res.data.sgstPercent !== undefined ? String(res.data.sgstPercent) : '2.5',
          cgstPercent: res.data.cgstPercent !== undefined ? String(res.data.cgstPercent) : '2.5',
          includePurchasesInReports: !!res.data.includePurchasesInReports,
        });
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useOnRouteActive(() => {
    fetchSettings();
  });

  const save = async (e) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    if (!settings.restaurantName.trim()) {
      toast.error('Restaurant name is required');
      return;
    }

    const sgst = parseFloat(settings.sgstPercent);
    const cgst = parseFloat(settings.cgstPercent);

    if (isNaN(sgst) || sgst < 0 || sgst > 100) {
      toast.error('SGST percent must be between 0 and 100');
      return;
    }
    if (isNaN(cgst) || cgst < 0 || cgst > 100) {
      toast.error('CGST percent must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings', {
        restaurantName: settings.restaurantName.trim(),
        address: settings.address.trim() || null,
        phone: settings.phone.trim() || null,
        gstin: settings.gstin.trim() || null,
        sgstPercent: sgst,
        cgstPercent: cgst,
        includePurchasesInReports: settings.includePurchasesInReports,
      });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalGst = (parseFloat(settings.sgstPercent) || 0) + (parseFloat(settings.cgstPercent) || 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text dark:text-white flex items-center gap-2">
          <img src={settingsBlue} alt="Settings" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
          Settings
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Configure restaurant details, billing preferences, and tax rates
        </p>
      </div>

      <form onSubmit={save} className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-6 shadow-sm space-y-6">

        <div>
          <h2 className="text-sm font-semibold text-text dark:text-slate-100 mb-4 pb-2 border-b border-border dark:border-slate-800 flex items-center gap-2">
            <Store size={16} className="text-primary" />
            Restaurant Information
          </h2>

          <div className="space-y-4">

            <div>
              <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                Restaurant Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={settings.restaurantName}
                onChange={(e) => setSettings((s) => ({ ...s, restaurantName: e.target.value }))}
                placeholder="e.g. Maharaj Veg Villa"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                Address / Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={!canEdit}
                  value={settings.address}
                  onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
                  placeholder="e.g. 123 Main Street, Pune, Maharashtra"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
                />
                <MapPin size={16} className="absolute left-3 top-3 text-text-secondary dark:text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                  Contact Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={settings.phone}
                    onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="e.g. +91 9876543210"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
                  />
                  <Phone size={16} className="absolute left-3 top-3 text-text-secondary dark:text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                  GSTIN Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={settings.gstin}
                    onChange={(e) => setSettings((s) => ({ ...s, gstin: e.target.value }))}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
                  />
                  <FileText size={16} className="absolute left-3 top-3 text-text-secondary dark:text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text dark:text-slate-100 mb-4 pb-2 border-b border-border dark:border-slate-800 flex items-center gap-2">
            <Percent size={16} className="text-primary" />
            Tax Configuration (GST)
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                  SGST Rate (%) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  disabled={!canEdit}
                  value={settings.sgstPercent}
                  onChange={(e) => setSettings((s) => ({ ...s, sgstPercent: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text dark:text-slate-300 uppercase mb-1">
                  CGST Rate (%) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  disabled={!canEdit}
                  value={settings.cgstPercent}
                  onChange={(e) => setSettings((s) => ({ ...s, cgstPercent: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-surface dark:disabled:bg-slate-800/50"
                />
              </div>
            </div>

            <div className="p-3.5 bg-surface dark:bg-slate-800/60 rounded-lg border border-border dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-text-secondary dark:text-slate-400 font-medium">
                Calculated Total GST on Bills:
              </span>
              <span className="font-mono font-bold text-text dark:text-slate-100 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-border dark:border-slate-700">
                {totalGst.toFixed(2)}% ({settings.sgstPercent}% SGST + {settings.cgstPercent}% CGST)
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text dark:text-slate-100 mb-4 pb-2 border-b border-border dark:border-slate-800 flex items-center gap-2">
            <Percent size={16} className="text-primary" />
            Report Configuration
          </h2>
          <div className="p-4 bg-surface dark:bg-slate-800/60 rounded-lg border border-border dark:border-slate-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={settings.includePurchasesInReports}
                onChange={(e) => setSettings(s => ({ ...s, includePurchasesInReports: e.target.checked }))}
                className="w-4 h-4 rounded border-border dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary disabled:opacity-60"
              />
              <div>
                <span className="text-sm font-medium text-text dark:text-slate-200">Include Purchases in Reports</span>
                <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                  When enabled, daily/monthly reports will show &quot;Net Sales After Purchases&quot; as a derived metric. This is NOT true profit — purchased stock may remain unused in inventory.
                </p>
              </div>
            </label>
          </div>
        </div>

        {canEdit && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Settings
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
