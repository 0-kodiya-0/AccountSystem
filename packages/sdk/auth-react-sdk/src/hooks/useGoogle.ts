import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useGoogle = (accountId?: string) => {
  const store = useAppStore();

  const targetAccountId = accountId || store.session.currentAccountId;

  const getTokenInfo = useCallback(async () => {
    if (!targetAccountId) throw new Error('No account ID');
    return store.getGoogleTokenInfo(targetAccountId);
  }, [store.getGoogleTokenInfo, targetAccountId]);

  const checkScopes = useCallback(
    async (scopeNames: string[]) => {
      if (!targetAccountId) throw new Error('No account ID');
      return store.checkGoogleScopes(targetAccountId, scopeNames);
    },
    [store.checkGoogleScopes, targetAccountId],
  );

  return {
    getTokenInfo,
    checkScopes,
  };
};
