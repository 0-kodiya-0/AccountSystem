'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Download, CheckCircle, QrCode } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { downloadBackupCodes } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface SecuritySettingsProps {
  account: any;
  twoFactorAuth: any; // The useTwoFactorAuth hook result
  oauthPermissions: any; // The useOAuthPermissions hook result
  onPasswordChange: (data: any) => Promise<void>;
  on2FAToggle: (enabled: boolean, password?: string) => Promise<void>;
  on2FAVerification: (token: string) => Promise<void>;
  onGenerateBackupCodes: (password?: string) => Promise<string[]>;
  onRequestPermissions: (provider: string, scopes: string[], callbackUrl: string) => Promise<void>;
  onReauthorizePermissions: (provider: string, callbackUrl: string) => Promise<void>;
  onRevokeTokens: () => Promise<void>;
  loading: boolean;
}

export default function SecuritySettings({
  account,
  twoFactorAuth,
  oauthPermissions,
  onPasswordChange,
  on2FAToggle,
  on2FAVerification,
  onGenerateBackupCodes,
  onRequestPermissions,
  onReauthorizePermissions,
  onRevokeTokens,
  loading,
}: SecuritySettingsProps) {
  const { toast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
    twoFA: false,
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFAData, setTwoFAData] = useState({
    password: '',
    verificationToken: '',
  });

  // Use the 2FA status from the hook
  const twoFactorEnabled = twoFactorAuth?.isEnabled || false;
  const setupData = twoFactorAuth?.setupData;
  const isSettingUp = twoFactorAuth?.isSettingUp || false;
  const isVerifyingSetup = twoFactorAuth?.isVerifyingSetup || false;
  const isCompleted = twoFactorAuth?.isCompleted || false;

  // Show setup modal when setup data is available
  useEffect(() => {
    if (setupData?.qrCode) {
      setShow2FASetup(true);
    }
  }, [setupData]);

  useEffect(() => {
    console.log(twoFactorAuth, isVerifyingSetup);
  }, [twoFactorAuth, isVerifyingSetup]);

  // Reset setup form when 2FA is completed or enabled
  useEffect(() => {
    if (isCompleted || twoFactorEnabled) {
      setShow2FASetup(false);
      setTwoFAData({ password: '', verificationToken: '' });
    }
  }, [isCompleted, twoFactorEnabled]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handle2FADataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTwoFAData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onPasswordChange({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error) {
      console.error('Failed to change password:', error);
    }
  };

  const handle2FAToggle = async (enabled: boolean) => {
    try {
      if (enabled && account?.accountType === 'local') {
        // For local accounts, we need a password - show setup form
        setShow2FASetup(true);
      } else if (enabled) {
        // For OAuth accounts, proceed directly
        await on2FAToggle(enabled);
      } else {
        // Disabling 2FA
        await on2FAToggle(enabled);
      }
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
    }
  };

  const handleSetup2FA = async () => {
    try {
      await on2FAToggle(true, twoFAData.password);
    } catch (error) {
      console.error('Failed to setup 2FA:', error);
    }
  };

  const handleVerify2FA = async () => {
    try {
      await on2FAVerification(twoFAData.verificationToken);
      // Don't reset here - let the useEffect handle it
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
    }
  };

  const handleCancel2FASetup = () => {
    setShow2FASetup(false);
    setTwoFAData({ password: '', verificationToken: '' });
    // Reset the 2FA hook state if needed
    if (twoFactorAuth?.reset) {
      twoFactorAuth.reset();
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      const codes = await onGenerateBackupCodes(account?.accountType === 'local' ? twoFAData.password : undefined);
      if (codes.length > 0) {
        downloadBackupCodes(codes);
      }
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Security Settings</span>
          </CardTitle>
          <CardDescription>Manage your account security and authentication methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Management */}
          {account?.accountType === 'local' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Password</h4>
                  <p className="text-sm text-muted-foreground">Change your account password</p>
                </div>
                <Button variant="outline" onClick={() => setShowPasswordForm(!showPasswordForm)} disabled={loading}>
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="oldPassword"
                        name="oldPassword"
                        type={showPasswords.old ? 'text' : 'password'}
                        value={passwordData.oldPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter current password"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('old')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter new password"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordData.newPassword && <PasswordStrengthIndicator password={passwordData.newPassword} />}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Confirm new password"
                        required
                        disabled={loading}
                        error={
                          !!(passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-sm text-destructive">Passwords do not match</p>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      loading={loading}
                      disabled={passwordData.newPassword !== passwordData.confirmPassword}
                    >
                      Update Password
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowPasswordForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Two-Factor Authentication */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <div className="flex items-center space-x-2">
                {twoFactorEnabled && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                )}
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handle2FAToggle}
                  disabled={loading || isSettingUp || isVerifyingSetup || show2FASetup}
                />
              </div>
            </div>

            {twoFactorEnabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium text-green-800 dark:text-green-200">2FA is Active</h5>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                      Your account is protected with two-factor authentication
                      {twoFactorAuth?.hasBackupCodes && ` (${twoFactorAuth.backupCodesCount} backup codes available)`}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleGenerateBackupCodes} disabled={loading}>
                      <Download className="w-4 h-4 mr-2" />
                      Generate New Backup Codes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Account Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Account Status</h4>
                <p className="text-sm text-muted-foreground">Current status of your account</p>
              </div>
              <Badge variant={account?.status === 'active' ? 'default' : 'destructive'}>{account?.status}</Badge>
            </div>
          </div>

          {/* OAuth Permissions (for OAuth accounts) */}
          {account?.accountType === 'oauth' && oauthPermissions && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">OAuth Permissions</h4>
                  <p className="text-sm text-muted-foreground">Manage permissions and tokens for this OAuth account</p>
                </div>
              </div>

              {/* OAuth Status */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium text-blue-800 dark:text-blue-200">OAuth Account</h5>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      This account uses {account.provider} for authentication
                      {oauthPermissions.grantedScopes?.length > 0 &&
                        ` with ${oauthPermissions.grantedScopes.length} granted permissions`}
                    </p>

                    {/* OAuth Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onRequestPermissions(
                            account.provider,
                            ['email', 'profile'],
                            `${window.location.origin}/accounts/${account.id}/settings?tab=security`,
                          )
                        }
                        disabled={loading || oauthPermissions.isRequesting}
                      >
                        {oauthPermissions.isRequesting ? 'Requesting...' : 'Request Additional Permissions'}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onReauthorizePermissions(
                            account.provider,
                            `${window.location.origin}/accounts/${account.id}/settings?tab=security`,
                          )
                        }
                        disabled={loading || oauthPermissions.isReauthorizing}
                      >
                        {oauthPermissions.isReauthorizing ? 'Reauthorizing...' : 'Reauthorize Permissions'}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRevokeTokens}
                        disabled={loading}
                        className="text-destructive hover:text-destructive"
                      >
                        Revoke All Tokens
                      </Button>
                    </div>

                    {/* Show granted scopes if available */}
                    {oauthPermissions.grantedScopes?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Granted Permissions:</p>
                        <div className="flex flex-wrap gap-1">
                          {oauthPermissions.grantedScopes.map((scope: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show callback message if available */}
                    {oauthPermissions.callbackMessage && (
                      <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300">
                        {oauthPermissions.callbackMessage}
                      </div>
                    )}

                    {/* Show error if failed */}
                    {oauthPermissions.isFailed && oauthPermissions.error && (
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300">
                        {oauthPermissions.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="w-5 h-5" />
              <span>Two-Factor Authentication Setup</span>
            </CardTitle>
            <CardDescription>
              {!setupData ? 'Enter your password to begin setup' : 'Scan the QR code and enter verification code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!setupData ? (
              // Step 1: Get password (for local accounts)
              account?.accountType === 'local' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="twoFAPassword">Account Password</Label>
                    <div className="relative">
                      <Input
                        id="twoFAPassword"
                        name="password"
                        type={showPasswords.twoFA ? 'text' : 'password'}
                        value={twoFAData.password}
                        onChange={handle2FADataChange}
                        placeholder="Enter your account password"
                        required
                        disabled={isSettingUp}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('twoFA')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.twoFA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleSetup2FA} loading={isSettingUp} disabled={!twoFAData.password}>
                      {isSettingUp ? 'Starting...' : 'Start Setup'}
                    </Button>
                    <Button variant="outline" onClick={handleCancel2FASetup}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            ) : (
              // Step 2: Show QR code and verify
              <div className="space-y-4">
                {setupData.qrCode && (
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white rounded-lg">
                      <img
                        src={setupData.qrCode}
                        alt="2FA QR Code"
                        className="w-48 h-48"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Scan this QR code with your authenticator app</p>
                  </div>
                )}

                {setupData.secret && (
                  <div className="space-y-2">
                    <Label>Manual Entry Key</Label>
                    <div className="p-2 bg-muted rounded font-mono text-sm break-all">{setupData.secret}</div>
                    <p className="text-xs text-muted-foreground">
                      If you can't scan the QR code, enter this key manually in your authenticator app
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="verificationToken">Verification Code</Label>
                  <Input
                    id="verificationToken"
                    name="verificationToken"
                    type="text"
                    value={twoFAData.verificationToken}
                    onChange={handle2FADataChange}
                    placeholder="Enter 6-digit code from your app"
                    maxLength={6}
                    disabled={isSettingUp}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={handleVerify2FA}
                    loading={isSettingUp}
                    disabled={twoFAData.verificationToken.length !== 6}
                  >
                    Verify & Enable
                  </Button>
                  <Button variant="outline" onClick={handleCancel2FASetup}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
