'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Shield, LogOut, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthGuard, useAccount } from '../../../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import { useToast } from '@/components/ui/use-toast';
import SecuritySettings from '@/components/settings/security-settings';
import ProfileSettings from '@/components/settings/profile-settings';

export default function AccountSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const accountId = params?.accountId as string;
  const currentAccount = useAccount(accountId);

  const [activeTab, setActiveTab] = useState('profile');

  // Handle profile updates
  const handleProfileUpdate = async (updates: any) => {
    if (!currentAccount) return;

    try {
      await currentAccount.operations.updateAccount(updates);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle password change
  const handlePasswordChange = async (data: any) => {
    if (!currentAccount) return;

    try {
      await currentAccount.operations.changePassword(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to change password',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle 2FA toggle
  const handle2FAToggle = async (enabled: boolean) => {
    if (!currentAccount) return;

    try {
      await currentAccount.operations.setup2FA({
        enableTwoFactor: enabled,
        password: '', // Will need to prompt for password for local accounts
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update two-factor authentication',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle backup codes generation
  const handleGenerateBackupCodes = async (): Promise<string[]> => {
    if (!currentAccount) return [];

    try {
      const result = await currentAccount.operations.generateBackupCodes({
        password: '', // Will need to prompt for password for local accounts
      });
      return result.backupCodes || [];
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate backup codes',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle account logout
  const handleLogout = async () => {
    if (!currentAccount) return;

    try {
      await currentAccount.operations.logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  // Loading state
  if (!currentAccount || currentAccount.isLoading) {
    return <LoadingSpinner reason="Loading account settings..." />;
  }

  // Error state
  if (currentAccount.hasError || !currentAccount.data) {
    return (
      <ErrorDisplay
        error={currentAccount.error || 'Failed to load account'}
        retry={() => currentAccount.operations.load()}
      />
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
                onPasswordChange={handlePasswordChange}
                on2FAToggle={handle2FAToggle}
                onGenerateBackupCodes={handleGenerateBackupCodes}
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
