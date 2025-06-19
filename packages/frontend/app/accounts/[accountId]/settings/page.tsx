'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Shield, LogOut, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthGuard, useAccount, useTwoFactorAuth, useOAuthPermissions } from '../../../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import SecuritySettings from '@/components/settings/security-settings';
import ProfileSettings from '@/components/settings/profile-settings';

export default function AccountSettingsPage() {
  const router = useRouter();
  const params = useParams();

  const accountId = params?.accountId as string;

  const currentAccount = useAccount(accountId);
  const twoFactorAuth = useTwoFactorAuth(accountId);
  const oauthPermissions = useOAuthPermissions(accountId);

  const [activeTab, setActiveTab] = useState('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle profile updates
  const handleProfileUpdate = async (updates: any) => {
    if (!currentAccount) return;

    try {
      await currentAccount.updateAccount(updates);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
      throw error;
    }
  };

  // Handle password change
  const handlePasswordChange = async (data: any) => {
    if (!currentAccount) return;

    try {
      await currentAccount.changePassword(data);
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
      throw error;
    }
  };

  // Handle 2FA toggle
  const handle2FAToggle = async (enabled: boolean, password?: string) => {
    if (!twoFactorAuth) return;

    try {
      if (enabled) {
        // Setup 2FA
        const setupResult = await twoFactorAuth.setup({
          enableTwoFactor: true,
          password: password || '', // Password for local accounts
        });

        if (setupResult?.qrCode) {
          setMessage({ type: 'success', text: 'Please complete 2FA setup by scanning the QR code' });
        }
      } else {
        // Disable 2FA
        await twoFactorAuth.disable(password);
        setMessage({ type: 'success', text: 'Two-factor authentication disabled' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update two-factor authentication' });
      throw error;
    }
  };

  // Handle 2FA verification (for setup completion)
  const handle2FAVerification = async (token: string) => {
    if (!twoFactorAuth) return;

    try {
      const result = await twoFactorAuth.verifySetup(token);
      if (result) {
        setMessage({ type: 'success', text: 'Two-factor authentication enabled successfully' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify 2FA setup' });
      throw error;
    }
  };

  // Handle backup codes generation
  const handleGenerateBackupCodes = async (password?: string): Promise<string[]> => {
    if (!twoFactorAuth) return [];

    try {
      const result = await twoFactorAuth.generateBackupCodes({
        password: password || '', // Password for local accounts
      });

      if (result?.backupCodes) {
        setMessage({ type: 'success', text: 'Backup codes generated successfully' });
        return result.backupCodes;
      }
      return [];
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate backup codes' });
      throw error;
    }
  };

  // Handle OAuth permissions request
  const handleRequestPermissions = async (provider: string, scopes: string[], callbackUrl: string) => {
    if (!oauthPermissions) return;

    try {
      await oauthPermissions.requestPermission(provider as any, scopes, callbackUrl);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to request permissions' });
      throw error;
    }
  };

  // Handle OAuth reauthorization
  const handleReauthorizePermissions = async (provider: string, callbackUrl: string) => {
    if (!oauthPermissions) return;

    try {
      await oauthPermissions.reauthorizePermissions(provider as any, callbackUrl);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reauthorize permissions' });
      throw error;
    }
  };

  // Handle token revocation
  const handleRevokeTokens = async () => {
    if (!currentAccount) return;

    try {
      await currentAccount.revokeTokens();
      setMessage({ type: 'success', text: 'Tokens revoked successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to revoke tokens' });
      throw error;
    }
  };

  // Handle account logout
  const handleLogout = async () => {
    if (!currentAccount) return;

    try {
      await currentAccount.logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  // Loading state
  if (!currentAccount || currentAccount.isLoading || currentAccount.isIdle) {
    return <LoadingSpinner reason="Loading account settings..." />;
  }

  // Error state
  if (currentAccount.hasError || !currentAccount.data) {
    return (
      <ErrorDisplay error={currentAccount.error || 'Failed to load account'} retry={() => currentAccount.load()} />
    );
  }

  const account = currentAccount.data;
  const displayName = formatAccountName(
    account.userDetails.firstName,
    account.userDetails.lastName,
    account.userDetails.name,
  );

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
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-8">
            {/* Status Message */}
            {message && (
              <div
                className={`p-4 rounded-lg border ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{message.text}</p>
                  <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.push('/accounts')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Accounts
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Account Settings</h1>
                  <p className="text-muted-foreground">Manage settings for {displayName}</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="w-4 h-4 mr-2 inline" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'security'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield className="w-4 h-4 mr-2 inline" />
                Security
              </button>
            </div>

            {/* Content */}
            {activeTab === 'profile' && (
              <ProfileSettings
                account={account}
                onUpdate={handleProfileUpdate}
                loading={currentAccount.isUpdating || currentAccount.isSaving}
              />
            )}

            {activeTab === 'security' && (
              <SecuritySettings
                account={account}
                twoFactorAuth={twoFactorAuth}
                oauthPermissions={oauthPermissions}
                onPasswordChange={handlePasswordChange}
                on2FAToggle={handle2FAToggle}
                on2FAVerification={handle2FAVerification}
                onGenerateBackupCodes={handleGenerateBackupCodes}
                onRequestPermissions={handleRequestPermissions}
                onReauthorizePermissions={handleReauthorizePermissions}
                onRevokeTokens={handleRevokeTokens}
                loading={currentAccount.isUpdating}
              />
            )}

            {/* Danger Zone */}
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Danger Zone</span>
                </CardTitle>
                <CardDescription>Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
                  <div>
                    <h4 className="font-medium">Sign Out</h4>
                    <p className="text-sm text-muted-foreground">Sign out of this account on this device</p>
                  </div>
                  <Button variant="destructive" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
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
