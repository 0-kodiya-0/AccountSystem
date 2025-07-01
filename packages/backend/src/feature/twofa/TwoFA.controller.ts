import { asyncHandler } from '../../utils/response';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../types/response.types';
import * as TwoFAService from './TwoFA.service';
import {
  SetupTwoFactorRequest,
  VerifySetupTwoFactorRequest,
  GenerateBackupCodesRequest,
  VerifyTwoFactorLoginRequest,
} from './TwoFA.types';
import { AccountDocument } from '../account/Account.model';
import { AccountType } from '../account/Account.types';
import QRCode from 'qrcode';
import { logger } from '../../utils/logger';
import { sendNonCriticalEmail } from '../email/Email.utils';
import { sendTwoFactorEnabledNotification } from '../email/Email.service';
import { setupCompleteAccountSession } from '../session/session.utils';
import * as TokenJwt from '../tokens/Token.jwt';
import {
  getGoogleTokenInfo,
  updateAccountScopes,
  checkForAdditionalGoogleScopes,
} from '../google/services/tokenInfo/tokenInfo.services';
import { getNodeEnv, isMockEnabled } from '../../config/env.config';
import { getAllSetupTokens, getAllTempTokens, getTwoFactorTempToken } from './TwoFA.cache';

const isMock = getNodeEnv() !== 'production' && isMockEnabled();

/**
 * Get 2FA status for the current account
 * Route: GET /:accountId/twofa/status
 */
export const getTwoFactorStatus = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  const status = await TwoFAService.getTwoFactorStatus(accountId);

  next(new JsonSuccess(status));
});

/**
 * Set up 2FA for the current account (unified for local and OAuth)
 * Route: POST /:accountId/twofa/setup
 */
export const setupTwoFactor = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;
  const data = req.body as SetupTwoFactorRequest;

  // Extract OAuth access token if this is an OAuth account
  const oauthAccessToken = account.accountType === AccountType.OAuth ? req.oauthAccessToken : undefined;

  if (typeof data.enableTwoFactor !== 'boolean') {
    throw new BadRequestError('enableTwoFactor field is required and must be boolean', 400, ApiErrorCode.MISSING_DATA);
  }

  // For local accounts, password is required
  if (account.accountType === AccountType.Local && data.enableTwoFactor && !data.password) {
    throw new BadRequestError('Password is required for local accounts', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await TwoFAService.setupTwoFactor(accountId, data, oauthAccessToken);

  // If enabling 2FA, generate QR code and return setup token
  if (isMock && data.enableTwoFactor && result.secret && result.qrCodeUrl && result.setupToken) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(result.qrCodeUrl);

      logger.info(`2FA setup QR code generated for account ${accountId}`);

      next(
        new JsonSuccess({
          ...result,
          qrCode: qrCodeDataUrl,
          // Mock data only included when mock is enabled
          mock: {
            setupToken: result.setupToken,
            secret: result.secret,
            nextStep: 'Use setupToken in verify-setup endpoint',
            note: 'Setup token and secret exposed for testing',
          },
        }),
      );
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      throw new BadRequestError('Failed to generate QR code', 500, ApiErrorCode.SERVER_ERROR);
    }
  } else {
    // Original response logic for production
    if (data.enableTwoFactor && result.secret && result.qrCodeUrl && result.setupToken) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(result.qrCodeUrl);
        next(new JsonSuccess({ ...result, qrCode: qrCodeDataUrl }));
      } catch (error) {
        logger.error('Failed to generate QR code:', error);
        throw new BadRequestError('Failed to generate QR code', 500, ApiErrorCode.SERVER_ERROR);
      }
    } else {
      next(new JsonSuccess(result));
    }
  }
});

/**
 * Verify and enable 2FA setup using the setup token from the setup step
 * Route: POST /:accountId/twofa/verify-setup
 */
export const verifyAndEnableTwoFactor = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;
  const data = req.body as VerifySetupTwoFactorRequest;

  if (!data.token) {
    throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  if (!data.setupToken) {
    throw new BadRequestError('Setup token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await TwoFAService.verifyAndEnableTwoFactor(accountId, data);

  // Send notification email after successful 2FA enablement (async - don't wait)
  if (account.userDetails.email) {
    sendNonCriticalEmail(
      sendTwoFactorEnabledNotification,
      [account.userDetails.email, account.userDetails.firstName || account.userDetails.name.split(' ')[0]],
      { maxAttempts: 2, delayMs: 1000 },
    );
  }

  logger.info(`2FA verification and enablement successful for account ${accountId}`);

  next(new JsonSuccess(result));
});

/**
 * Generate new backup codes
 * Route: POST /:accountId/twofa/backup-codes
 */
export const generateBackupCodes = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;
  const data = req.body as GenerateBackupCodesRequest;

  // Extract OAuth access token if this is an OAuth account
  const oauthAccessToken = account.accountType === AccountType.OAuth ? req.oauthAccessToken : undefined;

  // For local accounts, password is required
  if (account.accountType === AccountType.Local && !data.password) {
    throw new BadRequestError('Password is required for local accounts', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await TwoFAService.generateBackupCodes(accountId, data, oauthAccessToken);

  next(new JsonSuccess(result));
});

/**
 * Verify 2FA code during login (public endpoint)
 * Route: POST /twofa/verify-login
 */
export const verifyTwoFactorLogin = asyncHandler(async (req, res, next) => {
  const data = req.body as VerifyTwoFactorLoginRequest;

  if (!data.token || !data.tempToken) {
    throw new BadRequestError('Verification token and temporary token are required', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await TwoFAService.verifyTwoFactorLogin(data);

  // After successful 2FA verification, create and set tokens
  if (result.accountType === AccountType.Local) {
    // For local accounts, create new JWT tokens
    const accessToken = await TokenJwt.createAccessToken({
      accountId: result.accountId,
      accountType: AccountType.Local,
    });

    const refreshToken = await TokenJwt.createRefreshToken({
      accountId: result.accountId,
      accountType: AccountType.Local,
    });

    // Set up complete account session
    const expiresIn = 3600 * 1000; // 1 hour
    setupCompleteAccountSession(
      req,
      res,
      result.accountId,
      accessToken,
      expiresIn,
      refreshToken,
      true, // set as current account
    );
  } else if (result.accountType === AccountType.OAuth && result.oauthTokens) {
    // For OAuth accounts, use the stored OAuth tokens
    const { accessToken: oauthAccessToken, refreshToken: oauthRefreshToken } = result.oauthTokens;

    // Get token expiration info
    const tokenInfo = await getGoogleTokenInfo(oauthAccessToken);
    const expiresIn = tokenInfo.expires_in || 3600;

    // Create JWT tokens that wrap the OAuth tokens
    const accessToken = await TokenJwt.createAccessToken({
      accountId: result.accountId,
      accountType: AccountType.OAuth,
      oauthAccessToken,
      expiresIn,
    });

    const refreshToken = await TokenJwt.createRefreshToken({
      accountId: result.accountId,
      accountType: AccountType.OAuth,
      oauthRefreshToken,
    });

    // Update account scopes if OAuth
    await updateAccountScopes(result.accountId, oauthAccessToken);

    // Check for additional scopes
    const scopeCheck = await checkForAdditionalGoogleScopes(result.accountId, oauthAccessToken);
    result.needsAdditionalScopes = scopeCheck.needsAdditionalScopes;
    result.missingScopes = scopeCheck.missingScopes;

    // Set up complete account session
    setupCompleteAccountSession(
      req,
      res,
      result.accountId,
      accessToken,
      expiresIn * 1000,
      refreshToken,
      true, // set as current account
    );
  }

  if (isMock) {
    const tempTokenData = getTwoFactorTempToken(data.tempToken);

    const responseData = {
      accountId: result.accountId,
      name: result.name,
      message: result.message,
      ...(result.needsAdditionalScopes !== undefined && { needsAdditionalScopes: result.needsAdditionalScopes }),
      ...(result.missingScopes && { missingScopes: result.missingScopes }),
      // Mock data only included when mock is enabled
      mock: {
        tempTokenData: tempTokenData
          ? {
              accountId: tempTokenData.accountId,
              email: tempTokenData.email,
              accountType: tempTokenData.accountType,
              expiresAt: tempTokenData.expiresAt,
            }
          : null,
        loginCompleted: true,
        note: 'Temp token data exposed for testing',
      },
    };

    next(new JsonSuccess(responseData));
  } else {
    // Original response logic
    const responseData = {
      accountId: result.accountId,
      name: result.name,
      message: result.message,
      ...(result.needsAdditionalScopes !== undefined && { needsAdditionalScopes: result.needsAdditionalScopes }),
      ...(result.missingScopes && { missingScopes: result.missingScopes }),
    };

    next(new JsonSuccess(responseData));
  }
});

/**
 * Get active 2FA tokens
 */
export const getActiveTwoFactorTokens = asyncHandler(async (req, res, next) => {
  if (!isMock) {
    throw new BadRequestError('2FA token inspection disabled in production', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const tempTokens = getAllTempTokens();
  const setupTokens = getAllSetupTokens();

  next(
    new JsonSuccess({
      tempTokens: tempTokens.map((tokenData) => ({
        token: tokenData.token,
        accountId: tokenData.accountId,
        email: tokenData.email,
        accountType: tokenData.accountType,
        expiresAt: tokenData.expiresAt,
        hasOAuthTokens: !!tokenData.oauthTokens,
      })),
      setupTokens: setupTokens.map((tokenData) => ({
        token: tokenData.token,
        accountId: tokenData.accountId,
        accountType: tokenData.accountType,
        expiresAt: tokenData.expiresAt,
        createdAt: tokenData.createdAt,
        hasSecret: !!tokenData.secret,
      })),
      tempCount: tempTokens.length,
      setupCount: setupTokens.length,
      message: 'Active 2FA tokens retrieved successfully',
    }),
  );
});
