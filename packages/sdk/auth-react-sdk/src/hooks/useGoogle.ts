import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { OAuthTokenInfoResponse } from '../types';

export const useGoogle = (accountId?: string) => {
  const store = useAppStore();

  const targetAccountId = accountId || store.session.currentAccountId;

  const getTokenInfo = useCallback(async (): Promise<OAuthTokenInfoResponse> => {
    if (!targetAccountId) throw new Error('No account ID');
    return store.getOAuthTokenInfo(targetAccountId);
  }, [store.getOAuthTokenInfo, targetAccountId]);

  const checkScopes = useCallback(
    async (scopeNames: string[]) => {
      if (!targetAccountId) throw new Error('No account ID');

      try {
        const tokenInfo = await store.getOAuthTokenInfo(targetAccountId);

        if (!tokenInfo.providerToken || tokenInfo.providerToken.provider !== 'google') {
          throw new Error('No Google token information available');
        }

        const grantedScopes = tokenInfo.providerToken.scope ? tokenInfo.providerToken.scope.split(' ') : [];

        const results: Record<string, any> = {};
        scopeNames.forEach((scopeName) => {
          const scopeUrl = scopeName.startsWith('https://')
            ? scopeName
            : `https://www.googleapis.com/auth/${scopeName}`;

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
    },
    [store.getOAuthTokenInfo, targetAccountId],
  );

  return {
    getTokenInfo,
    checkScopes,
  };
};
