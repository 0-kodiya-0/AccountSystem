'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useEmailVerification, EmailVerificationStatus } from '../../../sdk/auth-react-sdk/src';
import { useEffect } from 'react';

export default function EmailVerificationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const { status, message, error, isLoading, verify } = useEmailVerification({
    token,
    onSuccess: (message) => {
      console.log('Email verification successful:', message);
    },
    onError: (error) => {
      console.error('Email verification failed:', error);
    },
  });

  // Auto-verify when component mounts if we have a token
  useEffect(() => {
    if (token && status === EmailVerificationStatus.LOADING) {
      verify();
    }
  }, [status]);

  const getContent = () => {
    switch (status) {
      case EmailVerificationStatus.LOADING:
        return {
          icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
          title: 'Verifying your email...',
          description: 'Please wait while we verify your email address.',
          showActions: false,
        };

      case EmailVerificationStatus.SUCCESS:
        return {
          icon: <CheckCircle className="w-12 h-12 text-green-600" />,
          title: 'Email verified successfully!',
          description: message || 'Your account has been activated. You will be redirected to sign in shortly.',
          showActions: true,
          actionText: 'Continue to sign in',
          actionOnClick: () => router.push('/login'),
        };

      case EmailVerificationStatus.EXPIRED_TOKEN:
        return {
          icon: <XCircle className="w-12 h-12 text-destructive" />,
          title: 'Verification link expired',
          description: 'This verification link has expired. Please request a new verification email.',
          showActions: true,
          actionText: 'Request new verification',
          actionOnClick: () => router.push('/signup'),
          secondaryActionText: 'Back to sign in',
          secondaryActionOnClick: () => router.push('/login'),
        };

      case EmailVerificationStatus.INVALID_TOKEN:
      case EmailVerificationStatus.ERROR:
      default:
        return {
          icon: <XCircle className="w-12 h-12 text-destructive" />,
          title: 'Verification failed',
          description: error || "We couldn't verify your email address.",
          showActions: true,
          actionText: 'Try again',
          actionOnClick: verify,
          secondaryActionText: 'Back to sign up',
          secondaryActionOnClick: () => router.push('/signup'),
        };
    }
  };

  const content = getContent();

  // Handle case where no token is provided
  if (!token) {
    return (
      <AuthLayout title="Invalid verification link" description="No verification token provided">
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Invalid verification link</h3>
              <p className="text-sm text-muted-foreground">
                This verification link is invalid or missing required information.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full" onClick={() => router.push('/signup')}>
              Sign up for an account
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
              Back to sign in
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={content.title} description={content.description}>
      <div className="space-y-6">
        {/* Status Icon */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">{content.icon}</div>
        </div>

        {/* Additional Information */}
        {status === EmailVerificationStatus.SUCCESS && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Account Activated</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Your email address has been successfully verified and your account is now active. You can now sign in
                  and access all features.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {content.showActions && (
          <div className="space-y-3">
            {content.actionOnClick && (
              <Button className="w-full" onClick={content.actionOnClick} disabled={isLoading}>
                {content.actionText}
              </Button>
            )}

            {content.secondaryActionOnClick && (
              <Button variant="outline" className="w-full" onClick={content.secondaryActionOnClick}>
                {content.secondaryActionText}
              </Button>
            )}
          </div>
        )}

        {/* Auto-redirect notice for success */}
        {status === EmailVerificationStatus.SUCCESS && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              You will be automatically redirected to sign in in a few seconds.
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
