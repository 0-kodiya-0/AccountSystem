'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Download, CheckCircle } from 'lucide-react';

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
  onPasswordChange: (data: any) => Promise<void>;
  on2FAToggle: (enabled: boolean) => Promise<void>;
  onGenerateBackupCodes: () => Promise<string[]>;
  loading: boolean;
}

export default function SecuritySettings({
  account,
  onPasswordChange,
  on2FAToggle,
  onGenerateBackupCodes,
  loading,
}: SecuritySettingsProps) {
  const { toast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(account?.security?.twoFactorEnabled || false);

  useEffect(() => {
    setTwoFactorEnabled(account?.security?.twoFactorEnabled || false);
  }, [account]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
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

      toast({
        title: 'Success',
        description: 'Password updated successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to change password:', error);
    }
  };

  const handle2FAToggle = async (enabled: boolean) => {
    try {
      await on2FAToggle(enabled);
      setTwoFactorEnabled(enabled);

      toast({
        title: 'Success',
        description: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
      setTwoFactorEnabled(!enabled); // Revert on error
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      const codes = await onGenerateBackupCodes();
      downloadBackupCodes(codes);

      toast({
        title: 'Success',
        description: 'Backup codes generated and downloaded',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
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
              <Switch checked={twoFactorEnabled} onCheckedChange={handle2FAToggle} disabled={loading} />
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
                  </p>
                  <Button variant="outline" size="sm" onClick={handleGenerateBackupCodes} disabled={loading}>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Backup Codes
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
      </CardContent>
    </Card>
  );
}
