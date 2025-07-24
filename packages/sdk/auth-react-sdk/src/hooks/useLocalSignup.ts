import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { RequestEmailVerificationRequest, CompleteProfileRequest } from '../types';
import { parseApiError } from '../utils';

// Enhanced state management with phases
type SignupPhase =
  | 'idle'
  | 'email_sending'
  | 'email_sent'
  | 'email_verifying'
  | 'email_verified'
  | 'profile_completing'
  | 'completed'
  | 'canceled'
  | 'failed';

interface SignupState {
  phase: SignupPhase;
  loading: boolean;
  error: string | null;
  retryCount: number;
  email: string | null;
  verificationToken: string | null;
  profileToken: string | null;
  lastAttemptTimestamp: number | null;
}

interface UseLocalSignupOptions {
  autoProcessToken?: boolean; // Whether to auto-process tokens from URL (default: true)
}

interface UseLocalSignupReturn {
  // Enhanced actions with better return types
  start: (data: RequestEmailVerificationRequest) => Promise<{ success: boolean; message?: string }>;
  cancel: () => Promise<{ success: boolean; message?: string }>;
  complete: (data: CompleteProfileRequest) => Promise<{ success: boolean; accountId?: string; message?: string }>;
  retry: () => Promise<{ success: boolean; accountId?: string; message?: string }>;
  processTokenFromUrl: () => Promise<{ success: boolean; message?: string }>;

  // Computed state for better UX
  phase: SignupPhase;
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  canComplete: boolean;
  canCancel: boolean;
  retryCount: number;

  // Convenience state getters
  isIdle: boolean;
  isEmailSending: boolean;
  isEmailSent: boolean;
  isEmailVerifying: boolean;
  isEmailVerified: boolean;
  isProfileCompleting: boolean;
  isCompleted: boolean;
  isCanceled: boolean;
  isFailed: boolean;

  // Progress tracking
  progress: number; // 0-100
  currentStep: string;
  nextStep: string | null;

  // Enhanced utilities
  clearError: () => void;
  reset: () => void;
  getDebugInfo: () => SignupState;
}

const INITIAL_STATE: SignupState = {
  phase: 'idle',
  loading: false,
  error: null,
  retryCount: 0,
  email: null,
  verificationToken: null,
  profileToken: null,
  lastAttemptTimestamp: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export const useLocalSignup = (options: UseLocalSignupOptions = {}): UseLocalSignupReturn => {
  const { autoProcessToken = true } = options;
  const authService = useAuthService();
  const [state, setState] = useState<SignupState>(INITIAL_STATE);

  // Add refs to store the last operation data for retry
  const lastStartDataRef = useRef<RequestEmailVerificationRequest | null>(null);
  const lastCompleteDataRef = useRef<CompleteProfileRequest | null>(null);
  const lastOperationRef = useRef<'start' | 'complete' | 'cancel' | 'verify' | null>(null);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: SignupState) => SignupState) => {
    setState(updater);
  }, []);

  // Enhanced error handling with categorization
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

  // Update the start function to store data for retry
  const start = useCallback(
    async (data: RequestEmailVerificationRequest, isRetry = false): Promise<{ success: boolean; message?: string }> => {
      // Validation
      if (!data.email || !data.email.trim()) {
        const message = 'Email address is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!data.callbackUrl || !data.callbackUrl.trim()) {
        const message = 'Callback URL is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'email_sending',
          loading: true,
          error: null,
          email: data.email,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastStartDataRef.current = data;
          lastOperationRef.current = 'start';
        }

        const result = await authService.requestEmailVerification(data);

        if (result.message) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'email_sent',
            loading: false,
            lastAttemptTimestamp: Date.now(),
            retryCount: 0,
          }));
          return { success: true, message: result.message };
        }

        const message = 'Failed to send verification email';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to send verification email');
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
  );

  // Update the complete function to store data for retry
  const complete = useCallback(
    async (
      data: CompleteProfileRequest,
      isRetry = false,
    ): Promise<{ success: boolean; accountId?: string; message?: string }> => {
      if (!state.profileToken) {
        const message = 'No profile token available. Please verify your email first.';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      // Enhanced validation
      if (!data.firstName?.trim()) {
        const message = 'First name is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!data.lastName?.trim()) {
        const message = 'Last name is required';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!data.password || data.password.length < 8) {
        const message = 'Password must be at least 8 characters long';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (data.password !== data.confirmPassword) {
        const message = 'Passwords do not match';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      if (!data.agreeToTerms) {
        const message = 'You must agree to the terms and conditions';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'profile_completing',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastCompleteDataRef.current = data;
          lastOperationRef.current = 'complete';
        }

        const result = await authService.completeProfile(state.profileToken, data);

        if (result.accountId) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
            retryCount: 0,
          }));

          return {
            success: true,
            accountId: result.accountId,
            message: `Welcome ${result.name}! Your account has been created successfully.`,
          };
        }

        const message = 'Failed to complete profile';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to complete profile');
        return { success: false, message };
      }
    },
    [state.profileToken, authService, handleError, safeSetState],
  );

  // Update cancel to store operation for retry
  const cancel = useCallback(
    async (isRetry = false): Promise<{ success: boolean; message?: string }> => {
      if (!state.email) {
        const message = 'No signup process to cancel';
        safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastOperationRef.current = 'cancel';
        }

        const result = await authService.cancelSignup({ email: state.email });

        if (result) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'canceled',
            loading: false,
            retryCount: 0,
          }));
          return { success: true, message: 'Signup canceled successfully' };
        }

        const message = 'Failed to cancel signup';
        safeSetState((prev) => ({
          ...prev,
          loading: false,
          error: message,
          lastAttemptTimestamp: Date.now(),
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to cancel signup');
        return { success: false, message };
      }
    },
    [state.email, authService, handleError, safeSetState],
  );

  // Update extractAndVerifyToken to store operation for retry
  const extractAndVerifyToken = useCallback(
    async (isRetry = false): Promise<boolean> => {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');

      if (!tokenFromUrl) {
        return false;
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'email_verifying',
          loading: true,
          error: null,
          verificationToken: tokenFromUrl,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastOperationRef.current = 'verify';
        }

        const result = await authService.verifyEmailForSignup(tokenFromUrl);

        if (result.profileToken) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'email_verified',
            loading: false,
            profileToken: result.profileToken,
            error: null,
            retryCount: 0,
          }));

          return true;
        } else {
          throw new Error('Email verification failed - no profile token received');
        }
      } catch (error: any) {
        handleError(error, 'Email verification failed');
        return false;
      } finally {
        // Clean up URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
      }
    },
    [authService, handleError, safeSetState],
  );

  const retry = useCallback(async (): Promise<{ success: boolean; accountId?: string; message?: string }> => {
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
      case 'start':
        if (lastStartDataRef.current) {
          return start(lastStartDataRef.current, true);
        }
        break;
      case 'complete':
        if (lastCompleteDataRef.current) {
          return complete(lastCompleteDataRef.current, true);
        }
        break;
      case 'cancel':
        return cancel(true);
      case 'verify':
        const success = await extractAndVerifyToken(true);
        return {
          success,
          message: success ? 'Email verification retry successful' : 'Email verification retry failed',
        };
      default:
        break;
    }

    const message = 'No previous operation to retry';
    safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
    return { success: false, message };
  }, [state.retryCount, state.lastAttemptTimestamp, start, complete, cancel, extractAndVerifyToken, safeSetState]);

  const processTokenFromUrl = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const success = await extractAndVerifyToken();
    return {
      success,
      message: success ? 'Email verification successful' : 'No valid token found',
    };
  }, [extractAndVerifyToken]);

  // Auto-verify on mount only (remove dependency loop)
  useEffect(() => {
    if (autoProcessToken) {
      extractAndVerifyToken();
    }
  }, [autoProcessToken]); // Empty dependency array - only run on mount

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): SignupState => ({ ...state }), [state]);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    state.lastAttemptTimestamp !== null &&
    Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS;

  const canComplete = state.phase === 'email_verified' && !!state.profileToken;
  const canCancel = ['email_sending', 'email_sent', 'email_verifying', 'failed'].includes(state.phase);

  // Progress calculation
  const getProgress = useCallback((): number => {
    switch (state.phase) {
      case 'idle':
        return 0;
      case 'email_sending':
        return 25;
      case 'email_sent':
        return 50;
      case 'email_verifying':
        return 65;
      case 'email_verified':
        return 75;
      case 'profile_completing':
        return 90;
      case 'completed':
        return 100;
      case 'canceled':
        return 0;
      case 'failed':
        return state.retryCount > 0 ? 25 : 0;
      default:
        return 0;
    }
  }, [state.phase]);

  const getCurrentStep = useCallback((): string => {
    switch (state.phase) {
      case 'idle':
        return 'Ready to start signup';
      case 'email_sending':
        return 'Sending verification email...';
      case 'email_sent':
        return 'Verification email sent';
      case 'email_verifying':
        return 'Verifying email...';
      case 'email_verified':
        return 'Email verified successfully';
      case 'profile_completing':
        return 'Creating your account...';
      case 'completed':
        return 'Account created successfully!';
      case 'canceled':
        return 'Signup canceled';
      case 'failed':
        return 'Signup failed';
      default:
        return 'Unknown step';
    }
  }, [state.phase]);

  const getNextStep = useCallback((): string | null => {
    switch (state.phase) {
      case 'idle':
        return 'Enter email to begin';
      case 'email_sending':
        return 'Check your email';
      case 'email_sent':
        return 'Click the link in your email';
      case 'email_verifying':
        return 'Complete your profile';
      case 'email_verified':
        return 'Fill out profile information';
      case 'profile_completing':
        return 'Almost done...';
      case 'completed':
        return null;
      case 'canceled':
        return 'Start over if needed';
      case 'failed':
        return canRetry ? 'Try again' : 'Contact support';
      default:
        return null;
    }
  }, [state.phase]);

  return {
    // Enhanced actions
    start,
    cancel,
    complete,
    retry,

    processTokenFromUrl,

    // Core state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    canRetry,
    canComplete,
    canCancel,
    retryCount: state.retryCount,

    // Convenience state getters
    isIdle: state.phase === 'idle',
    isEmailSending: state.phase === 'email_sending',
    isEmailSent: state.phase === 'email_sent',
    isEmailVerifying: state.phase === 'email_verifying',
    isEmailVerified: state.phase === 'email_verified',
    isProfileCompleting: state.phase === 'profile_completing',
    isCompleted: state.phase === 'completed',
    isCanceled: state.phase === 'canceled',
    isFailed: state.phase === 'failed',

    // Progress tracking
    progress: getProgress(),
    currentStep: getCurrentStep(),
    nextStep: getNextStep(),

    // Enhanced utilities
    clearError,
    reset,
    getDebugInfo,
  };
};
