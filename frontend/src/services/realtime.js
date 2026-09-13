import { io } from 'socket.io-client';

class RealtimeService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.rooms = new Set();
    this.isConnected = false;
    this.isInitialized = false;
  }

  /**
   * Determine the WebSocket server URL
   */
  getServerUrl() {
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    if (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')) {
      // Extract origin from API URL (e.g. http://localhost:5000/api -> http://localhost:5000)
      try {
        const url = new URL(rawApiUrl);
        return url.origin;
      } catch (e) {
        return window.location.origin;
      }
    }
    // Default to current origin (proxied by Vite or served from same origin)
    return window.location.origin;
  }

  /**
   * Initialize or reconnect Socket.io client
   */
  init() {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.socket && this.socket.connected) {
      return;
    }

    const serverUrl = this.getServerUrl();

    this.socket = io(serverUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      // Re-join any tracked rooms
      for (const room of this.rooms) {
        this.socket.emit('join', room);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', (err) => {
      this.isConnected = false;
      // If token expired, try to refresh or reconnect on next auth event
      if (err?.message?.includes('Authentication')) {
        const newToken = localStorage.getItem('accessToken');
        if (newToken && newToken !== token && this.socket) {
          this.socket.auth = { token: newToken };
          this.socket.connect();
        }
      }
    });

    // Wire up all registered event listeners
    this.socket.onAny((event, ...args) => {
      const handlers = this.listeners.get(event);
      if (handlers && handlers.size > 0) {
        for (const handler of handlers) {
          try {
            handler(...args);
          } catch (handlerErr) {
            console.error(`Error in realtime handler for "${event}":`, handlerErr);
          }
        }
      }
    });

    this.isInitialized = true;
  }

  /**
   * Subscribe to a real-time event
   * @param {string} event - Event name (e.g. 'kot:created', 'table:updated')
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe cleanup function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (!this.socket || !this.socket.connected) {
      this.init();
    }

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from a real-time event
   */
  off(event, callback) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Join a room (e.g. 'kitchen', 'billing', 'tables')
   */
  join(room) {
    this.rooms.add(room);
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', room);
    }
  }

  /**
   * Leave a room
   */
  leave(room) {
    this.rooms.delete(room);
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave', room);
    }
  }

  /**
   * Disconnect the socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isInitialized = false;
    }
  }
}

export const realtime = new RealtimeService();
export default realtime;
