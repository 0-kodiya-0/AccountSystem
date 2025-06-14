'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/auth-layout';
import { getEnvironmentConfig } from '@/lib/utils';
import { AuthGuard, useAuth } from '../../../sdk/auth-react-sdk/src';
import { ErrorDisplay } from '@/components/auth/error-display';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const config = getEnvironmentConfig();
  const { requestPasswordReset } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      await requestPasswordReset(data.email);

      setIsSuccess(true);
      setMessage('Password reset email sent successfully!');
      console.log('Password reset requested for:', data.email);
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const email = getValues('email');
    if (email) {
      try {
        setIsLoading(true);
        setError(null);

        await requestPasswordReset(email);

        setMessage('Password reset email sent again!');
        console.log('Password reset resent for:', email);
      } catch (err: any) {
        console.error('Password reset resend failed:', err);
        setError(err.message || 'Failed to resend password reset email. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  // Show success state
  if (isSuccess) {
    return (
      <AuthGuard
        allowGuests={true}
        requireAccount={false}
        redirectOnAuthenticated="/dashboard"
        errorComponent={ErrorDisplay}
        loadingComponent={LoadingSpinner}
        redirectingComponent={RedirectingDisplay}
      >
        <AuthLayout title="Check your email" description="We've sent password reset instructions to your email">
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Password reset email sent</h3>
                <p className="text-sm text-muted-foreground">
                  {message ||
                    `We've sent a password reset link to ${getValues(
                      'email',
                    )}. Click the link in the email to reset your password.`}
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">What to do next:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Check your email inbox (and spam folder)</li>
                <li>• Click the reset link in the email</li>
                <li>• Create a new password</li>
                <li>• Sign in with your new password</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full" onClick={handleResend} disabled={isLoading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend email
              </Button>

              <div className="text-center">
                <Button variant="ghost" className="text-sm" onClick={handleBackToLogin}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to sign in
                </Button>
              </div>
            </div>
          </div>
        </AuthLayout>
      </AuthGuard>
    );
  }

  // Show request form
  return (
    <AuthGuard
      allowGuests={true}
      requireAccount={false}
      redirectOnAuthenticated="/dashboard"
      errorComponent={ErrorDisplay}
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
    >
      <AuthLayout
        title="Forgot your password?"
        description="Enter your email address and we'll send you a reset link"
        showBackToHome={!!config.homeUrl}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              error={!!errors.email || !!error}
              disabled={isLoading}
              {...register('email')}
              autoComplete="email"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">We&apos;ll send reset instructions to this email address</p>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading} loading={isLoading}>
            Send reset email
          </Button>
        </form>

        {/* Back to login */}
        <div className="text-center">
          <Button variant="ghost" className="text-sm" onClick={handleBackToLogin}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    </AuthGuard>
  );
}
