'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Chrome } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AuthLayout } from '@/components/layout/auth-layout';
import { LoadingState, OAuthProviders, useAuth } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';

// Base form data type that includes all possible fields
type LoginFormData = {
  email: string;
  username: string;
  password: string;
  rememberMe: boolean;
  loginType: 'email' | 'username'; // Track which type is being used
};

// Create the Zod schema with conditional validation using refine
const createLoginSchema = () => {
  return z
    .object({
      email: z.string(),
      username: z.string(),
      password: z.string().min(1, 'Password is required'),
      rememberMe: z.boolean(),
      loginType: z.enum(['email', 'username']),
    })
    .refine(
      (data) => {
        // Conditional validation based on loginType
        if (data.loginType === 'email') {
          // When using email, validate email field
          if (!data.email || data.email.trim() === '') {
            return false;
          }
          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(data.email);
        } else {
          // When using username, validate username field
          if (!data.username || data.username.trim() === '') {
            return false;
          }
          return data.username.length >= 1;
        }
      },
      {
        message: 'Please provide a valid email address or username',
        path: ['email'], // Show error on email field by default
      },
    );
};

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [useEmail, setUseEmail] = useState(true);

  const { login, startOAuthSignin, session, clearError } = useAuth();
  const config = getEnvironmentConfig();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    clearErrors,
    setError,
    trigger,
  } = useForm<LoginFormData>({
    resolver: zodResolver(createLoginSchema()),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      rememberMe: false,
      loginType: 'email',
    },
  });

  const handleInputTypeChange = async (newUseEmail: boolean) => {
    setUseEmail(newUseEmail);

    // Update the loginType field to trigger proper validation
    setValue('loginType', newUseEmail ? 'email' : 'username');

    // Clear the field that's not being used and its errors
    if (newUseEmail) {
      setValue('username', '');
      clearErrors('username');
    } else {
      setValue('email', '');
      clearErrors('email');
    }

    // Clear any existing validation errors
    clearErrors();

    // Re-trigger validation after a short delay
    setTimeout(() => trigger(), 100);
  };

  const onSubmit = async (data: LoginFormData) => {
    console.log('Form submitted with data:', data);

    try {
      // Clear any previous errors
      clearError('global');

      // Additional client-side validation based on current mode
      if (useEmail) {
        if (!data.email || data.email.trim() === '') {
          setError('email', { message: 'Email is required' });
          return;
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
          setError('email', { message: 'Please enter a valid email address' });
          return;
        }
      } else {
        if (!data.username || data.username.trim() === '') {
          setError('username', { message: 'Username is required' });
          return;
        }
      }

      if (!data.password || data.password.trim() === '') {
        setError('password', { message: 'Password is required' });
        return;
      }

      const loginData = {
        email: useEmail ? data.email : undefined,
        username: !useEmail ? data.username : undefined,
        password: data.password,
        rememberMe: data.rememberMe ?? false,
      };

      console.log('Sending login request with:', loginData);

      const result = await login(loginData);
      console.log('Login result:', result);

      if (result?.requiresTwoFactor) {
        console.log('2FA required, redirecting...');
        router.push('/two-factor-verify');
        return;
      }

      // Success - redirect to intended destination
      toast({
        title: 'Welcome back!',
        description: 'You have been successfully signed in.',
        variant: 'success',
      });

      console.log('Login successful, redirecting to:', config.homeUrl || '/dashboard');
      const redirectUrl = config.homeUrl || '/dashboard';
      router.push(redirectUrl);
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check your credentials and try again.';
      toast({
        title: 'Sign in failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleOAuthLogin = (provider: OAuthProviders) => {
    console.log('OAuth login clicked for provider:', provider);
    try {
      startOAuthSignin(provider);
    } catch (error: unknown) {
      console.error('OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to start OAuth sign in process.';
      toast({
        title: 'OAuth sign in failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account to continue"
      showBackToHome={!!config.homeUrl}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden field for login type */}
        <input type="hidden" {...register('loginType')} />

        {/* OAuth Buttons */}
        {config.enableOAuth && (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthLogin(OAuthProviders.Google)}
              disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
          </div>
        )}

        {/* Login Type Toggle */}
        {config.enableLocalAuth && (
          <div className="flex items-center justify-center space-x-2">
            <Button
              type="button"
              variant={useEmail ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleInputTypeChange(true)}
              className="text-xs"
            >
              Email
            </Button>
            <Button
              type="button"
              variant={!useEmail ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleInputTypeChange(false)}
              className="text-xs"
            >
              Username
            </Button>
          </div>
        )}

        {/* Email/Username Field */}
        {config.enableLocalAuth && (
          <div className="space-y-2">
            <Label htmlFor={useEmail ? 'email' : 'username'}>{useEmail ? 'Email address' : 'Username'}</Label>
            {useEmail ? (
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                error={!!errors.email}
                disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
                {...register('email')}
                autoComplete="email"
              />
            ) : (
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                error={!!errors.username}
                disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
                {...register('username')}
                autoComplete="username"
              />
            )}
            {useEmail && errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            {!useEmail && errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
          </div>
        )}

        {/* Password Field */}
        {config.enableLocalAuth && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                error={!!errors.password}
                disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
                {...register('password')}
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
              </Button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
        )}

        {/* Remember Me */}
        {config.enableLocalAuth && (
          <div className="flex items-center space-x-2">
            <input
              id="rememberMe"
              type="checkbox"
              className="rounded border-gray-300 text-primary focus:ring-primary"
              disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
              {...register('rememberMe')}
            />
            <Label htmlFor="rememberMe" className="text-sm">
              Remember me for 30 days
            </Label>
          </div>
        )}

        {/* Submit Button */}
        {config.enableLocalAuth && (
          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting || session.loadingState === LoadingState.LOADING}
            disabled={isSubmitting || session.loadingState === LoadingState.LOADING}
            onClick={() => console.log('Sign in button clicked, form valid:', Object.keys(errors).length === 0)}
          >
            Sign in
          </Button>
        )}
      </form>

      {/* Sign Up Link */}
      <div className="text-center text-sm">
        <span className="text-muted-foreground">Don&apos;t have an account? </span>
        <Link href="/signup" className="text-primary hover:underline font-medium">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
