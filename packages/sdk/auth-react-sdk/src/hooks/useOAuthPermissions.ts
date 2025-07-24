import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { OAuthProviders, CallbackCode, CallbackData } from '../types';
import { parseApiError } from '../utils';

// OAuth permissions phases
type PermissionsPhase = 'idle' | 'requesting' | 'reauthorizing' | 'processing_callback' | 'completed' | 'failed';

interface PermissionsState {
  phase: PermissionsPhase;
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  lastProvider: OAuthProviders | null;
  lastScopes: string[] | null;
  // Callback result data
  callbackMessage: string | null;
  grantedScopes: string[] | null;
}

interface PermissionsOptions {
  autoProcessCallback?: boolean; // Whether to auto-process OAuth callbacks (default: true)
}

interface PermissionsReturn {
  // Account identification
  accountId: string | null;

  // Permissions state
  phase: PermissionsPhase;
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  retryCount: number;

  // Convenience getters
  isIdle: boolean;
  isRequesting: boolean;
  isReauthorizing: boolean;
  isProcessingCallback: boolean;
  isCompleted: boolean;
  isFailed: boolean;

  // Last operation info
  lastProvider: OAuthProviders | null;
  lastScopes: string[] | null;

  // Callback result data
  callbackMessage: string | null;
  grantedScopes: string[] | null;

  // Operations
  requestPermission: (
    provider: OAuthProviders,
    scopeNames: string[],
    callbackUrl: string,
  ) => Promise<{ success: boolean; message?: string }>;
  getPermissionUrl: (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => Promise<string | null>;
  reauthorizePermissions: (
    provider: OAuthProviders,
    callbackUrl: string,
  ) => Promise<{ success: boolean; message?: string }>;
  getReauthorizeUrl: (provider: OAuthProviders, callbackUrl: string) => Promise<string | null>;
  retry: () => Promise<{ success: boolean; message?: string }>;
  processCallbackFromUrl: () => Promise<{ success: boolean; message?: string }>;

  // Utilities
  clearError: () => void;
  reset: () => void;
  canRequest: boolean;
}

const INITIAL_STATE: PermissionsState = {
  phase: 'idle',
  loading: false,
  error: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  lastProvider: null,
  lastScopes: null,
  callbackMessage: null,
  grantedScopes: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export function useOAuthPermissions(accountId: string | null, options: PermissionsOptions = {}): PermissionsReturn {
  const { autoProcessCallback = true } = options;

  const authService = useAuthService();
  const [state, setState] = useState<PermissionsState>(INITIAL_STATE);

  // Refs for retry logic
  const lastCallbackUrlRef = useRef<string | null>(null);
  const lastScopeNamesRef = useRef<string[] | null>(null);
  const lastOperationRef = useRef<'request' | 'reauthorize' | 'callback' | null>(null);

  // Get account data from store to check if it's OAuth
  const accountType = useAppStore((state) => {
    if (!accountId) return null;
    const accountState = state.getAccountState(accountId);
    return accountState ? accountState.data?.accountType : null;
  });

  // Safe state update
  const safeSetState = useCallback((updater: (prev: PermissionsState) => PermissionsState) => {
    setState(updater);
  }, []);

  // Enhanced error handling
  const handleError = useCallback(
    (error: any, context: string) => {
      const apiError = parseApiError(error, context);

      safeSetState((prev) => ({
        ...prev,
        phase: 'failed',
        loading: false,
        error: apiError.message,
        lastAttemptTimestamp: Date.now(),
      }));

      return apiError.message;
    },
    [safeSetState],
  );

  // Handle OAuth callback from URL parameters
  const handleOAuthCallback = useCallback(
    async (isRetry = false): Promise<boolean> => {
      const urlParams = new URLSearchParams(window.location.search);

      const callbackData: CallbackData = {};
      urlParams.forEach((value, key) => {
        const decodedValue = decodeURIComponent(value);

        // Handle arrays - if value contains commas, split into array
        if (decodedValue.includes(',')) {
          callbackData[key] = decodedValue.split(',').map((s) => s.trim());
        } else {
          // Handle boolean values
          if (decodedValue === 'true') {
            callbackData[key] = true;
          } else if (decodedValue === 'false') {
            callbackData[key] = false;
          } else {
            callbackData[key] = decodedValue;
          }
        }
      });

      if (urlParams.size <= 0 || !callbackData.code) {
        return false;
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'processing_callback',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastOperationRef.current = 'callback';
        }

        // Handle based on callback code
        switch (callbackData.code) {
          case CallbackCode.OAUTH_PERMISSION_SUCCESS: {
            safeSetState((prev) => ({
              ...prev,
              phase: 'completed',
              loading: false,
              error: null,
              callbackMessage: callbackData.message || 'Permissions granted successfully!',
              grantedScopes: Array.isArray(callbackData.scopes)
                ? callbackData.scopes
                : typeof callbackData.scopes === 'string'
                  ? [callbackData.scopes]
                  : [],
              lastProvider: callbackData.provider || prev.lastProvider,
              retryCount: 0,
            }));

            return true;
          }

          case CallbackCode.OAUTH_PERMISSION_ERROR:
          case CallbackCode.OAUTH_ERROR:
          default: {
            const errorMessage = callbackData.error || 'OAuth permission request failed';

            safeSetState((prev) => ({
              ...prev,
              phase: 'failed',
              loading: false,
              error: errorMessage,
              lastAttemptTimestamp: Date.now(),
            }));

            return false;
          }
        }
      } catch (error) {
        handleError(error, 'Failed to process OAuth callback');
        console.error('OAuth callback processing error:', error);
        return false;
      } finally {
        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      }
    },
    [safeSetState, handleError],
  );

  const processCallbackFromUrl = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const success = await handleOAuthCallback();
    return {
      success,
      message: success ? 'OAuth callback processed successfully' : 'No valid callback found',
    };
  }, [handleOAuthCallback]);

  // Auto-detect and handle OAuth callback on mount
  useEffect(() => {
    if (autoProcessCallback) {
      handleOAuthCallback();
    }
  }, []); // Only run on mount

  // OAuth permissions operations
  const requestPermission = useCallback(
    async (
      provider: OAuthProviders,
      scopeNames: string[],
      callbackUrl: string,
      isRetry = false,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!accountId) {
        return { success: false, message: 'No account ID available' };
      }

      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for permission request');
        }

        safeSetState((prev) => ({
          ...prev,
          phase: 'requesting',
          loading: true,
          error: null,
          lastProvider: provider,
          lastScopes: scopeNames,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastCallbackUrlRef.current = callbackUrl;
          lastScopeNamesRef.current = scopeNames;
          lastOperationRef.current = 'request';
        }

        const response = await authService.generatePermissionUrl(provider, {
          accountId: accountId,
          scopeNames,
          callbackUrl,
        });

        // Set completed state before redirect
        safeSetState((prev) => ({
          ...prev,
          phase: 'requesting',
          loading: false,
          retryCount: 0,
        }));

        // Redirect to OAuth provider
        window.location.href = response.authorizationUrl;

        return { success: true, message: `Redirecting to ${provider} for permissions...` };
      } catch (error) {
        const message = handleError(error, 'Failed to request permission');
        return { success: false, message };
      }
    },
    [accountId, authService, handleError, safeSetState],
  );

  const getPermissionUrl = useCallback(
    async (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => {
      if (!accountId) return null;

      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for permission URL generation');
        }

        const response = await authService.generatePermissionUrl(provider, {
          accountId: accountId,
          scopeNames,
          callbackUrl,
        });
        return response.authorizationUrl;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get permission URL');
        safeSetState((prev) => ({ ...prev, error: apiError.message }));
        return null;
      }
    },
    [accountId, authService, safeSetState],
  );

  const reauthorizePermissions = useCallback(
    async (
      provider: OAuthProviders,
      callbackUrl: string,
      isRetry = false,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!accountId) {
        return { success: false, message: 'No account ID available' };
      }

      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for reauthorization');
        }

        safeSetState((prev) => ({
          ...prev,
          phase: 'reauthorizing',
          loading: true,
          error: null,
          lastProvider: provider,
          lastScopes: null, // Reauth doesn't specify scopes
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastCallbackUrlRef.current = callbackUrl;
          lastScopeNamesRef.current = null;
          lastOperationRef.current = 'reauthorize';
        }

        const response = await authService.generateReauthorizeUrl(provider, {
          accountId: accountId,
          callbackUrl,
        });

        if (response.authorizationUrl) {
          // Set reauthorizing state before redirect
          safeSetState((prev) => ({
            ...prev,
            phase: 'reauthorizing',
            loading: false,
            retryCount: 0,
          }));

          // Redirect to OAuth provider
          window.location.href = response.authorizationUrl;

          return { success: true, message: `Redirecting to ${provider} for reauthorization...` };
        } else {
          // No reauthorization needed
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            callbackMessage: response.message || 'No reauthorization needed',
            retryCount: 0,
          }));

          return { success: true, message: response.message || 'No reauthorization needed' };
        }
      } catch (error) {
        const message = handleError(error, 'Failed to reauthorize permissions');
        return { success: false, message };
      }
    },
    [accountId, authService, handleError, safeSetState],
  );

  const getReauthorizeUrl = useCallback(
    async (provider: OAuthProviders, callbackUrl: string) => {
      if (!accountId) return null;

      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for reauthorization URL generation');
        }

        const response = await authService.generateReauthorizeUrl(provider, {
          accountId: accountId,
          callbackUrl,
        });
        return response.authorizationUrl;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get reauthorize URL');
        safeSetState((prev) => ({ ...prev, error: apiError.message }));
        return null;
      }
    },
    [accountId, authService, safeSetState],
  );

  // Enhanced retry with cooldown and attempt limits
  const retry = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
      const message = `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`;
      safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
      return { success: false, message };
    }

    if (state.lastAttemptTimestamp && Date.now() - state.lastAttemptTimestamp < RETRY_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - state.lastAttemptTimestamp)) / 1000);
      const message = `Please wait ${remainingTime} seconds before retrying`;
      return { success: false, message };
    }

    safeSetState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }));

    // Retry the specific operation that failed
    switch (lastOperationRef.current) {
      case 'request':
        if (state.lastProvider && lastScopeNamesRef.current && lastCallbackUrlRef.current) {
          return requestPermission(state.lastProvider, lastScopeNamesRef.current, lastCallbackUrlRef.current, true);
        }
        break;
      case 'reauthorize':
        if (state.lastProvider && lastCallbackUrlRef.current) {
          return reauthorizePermissions(state.lastProvider, lastCallbackUrlRef.current, true);
        }
        break;
      case 'callback':
        const success = await handleOAuthCallback(true);
        return {
          success,
          message: success ? 'OAuth callback retry successful' : 'OAuth callback retry failed',
        };
      default:
        break;
    }

    const message = 'No previous operation to retry';
    safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
    return { success: false, message };
  }, [
    state.retryCount,
    state.lastAttemptTimestamp,
    state.lastProvider,
    requestPermission,
    reauthorizePermissions,
    handleOAuthCallback,
    safeSetState,
  ]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastCallbackUrlRef.current = null;
    lastScopeNamesRef.current = null;
    lastOperationRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    state.lastAttemptTimestamp !== null &&
    Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS &&
    lastOperationRef.current !== null;

  // Derived state
  const canRequest = !!accountId && accountType === 'oauth';

  return {
    // Account identification
    accountId: accountId,

    // Permissions state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    canRetry,
    retryCount: state.retryCount,

    // Convenience getters
    isIdle: state.phase === 'idle',
    isRequesting: state.phase === 'requesting',
    isReauthorizing: state.phase === 'reauthorizing',
    isProcessingCallback: state.phase === 'processing_callback',
    isCompleted: state.phase === 'completed',
    isFailed: state.phase === 'failed',

    // Last operation info
    lastProvider: state.lastProvider,
    lastScopes: state.lastScopes,

    // Callback result data
    callbackMessage: state.callbackMessage,
    grantedScopes: state.grantedScopes,

    // Operations
    requestPermission,
    getPermissionUrl,
    reauthorizePermissions,
    getReauthorizeUrl,
    retry,
    processCallbackFromUrl,

    // Utilities
    clearError,
    reset,
    canRequest,
  };
}
