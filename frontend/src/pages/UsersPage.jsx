import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  Edit2,
  CheckSquare,
  Square,
  Search,
  Eye,
  EyeOff,
  Shield,
  Key,
  User,
  Check,
  X,
  Lock,
  RotateCcw,
  CheckCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useOnRouteActive } from '../components/common/RouteKeepAlive';
import { usersBlue } from '../assets';

const PERMISSION_GROUPS = [
  { group: 'Dashboard', perms: ['DASHBOARD_VIEW'] },
  { group: 'Tables', perms: ['TABLE_VIEW', 'TABLE_CREATE', 'TABLE_EDIT', 'TABLE_DELETE'] },
  { group: 'Menu AC', perms: ['MENU_AC_VIEW', 'MENU_AC_CREATE', 'MENU_AC_EDIT', 'MENU_AC_DELETE'] },
  { group: 'Menu Non-AC', perms: ['MENU_NON_AC_VIEW', 'MENU_NON_AC_CREATE', 'MENU_NON_AC_EDIT', 'MENU_NON_AC_DELETE'] },
  { group: 'Menu Swiggy', perms: ['MENU_SWIGGY_VIEW', 'MENU_SWIGGY_CREATE', 'MENU_SWIGGY_EDIT', 'MENU_SWIGGY_DELETE'] },
  { group: 'Menu Zomato', perms: ['MENU_ZOMATO_VIEW', 'MENU_ZOMATO_CREATE', 'MENU_ZOMATO_EDIT', 'MENU_ZOMATO_DELETE'] },
  { group: 'Menu Bulk', perms: ['MENU_BULK_ADD'] },
  { group: 'Orders', perms: ['ORDER_CREATE', 'ORDER_EDIT', 'ORDER_CANCEL'] },
  { group: 'Kitchen & KOT', perms: ['KOT_CREATE', 'KOT_VIEW', 'KOT_EDIT', 'KOT_PRINT'] },
  { group: 'Bills & Settlement', perms: ['BILL_VIEW_DRAFT', 'BILL_EDIT', 'BILL_PRINT', 'BILL_FINALIZE', 'BILL_CANCEL', 'BILL_AMEND'] },
  { group: 'Purchases', perms: ['PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_EDIT', 'PURCHASE_DELETE'] },
  { group: 'Inventory', perms: ['INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_EDIT', 'INVENTORY_ADJUST'] },
  { group: 'Reports & Export', perms: ['REPORT_VIEW', 'REPORT_PDF', 'REPORT_CSV'] },
  { group: 'Users & Roles', perms: ['USER_VIEW', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE'] },
  { group: 'Settings', perms: ['SETTINGS_VIEW', 'SETTINGS_EDIT'] },
  { group: 'Online Orders', perms: ['ONLINE_ORDER_VIEW', 'ONLINE_ORDER_CREATE', 'ONLINE_ORDER_EDIT'] },
];

const PERMISSION_LABELS = {
  DASHBOARD_VIEW: 'View Dashboard & Telemetry',

  TABLE_VIEW: 'View Tables & Status',
  TABLE_CREATE: 'Create New Tables',
  TABLE_EDIT: 'Edit Table Details',
  TABLE_DELETE: 'Delete Tables',

  MENU_AC_VIEW: 'View AC Menu',
  MENU_AC_CREATE: 'Add AC Menu Items',
  MENU_AC_EDIT: 'Edit AC Menu Items',
  MENU_AC_DELETE: 'Delete AC Menu Items',

  MENU_NON_AC_VIEW: 'View Non-AC Menu',
  MENU_NON_AC_CREATE: 'Add Non-AC Items',
  MENU_NON_AC_EDIT: 'Edit Non-AC Items',
  MENU_NON_AC_DELETE: 'Delete Non-AC Items',

  MENU_SWIGGY_VIEW: 'View Swiggy Menu',
  MENU_SWIGGY_CREATE: 'Add Swiggy Items',
  MENU_SWIGGY_EDIT: 'Edit Swiggy Items',
  MENU_SWIGGY_DELETE: 'Delete Swiggy Items',

  MENU_ZOMATO_VIEW: 'View Zomato Menu',
  MENU_ZOMATO_CREATE: 'Add Zomato Items',
  MENU_ZOMATO_EDIT: 'Edit Zomato Items',
  MENU_ZOMATO_DELETE: 'Delete Zomato Items',

  MENU_BULK_ADD: 'Bulk Add Menu Items',

  ORDER_CREATE: 'Create Orders',
  ORDER_EDIT: 'Modify Active Orders',
  ORDER_CANCEL: 'Cancel Orders',

  KOT_CREATE: 'Send Order to Kitchen (KOT)',
  KOT_VIEW: 'View Kitchen Display',
  KOT_EDIT: 'Edit KOT Items / Status',
  KOT_PRINT: 'Print KOT Kitchen Tickets',

  BILL_VIEW_DRAFT: 'View Draft Bills',
  BILL_EDIT: 'Edit Bills & Discounts',
  BILL_PRINT: 'Print Thermal Bills',
  BILL_FINALIZE: 'Finalize & Settle Bills',
  BILL_CANCEL: 'Cancel Bills',
  BILL_AMEND: 'Amend Finalized Bills',

  PURCHASE_VIEW: 'View Purchases',
  PURCHASE_CREATE: 'Record Purchases',
  PURCHASE_EDIT: 'Edit Purchases',
  PURCHASE_DELETE: 'Delete Purchases',

  INVENTORY_VIEW: 'View Inventory Stock',
  INVENTORY_CREATE: 'Add Inventory Item',
  INVENTORY_EDIT: 'Edit Inventory Items',
  INVENTORY_ADJUST: 'Adjust Stock Quantities',

  REPORT_VIEW: 'View Sales Reports',
  REPORT_PDF: 'Export PDF Reports',
  REPORT_CSV: 'Export CSV Reports',

  USER_VIEW: 'View Users List',
  USER_CREATE: 'Create New Users',
  USER_EDIT: 'Edit Users & Permissions',
  USER_DELETE: 'Delete Users',

  SETTINGS_VIEW: 'View Settings',
  SETTINGS_EDIT: 'Modify Settings',

  ONLINE_ORDER_VIEW: 'View Online Orders',
  ONLINE_ORDER_CREATE: 'Create Online Orders',
  ONLINE_ORDER_EDIT: 'Update Online Orders',
};

const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.perms);

const ROLE_NAMES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  AC_MASTER: 'AC Master',
  NON_AC_MASTER: 'Non AC Master',
};

const ROLE_COLORS = {
  SUPER_ADMIN: 'primary',
  ADMIN: 'info',
  AC_MASTER: 'success',
  NON_AC_MASTER: 'warning',
};

const ROLE_DESCRIPTIONS = {
  SUPER_ADMIN: 'Full unrestricted access to all operations, security settings & bypasses checks',
  ADMIN: 'Full management of restaurant operations, menus, billing, inventory & reports',
  AC_MASTER: 'Manages AC hall orders, kitchen KOTs & generates draft bills',
  NON_AC_MASTER: 'Manages Non-AC hall orders, kitchen KOTs & generates draft bills',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'ADMIN', permissions: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const { user: currentUser, hasPermission, refreshUser } = useAuth();
  const canCreate = hasPermission('USER_CREATE');
  const canEdit = hasPermission('USER_EDIT');
  const canDelete = hasPermission('USER_DELETE');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : res.data.value || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useOnRouteActive(() => {
    fetchUsers();
  });

  const openAddModal = () => {
    setForm({
      username: '',
      password: '',
      name: '',
      role: 'ADMIN',
      permissions: ALL_PERMS.filter((p) => !['USER_CREATE', 'USER_EDIT', 'USER_DELETE'].includes(p)),
    });
    setShowPassword(false);
    setPermSearch('');
    setModal('new');
  };

  const openEditModal = (u) => {
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      role: u.role,
      permissions: (u.permissions || []).map((p) => (typeof p === 'string' ? p : p.permission)),
    });
    setShowPassword(false);
    setPermSearch('');
    setModal(u);
  };

  const save = async () => {
    if (!modal) return;
    try {
      setSaving(true);
      if (modal === 'new') {
        if (!form.username.trim() || form.username.trim().length < 3) {
          return toast.error('Username must be at least 3 characters');
        }
        if (!form.name.trim()) {
          return toast.error('Full Name is required');
        }
        if (!form.password || form.password.length < 6) {
          return toast.error('Password must be at least 6 characters');
        }
        const payload = {
          username: form.username.trim(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
          permissions: form.role === 'SUPER_ADMIN' ? ALL_PERMS : form.permissions,
        };
        await api.post('/users', payload);
        toast.success('User created successfully');
      } else {
        const payload = {
          name: form.name.trim(),
          role: form.role,
          permissions: form.role === 'SUPER_ADMIN' ? ALL_PERMS : form.permissions,
        };

        if (form.password && form.password.trim() !== '') {
          payload.password = form.password;
        }

        await api.patch(`/users/${modal.id}`, payload);
        toast.success('User updated successfully');
        if (modal.id === currentUser?.id) {
          await refreshUser();
        }
      }
      setModal(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    if (u.id === currentUser?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    try {
      await api.patch(`/users/${u.id}/status`, { active: !u.active });
      toast.success(`User ${u.active ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const deleteUser = async (u) => {
    if (u.id === currentUser?.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    if (u.role === 'SUPER_ADMIN') {
      toast.error("Super Admin accounts cannot be deleted");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user @${u.username}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`User @${u.username} deleted successfully`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSelectAll = () => {
    setForm((f) => ({ ...f, permissions: ALL_PERMS }));
  };

  const handleDeselectAll = () => {
    setForm((f) => ({ ...f, permissions: [] }));
  };

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const toggleAllInGroup = (groupPerms) => {
    const allSelected = groupPerms.every((p) => form.permissions.includes(p));
    if (allSelected) {
      setForm((f) => ({
        ...f,
        permissions: f.permissions.filter((p) => !groupPerms.includes(p)),
      }));
    } else {
      setForm((f) => ({
        ...f,
        permissions: Array.from(new Set([...f.permissions, ...groupPerms])),
      }));
    }
  };

  const filteredGroups = useMemo(() => {
    if (!permSearch.trim()) return PERMISSION_GROUPS;
    const q = permSearch.toLowerCase();
    return PERMISSION_GROUPS.map((g) => {
      const matchingPerms = g.perms.filter((p) => {
        const label = (PERMISSION_LABELS[p] || p).toLowerCase();
        const raw = p.toLowerCase();
        return label.includes(q) || raw.includes(q) || g.group.toLowerCase().includes(q);
      });
      return { ...g, perms: matchingPerms };
    }).filter((g) => g.perms.length > 0);
  }, [permSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-white flex items-center gap-2.5">
            <img src={usersBlue} alt="Users" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
            User Management
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            View system accounts, update roles, and manage granular permissions
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface dark:bg-slate-800/80 border-b border-border dark:border-slate-700">
              <tr className="text-left text-text-secondary dark:text-slate-400 text-xs">
                <th className="px-5 py-3.5 font-semibold">User</th>
                <th className="px-5 py-3.5 font-semibold">Username</th>
                <th className="px-5 py-3.5 font-semibold">Role</th>
                <th className="px-5 py-3.5 font-semibold">Permissions</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-800">
              {users.map((u) => {
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                const permCount = (u.permissions || []).length;
                const isCurrent = u.id === currentUser?.id;

                return (
                  <tr key={u.id} className="hover:bg-surface/50 dark:hover:bg-slate-800/50 transition-colors">

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {u.name ? u.name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text dark:text-slate-100 truncate">
                            {u.name}
                            {isCurrent && (
                              <span className="ml-2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-text-secondary dark:text-slate-400">
                      @{u.username}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge variant={ROLE_COLORS[u.role] || 'neutral'}>
                        {ROLE_NAMES[u.role] || u.role}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5">
                      {isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Shield size={12} /> Full Access (Super Admin)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Key size={12} className="text-text-secondary dark:text-slate-400" />
                          {permCount} / {ALL_PERMS.length} permissions
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge variant={u.active ? 'success' : 'danger'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 text-primary dark:text-blue-400 hover:bg-primary hover:text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            title="Edit User & Permissions"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => toggleStatus(u)}
                            disabled={isCurrent}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed border-border dark:border-slate-700 text-text-secondary dark:text-slate-400 bg-surface dark:bg-slate-800'
                                : u.active
                                ? 'border-border dark:border-slate-700 text-text-secondary dark:text-slate-400 hover:border-danger hover:text-danger hover:bg-red-50/50 dark:hover:bg-red-950/30'
                                : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                            }`}
                            title={isCurrent ? "You cannot disable yourself" : u.active ? "Deactivate User" : "Activate User"}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {canDelete && !isCurrent && u.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => deleteUser(u)}
                            className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer"
                            title="Delete User Account"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'new' ? 'Add New User' : 'Edit User & Permissions'}
        size="xl"
      >
        {modal && (
          <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  {form.name ? form.name[0].toUpperCase() : modal === 'new' ? '+' : 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-text dark:text-slate-100 truncate">
                      {form.name || (modal === 'new' ? 'New User Account' : modal.name)}
                    </h3>
                    <Badge variant={ROLE_COLORS[form.role] || 'neutral'}>
                      {ROLE_NAMES[form.role] || form.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary dark:text-slate-400 font-mono mt-0.5">
                    {modal === 'new'
                      ? form.username ? `@${form.username}` : 'Enter unique username below'
                      : `Account: @${modal.username}`}
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between text-xs text-text-secondary dark:text-slate-400">
                <span className="font-semibold text-text dark:text-slate-200">
                  {form.role === 'SUPER_ADMIN' ? 'All Privileges' : `${form.permissions.length} active permissions`}
                </span>
                <span className="text-[11px] text-text-secondary dark:text-slate-400">
                  {modal === 'new' ? 'New Registration' : `User ID: ${modal.id?.slice(0, 8)}...`}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-4 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-text dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border dark:border-slate-800">
                <User size={13} className="text-primary" /> Profile & Credentials
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-semibold text-text dark:text-slate-300 mb-1.5">
                    Display Name <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 text-sm bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 text-text dark:text-slate-100 font-medium transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Username <span className="text-danger">*</span></span>
                    <span className="text-[10px] text-text-secondary dark:text-slate-400 font-normal flex items-center gap-1">
                      <Lock size={10} /> {modal === 'new' ? 'Lowercase letters & numbers' : 'Fixed Identifier'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.username}
                      disabled={modal !== 'new'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
                        }))
                      }
                      placeholder="e.g. rahul_s"
                      className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
                        modal === 'new'
                          ? 'bg-surface dark:bg-slate-800 border-border dark:border-slate-700 text-text dark:text-slate-100 font-mono focus:outline-none focus:border-primary'
                          : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-text-secondary dark:text-slate-400 font-mono cursor-not-allowed opacity-90'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text dark:text-slate-300 mb-1.5">
                    System Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 text-text dark:text-slate-100 font-medium transition-colors cursor-pointer"
                  >
                    {Object.entries(ROLE_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">
                    {ROLE_DESCRIPTIONS[form.role]}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>
                      {modal === 'new' ? 'Password' : 'Update Password'} {modal === 'new' && <span className="text-danger">*</span>}
                    </span>
                    <span className="text-[10px] text-text-secondary dark:text-slate-400 font-normal">
                      {modal === 'new' ? 'Min. 6 characters' : 'Leave empty to keep current'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder={modal === 'new' ? 'Enter initial password' : 'Enter new password'}
                      className="w-full pl-3 pr-10 py-2 text-sm bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 text-text dark:text-slate-100 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 p-4 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-primary" />
                  <h4 className="text-xs font-bold text-text dark:text-slate-200 uppercase tracking-wider">
                    Permissions Matrix
                  </h4>
                  {form.role !== 'SUPER_ADMIN' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-blue-400 font-semibold">
                      {form.permissions.length} of {ALL_PERMS.length} active
                    </span>
                  )}
                </div>

                {form.role !== 'SUPER_ADMIN' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px]">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="w-full pl-7 pr-7 py-1 text-xs bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 focus:outline-none focus:border-primary text-text dark:text-slate-100"
                      />
                      {permSearch && (
                        <button
                          onClick={() => setPermSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors"
                    >
                      <CheckCheck size={12} /> Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-surface dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text-secondary dark:text-slate-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition-colors"
                    >
                      <RotateCcw size={12} /> Clear
                    </button>
                  </div>
                )}
              </div>

              {form.role === 'SUPER_ADMIN' ? (
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
                  <Shield size={18} className="text-primary dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-primary dark:text-blue-400">Unrestricted Super Administrator Access</p>
                    <p className="mt-1 text-text-secondary dark:text-slate-400 leading-relaxed">
                      Super Admin has automatic bypass on all permission checks. Every system module, report, configuration, and operation is granted unconditionally.
                    </p>
                  </div>
                </div>
              ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredGroups.map((group) => {
                    const allSelected = group.perms.every((p) => form.permissions.includes(p));
                    const selectedCount = group.perms.filter((p) => form.permissions.includes(p)).length;

                    return (
                      <div
                        key={group.group}
                        className={`rounded-xl border p-3 transition-all duration-150 ${
                          selectedCount > 0
                            ? 'bg-slate-50/60 dark:bg-slate-800/60 border-blue-200/80 dark:border-blue-900/60 shadow-2xs'
                            : 'bg-surface/50 dark:bg-slate-800/30 border-border/80 dark:border-slate-800'
                        }`}
                      >

                        <div className="flex items-center justify-between gap-1 mb-2.5 pb-1.5 border-b border-border/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-text dark:text-slate-200 truncate">
                              {group.group}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                                selectedCount === group.perms.length
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                  : selectedCount > 0
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {selectedCount}/{group.perms.length}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAllInGroup(group.perms)}
                            className="text-[11px] text-primary dark:text-blue-400 hover:underline font-semibold shrink-0"
                          >
                            {allSelected ? 'None' : 'All'}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {group.perms.map((perm) => {
                            const isChecked = form.permissions.includes(perm);
                            return (
                              <label
                                key={perm}
                                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer select-none text-xs transition-colors ${
                                  isChecked
                                    ? 'bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 shadow-2xs font-medium text-text dark:text-slate-100'
                                    : 'hover:bg-white/80 dark:hover:bg-slate-800/80 text-text-secondary dark:text-slate-400 border border-transparent'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm)}
                                  className="rounded border-border dark:border-slate-600 text-primary focus:ring-primary/20 w-3.5 h-3.5 cursor-pointer shrink-0 dark:bg-slate-800"
                                />
                                <span className="truncate leading-tight">
                                  {PERMISSION_LABELS[perm] || perm}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {filteredGroups.length === 0 && (
                    <div className="col-span-full py-8 text-center text-text-secondary dark:text-slate-400 text-xs">
                      No permissions match "<strong>{permSearch}</strong>".
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-border dark:border-slate-700 text-text dark:text-slate-300 hover:bg-surface dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light disabled:opacity-50 shadow-xs transition-colors"
              >
                {saving ? (
                  <>
                    <Spinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{modal === 'new' ? 'Create User' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
