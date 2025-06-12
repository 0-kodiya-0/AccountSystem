'use client';

import * as React from 'react';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, CheckCircle, Key } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { AccountDropdown } from '@/components/auth/account-dropdown';
import { UserAvatar } from '@/components/auth/user-avatar';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { AuthGuard, useAccount, useAuth } from '../../../../../sdk/auth-react-sdk/src';
import { formatAccountName, getEnvironmentConfig, validatePasswordStrength } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import { ErrorDisplay } from '@/components/auth/error-display';

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const accountId = params.accountId as string;

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Use useAccount hook to get account data
  const { account, isLoading, error, clearError } = useAccount(accountId);

  const { changePassword } = useAuth();
  const config = getEnvironmentConfig();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setError: setFormError,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const watchedNewPassword = watch('newPassword');
  const passwordStrength = watchedNewPassword ? validatePasswordStrength(watchedNewPassword) : null;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading account settings...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Account not found</h1>
          <p className="text-muted-foreground">{error || 'Unable to load account data'}</p>
          <div className="space-x-2">
            <Button onClick={() => clearError()} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => router.push('/accounts')}>Back to Accounts</Button>
          </div>
        </div>
      </div>
    );
  }

  // Only show for local accounts
  if (account.accountType !== 'local') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Not Available</h1>
          <p className="text-muted-foreground">Password changes are only available for local accounts.</p>
          <Button onClick={() => router.push(`/accounts/${accountId}/settings`)}>Back to Settings</Button>
        </div>
      </div>
    );
  }

  const displayName = formatAccountName(
    account.userDetails.firstName,
    account.userDetails.lastName,
    account.userDetails.name,
  );

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setIsChanging(true);

      await changePassword(accountId, {
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      toast({
        title: 'Password changed successfully',
        description: 'Your password has been updated. Please sign in again for security.',
        variant: 'success',
      });

      // Clear form
      reset();

      // Redirect to settings after a short delay
      setTimeout(() => {
        router.push(`/accounts/${accountId}/settings`);
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';

      // Check for specific error types and set appropriate field errors
      if (errorMessage.toLowerCase().includes('current') || errorMessage.toLowerCase().includes('old')) {
        setFormError('oldPassword', { message: 'Current password is incorrect' });
      } else {
        toast({
          title: 'Password change failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <AuthGuard
      requireAccount
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">A</span>
                  </div>
                  <span className="text-xl font-bold">{config.appName}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <AccountDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="space-y-8">
            {/* Page Header */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <UserAvatar name={displayName} imageUrl={account.userDetails.imageUrl} size="lg" />
                <div>
                  <h1 className="text-3xl font-bold">Change Password</h1>
                  <p className="text-muted-foreground">Update your password to keep your account secure</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant="secondary">Local Account</Badge>
                {account.security?.twoFactorEnabled && (
                  <Badge variant="outline" className="text-green-600">
                    <Key className="w-3 h-3 mr-1" />
                    2FA Protected
                  </Badge>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Security Best Practices</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Use a unique password not used elsewhere</li>
                    <li>• Include uppercase, lowercase, numbers, and symbols</li>
                    <li>• Make it at least 8 characters long</li>
                    <li>• Avoid common words or personal information</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <Card>
              <CardHeader>
                <CardTitle>Update Password</CardTitle>
                <CardDescription>Enter your current password and choose a new secure password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="oldPassword"
                        type={showOldPassword ? 'text' : 'password'}
                        placeholder="Enter your current password"
                        error={!!errors.oldPassword}
                        disabled={isChanging}
                        {...register('oldPassword')}
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        disabled={isChanging}
                      >
                        {showOldPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.oldPassword && <p className="text-sm text-destructive">{errors.oldPassword.message}</p>}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Enter your new password"
                        error={!!errors.newPassword}
                        disabled={isChanging}
                        {...register('newPassword')}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isChanging}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
                    {watchedNewPassword && <PasswordStrengthIndicator password={watchedNewPassword} />}
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your new password"
                        error={!!errors.confirmPassword}
                        disabled={isChanging}
                        {...register('confirmPassword')}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isChanging}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <Button type="submit" disabled={isChanging || !passwordStrength?.isValid} loading={isChanging}>
                      Change Password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(`/accounts/${accountId}/settings`)}
                      disabled={isChanging}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
