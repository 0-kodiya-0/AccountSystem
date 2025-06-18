'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthGuard, OAuthProviders, useLocalSignin, useOAuthSignin } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

export default function LoginPage() {
  const router = useRouter();
  const config = getEnvironmentConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Local signin hook
  const {
    signin: localSignin,
    verify2FA: localVerify2FA,
    phase: localPhase,
    loading: localLoading,
    error: localError,
    requiresTwoFactor: localRequires2FA,
    accountName: localAccountName,
    clearError: clearLocalError,
    reset: resetLocal,
  } = useLocalSignin();

  // OAuth signin hook
  const {
    startSignin: startOAuthSignin,
    verify2FA: oauthVerify2FA,
    phase: oauthPhase,
    loading: oauthLoading,
    error: oauthError,
    requiresTwoFactor: oauthRequires2FA,
    accountName: oauthAccountName,
    clearError: clearOAuthError,
    reset: resetOAuth,
  } = useOAuthSignin();

  // Determine current state
  const isLoading = localLoading || oauthLoading;
  const currentError = localError || oauthError;
  const requiresTwoFactor = localRequires2FA || oauthRequires2FA;
  const accountName = localAccountName || oauthAccountName;
  const isCompleted = localPhase === 'completed' || oauthPhase === 'completed';

  useEffect(() => {
    console.log('OAuth Debug:', {
      oauthPhase,
      oauthLoading,
      localLoading,
      isLoading,
      oauthError,
      localError,
    });
  }, [oauthPhase, oauthLoading, localLoading, isLoading, oauthError, localError]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle local signin
  const handleLocalSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearLocalError();

    if (!formData.email.trim()) {
      return;
    }

    const result = await localSignin({
      email: formData.email.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe,
    });

    if (result.success) {
      // Will be handled by completion effect
    }
  };

  // Handle OAuth signin
  const handleOAuthSignin = async (provider: OAuthProviders) => {
    clearOAuthError();
    const callbackUrl = `${window.location.origin}/login`;

    console.log(await startOAuthSignin(provider, callbackUrl));
  };

  // Handle 2FA verification
  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!twoFactorCode.trim()) {
      return;
    }

    // Use appropriate 2FA verification based on which flow is active
    if (localRequires2FA) {
      const result = await localVerify2FA(twoFactorCode);
      if (result.success) {
        // Will be handled by completion effect
      }
    } else if (oauthRequires2FA) {
      const result = await oauthVerify2FA(twoFactorCode);
      if (result.success) {
        // Will be handled by completion effect
      }
    }
  };

  // Handle completion redirect
  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, router]);

  // Reset all states
  const resetAll = () => {
    resetLocal();
    resetOAuth();
    setTwoFactorCode('');
    setFormData({
      email: '',
      password: '',
      rememberMe: false,
    });
  };

  const renderSigninForm = () => (
    <form onSubmit={handleLocalSignin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Enter your email"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            required
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="rememberMe"
          name="rememberMe"
          type="checkbox"
          checked={formData.rememberMe}
          onChange={handleInputChange}
          disabled={isLoading}
          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
        />
        <Label htmlFor="rememberMe" className="text-sm">
          Remember me
        </Label>
      </div>

      {currentError && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{currentError}</div>}

      <Button type="submit" className="w-full" loading={localLoading}>
        Sign In
      </Button>
    </form>
  );

  const render2FAForm = () => (
    <form onSubmit={handle2FAVerification} className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground">Hi {accountName}, please enter your verification code</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="twoFactorCode">Verification Code</Label>
        <Input
          id="twoFactorCode"
          name="twoFactorCode"
          type="text"
          value={twoFactorCode}
          onChange={(e) => setTwoFactorCode(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
          required
          disabled={oauthLoading}
          className="text-center text-lg tracking-widest"
        />
      </div>

      {currentError && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{currentError}</div>}

      <div className="space-y-3">
        <Button type="submit" className="w-full" loading={oauthLoading}>
          Verify Code
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={resetAll}>
          Back to Sign In
        </Button>
      </div>
    </form>
  );

  const renderOAuthButtons = () => (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      {config.enableOAuth && (
        <div className="grid grid-cols-1 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthSignin(OAuthProviders.Google)}
            disabled={oauthLoading}
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        </div>
      )}
    </div>
  );

  const renderCompletionMessage = () => (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-medium text-green-600">Welcome back!</h3>
        <p className="text-sm text-muted-foreground">Redirecting you to your dashboard...</p>
      </div>
    </div>
  );

  return (
    <AuthGuard
      allowGuests={true}
      requireAccount={false}
      redirectOnAuthenticated="/dashboard"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <AuthLayout title="Welcome back" description="Sign in to your account to continue" showBackToHome={true}>
        {isCompleted ? (
          renderCompletionMessage()
        ) : requiresTwoFactor ? (
          render2FAForm()
        ) : (
          <div className="space-y-6">
            {renderSigninForm()}
            {renderOAuthButtons()}

            <div className="text-center space-y-2">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot your password?
              </Link>
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        )}
      </AuthLayout>
    </AuthGuard>
  );
}
