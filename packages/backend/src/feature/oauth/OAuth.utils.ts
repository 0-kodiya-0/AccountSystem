import { OAuthProviders } from '../account/Account.types';
import { AuthType } from './OAuth.types';
import crypto from 'crypto';
import { saveOAuthState, removeOAuthState, savePermissionState, removePermissionState } from './OAuth.cache';
import { getOAuthMockConfig } from '../../config/mock.config';
import { getNodeEnv } from '../../config/env.config';
import { oauthMockService } from '../../mocks/oauth/OAuthMockService';

export const generateOAuthState = async (
  provider: OAuthProviders,
  authType: AuthType,
  callbackUrl: string,
  mockAccountEmail?: string,
): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Check if we should use mock
  const mockConfig = getOAuthMockConfig();
  const isProduction = getNodeEnv() === 'production';
  const useMock = !isProduction && mockConfig.enabled;

  if (useMock && provider === OAuthProviders.Google) {
    // Save state in mock service with additional mock-specific data
    oauthMockService.saveOAuthState(
      provider,
      authType as 'signup' | 'signin' | 'permission',
      callbackUrl,
      mockAccountEmail,
    );
  } else {
    // Save state in regular cache
    saveOAuthState(state, provider, authType, callbackUrl);
  }

  return state;
};

export const generatePermissionState = async (
  provider: OAuthProviders,
  accountId: string,
  service: string,
  scopeLevel: string,
  callbackUrl: string,
  mockAccountEmail?: string,
): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Check if we should use mock
  const mockConfig = getOAuthMockConfig();
  const isProduction = getNodeEnv() === 'production';
  const useMock = !isProduction && mockConfig.enabled;

  if (useMock && provider === OAuthProviders.Google) {
    // Save permission state in mock service
    oauthMockService.saveOAuthState(
      provider,
      'permission',
      callbackUrl,
      mockAccountEmail,
      // Could include scopes here if needed
    );
  } else {
    // Save state in regular cache
    savePermissionState(state, provider, accountId, service, scopeLevel, callbackUrl);
  }

  return state;
};

export const clearOAuthState = async (state: string): Promise<void> => {
  // Clear from both regular cache and mock cache
  removeOAuthState(state);
  oauthMockService.removeOAuthState(state);
};

export const clearPermissionState = async (state: string): Promise<void> => {
  // Clear from both regular cache and mock cache
  removePermissionState(state);
  oauthMockService.removeOAuthState(state);
};
