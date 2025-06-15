import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { LocalLoginRequest, OAuthProviders, PasswordChangeRequest, CompleteProfileRequest } from '../types';

// Get ServiceManager instance at module level
const serviceManager = ServiceManager.getInstance();

export const useAuth = () => {
  // Get session data from store
  const session = useAppStore((state) => state.session);
  const accounts = useAppStore((state) => state.accounts);
  const tempToken = useAppStore((state) => state.tempToken);

  // Get session actions
  const setCurrentAccount = useAppStore((state) => state.setCurrentAccount);
  const clearSession = useAppStore((state) => state.clearSession);
  const refreshSession = useAppStore((state) => state.initializeSession);

  // Derived authentication state
  const isAuthenticated = session.hasSession && session.isValid && session.accountIds.length > 0;
  const currentAccount = session.currentAccountId ? accounts.get(session.currentAccountId) : null;

  // ============================================================================
  // Core Authentication
  // ============================================================================

  const login = async (data: LocalLoginRequest) => {
    serviceManager.ensureInitialized();
    const result = await serviceManager.authService.localLogin(data);

    if (!result.requiresTwoFactor) {
      // Refresh session on successful login
      await refreshSession();
    }

    return result;
  };

  const logout = async (accountId?: string) => {
    const targetAccountId = accountId || session.currentAccountId;
    if (!targetAccountId) throw new Error('No account ID to logout');

    serviceManager.ensureInitialized();
    await serviceManager.authService.logout(targetAccountId);
    await refreshSession();
  };

  const logoutAll = async () => {
    if (session.accountIds.length === 0) return;

    serviceManager.ensureInitialized();
    await serviceManager.authService.logoutAll(session.accountIds);
    clearSession();
  };

  // ============================================================================
  // Signup Flow
  // ============================================================================

  const requestEmailVerification = async (email: string) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.requestEmailVerification({ email });
  };

  const completeProfile = async (token: string, data: CompleteProfileRequest) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.completeProfile(token, data);
  };

  const getSignupStatus = async (email?: string, token?: string) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.getSignupStatus(email, token);
  };

  const cancelSignup = async (email: string) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.cancelSignup({ email });
  };

  // ============================================================================
  // Password Management
  // ============================================================================

  const requestPasswordReset = async (email: string) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.requestPasswordReset({ email });
  };

  const changePassword = async (accountId: string, data: PasswordChangeRequest) => {
    serviceManager.ensureInitialized();
    return serviceManager.authService.changePassword(accountId, data);
  };

  // ============================================================================
  // OAuth Authentication
  // ============================================================================

  const startOAuthSignup = (provider: OAuthProviders) => {
    serviceManager.ensureInitialized();
    serviceManager.authService.redirectToOAuthSignup(provider);
  };

  const startOAuthSignin = (provider: OAuthProviders) => {
    serviceManager.ensureInitialized();
    serviceManager.authService.redirectToOAuthSignin(provider);
  };

  // ============================================================================
  // Account Management
  // ============================================================================

  const switchAccount = async (accountId: string) => {
    return setCurrentAccount(accountId);
  };

  // ============================================================================
  // Google Permissions
  // ============================================================================

  const requestGooglePermission = (scopeNames: string[]) => {
    if (!currentAccount?.id) throw new Error('No current account ID');
    serviceManager.ensureInitialized();
    serviceManager.authService.requestGooglePermission(currentAccount.id, scopeNames);
  };

  const reauthorizePermissions = () => {
    if (!currentAccount?.id) throw new Error('No current account ID');
    serviceManager.ensureInitialized();
    serviceManager.authService.reauthorizePermissions(currentAccount.id);
  };

  return {
    // Authentication state
    session,
    isAuthenticated,
    currentAccount,
    accounts: Array.from(accounts.values()),
    tempToken,

    // Core authentication
    login,
    logout,
    logoutAll,

    // Signup flow
    requestEmailVerification,
    completeProfile,
    getSignupStatus,
    cancelSignup,

    // Password management
    requestPasswordReset,
    changePassword,

    // OAuth authentication
    startOAuthSignup,
    startOAuthSignin,

    // Account management
    switchAccount,
    setCurrentAccount,

    // Google permissions
    requestGooglePermission,
    reauthorizePermissions,

    // Session management
    refreshSession,
    clearSession,
  };
};
