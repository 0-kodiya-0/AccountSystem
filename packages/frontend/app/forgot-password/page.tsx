'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle, Eye, EyeOff } from 'lucide-react';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { AuthGuard, usePasswordReset } from '../../../sdk/auth-react-sdk/src';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  const {
    requestReset,
    resetPassword,
    phase,
    loading,
    error,
    hasValidToken,
    canResetPassword,
    isCompleted,
    clearError,
    reset,
  } = usePasswordReset();

  // Handle password reset request
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) {
      return;
    }

    const callbackUrl = `${window.location.origin}/forgot-password`;

    const result = await requestReset({
      email: email.trim(),
      callbackUrl,
    });

    if (result.success) {
      // Email sent - user will see confirmation
    }
  };

  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!passwordData.password || !passwordData.confirmPassword) {
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      return;
    }

    const result = await resetPassword({
      password: passwordData.password,
      confirmPassword: passwordData.confirmPassword,
    });

    if (result.success) {
      // Password reset successfully
    }
  };

  // Handle password input changes
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Redirect to login after completion
  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push('/login?passwordReset=true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, router]);

  const renderRequestForm = () => (
    <form onSubmit={handleRequestReset} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
          disabled={loading}
        />
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

      <Button type="submit" className="w-full" loading={loading}>
        Send Reset Email
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
        <p className="text-sm text-muted-foreground">We&apos;ve sent a password reset link to {email}</p>
        <p className="text-sm text-muted-foreground mt-2">Click the link in the email to reset your password.</p>
      </div>
      <Button variant="outline" onClick={reset}>
        Use a different email
      </Button>
    </div>
  );

  const renderResetForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-lg font-medium">Reset your password</h3>
        <p className="text-sm text-muted-foreground">Enter your new password below</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={passwordData.password}
            onChange={handlePasswordChange}
            placeholder="Enter your new password"
            required
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordData.password && <PasswordStrengthIndicator password={passwordData.password} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            placeholder="Confirm your new password"
            required
            disabled={loading}
            error={!!(passwordData.confirmPassword && passwordData.password !== passwordData.confirmPassword)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordData.confirmPassword && passwordData.password !== passwordData.confirmPassword && (
          <p className="text-sm text-destructive">Passwords do not match</p>
        )}
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

      <Button
        type="submit"
        className="w-full"
        loading={loading}
        disabled={passwordData.password !== passwordData.confirmPassword}
      >
        Reset Password
      </Button>
    </form>
  );

  const renderCompletionMessage = () => (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-6 h-6 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-green-600">Password reset successfully!</h3>
        <p className="text-sm text-muted-foreground">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <p className="text-sm text-muted-foreground mt-2">Redirecting you to sign in...</p>
      </div>
    </div>
  );

  const getTitle = () => {
    if (isCompleted) return 'Password Reset Complete';
    if (phase === 'reset_email_sent') return 'Check Your Email';
    if (canResetPassword) return 'Reset Password';
    return 'Forgot Password';
  };

  const getDescription = () => {
    if (isCompleted) return 'Your password has been successfully updated';
    if (phase === 'reset_email_sent') return "We've sent you a password reset link";
    if (canResetPassword) return 'Enter your new password below';
    return 'Enter your email to receive a password reset link';
  };

  return (
    <AuthGuard
      allowGuests={true}
      requireAccount={false}
      redirectOnAuthenticated={process.env.NEXT_PUBLIC_HOME_URL}
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <AuthLayout title={getTitle()} description={getDescription()} showBackToHome={true}>
        {isCompleted ? (
          renderCompletionMessage()
        ) : phase === 'reset_email_sent' ? (
          renderEmailSentMessage()
        ) : canResetPassword ? (
          renderResetForm()
        ) : (
          <div className="space-y-6">
            {renderRequestForm()}

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
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
