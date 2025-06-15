import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  Account,
  GetAccountSessionResponse,
  LoadingState,
  SessionAccount,
  Notification,
  CreateNotificationRequest,
  AccountSessionInfo,
} from '../types';
import { enableMapSet } from 'immer';
import { ServiceManager } from '../services/ServiceManager';

enableMapSet();

// ============================================================================
// Simplified App State - Session-focused only
// ============================================================================

interface AppState {
  // Session state with loading management
  session: {
    hasSession: boolean;
    accountIds: string[];
    currentAccountId: string | null;
    isValid: boolean;
    loadingState: LoadingState;
    error: string | null;
  };

  // Simple account data cache (no individual loading states)
  accounts: Map<string, Account>;

  // Simple notification cache by account
  notifications: Map<string, Notification[]>;

  // Temporary token for 2FA flows
  tempToken: string | null;
}

// ============================================================================
// App Actions - Essential only
// ============================================================================

interface AppActions {
  // ============================================================================
  // Session Management
  // ============================================================================
  initializeSession: () => Promise<void>;
  loadSession: () => Promise<AccountSessionInfo>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearSession: () => void;

  // ============================================================================
  // Account Management (simple operations)
  // ============================================================================
  loadAccount: (accountId: string) => Promise<Account>;
  loadSessionAccountsData: (accountIds?: string[]) => Promise<SessionAccount[]>;
  updateAccount: (accountId: string, updates: Partial<Account>) => void;
  removeAccount: (accountId: string) => void;

  // ============================================================================
  // Notifications (simplified operations)
  // ============================================================================
  loadNotifications: (accountId: string) => Promise<Notification[]>;
  createNotification: (accountId: string, notification: CreateNotificationRequest) => Promise<Notification>;
  markNotificationAsRead: (accountId: string, notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: (accountId: string) => Promise<void>;
  deleteNotification: (accountId: string, notificationId: string) => Promise<void>;
  deleteAllNotifications: (accountId: string) => Promise<void>;

  // ============================================================================
  // State Management (simplified)
  // ============================================================================
  setTempToken: (token: string) => void;
  clearTempToken: () => void;
  clearSessionError: () => void;

  // ============================================================================
  // Helper methods (session-focused only)
  // ============================================================================
  isSessionLoading: () => boolean;
  isSessionReady: () => boolean;
  isSessionIdle: () => boolean;
  isSessionError: () => boolean;

  // ============================================================================
  // Reset methods (session only)
  // ============================================================================
  resetSessionState: () => void;
}

// ============================================================================
// Service Management + Loading Cache
// ============================================================================

// Get singleton service manager instance
const serviceManager = ServiceManager.getInstance();

// Cache for ongoing API requests to prevent duplicate calls
const loadingCache = new Map<string, Promise<any>>();

// Helper function to ensure single concurrent call per key
const singleCall = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (loadingCache.has(key)) {
    return loadingCache.get(key) as Promise<T>;
  }

  const promise = fn().finally(() => {
    loadingCache.delete(key);
  });

  loadingCache.set(key, promise);
  return promise;
};

// ============================================================================
// Store Implementation (type-only, implementation would follow)
// ============================================================================

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // ============================================================================
      // Initial State (simplified)
      // ============================================================================
      session: {
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
        loadingState: LoadingState.IDLE,
        error: null,
      },

      accounts: new Map(),
      notifications: new Map(),
      tempToken: null,

      // ============================================================================
      // Session Management Implementation
      // ============================================================================
      loadSession: async () => {
        serviceManager.ensureInitialized();

        // Use singleCall to prevent duplicate session loading
        return singleCall('session', async () => {
          try {
            const response: GetAccountSessionResponse = await serviceManager.authService.getAccountSession();

            // Update session data (but not loading state)
            set((state) => {
              state.session.hasSession = response.session.hasSession;
              state.session.accountIds = response.session.accountIds;
              state.session.currentAccountId = response.session.currentAccountId;
              state.session.isValid = response.session.isValid;
              // Don't update loadingState or error - that's handled by initializeSession
            });

            return response.session;
          } catch (error) {
            throw error;
          }
        });
      },

      initializeSession: async () => {
        serviceManager.ensureInitialized();

        set((state) => {
          state.session.loadingState = LoadingState.LOADING;
          state.session.error = null;
        });

        try {
          // Use the separate loadSession function
          await get().loadSession();

          set((state) => {
            state.session = {
              ...state.session,
              loadingState: LoadingState.READY,
              error: null,
            };
          });

          // Load account data if session has accounts
          if (get().session.accountIds.length > 0) {
            try {
              await get().loadSessionAccountsData(get().session.accountIds);
            } catch (error) {
              console.warn('Failed to load session accounts data:', error);
            }
          }
        } catch (error) {
          set((state) => {
            state.session.loadingState = LoadingState.ERROR;
            state.session.error = error instanceof Error ? error.message : 'Failed to load session';
          });
          throw error;
        }
      },

      // ============================================================================
      // Helper Methods
      // ============================================================================
      isSessionLoading: () => get().session.loadingState === LoadingState.LOADING,
      isSessionReady: () => get().session.loadingState === LoadingState.READY,
      isSessionIdle: () => get().session.loadingState === LoadingState.IDLE,
      isSessionError: () => get().session.loadingState === LoadingState.ERROR,

      clearSessionError: () => {
        set((state) => {
          state.session.error = null;
        });
      },

      resetSessionState: () => {
        set((state) => {
          state.session.loadingState = LoadingState.IDLE;
          state.session.error = null;
        });
      },

      // ============================================================================
      // State Management
      // ============================================================================
      setTempToken: (token: string) => {
        set((state) => {
          state.tempToken = token;
        });
      },

      clearTempToken: () => {
        set((state) => {
          state.tempToken = null;
        });
      },

      clearSession: () => {
        set((state) => {
          state.session = {
            hasSession: false,
            accountIds: [],
            currentAccountId: null,
            isValid: false,
            loadingState: LoadingState.IDLE,
            error: null,
          };
          state.accounts.clear();
          state.notifications.clear();
          state.tempToken = null;
        });
      },

      // ============================================================================
      // Placeholder implementations (other methods would be implemented similarly)
      // ============================================================================
      setCurrentAccount: async (accountId: string | null) => {
        serviceManager.ensureInitialized();

        set((state) => {
          state.session.loadingState = LoadingState.LOADING;
          state.session.error = null;
        });

        try {
          await serviceManager.authService.setCurrentAccountInSession(accountId);

          set((state) => {
            state.session.currentAccountId = accountId;
            state.session.loadingState = LoadingState.READY;
          });
        } catch (error) {
          set((state) => {
            state.session.error = error instanceof Error ? error.message : 'Failed to set current account';
            state.session.loadingState = LoadingState.ERROR;
          });
          throw error;
        }
      },

      refreshSession: async () => {
        return get().initializeSession();
      },

      loadAccount: async (accountId: string) => {
        serviceManager.ensureInitialized();

        // Use singleCall to prevent duplicate requests for same account
        return singleCall(`account:${accountId}`, async () => {
          try {
            const account = await serviceManager.accountService.getAccount(accountId);

            set((state) => {
              state.accounts.set(accountId, account);
            });

            return account;
          } catch (error) {
            throw error;
          }
        });
      },

      loadSessionAccountsData: async (accountIds?: string[]) => {
        serviceManager.ensureInitialized();

        // Use singleCall for session accounts data
        const cacheKey = `session-accounts:${accountIds?.join(',') || 'all'}`;

        return singleCall(cacheKey, async () => {
          try {
            const accountsData = await serviceManager.authService.getSessionAccountsData(accountIds);

            set((state) => {
              accountsData.forEach((account) => {
                state.accounts.set(account.id, account as Account);
              });
            });

            return accountsData;
          } catch (error) {
            throw error;
          }
        });
      },

      updateAccount: (accountId: string, updates: Partial<Account>) => {
        set((state) => {
          const existing = state.accounts.get(accountId);
          if (existing) {
            state.accounts.set(accountId, { ...existing, ...updates });
          }
        });
      },

      removeAccount: (accountId: string) => {
        set((state) => {
          state.accounts.delete(accountId);
          state.notifications.delete(accountId);
          state.session.accountIds = state.session.accountIds.filter((id) => id !== accountId);
          if (state.session.currentAccountId === accountId) {
            state.session.currentAccountId = state.session.accountIds[0] || null;
          }
        });
      },

      // ============================================================================
      // Notification Management (simplified)
      // ============================================================================
      loadNotifications: async (accountId: string) => {
        serviceManager.ensureInitialized();

        // Use singleCall to prevent duplicate notification loading
        return singleCall(`notifications:${accountId}`, async () => {
          try {
            const result = await serviceManager.notificationService.getNotifications(accountId);

            set((state) => {
              state.notifications.set(accountId, result.notifications);
            });

            return result.notifications;
          } catch (error) {
            throw error;
          }
        });
      },

      createNotification: async (accountId: string, notification: CreateNotificationRequest) => {
        serviceManager.ensureInitialized();

        try {
          const result = await serviceManager.notificationService.createNotification(accountId, notification);

          set((state) => {
            const existing = state.notifications.get(accountId) || [];
            state.notifications.set(accountId, [result, ...existing]);
          });

          return result;
        } catch (error) {
          throw error;
        }
      },

      markNotificationAsRead: async (accountId: string, notificationId: string) => {
        serviceManager.ensureInitialized();

        try {
          await serviceManager.notificationService.markNotificationAsRead(accountId, notificationId);

          set((state) => {
            const notifications = state.notifications.get(accountId) || [];
            const updated = notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
            state.notifications.set(accountId, updated);
          });
        } catch (error) {
          throw error;
        }
      },

      markAllNotificationsAsRead: async (accountId: string) => {
        serviceManager.ensureInitialized();

        try {
          await serviceManager.notificationService.markAllNotificationsAsRead(accountId);

          set((state) => {
            const notifications = state.notifications.get(accountId) || [];
            const updated = notifications.map((n) => ({ ...n, read: true }));
            state.notifications.set(accountId, updated);
          });
        } catch (error) {
          throw error;
        }
      },

      deleteNotification: async (accountId: string, notificationId: string) => {
        serviceManager.ensureInitialized();

        try {
          await serviceManager.notificationService.deleteNotification(accountId, notificationId);

          set((state) => {
            const notifications = state.notifications.get(accountId) || [];
            const updated = notifications.filter((n) => n.id !== notificationId);
            state.notifications.set(accountId, updated);
          });
        } catch (error) {
          throw error;
        }
      },

      deleteAllNotifications: async (accountId: string) => {
        serviceManager.ensureInitialized();

        try {
          await serviceManager.notificationService.deleteAllNotifications(accountId);

          set((state) => {
            state.notifications.set(accountId, []);
          });
        } catch (error) {
          throw error;
        }
      },
    })),
  ),
);
