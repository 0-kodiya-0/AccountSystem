'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthCallbackHandler, CallbackCode } from '../../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type StatusType = 'processing' | 'success' | 'error' | 'redirecting';

interface StatusState {
  type: StatusType;
  title: string;
  message: string;
  redirectIn?: number;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const config = getEnvironmentConfig();

  const [status, setStatus] = useState<StatusState>({
    type: 'processing',
    title: 'Processing authentication...',
    message: 'Please wait while we complete your request.',
  });

  const [countdown, setCountdown] = useState<number>(0);

  // Countdown effect for redirects
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const redirectWithCountdown = (url: string, delay: number = 3) => {
    setCountdown(delay);
    setTimeout(() => {
      router.replace(url);
    }, delay * 1000);
  };

  // Use the callback handler hook with custom overrides
  const { handleAuthCallback } = useAuthCallbackHandler({
    // OAuth success handlers with UI updates
    onOAuthSigninSuccess: async (data) => {
      console.log('OAuth signin success:', data.name);
      setStatus({
        type: 'success',
        title: 'Sign in successful!',
        message: `Welcome back, ${data.name}! Redirecting to your dashboard...`,
      });
      redirectWithCountdown(config.homeUrl || '/dashboard', 2);
    },

    onOAuthSignupSuccess: async (data) => {
      console.log('OAuth signup success:', data.name);
      setStatus({
        type: 'success',
        title: 'Account created successfully!',
        message: `Welcome to our platform, ${data.name}! Redirecting to your dashboard...`,
      });
      redirectWithCountdown(config.homeUrl || '/dashboard', 2);
    },

    onOAuthPermissionSuccess: async (data) => {
      console.log('OAuth permission success:', data.service, data.scopeLevel);
      setStatus({
        type: 'success',
        title: 'Permissions granted!',
        message: `Successfully granted ${data.service} ${data.scopeLevel} permissions. Redirecting...`,
      });
      redirectWithCountdown(config.homeUrl || '/dashboard', 2);
    },

    // Error handlers with UI updates - using correct CallbackCode enum
    onError: async (data) => {
      console.error('Authentication error:', data.error, 'Code:', data.code);

      let title = 'Authentication failed';
      let message = data.error || 'Authentication failed. Please try again.';
      let redirectUrl = '/login';

      // Handle specific error types based on code
      switch (data.code) {
        case CallbackCode.OAUTH_ERROR:
          title = 'OAuth authentication failed';
          message = data.error || 'OAuth authentication failed. Please try again.';
          break;
        case CallbackCode.PERMISSION_ERROR:
          title = 'Permission request failed';
          message = data.error || 'Permission request failed. Returning to dashboard.';
          redirectUrl = config.homeUrl || '/dashboard';
          break;
        default:
          title = 'Unknown error';
          message = 'An unexpected error occurred during authentication.';
          break;
      }

      setStatus({
        type: 'error',
        title,
        message,
      });
      redirectWithCountdown(redirectUrl, 4);
    },
  });

  const handleCallback = async () => {
    try {
      // Get all URL parameters from current page
      const params = new URLSearchParams(window.location.search);

      console.log('Starting handleAuthCallback with params:', params);
      await handleAuthCallback(params);
      console.log('handleAuthCallback completed');
    } catch (error: any) {
      console.error('Auth callback error:', error);
      setStatus({
        type: 'error',
        title: 'Authentication failed',
        message: error.message || 'There was a problem processing your authentication.',
      });
      redirectWithCountdown('/login', 4);
    }
  };

  useEffect(() => {
    // Check if we have any URL parameters at all
    const params = new URLSearchParams(window.location.search);

    if (params.size > 0) {
      console.log('Callback params found:', Object.fromEntries(params.entries()));
      // Add small delay to ensure component is fully mounted
      handleCallback();
    } else {
      // No parameters, redirect to login
      setStatus({
        type: 'error',
        title: 'Invalid callback',
        message: 'No authentication parameters found in the URL.',
      });
      redirectWithCountdown('/login', 3);
    }
  }, []);

  const getStatusIcon = () => {
    switch (status.type) {
      case 'success':
        return <CheckCircle className="w-16 h-16 md:w-20 md:h-20 text-green-500" />;
      case 'error':
        return <XCircle className="w-16 h-16 md:w-20 md:h-20 text-red-500" />;
      case 'redirecting':
        return <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-blue-500" />;
      default:
        return (
          <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        );
    }
  };

  const getStatusColor = () => {
    switch (status.type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'redirecting':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container text-center">
        <div className="auth-card p-8 space-y-6">
          {/* Status Icon */}
          <div className="flex justify-center">{getStatusIcon()}</div>

          {/* Status Content */}
          <div className="space-y-3">
            <h2 className={`text-xl font-semibold ${getStatusColor()}`}>{status.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{status.message}</p>
          </div>

          {/* Countdown - Just time display */}
          {countdown > 0 && (
            <div className="pt-4">
              <div className="inline-flex items-center justify-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Manual redirect link for errors */}
          {status.type === 'error' && (
            <div className="pt-4">
              <button
                onClick={() => router.push('/login')}
                className="text-sm text-primary hover:underline transition-colors duration-200"
              >
                Click here if you&apos;re not redirected automatically
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
