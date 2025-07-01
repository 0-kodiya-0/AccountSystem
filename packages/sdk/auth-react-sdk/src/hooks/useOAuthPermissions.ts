import { useState, useCallback, useEffect } from 'react';
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
  requestPermission: (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => Promise<void>;
  getPermissionUrl: (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => Promise<string>;
  reauthorizePermissions: (provider: OAuthProviders, callbackUrl: string) => Promise<void>;
  getReauthorizeUrl: (provider: OAuthProviders, callbackUrl: string) => Promise<string>;
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
  lastProvider: null,
  lastScopes: null,
  callbackMessage: null,
  grantedScopes: null,
};

export function useOAuthPermissions(accountId: string | null, options: PermissionsOptions = {}): PermissionsReturn {
  const { autoProcessCallback = true } = options;

  const authService = useAuthService();
  const [state, setState] = useState<PermissionsState>(INITIAL_STATE);

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
      }));

      return apiError.message;
    },
    [safeSetState],
  );

  // Handle OAuth callback from URL parameters
  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
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
      }));

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
  }, [safeSetState, handleError]);

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
  }, [autoProcessCallback, handleOAuthCallback]);

  // OAuth permissions operations
  const requestPermission = useCallback(
    async (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => {
      if (!accountId) return;

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
        }));

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
        }));

        // Redirect to OAuth provider
        window.location.href = response.authorizationUrl;
      } catch (error) {
        handleError(error, 'Failed to request permission');
      }
    },
    [accountId, authService, handleError, safeSetState],
  );

  const getPermissionUrl = useCallback(
    async (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => {
      if (!accountId) return '';

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
        return '';
      }
    },
    [accountId, authService, safeSetState],
  );

  const reauthorizePermissions = useCallback(
    async (provider: OAuthProviders, callbackUrl: string) => {
      if (!accountId) return;

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
        }));

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
          }));

          // Redirect to OAuth provider
          window.location.href = response.authorizationUrl;
        } else {
          // No reauthorization needed
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            callbackMessage: response.message || 'No reauthorization needed',
          }));
        }
      } catch (error) {
        handleError(error, 'Failed to reauthorize permissions');
      }
    },
    [accountId, authService, handleError, safeSetState],
  );

  const getReauthorizeUrl = useCallback(
    async (provider: OAuthProviders, callbackUrl: string) => {
      if (!accountId) return '';

      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for reauthorization URL generation');
        }

        const response = await authService.generateReauthorizeUrl(provider, {
          accountId: accountId,
          callbackUrl,
        });
        return response.authorizationUrl || '';
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get reauthorize URL');
        safeSetState((prev) => ({ ...prev, error: apiError.message }));
        return '';
      }
    },
    [accountId, authService, safeSetState],
  );

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // Derived state
  const canRequest = !!accountId && accountType === 'oauth';

  return {
    // Account identification
    accountId: accountId,

    // Permissions state
    phase: state.phase,
    loading: state.loading,
    error: state.error,

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
    processCallbackFromUrl,

    // Utilities
    clearError,
    reset,
    canRequest,
  };
}
