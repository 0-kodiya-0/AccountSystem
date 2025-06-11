'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, User, Chrome, Settings, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Account, OAuthProviders, useAuth } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';
import { UserAvatar } from '@/components/auth/user-avatar';
import { LoadingSpinner } from '@/components/auth/loading-spinner';

export default function AccountSelectionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [actioningAccount, setActioningAccount] = useState<string | null>(null);

  const { accounts, switchAccount, logout, startOAuthSignin, session } = useAuth();

  const config = getEnvironmentConfig();

  const handleSwitchAccount = async (accountId: string) => {
    try {
      setSwitchingTo(accountId);
      await switchAccount(accountId);

      toast({
        title: 'Account switched successfully',
        description: 'You are now signed in to your account.',
        variant: 'success',
      });

      // Redirect to home after successful switch
      const redirectUrl = config.homeUrl || '/dashboard';
      router.push(redirectUrl);
    } catch (error: unknown) {
      toast({
        title: 'Failed to switch account',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleLogout = async (accountId: string) => {
    try {
      setActioningAccount(accountId);
      await logout(accountId);
    } catch (error: unknown) {
      toast({
        title: 'Logout failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setActioningAccount(null);
    }
  };

  const handleAddOAuthAccount = (provider: OAuthProviders) => {
    startOAuthSignin(provider);
  };

  const getAccountStatusBadge = (account: Account) => {
    if (account.accountType === 'oauth') {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Chrome className="w-3 h-3 mr-1" />
          {account.provider || 'OAuth'}
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <User className="w-3 h-3 mr-1" />
          Local
        </Badge>
      );
    }
  };

  // Inline SessionAccountCard component - only shows session data
  const SessionAccountCard = ({ account }: { account: Account }) => {
    const displayName = account.userDetails.name;
    const email = account.userDetails.email;
    const imageUrl = account.userDetails.imageUrl;

    return (
      <Card
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-primary/20"
        onClick={() => handleSwitchAccount(account.id)}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <UserAvatar name={displayName} imageUrl={imageUrl} size="lg" />
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{displayName}</CardTitle>
                {email && <CardDescription className="text-sm truncate">{email}</CardDescription>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              {getAccountStatusBadge(account)}
              {/* Note: session data doesn't include security info, so we can't show 2FA badge */}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              disabled={!!switchingTo || switchingTo === account.id}
              loading={switchingTo === account.id}
              className="group-hover:bg-primary/90"
            >
              {switchingTo === account.id ? 'Switching...' : 'Continue'}
            </Button>

            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  // Note: Settings requires full account data, so we switch first
                  handleSwitchAccount(account.id).then(() => {
                    router.push(`/accounts/${account.id}/settings`);
                  });
                }}
                disabled={!!switchingTo}
                title="Account Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout(account.id);
                }}
                disabled={!!switchingTo || actioningAccount === account.id}
                loading={actioningAccount === account.id}
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Show loading while fetching session data
  if (session.isLoading) {
    return <LoadingSpinner reason="Loading your accounts..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <span className="text-xl font-bold">{config.appName}</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              {config.homeUrl && (
                <Link href={config.homeUrl}>
                  <Button variant="ghost" size="sm">
                    Back to {config.companyName || 'Home'}
                  </Button>
                </Link>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Choose an account</h1>
              <p className="text-muted-foreground text-lg">
                {accounts.length > 0
                  ? 'Select an account to continue or add a new one'
                  : 'Get started by creating an account or signing in'}
              </p>
            </div>

            {/* Quick Stats */}
            {accounts.length > 0 && (
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Active Accounts - Only show if we have accounts */}
          {accounts.length > 0 && session.hasSession && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your accounts</h2>
                <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200">
                  Ready to use
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                  <SessionAccountCard key={account.id} account={account} />
                ))}
              </div>
            </section>
          )}

          {/* Add Account Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{accounts.length > 0 ? 'Add another account' : 'Get started'}</h2>
              <Badge
                variant="outline"
                className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
              >
                {accounts.length > 0 ? 'Add account' : 'Choose option'}
              </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* OAuth Options */}
              {config.enableOAuth && (
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <Chrome className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <span className="text-lg">Continue with Google</span>
                        <CardDescription className="text-sm mt-1">
                          Sign in with your existing Google account
                        </CardDescription>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleAddOAuthAccount(OAuthProviders.Google)}
                      disabled={!!switchingTo}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {accounts.length > 0 ? 'Add Google Account' : 'Sign in with Google'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Local Account Option */}
              {config.enableLocalAuth && (
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <span className="text-lg">{accounts.length > 0 ? 'Create new account' : 'Create account'}</span>
                        <CardDescription className="text-sm mt-1">Sign up with email and password</CardDescription>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href="/signup">
                      <Button className="w-full" variant="outline" disabled={!!switchingTo}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Account
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {/* Footer Actions */}
          <section className="border-t pt-8 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Already have an account?</p>
              <Link href="/login">
                <Button variant="ghost" disabled={!!switchingTo}>
                  Sign in to existing account
                </Button>
              </Link>
            </div>

            {/* Help text */}
            <div className="text-center text-xs text-muted-foreground max-w-2xl mx-auto">
              <p>
                For help,{' '}
                {config.supportEmail ? (
                  <Link href={`mailto:${config.supportEmail}`} className="text-primary hover:underline">
                    contact support
                  </Link>
                ) : (
                  'contact support'
                )}
                .
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
