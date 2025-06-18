'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Shield,
  Key,
  Calendar,
  User,
  LogOut,
  Users,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { AuthGuard, useSession, useAccount } from '../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

// Token Status Component
interface TokenStatusProps {
  accountId: string;
}

function TokenStatus({ accountId }: TokenStatusProps) {
  const currentAccount = useAccount(accountId);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const loadTokenInfo = async () => {
    if (!currentAccount) return;

    setLoading(true);
    try {
      const info = await currentAccount.operations.getTokenInformation();
      setTokenInfo(info);
    } catch (error) {
      console.error('Failed to load token info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokenInfo();
  }, [accountId]);

  const formatTimeRemaining = (timeRemaining?: number) => {
    if (!timeRemaining) return 'Unknown';

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getTokenStatusBadge = (token: any) => {
    if (!token) return null;

    if (token.isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expired
        </Badge>
      );
    } else if (token.isValid) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          Valid
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs">
          Invalid
        </Badge>
      );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Token Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner reason="Loading token information..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tokenInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Token Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No token information available</p>
            <Button variant="outline" onClick={loadTokenInfo} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Token Information</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTokens(!showTokens)}>
              {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={loadTokenInfo}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <CardDescription>Authentication tokens and session information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Type Info */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              {tokenInfo.accountType === 'oauth' ? (
                <ExternalLink className="w-5 h-5 text-primary" />
              ) : (
                <Shield className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium capitalize">{tokenInfo.accountType} Account</p>
              <p className="text-sm text-muted-foreground">
                {tokenInfo.accountType === 'oauth' ? 'Third-party authentication' : 'Local authentication'}
              </p>
            </div>
          </div>
        </div>

        {/* Access Token */}
        {tokenInfo.hasAccessToken && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>Access Token</span>
              </h4>
              {getTokenStatusBadge(tokenInfo.accessToken)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Type</p>
                <p className="text-sm font-mono">{tokenInfo.accessToken?.type || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Expires In</p>
                <p className="text-sm">
                  {tokenInfo.accessToken?.timeRemaining
                    ? formatTimeRemaining(tokenInfo.accessToken.timeRemaining)
                    : 'Unknown'}
                </p>
              </div>
            </div>

            {showTokens && tokenInfo.accessToken?.oauthAccessToken && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Token Value</p>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                    {tokenInfo.accessToken.oauthAccessToken}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(tokenInfo.accessToken.oauthAccessToken)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Refresh Token */}
        {tokenInfo.hasRefreshToken && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Token</span>
              </h4>
              {getTokenStatusBadge(tokenInfo.refreshToken)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Type</p>
                <p className="text-sm font-mono">{tokenInfo.refreshToken?.type || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Expires In</p>
                <p className="text-sm">
                  {tokenInfo.refreshToken?.timeRemaining
                    ? formatTimeRemaining(tokenInfo.refreshToken.timeRemaining)
                    : 'Unknown'}
                </p>
              </div>
            </div>

            {showTokens && tokenInfo.refreshToken?.oauthRefreshToken && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Token Value</p>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                    {tokenInfo.refreshToken.oauthRefreshToken}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(tokenInfo.refreshToken.oauthRefreshToken)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token Actions */}
        {tokenInfo.accountType === 'oauth' && (
          <div className="flex space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (currentAccount) {
                  await currentAccount.operations.revokeTokens();
                  loadTokenInfo();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Key className="w-4 h-4 mr-2" />
              Revoke Tokens
            </Button>
            <Button variant="outline" size="sm" onClick={loadTokenInfo}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Info
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Security Overview Component
interface SecurityOverviewProps {
  account: any;
}

function SecurityOverview({ account }: SecurityOverviewProps) {
  const securityScore = () => {
    let score = 0;
    if (account.security?.twoFactorEnabled) score += 40;
    if (account.accountType === 'oauth') score += 30;
    if (account.status === 'active') score += 20;
    if (account.userDetails.emailVerified) score += 10;
    return score;
  };

  const score = securityScore();
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Security Overview</span>
        </CardTitle>
        <CardDescription>Your account security status and recommendations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Score */}
        <div className="text-center space-y-2">
          <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</div>
          <p className="text-sm text-muted-foreground">Security Score - {getScoreLabel(score)}</p>
        </div>

        {/* Security Features */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Two-Factor Authentication</span>
            </div>
            {account.security?.twoFactorEnabled ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Key className="w-4 h-4" />
              <span className="text-sm">Account Type</span>
            </div>
            <Badge variant={account.accountType === 'oauth' ? 'default' : 'secondary'}>
              {account.accountType === 'oauth' ? account.provider : 'Local'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Email Verified</span>
            </div>
            {account.userDetails.emailVerified ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Info className="w-4 h-4" />
              <span className="text-sm">Account Status</span>
            </div>
            <Badge variant={account.status === 'active' ? 'default' : 'destructive'}>{account.status}</Badge>
          </div>
        </div>

        {/* Recommendations */}
        {score < 100 && (
          <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-medium text-sm">Security Recommendations</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {!account.security?.twoFactorEnabled && <li>• Enable two-factor authentication for better security</li>}
              {account.accountType === 'local' && <li>• Consider using OAuth for additional security layers</li>}
              {!account.userDetails.emailVerified && <li>• Verify your email address</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
export default function DashboardPage() {
  const router = useRouter();
  const { accounts } = useSession();
  const currentAccount = useAccount();

  // Load current account data if available and not loaded
  useEffect(() => {
    if (currentAccount && !currentAccount.data && currentAccount.isIdle) {
      currentAccount.operations.load();
    }
  }, [currentAccount]);

  const handleLogout = async () => {
    if (currentAccount) {
      await currentAccount.operations.logout();
    }
  };

  const handleSwitchAccounts = () => {
    router.push('/accounts');
  };

  const handleAccountSettings = () => {
    if (currentAccount) {
      router.push(`/accounts/${currentAccount.id}/settings`);
    }
  };

  const renderAccountInfo = () => {
    if (!currentAccount?.data) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 animate-pulse rounded-full" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-gray-200 animate-pulse rounded" />
                <div className="w-48 h-3 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const account = currentAccount.data;
    const displayName = formatAccountName(
      account.userDetails.firstName,
      account.userDetails.lastName,
      account.userDetails.name,
    );

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <UserAvatar name={displayName} imageUrl={account.userDetails.imageUrl} size="xl" />
              <div>
                <h2 className="text-2xl font-bold">{displayName}</h2>
                <p className="text-muted-foreground">{account.userDetails.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant={account.accountType === 'oauth' ? 'default' : 'secondary'}>
                    {account.accountType === 'oauth' ? account.provider : 'Local Account'}
                  </Badge>
                  <Badge variant="outline">{account.status}</Badge>
                  {account.security?.twoFactorEnabled && (
                    <Badge variant="outline" className="text-green-600">
                      <Shield className="w-3 h-3 mr-1" />
                      2FA Enabled
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleAccountSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              {accounts.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleSwitchAccounts}>
                  <Users className="w-4 h-4 mr-2" />
                  Switch Account
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAccountStats = () => {
    if (!currentAccount?.data) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-gray-200 animate-pulse rounded" />
                  <div className="w-16 h-6 bg-gray-200 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const account = currentAccount.data;
    const accountAge = Math.floor((Date.now() - new Date(account.created).getTime()) / (1000 * 60 * 60 * 24));

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Age</p>
                <p className="text-2xl font-bold">{accountAge} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Security</p>
                <p className="text-2xl font-bold">{account.security?.twoFactorEnabled ? 'Protected' : 'Basic'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Type</p>
                <p className="text-2xl font-bold capitalize">{account.accountType}</p>
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
      redirectToAccountSelection="/accounts"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your account.</p>
            </div>

            {/* Account Info */}
            {renderAccountInfo()}

            {/* Account Stats */}
            {renderAccountStats()}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                {/* Security Overview */}
                {currentAccount?.data && <SecurityOverview account={currentAccount.data} />}
              </div>

              {/* Right Column */}
              <div className="space-y-8">
                {/* Token Information */}
                {currentAccount?.id && <TokenStatus accountId={currentAccount.id} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
