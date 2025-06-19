import { Key, RefreshCw, EyeOff, Eye, ExternalLink, Copy } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAccount, TokenInfo } from '../../../sdk/auth-react-sdk/src';
import { Card, CardHeader, CardTitle, CardContent, Button, CardDescription, Badge } from '../ui';
import { LoadingSpinner } from '../auth/loading-spinner';

// Updated TokenStatus Component
interface TokenStatusProps {
  accountId: string;
}

export default function TokenStatus({ accountId }: TokenStatusProps) {
  const currentAccount = useAccount(accountId);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const loadTokenInfo = useCallback(async () => {
    if (!currentAccount) return;

    setLoading(true);
    try {
      const info = await currentAccount.getTokenInformation();
      setTokenInfo(info);
    } catch (error) {
      console.error('Failed to load token info:', error);
      setTokenInfo(null);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

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

  const formatExpirationTime = (expiresAt?: number) => {
    if (!expiresAt) return 'Unknown';

    const date = new Date(expiresAt * 1000); // Convert from seconds to milliseconds
    return date.toLocaleString();
  };

  const getTokenStatusBadge = (tokenInfo: TokenInfo) => {
    if (tokenInfo.error) {
      return (
        <Badge variant="destructive" className="text-xs">
          Error
        </Badge>
      );
    } else if (tokenInfo.isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expired
        </Badge>
      );
    } else if (tokenInfo.isValid) {
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

  const getTokenTypeDisplay = (type: string) => {
    const typeMap = {
      local_jwt: 'Local Access Token',
      oauth_jwt: 'OAuth Access Token',
      local_refresh_jwt: 'Local Refresh Token',
      oauth_refresh_jwt: 'OAuth Refresh Token',
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  const isOAuthToken = (type: string) => {
    return type.includes('oauth');
  };

  const isRefreshToken = (type: string) => {
    return type.includes('refresh');
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
        <CardDescription>Authentication token status and information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Status Overview */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              {isRefreshToken(tokenInfo.type) ? (
                <RefreshCw className="w-5 h-5 text-primary" />
              ) : isOAuthToken(tokenInfo.type) ? (
                <ExternalLink className="w-5 h-5 text-primary" />
              ) : (
                <Key className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">{getTokenTypeDisplay(tokenInfo.type)}</p>
              <p className="text-sm text-muted-foreground">
                {isOAuthToken(tokenInfo.type) ? 'Third-party token' : 'Local authentication token'}
              </p>
            </div>
          </div>
          {getTokenStatusBadge(tokenInfo)}
        </div>

        {/* Token Details */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Token Type</p>
              <p className="text-sm font-mono">{tokenInfo.type}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <p className="text-sm">
                {tokenInfo.error ? 'Error' : tokenInfo.isExpired ? 'Expired' : tokenInfo.isValid ? 'Valid' : 'Invalid'}
              </p>
            </div>
          </div>

          {tokenInfo.timeRemaining && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Time Remaining</p>
                <p className="text-sm">{formatTimeRemaining(tokenInfo.timeRemaining)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Expires At</p>
                <p className="text-sm">{formatExpirationTime(tokenInfo.expiresAt)}</p>
              </div>
            </div>
          )}

          {tokenInfo.accountId && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Account ID</p>
              <p className="text-sm font-mono">{tokenInfo.accountId}</p>
            </div>
          )}

          {tokenInfo.error && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground text-destructive">Error</p>
              <p className="text-sm text-destructive">{tokenInfo.error}</p>
            </div>
          )}
        </div>

        {/* Token Value Display (for OAuth tokens if available) */}
        {showTokens && isOAuthToken(tokenInfo.type) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Token Value</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                {/* Note: TokenInfo doesn't include the actual token value for security */}
                [Token value not exposed for security reasons]
              </code>
              <Button variant="ghost" size="sm" disabled title="Token values are not exposed for security reasons">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Token Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          {isOAuthToken(tokenInfo.type) && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (currentAccount) {
                  await currentAccount.revokeTokens();
                  loadTokenInfo();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Key className="w-4 h-4 mr-2" />
              Revoke Tokens
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadTokenInfo}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Info
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
