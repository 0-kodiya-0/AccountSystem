'use client';

import React, { useState, useEffect } from 'react';
import { User, Save } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { formatAccountName } from '@/lib/utils';

// [Rest of the component code from the previous artifact...]

// Profile Settings Section
interface ProfileSettingsProps {
  account: any;
  onUpdate: (updates: any) => Promise<void>;
  loading: boolean;
}

export default function ProfileSettings({ account, onUpdate, loading }: ProfileSettingsProps) {
  const [formData, setFormData] = useState({
    firstName: account?.userDetails?.firstName || '',
    lastName: account?.userDetails?.lastName || '',
    name: account?.userDetails?.name || '',
    username: account?.userDetails?.username || '',
    imageUrl: account?.userDetails?.imageUrl || '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (account) {
      const newData = {
        firstName: account.userDetails?.firstName || '',
        lastName: account.userDetails?.lastName || '',
        name: account.userDetails?.name || '',
        username: account.userDetails?.username || '',
        imageUrl: account.userDetails?.imageUrl || '',
      };
      setFormData(newData);
      setHasChanges(false);
    }
  }, [account]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      await onUpdate(formData);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const displayName = formatAccountName(
    account?.userDetails?.firstName,
    account?.userDetails?.lastName,
    account?.userDetails?.name,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="w-5 h-5" />
          <span>Profile Information</span>
        </CardTitle>
        <CardDescription>Update your personal information and profile details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Picture */}
        <div className="flex items-center space-x-4">
          <UserAvatar name={displayName} imageUrl={account?.userDetails?.imageUrl} size="xl" />
          <div>
            <h3 className="font-medium">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{account?.userDetails?.email}</p>
            <Badge variant={account?.accountType === 'oauth' ? 'default' : 'secondary'} className="mt-1">
              {account?.accountType === 'oauth' ? account.provider : 'Local Account'}
            </Badge>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Enter your first name"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Enter your last name"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your display name"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter your username"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">Profile Image URL</Label>
          <Input
            id="imageUrl"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleInputChange}
            placeholder="https://example.com/avatar.jpg"
            disabled={loading}
          />
        </div>

        {hasChanges && (
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">You have unsaved changes</p>
            <Button onClick={handleSave} loading={loading} size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
