'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Settings, Shield, ArrowRight, Check } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { AuthGuard, useSession } from '../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

export default function AccountsPage() {
  const router = useRouter();
  const { session, currentAccount, accounts, operations } = useSession();

  // Load session on mount
  useEffect(() => {
    if (session.isIdle && !session.data) {
      operations.load();
    }
  }, [session.isIdle, session.data, operations]);

  // Load account data for each account
  useEffect(() => {
    accounts.forEach((account) => {
      if (account.isIdle && !account.data) {
        account.operations.load();
      }
    });
  }, [accounts]);

  const handleSwitchAccount = async (accountId: string) => {
    try {
      await operations.setCurrentAccount(accountId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  };

  const handleLogoutAccount = async (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      await account.operations.logout();
      // Session will be automatically updated after logout
    }
  };

  const handleLogoutAll = async () => {
    await operations.logoutAll();
    router.push('/login');
  };

  const handleAddAccount = () => {
    router.push('/login?add=true');
  };

  const renderAccountCard = (account: (typeof accounts)[0]) => {
    const isLoading = account.isLoading;
    const isCurrent = currentAccount?.id === account.id;
    const accountData = account.data;

    if (isLoading || !accountData) {
      return (
        <Card key={account.id} className="relative">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-4 bg-gray-200 animate-pulse rounded" />
                <div className="w-48 h-3 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const displayName = formatAccountName(
      accountData.userDetails.firstName,
      accountData.userDetails.lastName,
      accountData.userDetails.name,
    );

    return (
      <Card
        key={account.id}
        className={`relative cursor-pointer transition-all hover:shadow-md ${isCurrent ? 'ring-2 ring-primary' : ''}`}
        onClick={() => !isCurrent && handleSwitchAccount(account.id)}
      >
        {isCurrent && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <UserAvatar name={displayName} imageUrl={accountData.userDetails.imageUrl} size="lg" />
              <div>
                <h3 className="font-semibold text-lg">{displayName}</h3>
                <p className="text-sm text-muted-foreground">{accountData.userDetails.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant={accountData.accountType === 'oauth' ? 'default' : 'secondary'}>
                    {accountData.accountType === 'oauth' ? accountData.provider : 'Local'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {accountData.status}
                  </Badge>
                  {accountData.security?.twoFactorEnabled && (
                    <Badge variant="outline" className="text-green-600 text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      2FA
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchAccount(account.id);
                  }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Switch
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/accounts/${account.id}/settings`);
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogoutAccount(account.id);
                }}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <Card className="text-center p-12">
      <CardContent>
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium">No accounts found</h3>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any accounts yet. Create one to get started.
            </p>
          </div>
          <Button onClick={handleAddAccount}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderAccountsHeader = () => (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Your Accounts</h1>
        <p className="text-muted-foreground">
          Manage and switch between your {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        {accounts.length > 0 && (
          <Button variant="outline" onClick={handleLogoutAll}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out All
          </Button>
        )}
        <Button onClick={handleAddAccount}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>
    </div>
  );

  const renderAccountsList = () => {
    if (accounts.length === 0) {
      return renderEmptyState();
    }

    return <div className="space-y-4">{accounts.map((account) => renderAccountCard(account))}</div>;
  };

  const renderAccountSummary = () => {
    if (accounts.length === 0) return null;

    const localAccounts = accounts.filter((acc) => acc.data?.accountType === 'local').length;
    const oauthAccounts = accounts.filter((acc) => acc.data?.accountType === 'oauth').length;
    const protectedAccounts = accounts.filter((acc) => acc.data?.security?.twoFactorEnabled).length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Protected with 2FA</p>
                <p className="text-2xl font-bold">{protectedAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Account Types</p>
              <div className="flex space-x-4">
                <div className="text-center">
                  <p className="text-lg font-bold">{localAccounts}</p>
                  <p className="text-xs text-muted-foreground">Local</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{oauthAccounts}</p>
                  <p className="text-xs text-muted-foreground">OAuth</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectToLogin="/login"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
      session={{
        data: session.data,
        loading: session.isLoading,
        error: session.error,
      }}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-8">
            {/* Header */}
            {renderAccountsHeader()}

            {/* Account Summary */}
            {renderAccountSummary()}

            {/* Accounts List */}
            {renderAccountsList()}

            {/* Quick Actions */}
            {accounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common account management tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto p-4"
                      onClick={() => router.push('/dashboard')}
                    >
                      <ArrowRight className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Go to Dashboard</div>
                        <div className="text-sm text-muted-foreground">View your current account dashboard</div>
                      </div>
                    </Button>

                    <Button variant="outline" className="justify-start h-auto p-4" onClick={handleAddAccount}>
                      <Plus className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Add Another Account</div>
                        <div className="text-sm text-muted-foreground">Sign in or create a new account</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
