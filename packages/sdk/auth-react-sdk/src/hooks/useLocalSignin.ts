import { useState, useCallback, useRef } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { LocalLoginRequest } from '../types';
import { parseApiError } from '../utils';

// Local signin phases
type LocalSigninPhase = 'idle' | 'signing_in' | 'requires_2fa' | 'verifying_2fa' | 'completed' | 'failed';

interface LocalSigninState {
  phase: LocalSigninPhase;
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  // Two-factor authentication data
  tempToken: string | null;
  accountId: string | null;
  accountName: string | null;
  // Signin completion data
  completionMessage: string | null;
}

interface UseLocalSigninReturn {
  // Main actions
  signin: (data: LocalLoginRequest) => Promise<{ success: boolean; message?: string }>;
  verify2FA: (token: string) => Promise<{ success: boolean; message?: string }>;
  retry: () => Promise<{ success: boolean; message?: string }>;

  // State
  phase: LocalSigninPhase;
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  retryCount: number;

  // Two-factor authentication data
  requiresTwoFactor: boolean;
  tempToken: string | null;
  accountId: string | null;
  accountName: string | null;

  // Completion data
  completionMessage: string | null;

  // Convenience state getters
  isIdle: boolean;
  isSigningIn: boolean;
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
  getDebugInfo: () => LocalSigninState;
}

const INITIAL_STATE: LocalSigninState = {
  phase: 'idle',
  loading: false,
  error: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  tempToken: null,
  accountId: null,
  accountName: null,
  completionMessage: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export const useLocalSignin = (): UseLocalSigninReturn => {
  const authService = useAuthService();
  const [state, setState] = useState<LocalSigninState>(INITIAL_STATE);

  // Refs for retry logic
  const lastSigninDataRef = useRef<LocalLoginRequest | null>(null);
  const last2FATokenRef = useRef<string | null>(null);
  const lastOperationRef = useRef<'signin' | '2fa' | null>(null);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: LocalSigninState) => LocalSigninState) => {
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

  // Main signin function
  const signin = useCallback(
    async (data: LocalLoginRequest, isRetry = false): Promise<{ success: boolean; message?: string }> => {
      // Validation
      if (typeof data?.email !== 'string' && typeof data?.username !== 'string') {
        const message = 'Email or username is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (data.email && !data.email.trim()) {
        const message = 'Email cannot be empty';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (data.username && !data.username.trim()) {
        const message = 'Username cannot be empty';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!data.password || !data.password.trim()) {
        const message = 'Password is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'signing_in',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0, // Only reset if not a retry
        }));

        // Store signin data for potential retry
        if (!isRetry) {
          lastSigninDataRef.current = data;
          lastOperationRef.current = 'signin';
        }

        const result = await authService.localLogin(data);

        if (result.requiresTwoFactor && result.tempToken) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'requires_2fa',
            loading: false,
            tempToken: result.tempToken || null,
            accountId: result.accountId || null,
            accountName: result.name || null,
            lastAttemptTimestamp: Date.now(),
            retryCount: 0,
          }));

          return {
            success: false, // Not completed yet, needs 2FA
            message: 'Two-factor authentication required. Please enter your verification code.',
          };
        } else {
          // Signin successful without 2FA
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            accountId: result.accountId || null,
            accountName: result.name || null,
            completionMessage: result.message || 'Signin successful!',
            retryCount: 0,
          }));

          return {
            success: true,
            message: result.message || 'Signin successful!',
          };
        }
      } catch (error) {
        const message = handleError(error, 'Signin failed');
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
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
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            tempToken: null,
            accountId: result.accountId,
            accountName: result.name,
            completionMessage: result.message || 'Two-factor authentication successful!',
            retryCount: 0,
          }));

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
        if (lastSigninDataRef.current) {
          return signin(lastSigninDataRef.current, true);
        }
        break;
      case '2fa':
        if (last2FATokenRef.current) {
          return verify2FA(last2FATokenRef.current, true);
        }
        break;
      default:
        break;
    }

    const message = 'No previous signin attempt to retry';
    safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
    return { success: false, message };
  }, [state.retryCount, state.lastAttemptTimestamp, signin, verify2FA, safeSetState]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastSigninDataRef.current = null;
    last2FATokenRef.current = null;
    lastOperationRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): LocalSigninState => ({ ...state }), [state]);

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
      case 'signing_in':
        return 30;
      case 'requires_2fa':
        return 60;
      case 'verifying_2fa':
        return 85;
      case 'completed':
        return 100;
      case 'failed':
        return state.retryCount > 0 ? 30 : 0;
      default:
        return 0;
    }
  }, [state.phase]);

  const getCurrentStep = useCallback((): string => {
    switch (state.phase) {
      case 'idle':
        return 'Ready to sign in';
      case 'signing_in':
        return 'Signing in...';
      case 'requires_2fa':
        return 'Two-factor authentication required';
      case 'verifying_2fa':
        return 'Verifying authentication code...';
      case 'completed':
        return 'Signin completed successfully!';
      case 'failed':
        return 'Signin failed';
      default:
        return 'Unknown step';
    }
  }, [state.phase]);

  const getNextStep = useCallback((): string | null => {
    switch (state.phase) {
      case 'idle':
        return 'Enter credentials';
      case 'signing_in':
        return 'Authenticating...';
      case 'requires_2fa':
        return 'Enter verification code';
      case 'verifying_2fa':
        return 'Almost done...';
      case 'completed':
        return null;
      case 'failed':
        return canRetry ? 'Try again' : 'Contact support';
      default:
        return null;
    }
  }, [state.phase]);

  return {
    // Main actions
    signin,
    verify2FA,
    retry,

    // Core state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    canRetry,
    retryCount: state.retryCount,

    // Two-factor authentication data
    requiresTwoFactor,
    tempToken: state.tempToken,
    accountId: state.accountId,
    accountName: state.accountName,

    // Completion data
    completionMessage: state.completionMessage,

    // Convenience state getters
    isIdle: state.phase === 'idle',
    isSigningIn: state.phase === 'signing_in',
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
