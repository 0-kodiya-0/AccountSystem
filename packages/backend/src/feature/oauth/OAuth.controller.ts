import { NextFunction, Request, Response } from 'express';
import {
  ApiErrorCode,
  BadRequestError,
  CallbackCode,
  CallbackData,
  JsonSuccess,
  Redirect,
} from '../../types/response.types';
import { OAuthProviders } from '../account/Account.types';
import { ValidationUtils } from '../../utils/validation';
import { asyncHandler } from '../../utils/response';
import { logger } from '../../utils/logger';
import * as OAuthService from './OAuth.service';
import * as OAuthValidation from './OAuth.validation';

/**
 * Generate OAuth signup URL
 * GET /oauth/signup/:provider
 */
export const generateSignupUrl = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { callbackUrl } = req.query;

  if (!callbackUrl) {
    throw new BadRequestError('callbackUrl query parameter is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  const result = await OAuthService.generateSignupUrl(provider, callbackUrl as string);

  logger.info(`Generated signup URL for provider: ${provider}`);

  next(new JsonSuccess(result));
});

/**
 * Generate OAuth signin URL
 * GET /oauth/signin/:provider
 */
export const generateSigninUrl = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { callbackUrl } = req.query;

  if (!callbackUrl) {
    throw new BadRequestError('callbackUrl query parameter is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  const result = await OAuthService.generateSigninUrl(provider, callbackUrl as string);

  logger.info(`Generated signin URL for provider: ${provider}`);

  next(new JsonSuccess(result));
});

/**
 * Handle OAuth callback from provider
 * GET /oauth/callback/:provider
 */
export const handleOAuthCallback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { code, state } = req.query;

  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  ValidationUtils.validateRequiredFields({ code, state }, ['code', 'state']);

  const stateDetails = await OAuthValidation.validateOAuthState(state as string, provider);

  try {
    const result = await OAuthService.processOAuthCallback(req, res, provider, code as string, stateDetails);

    logger.info(`OAuth ${stateDetails.authType} successful for provider: ${provider}`);

    next(new Redirect(result.callbackData, result.callbackUrl));
  } catch (error) {
    logger.error('OAuth callback error:', error);

    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_ERROR,
      error: error instanceof Error ? error.message : 'OAuth authentication failed',
      provider,
    };

    next(new Redirect(callbackData, stateDetails.callbackUrl));
  }
});

/**
 * Generate permission request URL
 * GET /oauth/permission/:provider
 */
export const generatePermissionUrl = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { accountId, callbackUrl, scopeNames } = req.query;

  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  ValidationUtils.validateRequiredFields(req.query, ['accountId', 'callbackUrl', 'scopeNames']);
  ValidationUtils.validateObjectId(accountId as string, 'Account ID');
  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  const result = await OAuthService.generatePermissionUrl(
    provider,
    accountId as string,
    callbackUrl as string,
    scopeNames as string,
  );

  logger.info(`Generated permission URL for scope names: ${result.scopes.join(', ')}`);

  next(new JsonSuccess(result));
});

/**
 * Handle permission callback
 * GET /oauth/permission/callback/:provider
 */
export const handlePermissionCallback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { code, state } = req.query;

  ValidationUtils.validateRequiredFields({ code, state }, ['code', 'state']);

  const permissionDetails = await OAuthValidation.validatePermissionState(state as string, OAuthProviders.Google);

  try {
    const result = await OAuthService.processPermissionCallback(req, res, code as string, permissionDetails);

    logger.info(`Permission tokens exchanged successfully for account ${permissionDetails.accountId}`);

    next(new Redirect(result.callbackData, result.callbackUrl));
  } catch (error) {
    logger.error('Permission callback error:', error);

    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_PERMISSION_ERROR,
      error: error instanceof Error ? error.message : 'Permission grant failed',
      provider: OAuthProviders.Google,
    };

    next(new Redirect(callbackData, permissionDetails.callbackUrl));
  }
});

/**
 * Generate reauthorization URL
 * GET /oauth/reauthorize/:provider
 */
export const generateReauthorizeUrl = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { accountId, callbackUrl } = req.query;

  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  if (!accountId || !callbackUrl) {
    throw new BadRequestError('Missing required parameters: accountId and callbackUrl');
  }

  ValidationUtils.validateObjectId(accountId as string, 'Account ID');
  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  const result = await OAuthService.generateReauthorizeUrl(provider, accountId as string, callbackUrl as string);

  if (!result.authorizationUrl) {
    next(
      new JsonSuccess({
        message: 'No additional scopes needed',
        authorizationUrl: null,
        accountId,
        callbackUrl,
      }),
    );
    return;
  }

  logger.info(`Generated reauthorization URL for account ${accountId}`);

  next(new JsonSuccess(result));
});
