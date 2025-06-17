'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { AuthGuard, OAuthProviders, useLocalSignup, useOAuthSignup } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

export default function SignupPage() {
  const router = useRouter();
  const config = getEnvironmentConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  // Local signup hook
  const {
    start: startLocalSignup,
    complete: completeLocalSignup,
    phase: localPhase,
    loading: localLoading,
    error: localError,
    canComplete: canCompleteLocal,
    clearError: clearLocalError,
    reset: resetLocal,
  } = useLocalSignup();

  // OAuth signup hook
  const {
    startSignup: startOAuthSignup,
    phase: oauthPhase,
    loading: oauthLoading,
    error: oauthError,
    accountId: oauthAccountId,
    clearError: clearOAuthError,
    reset: resetOAuth,
  } = useOAuthSignup();

  // Determine current state
  const isLoading = localLoading || oauthLoading;
  const currentError = localError || oauthError;
  const isCompleted = localPhase === 'completed' || oauthPhase === 'completed';
  const isEmailSent = localPhase === 'email_sent';
  const isEmailVerified = localPhase === 'email_verified';

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle email verification request
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearLocalError();

    if (!formData.email.trim()) {
      return;
    }

    const callbackUrl = `${window.location.origin}/signup`;

    const result = await startLocalSignup({
      email: formData.email.trim(),
      callbackUrl,
    });

    if (result.success) {
      // Email sent - user will be shown email verification UI
    }
  };

  // Handle profile completion
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    clearLocalError();

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.agreeToTerms
    ) {
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      return;
    }

    const result = await completeLocalSignup({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      agreeToTerms: formData.agreeToTerms,
    });

    if (result.success) {
      // Account created successfully
    }
  };

  // Handle OAuth signup
  const handleOAuthSignup = async (provider: OAuthProviders) => {
    clearOAuthError();
    const callbackUrl = `${window.location.origin}/signup`;

    await startOAuthSignup(provider, callbackUrl);
  };

  // Handle completion redirect
  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push('/login?accountCreated=true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, router]);

  // Reset all states
  const resetAll = () => {
    resetLocal();
    resetOAuth();
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    });
  };

  const renderEmailForm = () => (
    <form onSubmit={handleEmailSignup} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Enter your email address"
          required
          disabled={isLoading}
        />
      </div>

      {currentError && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{currentError}</div>}

      <Button type="submit" className="w-full" loading={isLoading}>
        Continue with Email
      </Button>
    </form>
  );

  const renderEmailSentMessage = () => (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
        <Mail className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium">Check your email</h3>
        <p className="text-sm text-muted-foreground">We&apos;ve sent a verification link to {formData.email}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Click the link in the email to continue creating your account.
        </p>
      </div>
      <Button variant="outline" onClick={resetAll}>
        Use a different email
      </Button>
    </div>
  );

  const renderProfileForm = () => (
    <form onSubmit={handleCompleteProfile} className="space-y-4">
      <div className="text-center space-y-2 mb-6">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium">Email verified!</h3>
        <p className="text-sm text-muted-foreground">Complete your profile to finish creating your account</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleInputChange}
            placeholder="John"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleInputChange}
            placeholder="Doe"
            required
            disabled={isLoading}
          />
        </div>
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
            placeholder="Create a strong password"
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
        {formData.password && <PasswordStrengthIndicator password={formData.password} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Confirm your password"
            required
            disabled={isLoading}
            error={!!(formData.confirmPassword && formData.password !== formData.confirmPassword)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
          <p className="text-sm text-destructive">Passwords do not match</p>
        )}
      </div>

      <div className="flex items-start space-x-2">
        <input
          id="agreeToTerms"
          name="agreeToTerms"
          type="checkbox"
          checked={formData.agreeToTerms}
          onChange={handleInputChange}
          disabled={isLoading}
          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-0.5"
          required
        />
        <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed">
          I agree to the{' '}
          {config.termsUrl ? (
            <Link href={config.termsUrl} className="text-primary hover:underline" target="_blank">
              Terms of Service
            </Link>
          ) : (
            <span className="text-primary">Terms of Service</span>
          )}{' '}
          and{' '}
          {config.privacyUrl ? (
            <Link href={config.privacyUrl} className="text-primary hover:underline" target="_blank">
              Privacy Policy
            </Link>
          ) : (
            <span className="text-primary">Privacy Policy</span>
          )}
        </Label>
      </div>

      {currentError && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{currentError}</div>}

      <Button
        type="submit"
        className="w-full"
        loading={isLoading}
        disabled={!formData.agreeToTerms || formData.password !== formData.confirmPassword}
      >
        Create Account
      </Button>
    </form>
  );

  const renderOAuthButtons = () => (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
        </div>
      </div>

      {config.enableOAuth && (
        <div className="grid grid-cols-1 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthSignup(OAuthProviders.Google)}
            disabled={isLoading}
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
            Sign up with Google
          </Button>
        </div>
      )}
    </div>
  );

  const renderCompletionMessage = () => (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-6 h-6 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-green-600">Account created successfully!</h3>
        <p className="text-sm text-muted-foreground">Redirecting you to sign in...</p>
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
      session={{
        data: null,
        loading: false,
        error: null,
      }}
    >
      <AuthLayout
        title="Create your account"
        description="Sign up to get started with your new account"
        showBackToHome={true}
      >
        {isCompleted ? (
          renderCompletionMessage()
        ) : isEmailSent ? (
          renderEmailSentMessage()
        ) : isEmailVerified && canCompleteLocal ? (
          renderProfileForm()
        ) : (
          <div className="space-y-6">
            {renderEmailForm()}
            {renderOAuthButtons()}

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        )}
      </AuthLayout>
    </AuthGuard>
  );
}
