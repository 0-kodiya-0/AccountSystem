import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useSession = () => {
  const store = useAppStore();

  const refreshSession = useCallback(async () => {
    return store.refreshSession();
  }, [store.refreshSession]);

  const clearSession = useCallback(() => {
    store.clearSession();
  }, [store.clearSession]);

  const setCurrentAccount = useCallback(
    async (accountId: string | null) => {
      return store.setCurrentAccount(accountId);
    },
    [store.setCurrentAccount],
  );

  return {
    session: store.session,
    isInitializing: store.ui.isInitializing,
    refreshSession,
    clearSession,
    setCurrentAccount,
  };
};
