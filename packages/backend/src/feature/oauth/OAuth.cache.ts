import { LRUCache } from 'lru-cache';
import { AuthType, OAuthState, PermissionState } from './OAuth.types';
import { OAuthProviders } from '../account/Account.types';

// Cache options with TTL (time to live) of 10 minutes (600,000 ms)
const options = {
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 10, // 10 minutes in milliseconds
  updateAgeOnGet: false, // Don't reset TTL when reading an item
  allowStale: false, // Don't allow expired items to be returned
};

// Create separate caches for each state type
const oAuthStateCache = new LRUCache<string, OAuthState>(options);
const permissionStateCache = new LRUCache<string, PermissionState>(options);

// OAuthState methods
export const saveOAuthState = (
  state: string,
  provider: OAuthProviders,
  authType: AuthType,
  callbackUrl: string,
): void => {
  const expiresAt = new Date(Date.now() + options.ttl);

  const stateData: OAuthState = {
    state,
    provider,
    authType,
    callbackUrl,
    expiresAt: expiresAt.toISOString(),
  };

  oAuthStateCache.set(state, stateData);
};

export const getOAuthState = (state: string, provider: OAuthProviders): OAuthState | null => {
  const stateData = oAuthStateCache.get(state);

  if (!stateData || stateData.provider !== provider) {
    return null;
  }

  // Check if state is expired
  if (new Date(stateData.expiresAt) < new Date()) {
    oAuthStateCache.delete(state);
    return null;
  }

  return stateData;
};

export const removeOAuthState = (state: string): void => {
  oAuthStateCache.delete(state);
};

// Methods for permission state
export const savePermissionState = (
  state: string,
  provider: OAuthProviders,
  accountId: string,
  service: string,
  scopeLevel: string,
  callbackUrl: string,
): void => {
  const expiresAt = new Date(Date.now() + options.ttl);

  const stateData: PermissionState = {
    state,
    provider,
    authType: AuthType.PERMISSION,
    accountId,
    service,
    scopeLevel,
    callbackUrl,
    expiresAt: expiresAt.toISOString(),
  };

  permissionStateCache.set(state, stateData);
};

export const getPermissionState = (state: string, provider: OAuthProviders): PermissionState | null => {
  const stateData = permissionStateCache.get(state);

  if (!stateData || stateData.provider !== provider) {
    return null;
  }

  // Check if state is expired
  if (new Date(stateData.expiresAt) < new Date()) {
    permissionStateCache.delete(state);
    return null;
  }

  return stateData;
};

/**
 * Get all OAuth states (for testing purposes)
 */
export const getAllOAuthStates = (): OAuthState[] => {
  const states: OAuthState[] = [];

  for (const [state, data] of oAuthStateCache.entries()) {
    // Check if not expired
    if (new Date(data.expiresAt) >= new Date()) {
      states.push(data);
    } else {
      // Clean up expired states
      oAuthStateCache.delete(state);
    }
  }

  return states;
};

/**
 * Get all permission states (for testing purposes)
 */
export const getAllPermissionStates = (): PermissionState[] => {
  const states: PermissionState[] = [];

  for (const [state, data] of permissionStateCache.entries()) {
    // Check if not expired
    if (new Date(data.expiresAt) >= new Date()) {
      states.push(data);
    } else {
      // Clean up expired states
      permissionStateCache.delete(state);
    }
  }

  return states;
};

/**
 * Get OAuth state by provider (for testing purposes)
 */
export const getOAuthStatesByProvider = (provider: OAuthProviders): OAuthState[] => {
  const states: OAuthState[] = [];

  for (const [, data] of oAuthStateCache.entries()) {
    if (data.provider === provider && new Date(data.expiresAt) >= new Date()) {
      states.push(data);
    }
  }

  return states;
};

export const removePermissionState = (state: string): void => {
  permissionStateCache.delete(state);
};
