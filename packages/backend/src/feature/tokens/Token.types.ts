import { AccountType } from '../account/Account.types';

export interface TokenPayload {
  sub: string; // accountId
  type: AccountType;
  iat: number;
  exp?: number;
  isRefreshToken?: boolean;
}

export interface LocalTokenPayload extends TokenPayload {
  type: AccountType.Local;
}

export interface OAuthTokenPayload extends TokenPayload {
  type: AccountType.OAuth;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

export interface TokenVerificationResult {
  accountId: string;
  accountType: AccountType;
  isRefreshToken: boolean;
  exp?: number;
  // OAuth specific
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

export interface TokenCreationOptions {
  accountId: string;
  accountType: AccountType;
  expiresIn?: number;
  // OAuth specific
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

export interface TokenInfo {
  isExpired: boolean;
  isValid: boolean;
  type: 'local_jwt' | 'oauth_jwt' | 'local_refresh_jwt' | 'oauth_refresh_jwt';
  expiresAt?: number;
  timeRemaining?: number;
  accountId?: string;
  error?: string;
  // OAuth specific
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

export interface RefreshTokenResult {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface TokenRevocationResult {
  accessTokenRevoked: boolean;
  refreshTokenRevoked: boolean;
  message?: string;
}
