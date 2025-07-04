import { Response } from 'express';
import { OAuthProviders } from '../account/Account.types';
import { AuthType, OAuthState, OAuthPermissionState, StateDetails } from './OAuth.types';
import { getOAuthState, getPermissionState } from './OAuth.cache';
import { BadRequestError, ApiErrorCode } from '../../types/response.types';
import { findUserByEmail } from '../account';

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
 * Validate OAuth state
 */
export async function validateOAuthState(state: string, provider: OAuthProviders): Promise<OAuthState> {
  if (!state) {
    throw new BadRequestError('Missing state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  const stateDetails = getOAuthState(state, provider);
  if (!stateDetails) {
    throw new BadRequestError('Invalid or expired state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  return stateDetails;
}

/**
 * Validate permission state
 */
export async function validatePermissionState(state: string, provider: OAuthProviders): Promise<OAuthPermissionState> {
  if (!state) {
    throw new BadRequestError('Missing state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  const stateDetails = getPermissionState(state, provider);
  if (!stateDetails) {
    throw new BadRequestError('Invalid or expired state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  return stateDetails;
}

/**
 * Validate user for auth type
 */
export async function validateUserForAuthType(email: string, authType: AuthType) {
  if (!email) {
    throw new BadRequestError('Missing email parameter', 400, ApiErrorCode.MISSING_EMAIL);
  }

  const user = await findUserByEmail(email);

  if (authType === AuthType.SIGN_UP) {
    if (user) {
      throw new BadRequestError('User already exists', 409, ApiErrorCode.USER_EXISTS);
    }
  } else {
    if (!user) {
      throw new BadRequestError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }
  }
}
