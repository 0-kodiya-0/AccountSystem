import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AuthService } from '../services/AuthService';
import { AccountService } from '../services/AccountService';
import { NotificationService } from '../services/NotificationService';
import { GoogleService } from '../services/GoogleService';
import {
  Account,
  GetAccountSessionResponse,
  AccountSessionInfo,
  LocalLoginRequest,
  LocalLoginResponse,
  LocalSignupRequest,
  TwoFactorVerifyRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  PasswordChangeRequest,
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
  OAuthProviders,
  Notification,
  CreateNotificationRequest,
  NotificationListResponse,
  GoogleTokenInfo,
  TokenCheckResponse,
  LoadingState,
} from '../types';
import { enableMapSet } from 'immer';

enableMapSet();

interface AppState {
  session: {
    hasSession: boolean;
    accountIds: string[];
    currentAccountId: string | null;
    isValid: boolean;
    loadingState: LoadingState;
    error: string | null;
  };

  accounts: {
    data: Map<string, Account>;
    loadingStates: Map<string, LoadingState>;
    errors: Map<string, string>;
  };

  ui: {
    initializationState: LoadingState;
    globalError: string | null;
  };

  notifications: {
    byAccount: Map<string, Notification[]>;
    unreadCounts: Map<string, number>;
    loadingStates: Map<string, LoadingState>;
    errors: Map<string, string>;
  };

  tempToken: string | null;
}

interface AppActions {
  initializeSession: () => Promise<void>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearSession: () => void;

  loadAccount: (accountId: string) => Promise<Account>;
  updateAccount: (accountId: string, updates: Partial<Account>) => void;
  removeAccount: (accountId: string) => void;

  localSignup: (data: LocalSignupRequest) => Promise<{ accountId: string }>;
  localLogin: (data: LocalLoginRequest) => Promise<LocalLoginResponse>;
  verifyTwoFactor: (data: TwoFactorVerifyRequest) => Promise<LocalLoginResponse>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, data: ResetPasswordRequest) => Promise<void>;
  changePassword: (accountId: string, data: PasswordChangeRequest) => Promise<void>;
  setupTwoFactor: (accountId: string, data: TwoFactorSetupRequest) => Promise<TwoFactorSetupResponse>;
  verifyTwoFactorSetup: (accountId: string, token: string) => Promise<void>;
  generateBackupCodes: (accountId: string, password: string) => Promise<string[]>;

  startOAuthSignup: (provider: OAuthProviders) => void;
  startOAuthSignin: (provider: OAuthProviders) => void;

  logout: (accountId?: string) => void;
  logoutAll: () => void;

  loadNotifications: (
    accountId: string,
    options?: {
      read?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ) => Promise<NotificationListResponse>;
  createNotification: (accountId: string, notification: CreateNotificationRequest) => Promise<Notification>;
  markNotificationAsRead: (accountId: string, notificationId: string) => Promise<Notification>;
  markAllNotificationsAsRead: (accountId: string) => Promise<number>;
  updateNotification: (
    accountId: string,
    notificationId: string,
    updates: Partial<Notification>,
  ) => Promise<Notification>;
  deleteNotification: (accountId: string, notificationId: string) => Promise<void>;
  deleteAllNotifications: (accountId: string) => Promise<number>;

  requestGooglePermission: (accountId: string, scopeNames: string[]) => void;
  reauthorizePermissions: (accountId: string) => void;
  getGoogleTokenInfo: (accountId: string) => Promise<GoogleTokenInfo>;
  checkGoogleScopes: (accountId: string, scopeNames: string[]) => Promise<TokenCheckResponse>;

  setTempToken: (token: string) => void;
  clearTempToken: () => void;
  setGlobalError: (error: string | null) => void;
  clearError: (key: string) => void;

  // Helper methods for checking states
  isSessionLoading: () => boolean;
  isSessionReady: () => boolean;
  isSessionIdle: () => boolean;
  isAccountLoading: (accountId: string) => boolean;
  isAccountReady: (accountId: string) => boolean;
  isNotificationsLoading: (accountId: string) => boolean;
  isNotificationsReady: (accountId: string) => boolean;

  // Reset methods
  resetAccountState: (accountId: string) => void;
  resetSessionState: () => void;
  resetNotificationsState: (accountId: string) => void;

  _setServices: (services: {
    authService: AuthService;
    accountService: AccountService;
    notificationService: NotificationService;
    googleService: GoogleService;
  }) => void;
}

interface Services {
  authService: AuthService;
  accountService: AccountService;
  notificationService: NotificationService;
  googleService: GoogleService;
}

let services: Services | null = null;

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      session: {
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
        loadingState: LoadingState.IDLE,
        error: null,
      },

      accounts: {
        data: new Map(),
        loadingStates: new Map(),
        errors: new Map(),
      },

      ui: {
        initializationState: LoadingState.IDLE,
        globalError: null,
      },

      notifications: {
        byAccount: new Map(),
        unreadCounts: new Map(),
        loadingStates: new Map(),
        errors: new Map(),
      },

      tempToken: null,

      _setServices: (newServices: Services) => {
        services = newServices;
      },

      initializeSession: async () => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.session.loadingState = LoadingState.LOADING;
          state.session.error = null;
          state.ui.initializationState = LoadingState.LOADING;
        });

        try {
          const response = await services.authService.getAccountSession();

          set((state) => {
            state.session = {
              ...response.session,
              loadingState: LoadingState.READY,
              error: null,
            };

            state.ui.initializationState = LoadingState.READY;

            if (response.accounts) {
              response.accounts.forEach((account) => {
                state.accounts.data.set(account.id, account as Account);
                state.accounts.loadingStates.set(account.id, LoadingState.READY);
              });
            }
          });
        } catch (error) {
          set((state) => {
            state.session.loadingState = LoadingState.ERROR;
            state.session.error = error instanceof Error ? error.message : 'Failed to load session';
            state.ui.initializationState = LoadingState.ERROR;
          });
          throw error;
        }
      },

      setCurrentAccount: async (accountId: string | null) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.session.loadingState = LoadingState.LOADING;
        });

        try {
          await services.authService.setCurrentAccountInSession(accountId);

          set((state) => {
            state.session.currentAccountId = accountId;
            state.session.loadingState = LoadingState.READY;
          });
        } catch (error) {
          set((state) => {
            state.session.error = error instanceof Error ? error.message : 'Failed to set current account';
            state.session.loadingState = LoadingState.ERROR;
          });
        }
      },

      refreshSession: async () => {
        return get().initializeSession();
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

          state.accounts.data.clear();
          state.accounts.loadingStates.clear();
          state.accounts.errors.clear();

          state.notifications.byAccount.clear();
          state.notifications.unreadCounts.clear();
          state.notifications.loadingStates.clear();
          state.notifications.errors.clear();

          state.tempToken = null;
          state.ui.initializationState = LoadingState.IDLE;
        });
      },

      loadAccount: async (accountId: string) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.accounts.loadingStates.set(accountId, LoadingState.LOADING);
          state.accounts.errors.delete(accountId);
        });

        try {
          const account = await services.accountService.getAccount(accountId);

          set((state) => {
            state.accounts.data.set(accountId, account);
            state.accounts.loadingStates.set(accountId, LoadingState.READY);
          });

          return account;
        } catch (error) {
          set((state) => {
            state.accounts.loadingStates.set(accountId, LoadingState.ERROR);
            state.accounts.errors.set(accountId, error instanceof Error ? error.message : 'Failed to load account');
          });
          throw error;
        }
      },

      updateAccount: (accountId: string, updates: Partial<Account>) => {
        set((state) => {
          const existing = state.accounts.data.get(accountId);
          if (existing) {
            state.accounts.data.set(accountId, { ...existing, ...updates });
          }
        });
      },

      removeAccount: (accountId: string) => {
        set((state) => {
          state.accounts.data.delete(accountId);
          state.accounts.loadingStates.delete(accountId);
          state.accounts.errors.delete(accountId);
          state.notifications.byAccount.delete(accountId);
          state.notifications.unreadCounts.delete(accountId);
          state.notifications.loadingStates.delete(accountId);
          state.notifications.errors.delete(accountId);

          state.session.accountIds = state.session.accountIds.filter((id) => id !== accountId);
          if (state.session.currentAccountId === accountId) {
            state.session.currentAccountId = state.session.accountIds[0] || null;
          }
        });
      },

      localSignup: async (data: LocalSignupRequest) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.ui.globalError = null;
        });

        try {
          const result = await services.authService.localSignup(data);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Signup failed';
          set((state) => {
            state.ui.globalError = errorMessage;
          });
          throw error;
        }
      },

      localLogin: async (data: LocalLoginRequest) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.ui.globalError = null;
        });

        try {
          const result = await services.authService.localLogin(data);

          if (result.requiresTwoFactor) {
            set((state) => {
              state.tempToken = result.tempToken!;
            });
            return result;
          } else {
            await get().refreshSession();
          }

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set((state) => {
            state.ui.globalError = errorMessage;
          });
          throw error;
        }
      },

      verifyTwoFactor: async (data: TwoFactorVerifyRequest) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.ui.globalError = null;
        });

        try {
          const result = await services.authService.verifyTwoFactor(data);

          if (result.accountId) {
            set((state) => {
              state.tempToken = null;
            });
            await get().refreshSession();
          }

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '2FA verification failed';
          set((state) => {
            state.ui.globalError = errorMessage;
          });
          throw error;
        }
      },

      requestPasswordReset: async (email: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          await services.authService.requestPasswordReset(email);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Password reset request failed';
          set((state) => {
            state.ui.globalError = errorMessage;
          });
          throw error;
        }
      },

      resetPassword: async (token: string, data: ResetPasswordRequest) => {
        if (!services) throw new Error('Services not initialized');

        try {
          await services.authService.resetPassword(token, data);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
          set((state) => {
            state.ui.globalError = errorMessage;
          });
          throw error;
        }
      },

      changePassword: async (accountId: string, data: PasswordChangeRequest) => {
        if (!services) throw new Error('Services not initialized');

        try {
          await services.authService.changePassword(accountId, data);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Password change failed';
          set((state) => {
            state.accounts.errors.set(accountId, errorMessage);
          });
          throw error;
        }
      },

      setupTwoFactor: async (accountId: string, data: TwoFactorSetupRequest) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.authService.setupTwoFactor(accountId, data);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '2FA setup failed';
          set((state) => {
            state.accounts.errors.set(accountId, errorMessage);
          });
          throw error;
        }
      },

      verifyTwoFactorSetup: async (accountId: string, token: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          await services.authService.verifyTwoFactorSetup(accountId, token);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '2FA verification failed';
          set((state) => {
            state.accounts.errors.set(accountId, errorMessage);
          });
          throw error;
        }
      },

      generateBackupCodes: async (accountId: string, password: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.authService.generateBackupCodes(accountId, password);
          return result.backupCodes;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Backup code generation failed';
          set((state) => {
            state.accounts.errors.set(accountId, errorMessage);
          });
          throw error;
        }
      },

      startOAuthSignup: (provider: OAuthProviders) => {
        if (!services) throw new Error('Services not initialized');
        services.authService.redirectToOAuthSignup(provider);
      },

      startOAuthSignin: (provider: OAuthProviders) => {
        if (!services) throw new Error('Services not initialized');
        services.authService.redirectToOAuthSignin(provider);
      },

      logout: (accountId?: string) => {
        if (!services) throw new Error('Services not initialized');
        const targetAccountId = accountId || get().session.currentAccountId;

        if (targetAccountId) {
          services.authService.logout(targetAccountId);
        }
      },

      logoutAll: () => {
        if (!services) throw new Error('Services not initialized');
        const { accountIds } = get().session;

        if (accountIds.length > 0) {
          services.authService.logoutAll(accountIds);
        }
      },

      loadNotifications: async (accountId: string, options = {}) => {
        if (!services) throw new Error('Services not initialized');

        set((state) => {
          state.notifications.loadingStates.set(accountId, LoadingState.LOADING);
          state.notifications.errors.delete(accountId);
        });

        try {
          const result = await services.notificationService.getNotifications(accountId, options);

          set((state) => {
            state.notifications.byAccount.set(accountId, result.notifications);
            state.notifications.unreadCounts.set(accountId, result.unreadCount);
            state.notifications.loadingStates.set(accountId, LoadingState.READY);
          });

          return result;
        } catch (error) {
          set((state) => {
            state.notifications.loadingStates.set(accountId, LoadingState.ERROR);
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to load notifications',
            );
          });
          throw error;
        }
      },

      createNotification: async (accountId: string, notification: CreateNotificationRequest) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.notificationService.createNotification(accountId, notification);

          set((state) => {
            const existing = state.notifications.byAccount.get(accountId) || [];
            state.notifications.byAccount.set(accountId, [result, ...existing]);

            if (!result.read) {
              const currentUnread = state.notifications.unreadCounts.get(accountId) || 0;
              state.notifications.unreadCounts.set(accountId, currentUnread + 1);
            }
          });

          return result;
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to create notification',
            );
          });
          throw error;
        }
      },

      markNotificationAsRead: async (accountId: string, notificationId: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.notificationService.markNotificationAsRead(accountId, notificationId);

          set((state) => {
            const notifications = state.notifications.byAccount.get(accountId) || [];
            const updated = notifications.map((n) => (n.id === notificationId ? result : n));
            state.notifications.byAccount.set(accountId, updated);

            const currentUnread = state.notifications.unreadCounts.get(accountId) || 0;
            state.notifications.unreadCounts.set(accountId, Math.max(0, currentUnread - 1));
          });

          return result;
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to mark notification as read',
            );
          });
          throw error;
        }
      },

      markAllNotificationsAsRead: async (accountId: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.notificationService.markAllNotificationsAsRead(accountId);

          set((state) => {
            const notifications = state.notifications.byAccount.get(accountId) || [];
            const updated = notifications.map((n) => ({ ...n, read: true }));
            state.notifications.byAccount.set(accountId, updated);
            state.notifications.unreadCounts.set(accountId, 0);
          });

          return result.modifiedCount;
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to mark all notifications as read',
            );
          });
          throw error;
        }
      },

      updateNotification: async (accountId: string, notificationId: string, updates: Partial<Notification>) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.notificationService.updateNotification(accountId, notificationId, updates);

          set((state) => {
            const notifications = state.notifications.byAccount.get(accountId) || [];
            const updated = notifications.map((n) => (n.id === notificationId ? result : n));
            state.notifications.byAccount.set(accountId, updated);
          });

          return result;
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to update notification',
            );
          });
          throw error;
        }
      },

      deleteNotification: async (accountId: string, notificationId: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          await services.notificationService.deleteNotification(accountId, notificationId);

          set((state) => {
            const notifications = state.notifications.byAccount.get(accountId) || [];
            const notification = notifications.find((n) => n.id === notificationId);
            const updated = notifications.filter((n) => n.id !== notificationId);
            state.notifications.byAccount.set(accountId, updated);

            if (notification && !notification.read) {
              const currentUnread = state.notifications.unreadCounts.get(accountId) || 0;
              state.notifications.unreadCounts.set(accountId, Math.max(0, currentUnread - 1));
            }
          });
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to delete notification',
            );
          });
          throw error;
        }
      },

      deleteAllNotifications: async (accountId: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          const result = await services.notificationService.deleteAllNotifications(accountId);

          set((state) => {
            state.notifications.byAccount.set(accountId, []);
            state.notifications.unreadCounts.set(accountId, 0);
          });

          return result.deletedCount;
        } catch (error) {
          set((state) => {
            state.notifications.errors.set(
              accountId,
              error instanceof Error ? error.message : 'Failed to delete all notifications',
            );
          });
          throw error;
        }
      },

      requestGooglePermission: (accountId: string, scopeNames: string[]) => {
        if (!services) throw new Error('Services not initialized');
        services.authService.requestGooglePermission(accountId, scopeNames);
      },

      reauthorizePermissions: (accountId: string) => {
        if (!services) throw new Error('Services not initialized');
        services.authService.reauthorizePermissions(accountId);
      },

      getGoogleTokenInfo: async (accountId: string) => {
        if (!services) throw new Error('Services not initialized');

        try {
          return await services.googleService.getGoogleTokenInfo(accountId);
        } catch (error) {
          set((state) => {
            state.accounts.errors.set(accountId, error instanceof Error ? error.message : 'Failed to get token info');
          });
          throw error;
        }
      },

      checkGoogleScopes: async (accountId: string, scopeNames: string[]) => {
        if (!services) throw new Error('Services not initialized');

        try {
          return await services.googleService.checkGoogleScopes(accountId, scopeNames);
        } catch (error) {
          set((state) => {
            state.accounts.errors.set(accountId, error instanceof Error ? error.message : 'Failed to check scopes');
          });
          throw error;
        }
      },

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

      setGlobalError: (error: string | null) => {
        set((state) => {
          state.ui.globalError = error;
        });
      },

      clearError: (key: string) => {
        set((state) => {
          if (key === 'session') {
            state.session.error = null;
          } else if (key === 'global') {
            state.ui.globalError = null;
          } else {
            state.accounts.errors.delete(key);
            state.notifications.errors.delete(key);
          }
        });
      },

      // Helper methods for checking states
      isSessionLoading: () => get().session.loadingState === LoadingState.LOADING,
      isSessionReady: () => get().session.loadingState === LoadingState.READY,
      isSessionIdle: () => get().session.loadingState === LoadingState.IDLE,

      isAccountLoading: (accountId: string) => {
        return get().accounts.loadingStates.get(accountId) === LoadingState.LOADING;
      },

      isAccountReady: (accountId: string) => {
        return get().accounts.loadingStates.get(accountId) === LoadingState.READY;
      },

      isNotificationsLoading: (accountId: string) => {
        return get().notifications.loadingStates.get(accountId) === LoadingState.LOADING;
      },

      isNotificationsReady: (accountId: string) => {
        return get().notifications.loadingStates.get(accountId) === LoadingState.READY;
      },

      // Reset methods
      resetAccountState: (accountId: string) => {
        set((state) => {
          state.accounts.loadingStates.set(accountId, LoadingState.IDLE);
          state.accounts.errors.delete(accountId);
        });
      },

      resetSessionState: () => {
        set((state) => {
          state.session.loadingState = LoadingState.IDLE;
          state.session.error = null;
        });
      },

      resetNotificationsState: (accountId: string) => {
        set((state) => {
          state.notifications.loadingStates.set(accountId, LoadingState.IDLE);
          state.notifications.errors.delete(accountId);
        });
      },
    })),
  ),
);
