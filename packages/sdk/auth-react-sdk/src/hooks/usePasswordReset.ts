import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { PasswordResetRequest, ResetPasswordRequest } from '../types';
import { parseApiError } from '../utils';

// Password reset phases
type PasswordResetPhase =
  | 'idle'
  | 'requesting_reset'
  | 'reset_email_sent'
  | 'token_verifying'
  | 'resetting_password'
  | 'completed'
  | 'failed';

interface PasswordResetState {
  phase: PasswordResetPhase;
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  // Email and token data
  email: string | null;
  resetToken: string | null;
  // Completion data
  completionMessage: string | null;
}

interface UsePasswordResetReturn {
  // Main actions
  requestReset: (data: PasswordResetRequest) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (data: ResetPasswordRequest) => Promise<{ success: boolean; message?: string }>;
  retry: () => Promise<{ success: boolean; message?: string }>;

  // State
  phase: PasswordResetPhase;
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  retryCount: number;

  // Data
  email: string | null;
  resetToken: string | null;
  completionMessage: string | null;

  // Convenience state getters
  isIdle: boolean;
  isRequestingReset: boolean;
  isResetEmailSent: boolean;
  isTokenVerifying: boolean;
  isResettingPassword: boolean;
  isCompleted: boolean;
  isFailed: boolean;

  // Token availability
  hasValidToken: boolean;
  canResetPassword: boolean;

  // Progress tracking
  progress: number; // 0-100
  currentStep: string;
  nextStep: string | null;

  // Utilities
  clearError: () => void;
  reset: () => void;
  getDebugInfo: () => PasswordResetState;
}

const INITIAL_STATE: PasswordResetState = {
  phase: 'idle',
  loading: false,
  error: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  email: null,
  resetToken: null,
  completionMessage: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export const usePasswordReset = (): UsePasswordResetReturn => {
  const authService = useAuthService();
  const [state, setState] = useState<PasswordResetState>(INITIAL_STATE);

  // Refs for cleanup and state tracking
  const lastRequestDataRef = useRef<PasswordResetRequest | null>(null);
  const processingTokenRef = useRef<string | null>(null);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: PasswordResetState) => PasswordResetState) => {
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

  // Extract and verify reset token from URL
  const extractResetToken = useCallback(async (): Promise<boolean> => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token') || urlParams.get('resetToken');

    // Check if we should process this token
    if (!tokenFromUrl) {
      return false;
    }

    // Prevent double processing of the same token
    if (processingTokenRef.current === tokenFromUrl) {
      return false;
    }

    // Mark token as being processed
    processingTokenRef.current = tokenFromUrl;

    try {
      safeSetState((prev) => ({
        ...prev,
        phase: 'token_verifying',
        loading: true,
        error: null,
        resetToken: tokenFromUrl,
      }));

      // Token is valid for reset - just store it, don't validate with server yet
      safeSetState((prev) => ({
        ...prev,
        phase: 'reset_email_sent',
        loading: false,
        resetToken: tokenFromUrl,
      }));

      return true;
    } catch (error) {
      handleError(error, 'Invalid reset token');
      return false;
    } finally {
      processingTokenRef.current = null;

      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('resetToken');
      window.history.replaceState({}, '', url.toString());
    }
  }, [handleError, safeSetState]);

  // Auto-extract token on mount
  useEffect(() => {
    extractResetToken();
  }, []); // Only run on mount

  // Request password reset
  const requestReset = useCallback(
    async (data: PasswordResetRequest): Promise<{ success: boolean; message?: string }> => {
      // Validation
      if (!data.email || !data.email.trim()) {
        const message = 'Email address is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!data.callbackUrl || !data.callbackUrl.trim()) {
        const message = 'Callback URL is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'requesting_reset',
          loading: true,
          error: null,
          email: data.email,
          retryCount: 0,
        }));

        // Store request data for potential retry
        lastRequestDataRef.current = data;

        const result = await authService.requestPasswordReset(data);

        if (result.message) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'reset_email_sent',
            loading: false,
            lastAttemptTimestamp: Date.now(),
          }));

          return {
            success: true,
            message: result.message,
          };
        }

        const message = 'Failed to send password reset email';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to request password reset');
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
  );

  // Reset password with token
  const resetPassword = useCallback(
    async (data: ResetPasswordRequest): Promise<{ success: boolean; message?: string }> => {
      if (!state.resetToken) {
        const message = 'No reset token available. Please request a new password reset.';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      // Enhanced validation
      if (!data.password || !data.password.trim()) {
        const message = 'New password is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (data.password.length < 8) {
        const message = 'Password must be at least 8 characters long';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!data.confirmPassword || !data.confirmPassword.trim()) {
        const message = 'Password confirmation is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (data.password !== data.confirmPassword) {
        const message = 'Passwords do not match';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'resetting_password',
          loading: true,
          error: null,
        }));

        const result = await authService.resetPassword(state.resetToken, data);

        if (result.message) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            completionMessage: result.message,
          }));

          return {
            success: true,
            message: result.message,
          };
        }

        const message = 'Failed to reset password';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to reset password');
        return { success: false, message };
      }
    },
    [state.resetToken, authService, handleError, safeSetState],
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

    safeSetState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }));

    // Retry based on current phase
    if (state.phase === 'failed' && lastRequestDataRef.current) {
      // Retry password reset request
      return requestReset(lastRequestDataRef.current);
    } else if (state.resetToken) {
      // Try to re-extract token from URL
      processingTokenRef.current = null;
      const success = await extractResetToken();
      return {
        success,
        message: success ? 'Reset token verified' : 'No reset token found',
      };
    }

    const message = 'No previous operation to retry';
    safeSetState((prev) => ({ ...prev, error: message }));
    return { success: false, message };
  }, [
    state.retryCount,
    state.lastAttemptTimestamp,
    state.phase,
    state.resetToken,
    requestReset,
    extractResetToken,
    safeSetState,
  ]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastRequestDataRef.current = null;
    processingTokenRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): PasswordResetState => ({ ...state }), [state]);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    (!state.lastAttemptTimestamp || Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS);

  const hasValidToken = !!state.resetToken;
  const canResetPassword = state.phase === 'reset_email_sent' && hasValidToken;

  // Progress calculation
  const getProgress = (): number => {
    switch (state.phase) {
      case 'idle':
        return 0;
      case 'requesting_reset':
        return 25;
      case 'reset_email_sent':
        return 50;
      case 'token_verifying':
        return 60;
      case 'resetting_password':
        return 85;
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
        return 'Ready to reset password';
      case 'requesting_reset':
        return 'Sending reset email...';
      case 'reset_email_sent':
        return 'Reset email sent';
      case 'token_verifying':
        return 'Verifying reset token...';
      case 'resetting_password':
        return 'Resetting password...';
      case 'completed':
        return 'Password reset successfully!';
      case 'failed':
        return 'Password reset failed';
      default:
        return 'Unknown step';
    }
  };

  const getNextStep = (): string | null => {
    switch (state.phase) {
      case 'idle':
        return 'Enter your email address';
      case 'requesting_reset':
        return 'Check your email';
      case 'reset_email_sent':
        return hasValidToken ? 'Enter new password' : 'Click the link in your email';
      case 'token_verifying':
        return 'Enter new password';
      case 'resetting_password':
        return 'Almost done...';
      case 'completed':
        return null;
      case 'failed':
        return canRetry ? 'Try again' : 'Contact support';
      default:
        return null;
    }
  };

  return {
    // Main actions
    requestReset,
    resetPassword,
    retry,

    // Core state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    canRetry,
    retryCount: state.retryCount,

    // Data
    email: state.email,
    resetToken: state.resetToken,
    completionMessage: state.completionMessage,

    // Convenience state getters
    isIdle: state.phase === 'idle',
    isRequestingReset: state.phase === 'requesting_reset',
    isResetEmailSent: state.phase === 'reset_email_sent',
    isTokenVerifying: state.phase === 'token_verifying',
    isResettingPassword: state.phase === 'resetting_password',
    isCompleted: state.phase === 'completed',
    isFailed: state.phase === 'failed',

    // Token availability
    hasValidToken,
    canResetPassword,

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
