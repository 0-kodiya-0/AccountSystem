'use client';

import React from 'react';
import { LogOut, Settings, Shield, ArrowRight, Check, Crown, Clock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { formatAccountName } from '@/lib/utils';

// Account Card Component
interface AccountCardProps {
  account: any;
  isCurrent: boolean;
  onSwitch: (accountId: string) => void;
  onLogout: (accountId: string) => void;
  onSettings: (accountId: string) => void;
}

export default function AccountCard({ account, isCurrent, onSwitch, onLogout, onSettings }: AccountCardProps) {
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
