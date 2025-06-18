'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Settings, Shield, ArrowRight, Check, Users, Crown, Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { AuthGuard, useSession, useAccount, useAuthService } from '../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

// Account Card Component
interface AccountCardProps {
  account: any;
  isCurrent: boolean;
  onSwitch: (accountId: string) => void;
  onLogout: (accountId: string) => void;
  onSettings: (accountId: string) => void;
}

function AccountCard({ account, isCurrent, onSwitch, onLogout, onSettings }: AccountCardProps) {
  const displayName = formatAccountName(
    account.userDetails.firstName,
    account.userDetails.lastName,
    account.userDetails.name,
  );

  const getAccountTypeIcon = () => {
    if (account.accountType === 'oauth') {
      return <Crown className="w-4 h-4 text-amber-500" />;
    }
    return <Shield className="w-4 h-4 text-blue-500" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Card
      className={`relative transition-all duration-200 hover:shadow-lg cursor-pointer group ${
        isCurrent ? 'ring-2 ring-primary shadow-md bg-primary/5' : 'hover:bg-accent/50'
      }`}
      onClick={() => !isCurrent && onSwitch(account.id)}
    >
      {isCurrent && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative">
              <UserAvatar name={displayName} imageUrl={account.userDetails.imageUrl} size="lg" />
              {isCurrent && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={`font-semibold text-lg truncate ${isCurrent ? 'text-primary' : ''}`}>{displayName}</h3>
                {isCurrent && (
                  <Badge variant="default" className="text-xs font-medium">
                    Current
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground truncate mb-2">{account.userDetails.email}</p>

              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <Badge variant="outline" className="text-xs flex items-center space-x-1">
                  {getAccountTypeIcon()}
                  <span>{account.accountType === 'oauth' ? account.provider : 'Local'}</span>
                </Badge>

                <Badge className={`text-xs ${getStatusColor(account.status)}`} variant="outline">
                  {account.status}
                </Badge>

                {account.security?.twoFactorEnabled && (
                  <Badge variant="outline" className="text-green-600 text-xs flex items-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>2FA</span>
                  </Badge>
                )}

                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {Math.floor((Date.now() - new Date(account.created).getTime()) / (1000 * 60 * 60 * 24))}d
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {!isCurrent && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwitch(account.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Switch
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSettings(account.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onLogout(account.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Stats Component
interface QuickStatsProps {
  accounts: any[];
}

function QuickStats({ accounts }: QuickStatsProps) {
  const totalAccounts = accounts.length;
  const localAccounts = accounts.filter((acc) => acc.accountType === 'local').length;
  const oauthAccounts = accounts.filter((acc) => acc.accountType === 'oauth').length;
  const protectedAccounts = accounts.filter((acc) => acc.security?.twoFactorEnabled).length;

  const stats = [
    {
      label: 'Total Accounts',
      value: totalAccounts,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: 'OAuth Accounts',
      value: oauthAccounts,
      icon: Crown,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    },
    {
      label: 'Local Accounts',
      value: localAccounts,
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      label: '2FA Protected',
      value: protectedAccounts,
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Main Component
export default function AccountsPage() {
  const router = useRouter();
  const { accounts, currentAccountId, operations: sessionOps, isAuthenticated } = useSession();
  const currentAccount = useAccount();
  const authService = useAuthService();

  const handleSwitchAccount = async (accountId: string) => {
    try {
      await sessionOps.setCurrentAccount(accountId);
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
      await sessionOps.logoutAll();
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

  // Loading state
  if (!isAuthenticated) {
    return <LoadingSpinner reason="Loading accounts..." />;
  }

  // Empty state
  if (accounts.length === 0) {
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
            {currentAccount?.data && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span>Current Active Account</span>
                  </CardTitle>
                  <CardDescription>You are currently signed in with this account</CardDescription>
                </CardHeader>
                <CardContent>
                  <AccountCard
                    account={currentAccount.data}
                    isCurrent={true}
                    onSwitch={handleSwitchAccount}
                    onLogout={handleLogoutAccount}
                    onSettings={handleAccountSettings}
                  />
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
                    onClick={() => currentAccount && handleAccountSettings(currentAccount.id)}
                    disabled={!currentAccount}
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
