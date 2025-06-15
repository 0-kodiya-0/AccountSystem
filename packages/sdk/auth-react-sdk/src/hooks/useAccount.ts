import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { Account } from '../types';

// Get ServiceManager instance at module level
const serviceManager = ServiceManager.getInstance();

export interface UseAccountOptions {
  accountId?: string;
  autoLoad?: boolean; // Default true - auto-load account data
}

export const useAccount = (options: UseAccountOptions = {}) => {
  const { accountId, autoLoad = true } = options;

  // Get current account ID from store if not provided
  const currentAccountId = useAppStore((state) => state.session.currentAccountId);
  const targetAccountId = accountId || currentAccountId;

  // Get account data from store
  const account = useAppStore((state) => (targetAccountId ? state.accounts.get(targetAccountId) : null));

  // Get store actions directly
  const loadAccount = useAppStore((state) => state.loadAccount);
  const updateAccount = useAppStore((state) => state.updateAccount);
  const removeAccount = useAppStore((state) => state.removeAccount);

  // Convenience methods
  async function reload() {
    if (!targetAccountId) throw new Error('No account ID available');
    return loadAccount(targetAccountId);
  }

  function update(updates: Partial<Account>) {
    if (!targetAccountId) throw new Error('No account ID available');
    updateAccount(targetAccountId, updates);
  }

  function remove() {
    if (!targetAccountId) throw new Error('No account ID available');
    removeAccount(targetAccountId);
  }

  // Account-specific service methods
  async function updateSecurity(securityUpdates: Partial<Account['security']>) {
    if (!targetAccountId) throw new Error('No account ID available');

    serviceManager.ensureInitialized();
    const updatedAccount = await serviceManager.accountService.updateAccountSecurity(targetAccountId, securityUpdates);

    // Update local cache
    updateAccount(targetAccountId, updatedAccount);
    return updatedAccount;
  }

  async function getEmail() {
    if (!targetAccountId) throw new Error('No account ID available');

    serviceManager.ensureInitialized();
    return serviceManager.accountService.getAccountEmail(targetAccountId);
  }

  // Auto-load account if enabled and we have an account ID
  useEffect(() => {
    if (!autoLoad || !targetAccountId) return;

    // Only load if we don't have account data already
    if (!account) {
      loadAccount(targetAccountId).catch((error) => {
        console.warn('Failed to auto-load account:', error);
      });
    }
  }, [autoLoad, targetAccountId, account]);

  // Derived account data
  const isLoaded = !!account;
  const isLocal = account?.accountType === 'local';
  const isOAuth = account?.accountType === 'oauth';
  const has2FA = account?.security?.twoFactorEnabled || false;
  const displayName = account?.userDetails?.name || 'Unknown User';
  const email = account?.userDetails?.email;
  const imageUrl = account?.userDetails?.imageUrl;

  return {
    // Account data
    account,
    accountId: targetAccountId,
    isLoaded,
    isLocal,
    isOAuth,
    has2FA,
    displayName,
    email,
    imageUrl,

    // Direct store actions
    loadAccount,
    updateAccount,
    removeAccount,

    reload,
    update,
    remove,
    updateSecurity,
    getEmail,
  };
};
