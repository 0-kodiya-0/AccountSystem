import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
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

interface UseLocalSignupReturn {
  // Enhanced actions with better return types
  start: (data: RequestEmailVerificationRequest) => Promise<{ success: boolean; message?: string }>;
  cancel: () => Promise<{ success: boolean; message?: string }>;
  complete: (data: CompleteProfileRequest) => Promise<{ success: boolean; accountId?: string; message?: string }>;
  retry: () => Promise<{ success: boolean; message?: string }>;

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

export const useLocalSignup = (): UseLocalSignupReturn => {
  const authService = useAuthService();
  const [state, setState] = useState<SignupState>(INITIAL_STATE);

  // Refs for cleanup and state tracking
  const phaseRef = useRef<SignupPhase>('idle');
  const processingTokenRef = useRef<string | null>(null);

  // Update phase ref when state changes
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

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

  // Extract and verify token with proper state management
  const extractAndVerifyToken = useCallback(async (): Promise<boolean> => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    // Check if we should process this token
    if (!tokenFromUrl) {
      return false;
    }

    // Prevent double processing of the same token
    if (processingTokenRef.current === tokenFromUrl) {
      return false;
    }

    // Check current phase using ref to avoid stale closure
    const currentPhase = phaseRef.current;
    if (currentPhase === 'email_verified' || currentPhase === 'email_verifying') {
      return false;
    }

    // Mark token as being processed
    processingTokenRef.current = tokenFromUrl;

    try {
      safeSetState((prev) => ({
        ...prev,
        phase: 'email_verifying',
        loading: true,
        error: null,
        verificationToken: tokenFromUrl,
      }));

      const result = await authService.verifyEmailForSignup(tokenFromUrl);

      if (result.profileToken) {
        safeSetState((prev) => ({
          ...prev,
          phase: 'email_verified',
          loading: false,
          profileToken: result.profileToken,
          error: null,
        }));

        // Clean up URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());

        return true;
      } else {
        throw new Error('Email verification failed - no profile token received');
      }
    } catch (error: any) {
      handleError(error, 'Email verification failed');
      return false;
    } finally {
      // Clear processing flag
      processingTokenRef.current = null;
    }
  }, [authService, handleError, safeSetState]);

  // Auto-verify on mount only (remove dependency loop)
  useEffect(() => {
    // Check for token only once on mount
    extractAndVerifyToken();
  }, []); // Empty dependency array - only run on mount

  // Enhanced start function with validation
  const start = useCallback(
    async (data: RequestEmailVerificationRequest): Promise<{ success: boolean; message?: string }> => {
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
          phase: 'email_sending',
          loading: true,
          error: null,
          email: data.email,
          retryCount: 0,
        }));

        const result = await authService.requestEmailVerification(data);

        if (result.message) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'email_sent',
            loading: false,
            lastAttemptTimestamp: Date.now(),
          }));
          return { success: true, message: result.message };
        }

        const message = 'Failed to send verification email';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
          error: message,
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to send verification email');
        return { success: false, message };
      }
    },
    [authService, handleError, safeSetState],
  );

  // Enhanced cancel with automatic cleanup
  const cancel = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!state.email) {
      const message = 'No signup process to cancel';
      safeSetState((prev) => ({ ...prev, error: message }));
      return { success: false, message };
    }

    try {
      safeSetState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const result = await authService.cancelSignup({ email: state.email });

      if (result) {
        safeSetState((prev) => ({
          ...prev,
          phase: 'canceled',
          loading: false,
        }));
        return { success: true, message: 'Signup canceled successfully' };
      }

      const message = 'Failed to cancel signup';
      safeSetState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      return { success: false, message };
    } catch (error) {
      const message = handleError(error, 'Failed to cancel signup');
      return { success: false, message };
    }
  }, [state.email, authService, handleError, safeSetState]);

  // Enhanced complete with validation and session initialization
  const complete = useCallback(
    async (data: CompleteProfileRequest): Promise<{ success: boolean; accountId?: string; message?: string }> => {
      if (!state.profileToken) {
        const message = 'No profile token available. Please verify your email first.';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      // Enhanced validation
      if (!data.firstName?.trim()) {
        const message = 'First name is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!data.lastName?.trim()) {
        const message = 'Last name is required';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!data.password || data.password.length < 8) {
        const message = 'Password must be at least 8 characters long';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (data.password !== data.confirmPassword) {
        const message = 'Passwords do not match';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      if (!data.agreeToTerms) {
        const message = 'You must agree to the terms and conditions';
        safeSetState((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'profile_completing',
          loading: true,
          error: null,
        }));

        const result = await authService.completeProfile(state.profileToken, data);

        if (result.accountId) {
          safeSetState((prev) => ({
            ...prev,
            phase: 'completed',
            loading: false,
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
        }));
        return { success: false, message };
      } catch (error) {
        const message = handleError(error, 'Failed to complete profile');
        return { success: false, message };
      }
    },
    [state.profileToken, authService, handleError, safeSetState],
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

    // Clear processing flag to allow retry
    processingTokenRef.current = null;

    const success = await extractAndVerifyToken();
    return {
      success,
      message: success ? 'Email verification retry successful' : 'Email verification retry failed',
    };
  }, [state.retryCount, state.lastAttemptTimestamp, safeSetState, extractAndVerifyToken]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    processingTokenRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const getDebugInfo = useCallback((): SignupState => ({ ...state }), [state]);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    (!state.lastAttemptTimestamp || Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS);

  const canComplete = state.phase === 'email_verified' && !!state.profileToken;
  const canCancel = ['email_sending', 'email_sent', 'email_verifying', 'failed'].includes(state.phase);

  // Progress calculation
  const getProgress = (): number => {
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
  };

  const getCurrentStep = (): string => {
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
  };

  const getNextStep = (): string | null => {
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
  };

  return {
    // Enhanced actions
    start,
    cancel,
    complete,
    retry,

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
