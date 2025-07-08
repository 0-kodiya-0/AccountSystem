import { asyncHandler } from '../../../utils/response';
import { JsonSuccess, NotFoundError, ApiErrorCode } from '../../../types/response.types';
import * as TwoFAMockService from './TwoFA.service.mock';
import { getNodeEnv, isMockEnabled } from '../../../config/env.config';

const isMock = getNodeEnv() !== 'production' && isMockEnabled();

/**
 * Generate TOTP code for a given secret (simulates authenticator app)
 * Route: GET /mock/twofa/generate-code/:secret
 */
export const generateTotpCode = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { secret } = req.params;
  const result = await TwoFAMockService.generateTotpCode(secret);

  next(
    new JsonSuccess({
      ...result,
      message: 'TOTP code generated successfully',
      note: 'This is a mock endpoint - code generated using otplib',
    }),
  );
});

/**
 * Get the 2FA secret for an account (for testing purposes)
 * Route: GET /mock/twofa/account/:accountId/secret
 */
export const getAccountSecret = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { accountId } = req.params;
  const result = await TwoFAMockService.getAccountSecret(accountId);

  next(
    new JsonSuccess({
      ...result,
      message: 'Account 2FA secret retrieved successfully',
      note: 'This is a mock endpoint - secret exposed for testing',
    }),
  );
});

/**
 * Generate TOTP code for an account using its stored secret
 * Route: GET /mock/twofa/account/:accountId/generate-code
 */
export const generateAccountTotpCode = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { accountId } = req.params;
  const result = await TwoFAMockService.generateAccountTotpCode(accountId);

  next(
    new JsonSuccess({
      ...result,
      message: 'TOTP code generated for account successfully',
      note: 'This is a mock endpoint - use this code for 2FA verification',
    }),
  );
});

/**
 * Validate a TOTP token against a secret (simulates authenticator verification)
 * Route: GET /mock/twofa/validate-token/:secret/:token
 */
export const validateTotpToken = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { secret, token } = req.params;
  const result = await TwoFAMockService.validateTotpToken(secret, token);

  next(
    new JsonSuccess({
      ...result,
      message: result.valid ? 'Token is valid' : 'Token is invalid',
      note: 'This is a mock endpoint for token validation',
    }),
  );
});

/**
 * Get 2FA cache statistics (temp tokens, setup tokens)
 * Route: GET /mock/twofa/cache/stats
 */
export const getCacheStats = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const result = await TwoFAMockService.getCacheStatistics();

  next(
    new JsonSuccess({
      ...result,
      message: '2FA cache statistics retrieved successfully',
      note: 'This is a mock endpoint for debugging cache state',
    }),
  );
});

/**
 * Get all temporary tokens (for debugging login flows)
 * Route: GET /mock/twofa/cache/temp-tokens
 */
export const getAllTempTokens = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const result = await TwoFAMockService.getAllTemporaryTokens();

  next(
    new JsonSuccess({
      ...result,
      message: 'Temporary tokens retrieved successfully',
      note: 'This is a mock endpoint for debugging 2FA login flows',
    }),
  );
});

/**
 * Get all setup tokens (for debugging setup flows)
 * Route: GET /mock/twofa/cache/setup-tokens
 */
export const getAllSetupTokens = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const result = await TwoFAMockService.getAllSetupTokens();

  next(
    new JsonSuccess({
      ...result,
      message: 'Setup tokens retrieved successfully',
      note: 'This is a mock endpoint for debugging 2FA setup flows',
    }),
  );
});

/**
 * Get specific temporary token data
 * Route: GET /mock/twofa/cache/temp-token/:token
 */
export const getTempTokenData = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { token } = req.params;
  const result = await TwoFAMockService.getTemporaryTokenData(token);

  next(
    new JsonSuccess({
      ...result,
      message: 'Temporary token data retrieved successfully',
      note: 'This is a mock endpoint for debugging specific temp tokens',
    }),
  );
});

/**
 * Get specific setup token data
 * Route: GET /mock/twofa/cache/setup-token/:token
 */
export const getSetupTokenData = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { token } = req.params;
  const result = await TwoFAMockService.getSetupTokenData(token);

  next(
    new JsonSuccess({
      ...result,
      message: 'Setup token data retrieved successfully',
      note: 'This is a mock endpoint for debugging specific setup tokens',
    }),
  );
});

/**
 * Generate mock backup codes (for testing backup code flows)
 * Route: POST /mock/twofa/generate-backup-codes
 */
export const generateBackupCodes = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new NotFoundError('Mock endpoints are not available in production', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  const { count = 10 } = req.body;
  const result = await TwoFAMockService.generateMockBackupCodes(count);

  next(
    new JsonSuccess({
      ...result,
      message: `${result.count} backup codes generated successfully`,
      note: 'This is a mock endpoint - these codes are for testing only',
    }),
  );
});
