import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { OAuthTokenInfoResponse } from '../types';

// Get ServiceManager instance at module level
const serviceManager = ServiceManager.getInstance();

export const useGoogle = (accountId?: string) => {
  // Get current account ID from store if not provided
  const currentAccountId = useAppStore((state) => state.session.currentAccountId);
  const targetAccountId = accountId || currentAccountId;

  const getTokenInfo = async (): Promise<OAuthTokenInfoResponse> => {
    if (!targetAccountId) throw new Error('No account ID available');

    serviceManager.ensureInitialized();
    return serviceManager.authService.getOAuthTokenInfo(targetAccountId);
  };

  const checkScopes = async (scopeNames: string[]) => {
    if (!targetAccountId) throw new Error('No account ID available');

    try {
      const tokenInfo = await getTokenInfo();

      if (!tokenInfo.providerToken || tokenInfo.providerToken.provider !== 'google') {
        throw new Error('No Google token information available');
      }

      const grantedScopes = tokenInfo.providerToken.scope ? tokenInfo.providerToken.scope.split(' ') : [];

      const results: Record<string, any> = {};
      scopeNames.forEach((scopeName) => {
        const scopeUrl = scopeName.startsWith('https://') ? scopeName : `https://www.googleapis.com/auth/${scopeName}`;

        results[scopeName] = {
          hasAccess: grantedScopes.some((granted) => granted === scopeUrl || granted.includes(scopeName)),
          scopeName,
          scopeUrl,
        };
      });

      return {
        summary: {
          totalRequested: scopeNames.length,
          totalGranted: Object.values(results).filter((r: any) => r.hasAccess).length,
          allGranted: Object.values(results).every((r: any) => r.hasAccess),
        },
        requestedScopeNames: scopeNames,
        requestedScopeUrls: scopeNames.map((name) =>
          name.startsWith('https://') ? name : `https://www.googleapis.com/auth/${name}`,
        ),
        results,
      };
    } catch (error) {
      throw new Error(`Failed to check scopes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const requestPermission = (scopeNames: string[]) => {
    if (!targetAccountId) throw new Error('No account ID available');

    serviceManager.ensureInitialized();
    serviceManager.authService.requestGooglePermission(targetAccountId, scopeNames);
  };

  const reauthorizePermissions = () => {
    if (!targetAccountId) throw new Error('No account ID available');

    serviceManager.ensureInitialized();
    serviceManager.authService.reauthorizePermissions(targetAccountId);
  };

  return {
    // Data
    accountId: targetAccountId,

    // Actions
    getTokenInfo,
    checkScopes,
    requestPermission,
    reauthorizePermissions,

    // Utility methods
    async hasScope(scopeName: string): Promise<boolean> {
      try {
        const result = await checkScopes([scopeName]);
        return result.results[scopeName]?.hasAccess || false;
      } catch {
        return false;
      }
    },

    async hasAllScopes(scopeNames: string[]): Promise<boolean> {
      try {
        const result = await checkScopes(scopeNames);
        return result.summary.allGranted;
      } catch {
        return false;
      }
    },

    async getMissingScopes(scopeNames: string[]): Promise<string[]> {
      try {
        const result = await checkScopes(scopeNames);
        return Object.entries(result.results)
          .filter(([, data]: [string, any]) => !data.hasAccess)
          .map(([scopeName]) => scopeName);
      } catch {
        return scopeNames; // Return all as missing if check fails
      }
    },
  };
};
