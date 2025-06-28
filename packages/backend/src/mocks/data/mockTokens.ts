import { AccountType } from '../../feature/account';
import { TokenInfo, TokenVerificationResult } from '../../feature/tokens/Token.types';

export const mockValidAccessTokenInfo: TokenInfo = {
  isExpired: false,
  isValid: true,
  type: 'local_jwt',
  expiresAt: Date.now() + 3600000, // Expires in 1 hour
  timeRemaining: 3600000,
  accountId: '507f1f77bcf86cd799439011',
};

export const mockExpiredTokenInfo: TokenInfo = {
  isExpired: true,
  isValid: false,
  type: 'oauth_jwt',
  expiresAt: Date.now() - 3600000, // Expired 1 hour ago
  timeRemaining: 0,
  error: 'Token has expired',
};

export const mockTokenVerificationResult: TokenVerificationResult = {
  accountId: '507f1f77bcf86cd799439011',
  accountType: AccountType.Local,
  isRefreshToken: false,
  exp: Math.floor((Date.now() + 3600000) / 1000),
};

export const mockOAuthTokenVerificationResult: TokenVerificationResult = {
  accountId: '507f1f77bcf86cd799439012',
  accountType: AccountType.OAuth,
  isRefreshToken: false,
  exp: Math.floor((Date.now() + 3600000) / 1000),
  oauthAccessToken: 'ya29.example_google_access_token',
  oauthRefreshToken: '1//example_google_refresh_token',
};
