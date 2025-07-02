import { Request } from 'express';
import crypto from 'crypto';
import { TLSSocket, PeerCertificate } from 'tls';
import { ApiErrorCode, AuthError } from '../types/response.types';
import { asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getNodeEnv, getMockEnabled } from '../config/env.config';

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
 * Note: Certificate validation is handled by Node.js HTTPS module automatically.
 * This middleware only extracts certificate info and validates service headers.
 */
export const internalAuthentication = asyncHandler((req: InternalRequest, res, next) => {
  const nodeEnv = getNodeEnv();
  const mockEnabled = getMockEnabled();
  const isProduction = nodeEnv === 'production' && !mockEnabled;

  try {
    const socket = req.socket as TLSSocket;
    const isSecureConnection = socket.encrypted || req.secure;

    // Extract certificate information if available (for logging/audit purposes only)
    if (isSecureConnection && socket.getPeerCertificate) {
      const cert = socket.getPeerCertificate(true);

      if (cert && Object.keys(cert).length > 0) {
        // Generate fingerprint for logging
        const fingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex').toUpperCase();

        req.clientCertificate = {
          fingerprint,
          subject: cert.subject,
          issuer: cert.issuer,
        };

        logger.info(`Internal request with certificate: ${fingerprint}`, {
          subject: cert.subject.CN || 'Unknown',
          issuer: cert.issuer.CN || 'Unknown',
        });
      }
    }

    // Validate service identification headers
    const serviceId = req.get('X-Internal-Service-ID');
    const serviceSecret = req.get('X-Internal-Service-Secret');
    const serviceName = req.get('X-Internal-Service-Name') || serviceId;

    if (!serviceId) {
      throw new AuthError(
        'Service identification required (X-Internal-Service-ID header)',
        401,
        ApiErrorCode.AUTH_FAILED,
      );
    }

    // In development/mock mode, require service secret when no certificate is present
    const hasCertificate = !!req.clientCertificate;
    if (!isProduction && !hasCertificate && !serviceSecret) {
      throw new AuthError(
        'Service secret required in development mode (X-Internal-Service-Secret header)',
        401,
        ApiErrorCode.AUTH_FAILED,
      );
    }

    // Set request properties
    req.isInternalRequest = true;
    req.serviceId = serviceId;
    req.serviceName = serviceName || serviceId;

    // Log successful authentication
    const connectionType = isSecureConnection ? 'HTTPS' : 'HTTP';
    const authMethod = hasCertificate ? 'Certificate + Headers' : 'Headers Only';

    logger.info(`Internal service authenticated: ${req.serviceName}`, {
      serviceId,
      connectionType,
      authMethod,
      environment: isProduction ? 'production' : 'development',
      path: req.path,
    });

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
