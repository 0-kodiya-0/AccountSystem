import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/env.config';
import { logger } from '../../utils/logger';

export interface TokenInfo {
  isValid: boolean;
  expiresAt?: number;
  timeRemaining?: number;
  isExpired?: boolean;
  error?: string;
}

/**
 * Get detailed information about a token
 * Simple function - just pass a token and get back useful info
 */
export async function getTokenInformation(token: string): Promise<TokenInfo> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      isValid: false,
      error: 'Token is required and must be a non-empty string',
    };
  }

  try {
    // Try to decode the JWT without verification first to get basic info
    const decoded = jwt.decode(token) as any;

    if (!decoded) {
      return {
        isValid: false,
        error: 'Invalid token format - unable to decode',
      };
    }

    // Get expiration info
    const expiresAt = decoded.exp ? decoded.exp * 1000 : undefined; // Convert to milliseconds
    const currentTime = Date.now();
    const timeRemaining = expiresAt ? Math.max(0, expiresAt - currentTime) : undefined;
    const isExpired = expiresAt ? currentTime >= expiresAt : false;

    // Try to verify the token to confirm it's valid
    try {
      jwt.verify(token, getJwtSecret());

      logger.info('Token verification successful', {
        isExpired,
        timeRemaining,
      });

      return {
        isValid: !isExpired,
        expiresAt,
        timeRemaining,
        isExpired,
      };
    } catch (verificationError) {
      // Token structure is valid but signature/content is invalid
      logger.warn('Token verification failed', {
        error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
      });

      return {
        isValid: false,
        expiresAt,
        timeRemaining,
        isExpired,
        error: 'Token signature is invalid or token is malformed',
      };
    }
  } catch (error) {
    logger.error('Failed to process token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      isValid: false,
      error: `Failed to process token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Get time remaining for token in milliseconds
 */
export function getTokenTimeRemaining(token: string): number {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return 0;
    }
    return Math.max(0, decoded.exp * 1000 - Date.now());
  } catch {
    return 0;
  }
}
