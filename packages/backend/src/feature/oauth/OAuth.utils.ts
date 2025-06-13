import { OAuthProviders } from '../account/Account.types';
import { AuthType, ProviderResponse } from './OAuth.types';
import crypto from 'crypto';
import {
  saveOAuthState,
  saveSignInState,
  saveSignUpState,
  removeOAuthState,
  removeSignInState,
  removeSignUpState,
  savePermissionState,
  removePermissionState,
} from './OAuth.cache';

export const generateOAuthState = async (provider: OAuthProviders, authType: AuthType): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache without redirect URL
  saveOAuthState(state, provider, authType);

  return state;
};

export const generateSignupState = async (providerResponse: ProviderResponse): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache without redirect URL
  saveSignUpState(state, providerResponse);

  return state;
};

export const generateSignInState = async (providerResponse: ProviderResponse): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache without redirect URL
  saveSignInState(state, providerResponse);

  return state;
};

export const generatePermissionState = async (
  provider: OAuthProviders,
  accountId: string,
  service: string,
  scopeLevel: string,
): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');

  // Save state in cache without redirect URL
  savePermissionState(state, provider, accountId, service, scopeLevel);

  return state;
};

export const clearOAuthState = async (state: string): Promise<void> => {
  removeOAuthState(state);
};

export const clearSignUpState = async (state: string): Promise<void> => {
  removeSignUpState(state);
};

export const clearSignInState = async (state: string): Promise<void> => {
  removeSignInState(state);
};

export const clearPermissionState = async (state: string): Promise<void> => {
  removePermissionState(state);
};
