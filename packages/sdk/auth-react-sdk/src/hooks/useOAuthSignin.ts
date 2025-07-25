import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { OAuthProviders, CallbackCode, CallbackData } from '../types';
import { parseApiError } from '../utils';

// OAuth signin phases
type OAuthSigninPhase =
  | 'idle'
  | 'redirecting'
  | 'processing_callback'
  | 'requires_2fa'
  | 'verifying_2fa'
  | 'completed'
  | 'failed';

interface OAuthSigninState {
  phase: OAuthSigninPhase;
  loading: boolean;
  error: string | null;
  provider: OAuthProviders | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  // Two-factor authentication data
  tempToken: string | null;
  accountId: string | null;
  accountName: string | null;
  // Additional OAuth data
  needsAdditionalScopes: boolean;
  missingScopes: string[];
  // Completion data
  callbackMessage: string | null;
}

interface UseOAuthSigninOptions {
  autoProcessCallback?: boolean; // Whether to auto-process OAuth callbacks (default: true)
}

interface UseOAuthSigninReturn {
  // Main actions
  startSignin: (provider: OAuthProviders, callbackUrl: string) => Promise<{ success: boolean; message?: string }>;
  getSigninUrl: (provider: OAuthProviders, callbackUrl: string) => Promise<string | null>;
  verify2FA: (token: string) => Promise<{ success: boolean; message?: string }>;
  retry: () => Promise<{ success: boolean; message?: string }>;

  processCallbackFromUrl: () => Promise<{ success: boolean; message?: string }>;

  // State
  phase: OAuthSigninPhase;
  loading: boolean;
  error: string | null;
  provider: OAuthProviders | null;
  canRetry: boolean;
  retryCount: number;

  // Two-factor authentication data
  requiresTwoFactor: boolean;
  tempToken: string | null;
  accountId: string | null;
  accountName: string | null;

  // OAuth-specific data
  needsAdditionalScopes: boolean;
  missingScopes: string[];
  callbackMessage: string | null;

  // Convenience state getters
  isIdle: boolean;
  isRedirecting: boolean;
  isProcessingCallback: boolean;
  isRequires2FA: boolean;
  isVerifying2FA: boolean;
  isCompleted: boolean;
  isFailed: boolean;

  // Progress tracking
  progress: number; // 0-100
  currentStep: string;
  nextStep: string | null;

  // Utilities
  clearError: () => void;
  reset: () => void;
  getDebugInfo: () => OAuthSigninState;
}

const INITIAL_STATE: OAuthSigninState = {
  phase: 'idle',
  loading: false,
  error: null,
  provider: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  tempToken: null,
  accountId: null,
  accountName: null,
  needsAdditionalScopes: false,
  missingScopes: [],
  callbackMessage: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export const useOAuthSignin = (options: UseOAuthSigninOptions = {}): UseOAuthSigninReturn => {
  const { autoProcessCallback = true } = options;
  const authService = useAuthService();
  const [state, setState] = useState<OAuthSigninState>(INITIAL_STATE);

  // Refs for retry logic
  const lastCallbackUrlRef = useRef<string | null>(null);
  const last2FATokenRef = useRef<string | null>(null);
  const lastOperationRef = useRef<'signin' | 'callback' | '2fa' | null>(null);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: OAuthSigninState) => OAuthSigninState) => {
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
          retryCount: isRetry ? prev.retryCount : 0, // Only reset if not a retry
          loading: true,
          error: null,
        }));

        // Store for retry
        if (!isRetry) {
          lastOperationRef.current = 'callback';
        }

        // Handle based on callback code
        switch (callbackData.code) {
          case CallbackCode.OAUTH_SIGNIN_SUCCESS: {
            // Check if needs additional scopes
            if (callbackData.needsAdditionalScopes && callbackData.missingScopes) {
              safeSetState((prev) => ({
                ...prev,
                phase: 'completed',
                loading: false,
                error: null,
                accountId: callbackData.accountId || null,
                accountName: callbackData.name || null,
                needsAdditionalScopes: true,
                missingScopes: Array.isArray(callbackData.missingScopes) ? callbackData.missingScopes : [],
                callbackMessage: callbackData.message || 'OAuth signin successful, but additional permissions needed.',
                retryCount: 0,
              }));
            } else {
              // Complete success
              safeSetState((prev) => ({
                ...prev,
                phase: 'completed',
                loading: false,
                error: null,
                accountId: callbackData.accountId || null,
                accountName: callbackData.name || null,
                needsAdditionalScopes: false,
                missingScopes: [],
                callbackMessage: callbackData.message || 'OAuth signin completed successfully!',
                retryCount: 0,
              }));
            }

            return true;
          }

          case CallbackCode.OAUTH_SIGNIN_REQUIRES_2FA: {
            safeSetState((prev) => ({
              ...prev,
              phase: 'requires_2fa',
              loading: false,
              error: null,
              tempToken: callbackData.tempToken || null,
              accountId: callbackData.accountId || null,
              accountName: callbackData.name || null,
              callbackMessage: callbackData.message || 'Two-factor authentication required',
              retryCount: 0,
            }));

            return true;
          }

          case CallbackCode.OAUTH_ERROR:
          default: {
            const errorMessage = callbackData.error || 'OAuth signin failed';

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
  }, [autoProcessCallback]); // Only run on mount

  // Start OAuth signin with redirect
  const startSignin = useCallback(
    async (
      provider: OAuthProviders,
      callbackUrl: string,
      isRetry = false,
    ): Promise<{ success: boolean; message?: string }> => {
      // Validation
      if (!provider) {
        const message = 'OAuth provider is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!callbackUrl || !callbackUrl.trim()) {
        const message = 'Callback URL is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'redirecting',
          loading: true,
          error: null,
          provider,
          retryCount: isRetry ? prev.retryCount : 0, // Only reset if not a retry
        }));

        // Store callback URL and operation for potential retry
        if (!isRetry) {
          lastCallbackUrlRef.current = callbackUrl;
          lastOperationRef.current = 'signin';
        }

        const response = await authService.generateOAuthSigninUrl(provider, { callbackUrl });

        if (response.authorizationUrl) {
          // Set processing state before redirect
          safeSetState((prev) => ({
            ...prev,
            phase: 'processing_callback',
            lastAttemptTimestamp: Date.now(),
            retryCount: 0,
          }));

          // Redirect to OAuth provider
          window.location.href = response.authorizationUrl;

          return { success: true, message: `Redirecting to ${provider} for signin...` };
        }

        const message = 'Failed to generate OAuth signin URL';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, `Failed to start ${provider} signin`);
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
  );

  // Get OAuth signin URL without redirect (for custom handling)
  const getSigninUrl = useCallback(
    async (provider: OAuthProviders, callbackUrl: string): Promise<string | null> => {
      try {
        if (!provider) {
          throw new Error('OAuth provider is required');
        }

        if (!callbackUrl || !callbackUrl.trim()) {
          throw new Error('Callback URL is required');
        }

        const response = await authService.generateOAuthSigninUrl(provider, { callbackUrl });
        return response.authorizationUrl;
      } catch (error) {
        const apiError = parseApiError(error, `Failed to get ${provider} signin URL`);
        safeSetState((prev) => ({ ...prev, phase: 'failed', error: apiError.message }));
        return null;
      }
    },
    [authService, safeSetState],
  );

  // Two-factor verification function
  const verify2FA = useCallback(
    async (token: string, isRetry = false): Promise<{ success: boolean; message?: string }> => {
      if (!token || !token.trim()) {
        const message = 'Verification code is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!state.tempToken) {
        const message = 'No temporary token available. Please sign in again.';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'verifying_2fa',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0, // Only reset if not a retry
        }));

        // Store 2FA data for potential retry
        if (!isRetry) {
          last2FATokenRef.current = token.trim();
          lastOperationRef.current = '2fa';
        }

        const result = await authService.verifyTwoFactorLogin({
          token: token.trim(),
          tempToken: state.tempToken,
        });

        if (result.accountId) {
          // Check if needs additional scopes
          if (result.needsAdditionalScopes && result.missingScopes) {
            safeSetState((prev) => ({
              ...prev,
              phase: 'completed',
              loading: false,
              tempToken: null,
              accountId: result.accountId,
              accountName: result.name,
              needsAdditionalScopes: true,
              missingScopes: result.missingScopes || [],
              callbackMessage:
                result.message || 'Two-factor authentication successful, but additional permissions needed.',
              retryCount: 0,
            }));
          } else {
            // Complete success
            safeSetState((prev) => ({
              ...prev,
              phase: 'completed',
              loading: false,
              tempToken: null,
              accountId: result.accountId,
              accountName: result.name,
              needsAdditionalScopes: false,
              missingScopes: [],
              callbackMessage: result.message || 'Two-factor authentication successful!',
              retryCount: 0,
            }));
          }

          return {
            success: true,
            message: result.message || 'Two-factor authentication successful!',
          };
        }

        const message = 'Two-factor verification failed';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Two-factor verification failed');
        return { success: false, message };
      }
    },
    [state.tempToken, authService, handleError, safeSetState],
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
      case 'signin':
        if (state.provider && lastCallbackUrlRef.current) {
          return startSignin(state.provider, lastCallbackUrlRef.current, true);
        }
        break;
      case '2fa':
        if (last2FATokenRef.current) {
          return verify2FA(last2FATokenRef.current, true);
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

    const message = 'No previous signin attempt to retry';
    safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
    return { success: false, message };
  }, [
    state.retryCount,
    state.lastAttemptTimestamp,
    state.provider,
    startSignin,
    verify2FA,
    handleOAuthCallback,
    safeSetState,
  ]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastCallbackUrlRef.current = null;
    last2FATokenRef.current = null;
    lastOperationRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): OAuthSigninState => ({ ...state }), [state]);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    state.lastAttemptTimestamp !== null &&
    Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS &&
    lastOperationRef.current !== null;

  const requiresTwoFactor = state.phase === 'requires_2fa';

  // Progress calculation
  const getProgress = useCallback((): number => {
    switch (state.phase) {
      case 'idle':
        return 0;
      case 'redirecting':
        return 25;
      case 'processing_callback':
        return 50;
      case 'requires_2fa':
        return 65;
      case 'verifying_2fa':
        return 85;
      case 'completed':
        return 100;
      case 'failed':
        return state.retryCount > 0 ? 25 : 0;
      default:
        return 0;
    }
  }, [state.phase]);

  const getCurrentStep = useCallback((): string => {
    switch (state.phase) {
      case 'idle':
        return 'Ready to start OAuth signin';
      case 'redirecting':
        return `Redirecting to ${state.provider}...`;
      case 'processing_callback':
        return `Processing ${state.provider} response...`;
      case 'requires_2fa':
        return 'Two-factor authentication required';
      case 'verifying_2fa':
        return 'Verifying authentication code...';
      case 'completed':
        return 'OAuth signin completed successfully!';
      case 'failed':
        return 'OAuth signin failed';
      default:
        return 'Unknown step';
    }
  }, [state.phase]);

  const getNextStep = useCallback((): string | null => {
    switch (state.phase) {
      case 'idle':
        return 'Choose OAuth provider';
      case 'redirecting':
        return 'Complete authorization';
      case 'processing_callback':
        return 'Processing...';
      case 'requires_2fa':
        return 'Enter verification code';
      case 'verifying_2fa':
        return 'Almost done...';
      case 'completed':
        return state.needsAdditionalScopes ? 'Grant additional permissions' : null;
      case 'failed':
        return canRetry ? 'Try again' : 'Contact support';
      default:
        return null;
    }
  }, [state.phase]);

  return {
    // Main actions
    startSignin,
    getSigninUrl,
    verify2FA,
    retry,

    processCallbackFromUrl,

    // Core state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    provider: state.provider,
    canRetry,
    retryCount: state.retryCount,

    // Two-factor authentication data
    requiresTwoFactor,
    tempToken: state.tempToken,
    accountId: state.accountId,
    accountName: state.accountName,

    // OAuth-specific data
    needsAdditionalScopes: state.needsAdditionalScopes,
    missingScopes: state.missingScopes,
    callbackMessage: state.callbackMessage,

    // Convenience state getters
    isIdle: state.phase === 'idle',
    isRedirecting: state.phase === 'redirecting',
    isProcessingCallback: state.phase === 'processing_callback',
    isRequires2FA: state.phase === 'requires_2fa',
    isVerifying2FA: state.phase === 'verifying_2fa',
    isCompleted: state.phase === 'completed',
    isFailed: state.phase === 'failed',

    // Progress tracking
    progress: getProgress(),
    currentStep: getCurrentStep(),
    nextStep: getNextStep(),

    // Utilities
    clearError,
    reset,
    getDebugInfo,
  };
};
