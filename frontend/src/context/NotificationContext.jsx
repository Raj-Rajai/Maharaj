import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import realtime from '../services/realtime';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Gentle Web Audio API synthesizer for notification sounds (zero external files required)
function playChime(type = 'KOT') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (type === 'KOT') {
      // Pleasant dual tone: 523Hz (C5) -> 659Hz (E5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else {
      // Cheerful chime: 659Hz (E5) -> 880Hz (A5)
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.14);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  } catch {
    // Graceful fallback if Web Audio is restricted
  }
}

export function NotificationProvider({ children }) {
  const { user, hasPermission } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activePopups, setActivePopups] = useState([]);
  const popupsRef = useRef(activePopups);
  popupsRef.current = activePopups;

  // Helper to determine if an item (KOT or Bill) belongs to AC or Non-AC
  const checkIsAc = useCallback((item) => {
    if (!item) return false;
    const tableType =
      item.tableType ||
      item.table?.type ||
      item.order?.table?.type ||
      item.order?.tableType;

    if (tableType) {
      return String(tableType).toUpperCase() === 'AC';
    }

    const source = item.order?.orderSource || item.orderSource;
    if (source) {
      if (source === 'DINE_IN_AC') return true;
      if (['DINE_IN_NON_AC', 'SELF_PICKUP', 'SWIGGY', 'ZOMATO', 'TAKEAWAY'].includes(source)) {
        return false;
      }
    }

    return false;
  }, []);

  // Check if current user has permission to receive notification for this item
  const canReceiveNotification = useCallback((type, isAc) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    if (type === 'KOT') {
      return isAc
        ? hasPermission('NOTIFICATION_KOT_AC')
        : hasPermission('NOTIFICATION_KOT_NON_AC');
    }

    if (type === 'BILL') {
      return isAc
        ? hasPermission('NOTIFICATION_BILL_AC')
        : hasPermission('NOTIFICATION_BILL_NON_AC');
    }

    return false;
  }, [user, hasPermission]);

  const canReceiveRef = useRef(canReceiveNotification);
  canReceiveRef.current = canReceiveNotification;
  const checkIsAcRef = useRef(checkIsAc);
  checkIsAcRef.current = checkIsAc;

  // Dismiss a 10s floating popup early (it stays inside the notifications list / bell)
  const dismissPopup = useCallback((id) => {
    setActivePopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Remove a notification completely
  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setActivePopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setActivePopups([]);
  }, []);

  // Add a newly generated event to both the notification list and 10s popup queue
  const triggerNewNotification = useCallback((item) => {
    // 1. Add / Update in notifications list
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== item.id);
      return [item, ...filtered];
    });

    // 2. Play subtle chime
    playChime(item.type);

    // 3. Add to active floating popups with a 10-second lifetime
    const popupEntry = {
      id: item.id,
      notification: item,
      durationMs: 10000,
      createdAt: Date.now(),
    };

    setActivePopups((prev) => {
      const filtered = prev.filter((p) => p.id !== item.id);
      return [popupEntry, ...filtered];
    });

    // Auto-dismiss floating popup after 10s
    setTimeout(() => {
      dismissPopup(item.id);
    }, 10000);
  }, [dismissPopup]);

  // Initial synchronization: fetch active unserved KOTs and DRAFT bills from backend with permission filters
  const syncActiveItems = useCallback(async () => {
    if (!user) return;

    try {
      const promises = [];

      // KOTs: fetch active (non-completed)
      promises.push(
        api.get('/kots', { skipCache: true })
          .then((res) => {
            const data = Array.isArray(res.data) ? res.data : res.data?.value || [];
            return data
              .filter((k) => k.status !== 'COMPLETED' && k.status !== 'CANCELLED')
              .filter((k) => {
                const isAc = checkIsAc(k);
                return canReceiveNotification('KOT', isAc);
              })
              .map((k) => {
                const isAc = checkIsAc(k);
                const tableNum = k.order?.table?.number || k.table?.number;
                const tableTyp = isAc ? 'AC' : 'NON-AC';
                const source = k.order?.orderSource || k.orderSource || '';
                const itemsCount = k.items?.length || k.itemsCount || 0;
                return {
                  id: `kot-${k.id}`,
                  type: 'KOT',
                  kotId: k.id,
                  orderId: k.orderId,
                  kotNumber: k.kotNumber,
                  title: `KOT #${k.kotNumber}`,
                  subtitle: `${tableNum ? `Table ${tableNum} (${tableTyp})` : (source || 'Order')} • ${itemsCount} items`,
                  status: k.status || 'NEW',
                  isAc,
                  tableNumber: tableNum,
                  tableType: tableTyp,
                  itemsCount,
                  orderIdForNav: k.order?.tableId || k.orderId,
                  timestamp: new Date(k.createdAt).getTime(),
                };
              });
          })
          .catch(() => [])
      );

      // Bills: fetch DRAFT bills
      promises.push(
        api.get('/bills', { params: { status: 'DRAFT', all: true }, skipCache: true })
          .then((res) => {
            const data = Array.isArray(res.data) ? res.data : res.data?.value || [];
            return data
              .filter((b) => b.status === 'DRAFT')
              .filter((b) => {
                const isAc = checkIsAc(b);
                return canReceiveNotification('BILL', isAc);
              })
              .map((b) => {
                const isAc = checkIsAc(b);
                const tableNum = b.order?.table?.number || b.table?.number;
                const total = Number(b.total || 0).toFixed(2);
                return {
                  id: `bill-${b.id}`,
                  type: 'BILL',
                  billId: b.id,
                  orderId: b.orderId,
                  billNumber: b.billNumber,
                  title: `Bill #${b.billNumber}`,
                  subtitle: `${tableNum ? `Table ${tableNum} (${isAc ? 'AC' : 'NON-AC'})` : 'Take Away'} • ₹${total} (Draft)`,
                  status: 'DRAFT',
                  isAc,
                  tableNumber: tableNum,
                  tableType: isAc ? 'AC' : 'NON-AC',
                  amount: Number(b.total || 0),
                  orderIdForNav: b.tableId,
                  timestamp: new Date(b.createdAt).getTime(),
                };
              });
          })
          .catch(() => [])
      );

      const [kotsList, billsList] = await Promise.all(promises);
      const combined = [...kotsList, ...billsList].sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(combined);
    } catch {
      // Ignore background sync errors
    }
  }, [user, checkIsAc, canReceiveNotification]);

  // Sync on initial load and user login / permission changes
  useEffect(() => {
    syncActiveItems();
  }, [syncActiveItems]);

  // Wire up global Real-time Socket Event Listeners
  useEffect(() => {
    if (!user) return;

    // Join required rooms
    realtime.join('kitchen');
    realtime.join('billing');
    realtime.join('orders');
    realtime.join('tables');

    // 1. KOT Created
    const unsubKotCreated = realtime.on('kot:created', (kot) => {
      if (!kot || !kot.id) return;
      const isAc = checkIsAcRef.current(kot);
      if (!canReceiveRef.current('KOT', isAc)) return;

      const tableNum = kot.order?.table?.number || kot.table?.number;
      const tableTyp = isAc ? 'AC' : 'NON-AC';
      const source = kot.order?.orderSource || kot.orderSource;
      const itemsCount = kot.items?.length || kot.itemsCount || 1;

      const notifItem = {
        id: `kot-${kot.id}`,
        type: 'KOT',
        kotId: kot.id,
        orderId: kot.orderId,
        kotNumber: kot.kotNumber,
        title: `KOT #${kot.kotNumber}`,
        subtitle: `${tableNum ? `Table ${tableNum} (${tableTyp})` : (source || 'Order')} • ${itemsCount} items`,
        status: kot.status || 'NEW',
        isAc,
        tableNumber: tableNum,
        tableType: tableTyp,
        itemsCount,
        orderIdForNav: kot.order?.tableId || kot.orderId,
        timestamp: Date.now(),
      };

      triggerNewNotification(notifItem);
    });

    // 2. KOT Updated (e.g. status advanced to READY, or all items SERVED / COMPLETED)
    const unsubKotUpdated = realtime.on('kot:updated', (data) => {
      if (!data) return;
      const kotId = data.kotId || data.id;
      const kotStatus = data.kotStatus || data.status;

      // If the KOT has been fully SERVED or COMPLETED, remove it automatically!
      if (kotStatus === 'COMPLETED' || kotStatus === 'SERVED') {
        setNotifications((prev) => prev.filter((n) => n.kotId !== kotId && n.id !== `kot-${kotId}`));
        setActivePopups((prev) => prev.filter((p) => p.notification?.kotId !== kotId && p.id !== `kot-${kotId}`));
      } else if (kotStatus) {
        // Update its status badge in the list
        setNotifications((prev) =>
          prev.map((n) =>
            (n.kotId === kotId || n.id === `kot-${kotId}`)
              ? { ...n, status: kotStatus }
              : n
          )
        );
      }
    });

    // 3. Bill Created
    const unsubBillCreated = realtime.on('bill:created', (bill) => {
      if (!bill || !bill.id) return;
      const isAc = checkIsAcRef.current(bill);
      if (!canReceiveRef.current('BILL', isAc)) return;

      const tableNum = bill.order?.table?.number || bill.table?.number;
      const total = Number(bill.total || 0).toFixed(2);

      const notifItem = {
        id: `bill-${bill.id}`,
        type: 'BILL',
        billId: bill.id,
        orderId: bill.orderId,
        billNumber: bill.billNumber,
        title: `Bill #${bill.billNumber}`,
        subtitle: `${tableNum ? `Table ${tableNum} (${isAc ? 'AC' : 'NON-AC'})` : 'Take Away'} • ₹${total} (Draft)`,
        status: 'DRAFT',
        isAc,
        tableNumber: tableNum,
        tableType: isAc ? 'AC' : 'NON-AC',
        amount: Number(bill.total || 0),
        orderIdForNav: bill.tableId,
        timestamp: Date.now(),
      };

      triggerNewNotification(notifItem);
    });

    // 4. Bill Finalized -> REMOVE Bill from notification list & remove its associated KOTs
    const unsubBillFinalized = realtime.on('bill:finalized', (bill) => {
      if (!bill || !bill.id) return;
      setNotifications((prev) =>
        prev.filter((n) =>
          n.billId !== bill.id &&
          n.id !== `bill-${bill.id}` &&
          (bill.orderId ? n.orderId !== bill.orderId : true)
        )
      );
      setActivePopups((prev) =>
        prev.filter((p) =>
          p.notification?.billId !== bill.id &&
          p.id !== `bill-${bill.id}` &&
          (bill.orderId ? p.notification?.orderId !== bill.orderId : true)
        )
      );
    });

    // 5. Bill Updated -> if CANCELLED or FINALIZED, remove; else update total
    const unsubBillUpdated = realtime.on('bill:updated', (bill) => {
      if (!bill || !bill.id) return;
      if (bill.status === 'FINALIZED' || bill.status === 'CANCELLED') {
        setNotifications((prev) => prev.filter((n) => n.billId !== bill.id && n.id !== `bill-${bill.id}`));
        setActivePopups((prev) => prev.filter((p) => p.notification?.billId !== bill.id && p.id !== `bill-${bill.id}`));
      } else {
        setNotifications((prev) =>
          prev.map((n) =>
            (n.billId === bill.id || n.id === `bill-${bill.id}`)
              ? {
                  ...n,
                  amount: Number(bill.total || 0),
                  subtitle: `${n.tableNumber ? `Table ${n.tableNumber}` : 'Take Away'} • ₹${Number(bill.total || 0).toFixed(2)} (${bill.status})`,
                  status: bill.status,
                }
              : n
          )
        );
      }
    });

    // 6. Order Updated -> if COMPLETED or CANCELLED, remove related items
    const unsubOrderUpdated = realtime.on('order:updated', (order) => {
      if (!order || !order.id) return;
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        setNotifications((prev) => prev.filter((n) => n.orderId !== order.id));
        setActivePopups((prev) => prev.filter((p) => p.notification?.orderId !== order.id));
      }
    });

    return () => {
      unsubKotCreated();
      unsubKotUpdated();
      unsubBillCreated();
      unsubBillFinalized();
      unsubBillUpdated();
      unsubOrderUpdated();
    };
  }, [user, triggerNewNotification]);

  const value = {
    notifications,
    activePopups,
    unreadCount: notifications.length,
    kotCount: notifications.filter((n) => n.type === 'KOT').length,
    billCount: notifications.filter((n) => n.type === 'BILL').length,
    dismissPopup,
    clearNotification,
    clearAll,
    syncActiveItems,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
