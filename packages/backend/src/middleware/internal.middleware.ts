import { Request } from 'express';
import crypto from 'crypto';
import { TLSSocket, PeerCertificate } from 'tls';
import { ApiErrorCode, AuthError } from '../types/response.types';
import { asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getNodeEnv, getMockEnabled } from '../config/env.config'; // BUILD_REMOVE

export interface InternalRequest extends Request {
  clientCertificate?: {
    fingerprint: string;
    subject: PeerCertificate['subject'];
    issuer: PeerCertificate['issuer'];
  };
  isInternalRequest?: boolean;
  serviceId?: string;
  serviceName?: string;
}

/**
 * Internal authentication middleware
 * - Production: mTLS certificate validation (handled by Node.js) + Service ID header
 * - Development: Service ID header only (no certificates required)
 */
export const internalAuthentication = asyncHandler((req: InternalRequest, res, next) => {
  /* BUILD_REMOVE_START */
  const nodeEnv = getNodeEnv();
  const mockEnabled = getMockEnabled();
  const isProduction = nodeEnv === 'production' && !mockEnabled;
  /* BUILD_REMOVE_END */

  try {
    const socket = req.socket as TLSSocket;
    const isSecureConnection = socket.encrypted || req.secure;

    // Extract service identification headers (required in both modes)
    const serviceId = req.get('X-Internal-Service-ID');
    const serviceName = req.get('X-Internal-Service-Name') || serviceId;

    if (!serviceId) {
      throw new AuthError(
        'Service identification required (X-Internal-Service-ID header)',
        401,
        ApiErrorCode.AUTH_FAILED,
      );
    }

    /* BUILD_REMOVE_START */
    // Production Mode: Verify mTLS certificate + Service ID
    if (isProduction) {
      /* BUILD_REMOVE_END */
      if (!isSecureConnection) {
        throw new AuthError('HTTPS connection required in production mode', 401, ApiErrorCode.AUTH_FAILED);
      }

      // Extract certificate information (certificate validation already handled by Node.js HTTPS)
      const cert = socket.getPeerCertificate && socket.getPeerCertificate(true);

      if (!cert || Object.keys(cert).length === 0) {
        throw new AuthError('Valid client certificate required in production mode', 401, ApiErrorCode.AUTH_FAILED);
      }

      // Generate fingerprint for logging/audit purposes
      const fingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex').toUpperCase();

      req.clientCertificate = {
        fingerprint,
        subject: cert.subject,
        issuer: cert.issuer,
      };

      logger.info(`Internal service authenticated via mTLS: ${serviceName}`, {
        serviceId,
        certificateFingerprint: fingerprint,
        certificateSubject: cert.subject.CN || 'Unknown',
        certificateIssuer: cert.issuer.CN || 'Unknown',
        path: req.path,
      });
      /* BUILD_REMOVE_START */
    }
    // Development Mode: Service ID header only
    else {
      logger.info(`Internal service authenticated via headers: ${serviceName}`, {
        serviceId,
        connectionType: isSecureConnection ? 'HTTPS' : 'HTTP',
        environment: 'development',
        path: req.path,
      });
    }
    /* BUILD_REMOVE_END */

    // Set request properties for both modes
    req.isInternalRequest = true;
    req.serviceId = serviceId;
    req.serviceName = serviceName || serviceId;

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    logger.error('Internal authentication error:', error);
    throw new AuthError('Authentication processing failed', 500, ApiErrorCode.SERVER_ERROR);
  }
});

/**
 * Check if request is properly authenticated for internal use
 */
export function isInternalRequestAuthenticated(req: InternalRequest): boolean {
  return !!(req.isInternalRequest && req.serviceId);
}
