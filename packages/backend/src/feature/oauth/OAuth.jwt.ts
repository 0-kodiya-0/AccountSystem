import jwt from 'jsonwebtoken';
import { AccountType } from '../account/Account.types';
import { getAccessTokenExpiry, getJwtSecret, getRefreshTokenExpiry } from '../../config/env.config';

// Environment variables
const JWT_SECRET = getJwtSecret();
const ACCESS_TOKEN_EXPIRY = getAccessTokenExpiry();
const REFRESH_TOKEN_EXPIRY = getRefreshTokenExpiry();

/**
 * JWT payload interface for OAuth tokens
 */
interface OAuthTokenPayload {
  sub: string; // accountId
  type: AccountType.OAuth;
  oauthAccessToken: string; // The actual Google/OAuth access token
  iat: number;
  exp?: number;
  isRefreshToken?: boolean;
}

/**
 * JWT payload interface for OAuth refresh tokens
 */
interface OAuthRefreshTokenPayload {
  sub: string; // accountId
  type: AccountType.OAuth;
  oauthRefreshToken: string; // The actual Google/OAuth refresh token
  iat: number;
  exp?: number;
  isRefreshToken: true;
}

/**
 * Create a signed JWT token for OAuth authentication that wraps the OAuth access token
 * @param accountId The account ID to encode in the token
 * @param oauthAccessToken The actual OAuth access token from the provider
 * @param expiresIn Optional time until token expires (in seconds)
 * @returns Promise resolving to the signed token
 */
export async function createOAuthJwtToken(
  accountId: string,
  oauthAccessToken: string,
  expiresIn?: number,
): Promise<string> {
  const payload: OAuthTokenPayload = {
    sub: accountId,
    type: AccountType.OAuth,
    oauthAccessToken,
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign token
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn ? `${expiresIn}s` : ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Create a refresh token for OAuth authentication that wraps the OAuth refresh token
 * @param accountId The account ID to encode in the token
 * @param oauthRefreshToken The actual OAuth refresh token from the provider
 * @returns Promise resolving to the signed refresh token
 */
export async function createOAuthRefreshToken(accountId: string, oauthRefreshToken: string): Promise<string> {
  const payload: OAuthRefreshTokenPayload = {
    sub: accountId,
    type: AccountType.OAuth,
    oauthRefreshToken,
    isRefreshToken: true,
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign token with longer expiration
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify an OAuth JWT token and extract the OAuth access token
 * @param token The token to verify
 * @returns Account ID, type, and OAuth access token if valid
 */
export function verifyOAuthJwtToken(token: string): {
  accountId: string;
  accountType: AccountType.OAuth;
  oauthAccessToken: string;
} & jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as OAuthTokenPayload;

    // Ensure it's an OAuth token and not a refresh token
    if (decoded.type !== AccountType.OAuth || decoded.isRefreshToken) {
      throw new Error('Not an OAuth access token');
    }

    return {
      accountId: decoded.sub,
      accountType: AccountType.OAuth,
      ...decoded,
    };
  } catch {
    throw new Error('Invalid or expired OAuth token');
  }
}

/**
 * Verify an OAuth refresh token and extract the OAuth refresh token
 * @param token The refresh token to verify
 * @returns Account ID, type, and OAuth refresh token if valid
 */
export function verifyOAuthRefreshToken(token: string): {
  accountId: string;
  accountType: AccountType.OAuth;
  oauthRefreshToken: string;
} & jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as OAuthRefreshTokenPayload;

    // Ensure it's an OAuth refresh token
    if (decoded.type !== AccountType.OAuth || !decoded.isRefreshToken) {
      throw new Error('Not an OAuth refresh token');
    }

    return {
      accountId: decoded.sub,
      accountType: AccountType.OAuth,
      ...decoded,
    };
  } catch {
    throw new Error('Invalid or expired OAuth refresh token');
  }
}
