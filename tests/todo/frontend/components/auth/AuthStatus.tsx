'use client';

import React from 'react';
import { useSession, useAccount } from '../../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
} from '@/components/ui';
import { User, Shield, Clock, CheckCircle, XCircle } from 'lucide-react';

export function AuthStatus() {
  const session = useSession();
  const account = useAccount();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (isAuthenticated: boolean, hasAccount: boolean) => {
    if (isAuthenticated && hasAccount) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Authenticated
        </Badge>
      );
    } else if (isAuthenticated && !hasAccount) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          No Account Selected
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Not Authenticated
        </Badge>
      );
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Session Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Session Status
          </CardTitle>
          <CardDescription>Current authentication and session state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            {getStatusBadge(session.isAuthenticated, session.hasAccount)}
          </div>

          {session.error && (
            <Alert variant="destructive">
              <AlertDescription>{session.error}</AlertDescription>
            </Alert>
          )}

          {session.isAuthenticated && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Account:</span>
                <span className="font-mono">{session.currentAccountId || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Accounts:</span>
                <span>{session.accountIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Loading:</span>
                <span>{session.isLoading ? 'Yes' : 'No'}</span>
              </div>
            </div>
          )}

          {session.accountIds.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Account IDs:</p>
              <div className="space-y-1">
                {session.accountIds.map((id) => (
                  <div
                    key={id}
                    className={`text-xs font-mono p-2 rounded ${
                      id === session.currentAccountId ? 'bg-primary/10 border border-primary/20' : 'bg-muted'
                    }`}
                  >
                    {id} {id === session.currentAccountId && '(current)'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Details
          </CardTitle>
          <CardDescription>Current user account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account.error && (
            <Alert variant="destructive">
              <AlertDescription>{account.error}</AlertDescription>
            </Alert>
          )}

          {account.isLoading && <div className="text-sm text-muted-foreground">Loading account data...</div>}

          {account.data && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{account.data.accountType}</Badge>
                <Badge variant={account.data.status === 'active' ? 'default' : 'secondary'}>
                  {account.data.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account ID:</span>
                  <span className="font-mono text-xs">{account.data.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{account.data.userDetails.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="text-xs">{account.data.userDetails.email || 'Not available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span>{account.data.userDetails.username || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Verified:</span>
                  <span>{account.data.userDetails.emailVerified ? 'Yes' : 'No'}</span>
                </div>
                {account.data.provider && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OAuth Provider:</span>
                    <span className="capitalize">{account.data.provider}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">2FA Enabled:</span>
                  <span>{account.data.security.twoFactorEnabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-xs">{formatDate(account.data.created)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="text-xs">{formatDate(account.data.updated)}</span>
                </div>
              </div>
            </div>
          )}

          {!account.data && !account.isLoading && !account.error && session.isAuthenticated && (
            <div className="text-sm text-muted-foreground">No account data available</div>
          )}

          {!session.isAuthenticated && (
            <div className="text-sm text-muted-foreground">Please authenticate to view account details</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthStatus;
