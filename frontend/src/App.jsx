import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './components/layouts/AdminLayout';
import Spinner from './components/ui/Spinner';
import RouteKeepAlive from './components/common/RouteKeepAlive';

// Route-level code-splitting with React.lazy()
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const KitchenPage = lazy(() => import('./pages/KitchenPage'));
const BillsPage = lazy(() => import('./pages/BillsPage'));
const TakeAwayPage = lazy(() => import('./pages/TakeAwayPage'));
const OnlineOrdersPage = lazy(() => import('./pages/OnlineOrdersPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <Spinner size="lg" />
  </div>
);

const FullscreenLoader = () => (
  <div className="flex items-center justify-center h-screen w-screen">
    <Spinner size="lg" />
  </div>
);

const ProtectedRoute = ({ allowedRoles, requiredPermission, requiredAnyPermission }) => {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();
  
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="flex items-center justify-center h-screen text-danger font-medium">Access Denied</div>;
  }
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="flex items-center justify-center h-screen text-danger font-medium">Access Denied</div>;
  }
  if (requiredAnyPermission && !hasAnyPermission(...requiredAnyPermission)) {
    return <div className="flex items-center justify-center h-screen text-danger font-medium">Access Denied</div>;
  }
  
  return <Outlet />;
};

const LayoutWrapper = () => {
  return (
    <AdminLayout>
      <Suspense fallback={<PageLoader />}>
        <RouteKeepAlive />
      </Suspense>
    </AdminLayout>
  );
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <FullscreenLoader />;

  return (
    <Suspense fallback={<FullscreenLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Navigate to={(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') ? "/dashboard" : "/tables"} replace />} />
          
          <Route element={<LayoutWrapper />}>
            <Route element={<ProtectedRoute requiredPermission="TABLE_VIEW" />}>
              <Route path="tables" element={<TablesPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="ORDER_CREATE" />}>
              <Route path="tables/:tableId/order" element={<OrderPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="KOT_VIEW" />}>
              <Route path="kitchen" element={<KitchenPage />} />
            </Route>
            
            <Route path="bills" element={<BillsPage />} />
            
            <Route element={<ProtectedRoute requiredAnyPermission={['ONLINE_ORDER_VIEW', 'ORDER_CREATE']} />}>
              <Route path="take-away" element={<TakeAwayPage />} />
            </Route>
            <Route path="online-orders" element={<Navigate to="/take-away" replace />} />
            
            <Route element={<ProtectedRoute requiredPermission="DASHBOARD_VIEW" />}>
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="USER_VIEW" />}>
              <Route path="users" element={<UsersPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredAnyPermission={['MENU_AC_VIEW', 'MENU_NON_AC_VIEW', 'MENU_SWIGGY_VIEW', 'MENU_ZOMATO_VIEW']} />}>
              <Route path="menu" element={<MenuPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="PURCHASE_VIEW" />}>
              <Route path="purchases" element={<PurchasesPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="INVENTORY_VIEW" />}>
              <Route path="inventory" element={<InventoryPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="REPORT_VIEW" />}>
              <Route path="reports" element={<ReportsPage />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="SETTINGS_VIEW" />}>
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}