import { AccountType } from '../../account/Account.types';

export interface GetTokenInfoResponse {
  tokenCookies: Record<string, TokenCookieInfo>;
  tokenCount: number;
}

export interface TokenCookieInfo {
  type: string;
  accountId: string;
  isRefreshToken: boolean;
  iat?: number;
  exp?: number;
  isExpired: boolean;
  error?: string;
}

export interface CreateTokenRequest {
  accountId: string;
  accountType: AccountType;
  expiresIn?: number;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  setCookie?: boolean;
  setCookies?: boolean;
}

export interface CreateTokenResponse {
  message: string;
  token: string;
  accountId: string;
  accountType: AccountType;
  setCookie?: boolean;
  expiresIn?: number;
}

export interface CreateTokenPairRequest {
  accountId: string;
  accountType: AccountType;
  accessTokenExpiresIn?: number;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  setCookies?: boolean;
}

export interface CreateTokenPairResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  accountId: string;
  accountType: AccountType;
  setCookies: boolean;
}

export interface ValidateTokenResponse {
  valid: boolean;
  expired: boolean;
  tokenInfo?: unknown;
  error?: string;
  message: string;
}

export interface CreateExpiredTokenRequest {
  accountId: string;
  accountType: AccountType;
  tokenType?: 'access' | 'refresh';
  pastSeconds?: number;
}

export interface CreateExpiredTokenResponse {
  message: string;
  token: string;
  accountId: string;
  accountType: AccountType;
  tokenType: string;
  expiredSeconds: number;
}

export interface CreateMalformedTokenRequest {
  type?: 'invalid_signature' | 'malformed_structure' | 'missing_parts' | 'empty_parts' | 'invalid_json';
}

export interface CreateMalformedTokenResponse {
  message: string;
  token: string;
  type: string;
}

export interface ClearTokensResponse {
  message: string;
  accountId: string;
  cleared: string[];
}

export interface TokenInfo {
  present: boolean;
  valid?: boolean;
  expired?: boolean;
  info?: unknown;
  error?: string;
}

export interface GetTokenInfoForAccountResponse {
  accountId: string;
  accessToken: TokenInfo;
  refreshToken: TokenInfo;
}
