import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { OAuthProviders, CallbackCode, CallbackData } from '../types';
import { parseApiError } from '../utils';

// OAuth signup phases
type OAuthSignupPhase = 'idle' | 'redirecting' | 'processing_callback' | 'completed' | 'failed';

interface OAuthSignupState {
  phase: OAuthSignupPhase;
  loading: boolean;
  error: string | null;
  provider: OAuthProviders | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  // Callback result data
  accountId: string | null;
  accountName: string | null;
  callbackMessage: string | null;
}

interface UseOAuthSignupReturn {
  // Main actions
  startSignup: (provider: OAuthProviders, callbackUrl: string) => Promise<{ success: boolean; message?: string }>;
  getSignupUrl: (provider: OAuthProviders, callbackUrl: string) => Promise<string>;
  retry: () => Promise<{ success: boolean; message?: string }>;

  // State
  phase: OAuthSignupPhase;
  loading: boolean;
  error: string | null;
  provider: OAuthProviders | null;
  canRetry: boolean;
  retryCount: number;

  // Callback result data
  accountId: string | null;
  accountName: string | null;
  callbackMessage: string | null;

  // Convenience state getters
  isIdle: boolean;
  isRedirecting: boolean;
  isProcessingCallback: boolean;
  isCompleted: boolean;
  isFailed: boolean;

  // Progress tracking
  progress: number; // 0-100
  currentStep: string;
  nextStep: string | null;

  // Utilities
  clearError: () => void;
  reset: () => void;
  getDebugInfo: () => OAuthSignupState;
}

const INITIAL_STATE: OAuthSignupState = {
  phase: 'idle',
  loading: false,
  error: null,
  provider: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  accountId: null,
  accountName: null,
  callbackMessage: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export const useOAuthSignup = (): UseOAuthSignupReturn => {
  const authService = useAuthService();
  const [state, setState] = useState<OAuthSignupState>(INITIAL_STATE);

  // Refs for cleanup and state tracking
  const lastCallbackUrlRef = useRef<string | null>(null);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: OAuthSignupState) => OAuthSignupState) => {
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

    if (urlParams.size <= 0) {
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
        case CallbackCode.OAUTH_SIGNUP_SUCCESS: {
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            error: null,
            accountId: callbackData.accountId || null,
            accountName: callbackData.name || null,
            callbackMessage: callbackData.message || 'OAuth signup completed successfully!',
          }));

          return true;
        }

        case CallbackCode.OAUTH_ERROR:
        default: {
          const errorMessage = callbackData.error || 'OAuth signup failed';

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
  }, [safeSetState, handleError]);

  // Auto-detect and handle OAuth callback on mount
  useEffect(() => {
    handleOAuthCallback();
  }, []); // Only run on mount

  // Start OAuth signup with redirect
  const startSignup = useCallback(
    async (provider: OAuthProviders, callbackUrl: string): Promise<{ success: boolean; message?: string }> => {
      // Validation
      if (!provider) {
        const message = 'OAuth provider is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!callbackUrl || !callbackUrl.trim()) {
        const message = 'Callback URL is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'redirecting',
          loading: true,
          error: null,
          provider,
          retryCount: 0,
        }));

        // Store callback URL for potential retry
        lastCallbackUrlRef.current = callbackUrl;

        const response = await authService.generateOAuthSignupUrl(provider, { callbackUrl });

        if (response.authorizationUrl) {
          // Set processing state before redirect
          safeSetState((prev) => ({
            ...prev,
            phase: 'processing_callback',
            lastAttemptTimestamp: Date.now(),
          }));

          // Redirect to OAuth provider
          window.location.href = response.authorizationUrl;

          return { success: true, message: `Redirecting to ${provider} for signup...` };
        }

        const message = 'Failed to generate OAuth signup URL';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, `Failed to start ${provider} signup`);
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
  );

  // Get OAuth signup URL without redirect (for custom handling)
  const getSignupUrl = useCallback(
    async (provider: OAuthProviders, callbackUrl: string): Promise<string> => {
      try {
        if (!provider) {
          throw new Error('OAuth provider is required');
        }

        if (!callbackUrl || !callbackUrl.trim()) {
          throw new Error('Callback URL is required');
        }

        const response = await authService.generateOAuthSignupUrl(provider, { callbackUrl });
        return response.authorizationUrl;
      } catch (error) {
        const apiError = parseApiError(error, `Failed to get ${provider} signup URL`);
        safeSetState((prev) => ({ ...prev, error: apiError.message }));
        return '';
      }
    },
    [authService, safeSetState],
  );

  // Enhanced retry with cooldown and attempt limits
  const retry = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
      const message = `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`;
      safeSetState((prev) => ({ ...prev, error: message }));
      return { success: false, message };
    }

    if (state.lastAttemptTimestamp && Date.now() - state.lastAttemptTimestamp < RETRY_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - state.lastAttemptTimestamp)) / 1000);
      const message = `Please wait ${remainingTime} seconds before retrying`;
      return { success: false, message };
    }

    if (!state.provider || !lastCallbackUrlRef.current) {
      const message = 'No previous signup attempt to retry';
      safeSetState((prev) => ({ ...prev, error: message }));
      return { success: false, message };
    }

    safeSetState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }));

    // Retry the previous signup attempt
    return startSignup(state.provider, lastCallbackUrlRef.current);
  }, [state.retryCount, state.lastAttemptTimestamp, state.provider, startSignup, safeSetState]);

  // Mark signup as completed (called by callback handler)
  const markCompleted = useCallback(() => {
    safeSetState((prev) => ({
      ...prev,
      phase: 'completed',
      loading: false,
      error: null,
    }));
  }, [safeSetState]);

  // Mark signup as failed (called by callback handler)
  const markFailed = useCallback(
    (errorMessage: string) => {
      safeSetState((prev) => ({
        ...prev,
        phase: 'failed',
        loading: false,
        error: errorMessage,
        lastAttemptTimestamp: Date.now(),
      }));
    },
    [safeSetState],
  );

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastCallbackUrlRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): OAuthSignupState => ({ ...state }), [state]);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    (!state.lastAttemptTimestamp || Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS) &&
    !!state.provider &&
    !!lastCallbackUrlRef.current;

  // Progress calculation
  const getProgress = (): number => {
    switch (state.phase) {
      case 'idle':
        return 0;
      case 'redirecting':
        return 25;
      case 'processing_callback':
        return 75;
      case 'completed':
        return 100;
      case 'failed':
        return state.retryCount > 0 ? 25 : 0;
      default:
        return 0;
    }
  };

  const getCurrentStep = (): string => {
    switch (state.phase) {
      case 'idle':
        return 'Ready to start OAuth signup';
      case 'redirecting':
        return `Redirecting to ${state.provider}...`;
      case 'processing_callback':
        return `Processing ${state.provider} response...`;
      case 'completed':
        return 'OAuth signup completed successfully!';
      case 'failed':
        return 'OAuth signup failed';
      default:
        return 'Unknown step';
    }
  };

  const getNextStep = (): string | null => {
    switch (state.phase) {
      case 'idle':
        return 'Choose OAuth provider';
      case 'redirecting':
        return 'Complete authorization';
      case 'processing_callback':
        return 'Almost done...';
      case 'completed':
        return null;
      case 'failed':
        return canRetry ? 'Try again' : 'Contact support';
      default:
        return null;
    }
  };

  // Expose internal methods for callback handling (optional)
  const internal = {
    markCompleted,
    markFailed,
    handleOAuthCallback,
  };

  return {
    // Main actions
    startSignup,
    getSignupUrl,
    retry,

    // Core state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    provider: state.provider,
    canRetry,
    retryCount: state.retryCount,

    // Callback result data
    accountId: state.accountId,
    accountName: state.accountName,
    callbackMessage: state.callbackMessage,

    // Convenience state getters
    isIdle: state.phase === 'idle',
    isRedirecting: state.phase === 'redirecting',
    isProcessingCallback: state.phase === 'processing_callback',
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

    // Internal methods (for callback handling)
    ...internal,
  };
};
