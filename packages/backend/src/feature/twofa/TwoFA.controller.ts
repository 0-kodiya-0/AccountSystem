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

  // If enabling 2FA, generate QR code
  if (data.enableTwoFactor && result.secret && result.qrCodeUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(result.qrCodeUrl);

      // Send notification email (async - don't wait)
      if (account.userDetails.email) {
        sendNonCriticalEmail(
          sendTwoFactorEnabledNotification,
          [account.userDetails.email, account.userDetails.firstName || account.userDetails.name.split(' ')[0]],
          { maxAttempts: 2, delayMs: 1000 },
        );
      }

      next(
        new JsonSuccess({
          ...result,
          qrCode: qrCodeDataUrl,
        }),
      );
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      throw new BadRequestError('Failed to generate QR code', 500, ApiErrorCode.SERVER_ERROR);
    }
  } else {
    next(new JsonSuccess(result));
  }
});

/**
 * Verify and enable 2FA setup
 * Route: POST /:accountId/twofa/verify-setup
 */
export const verifyAndEnableTwoFactor = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const data = req.body as VerifySetupTwoFactorRequest;

  if (!data.token) {
    throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await TwoFAService.verifyAndEnableTwoFactor(accountId, data);

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

  // Remove OAuth tokens from response for security
  const responseData = {
    accountId: result.accountId,
    name: result.name,
    message: result.message,
    ...(result.needsAdditionalScopes !== undefined && { needsAdditionalScopes: result.needsAdditionalScopes }),
    ...(result.missingScopes && { missingScopes: result.missingScopes }),
  };

  next(new JsonSuccess(responseData));
});
