'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Settings, ArrowRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthGuard, useSession, useAuthService } from '../../../sdk/auth-react-sdk/src';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import QuickStats from '@/components/accounts-switch/quick-stats';
import AccountCard from '@/components/accounts-switch/account-card';

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, currentAccountId, isAuthenticated, setCurrentAccount, logoutAll } = useSession({
    autoLoadSessionAccounts: true,
  });
  const authService = useAuthService();

  const handleSwitchAccount = async (accountId: string) => {
    try {
      await setCurrentAccount(accountId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  };

  const handleLogoutAccount = async (accountId: string) => {
    try {
      await authService.logout(accountId);
      // Session will auto-refresh through the hook
    } catch (error) {
      console.error('Failed to logout account:', error);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAll();
      router.push('/login');
    } catch (error) {
      console.error('Failed to logout all accounts:', error);
    }
  };

  const handleAccountSettings = (accountId: string) => {
    router.push(`/accounts/${accountId}/settings`);
  };

  const handleAddAccount = () => {
    router.push('/login?mode=add');
  };

  // Show empty state if no accounts
  if (isAuthenticated && accounts.length === 0) {
    return (
      <AuthGuard
        allowGuests={false}
        requireAccount={true}
        redirectToLogin="/login"
        loadingComponent={LoadingSpinner}
        redirectingComponent={RedirectingDisplay}
        errorComponent={ErrorDisplay}
      >
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="text-center space-y-8">
              <div>
                <h1 className="text-3xl font-bold">No Accounts Found</h1>
                <p className="text-muted-foreground">
                  You don&apos;t have any accounts yet. Create one to get started.
                </p>
              </div>

              <Card className="p-12 max-w-md mx-auto">
                <div className="space-y-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Plus className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Get Started</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign in with an existing account or create a new one
                    </p>
                  </div>
                  <Button onClick={handleAddAccount} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectToLogin="/login"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Account Management</h1>
                <p className="text-muted-foreground">
                  Manage and switch between your {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button variant="outline" onClick={handleLogoutAll}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out All
                </Button>
                <Button onClick={handleAddAccount}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <QuickStats accounts={accounts} />

            {/* Current Account Highlight */}
            {currentAccountId && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span>Current Active Account</span>
                  </CardTitle>
                  <CardDescription>You are currently signed in with this account</CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts
                    .filter((account) => account.id === currentAccountId)
                    .map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        isCurrent={true}
                        onSwitch={handleSwitchAccount}
                        onLogout={handleLogoutAccount}
                        onSettings={handleAccountSettings}
                      />
                    ))}
                </CardContent>
              </Card>
            )}

            {/* All Accounts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Accounts</h2>
                <p className="text-sm text-muted-foreground">
                  {accounts.length} account{accounts.length !== 1 ? 's' : ''} total
                </p>
              </div>

              <div className="grid gap-4">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isCurrent={currentAccountId === account.id}
                    onSwitch={handleSwitchAccount}
                    onLogout={handleLogoutAccount}
                    onSettings={handleAccountSettings}
                  />
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common account management tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="justify-start h-auto p-4 space-x-3" onClick={handleAddAccount}>
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Add New Account</div>
                      <div className="text-sm text-muted-foreground">Sign in or create another account</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4 space-x-3"
                    onClick={() => currentAccountId && handleAccountSettings(currentAccountId)}
                    disabled={!currentAccountId}
                  >
                    <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <Settings className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Account Settings</div>
                      <div className="text-sm text-muted-foreground">Manage current account settings</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4 space-x-3"
                    onClick={() => router.push('/dashboard')}
                  >
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Go to Dashboard</div>
                      <div className="text-sm text-muted-foreground">Return to your main dashboard</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
