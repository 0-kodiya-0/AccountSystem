import { Response } from 'express';
import { OAuthProviders } from '../account/Account.types';
import { OAuthState, PermissionState, StateDetails } from './OAuth.types';
import { getOAuthState, getPermissionState } from './OAuth.cache';
import { BadRequestError, ApiErrorCode } from '../../types/response.types';

type ValidateState = (
  state: string | undefined,
  validate: (state: string) => Promise<StateDetails>,
  res: Response,
) => Promise<StateDetails | undefined>;

// validate state parameter
export const validateState: ValidateState = async (state, validate) => {
  if (!state || typeof state !== 'string') {
    throw new BadRequestError('Missing state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  const stateDetails = await validate(state);

  if (!stateDetails) {
    throw new BadRequestError('Invalid or expired state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  return stateDetails;
};

/**
 * Validates an OAuth state for a specific provider
 */
export const validateOAuthState = async (state: string, provider: OAuthProviders): Promise<OAuthState | null> => {
  if (!state) return null;

  const oauthState = getOAuthState(state, provider);

  if (!oauthState) {
    return null;
  }

  // Check if state has expired
  if (new Date(oauthState.expiresAt) < new Date()) {
    return null;
  }

  return oauthState;
};

/**
 * Validates a permission state
 */
export const validatePermissionState = async (
  state: string,
  provider: OAuthProviders,
): Promise<PermissionState | null> => {
  if (!state) return null;

  const permissionState = getPermissionState(state, provider);

  if (!permissionState) {
    return null;
  }

  // Check if state has expired
  if (new Date(permissionState.expiresAt) < new Date()) {
    return null;
  }

  return permissionState;
};
