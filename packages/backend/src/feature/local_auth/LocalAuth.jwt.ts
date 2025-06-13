import jwt from 'jsonwebtoken';
import { AccountType } from '../account/Account.types';
import { getAccessTokenExpiry, getJwtSecret, getRefreshTokenExpiry } from '../../config/env.config';
import { LocalAuthTokenPayload } from './LocalAuth.types';

/**
 * Create a signed JWT token for local authentication
 * @param accountId The account ID to encode in the token
 * @param expiresIn Optional time until token expires (in seconds)
 * @returns Promise resolving to the signed token
 */
export async function createLocalJwtToken(accountId: string, expiresIn?: number): Promise<string> {
  const payload: LocalAuthTokenPayload = {
    sub: accountId,
    type: AccountType.Local,
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign token
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn ? `${expiresIn}s` : getAccessTokenExpiry(),
  });
}

/**
 * Create a refresh token for local authentication
 * @param accountId The account ID to encode in the token
 * @returns Promise resolving to the signed refresh token
 */
export async function createLocalRefreshToken(accountId: string): Promise<string> {
  const payload: LocalAuthTokenPayload = {
    sub: accountId,
    type: AccountType.Local,
    isRefreshToken: true,
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign token with longer expiration
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getRefreshTokenExpiry(),
  });
}

/**
 * Verify a local auth JWT token
 * @param token The token to verify
 * @returns Account ID and type if valid
 */
export function verifyLocalJwtToken(token: string): {
  accountId: string;
  accountType: AccountType.Local;
} & jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as LocalAuthTokenPayload;

    // Ensure it's a local auth token
    if (decoded.type !== AccountType.Local) {
      throw new Error('Not a local authentication token');
    }

    return {
      accountId: decoded.sub,
      accountType: AccountType.Local,
      ...decoded,
    };
  } catch {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify a local auth refresh token
 * @param token The refresh token to verify
 * @returns Account ID and type if valid refresh token
 */
export function verifyLocalRefreshToken(token: string): {
  accountId: string;
  accountType: AccountType.Local;
} & jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as LocalAuthTokenPayload;

    // Ensure it's a local auth refresh token
    if (decoded.type !== AccountType.Local || !decoded.isRefreshToken) {
      throw new Error('Not a local authentication refresh token');
    }

    return {
      accountId: decoded.sub,
      accountType: AccountType.Local,
      ...decoded,
    };
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
}
