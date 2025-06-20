import { OAuthProviders } from '../account/Account.types';
import { AuthType } from './OAuth.types';
import crypto from 'crypto';
import { saveOAuthState, removeOAuthState, savePermissionState, removePermissionState } from './OAuth.cache';

export const generateOAuthState = async (
  provider: OAuthProviders,
  authType: AuthType,
  callbackUrl: string,
): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache with callback URL
  saveOAuthState(state, provider, authType, callbackUrl);

  return state;
};

export const generatePermissionState = async (
  provider: OAuthProviders,
  accountId: string,
  service: string,
  scopeLevel: string,
  callbackUrl: string,
): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache with callback URL
  savePermissionState(state, provider, accountId, service, scopeLevel, callbackUrl);

  return state;
};

export const clearOAuthState = async (state: string): Promise<void> => {
  removeOAuthState(state);
};

export const clearPermissionState = async (state: string): Promise<void> => {
  removePermissionState(state);
};
