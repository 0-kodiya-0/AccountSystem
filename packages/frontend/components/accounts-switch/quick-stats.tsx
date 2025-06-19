'use client';

import React from 'react';
import { Shield, Users, Crown } from 'lucide-react';

import { Card } from '@/components/ui/card';

// Quick Stats Component
interface QuickStatsProps {
  accounts: any[];
}

export default function QuickStats({ accounts }: QuickStatsProps) {
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
