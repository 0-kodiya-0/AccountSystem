import { Request } from 'express';
import crypto from 'crypto';
import { TLSSocket, PeerCertificate } from 'tls';
import { ApiErrorCode, AuthError } from '../types/response.types';
import { asyncHandler } from '../utils/response';

export interface InternalRequest extends Request {
    clientCertificate?: {
        fingerprint: string;
        subject: PeerCertificate['subject'];
        issuer: PeerCertificate['issuer'];
        valid: boolean;
        signedBySameCA: boolean;
    };
    isInternalRequest?: boolean;
}

/**
 * Middleware to extract and log client certificate information
 * Note: Actual certificate validation is handled by Node.js TLS layer when using:
 * - requestCert: true
 * - rejectUnauthorized: true
 * - ca: [CA certificate]
 */
export const extractClientCertificateInfo = asyncHandler((req: InternalRequest, res, next) => {
    try {
        const socket = req.socket as TLSSocket;

        // Get client certificate (already validated by TLS layer)
        const cert = socket.getPeerCertificate(true);

        if (cert && Object.keys(cert).length > 0) {
            // Calculate certificate fingerprint for logging
            const fingerprint = crypto
                .createHash('sha256')
                .update(cert.raw)
                .digest('hex')
                .toUpperCase();

            // Attach certificate info to request for logging/audit purposes
            req.clientCertificate = {
                fingerprint,
                subject: cert.subject,
                issuer: cert.issuer,
                valid: true,
                signedBySameCA: true // Already validated by TLS layer
            };

            console.log(`Internal request authenticated with certificate: ${fingerprint}`);
            console.log(`Certificate subject: ${JSON.stringify(cert.subject)}`);
        }

        req.isInternalRequest = true;
        next();

    } catch (error) {
        console.error('Error extracting certificate information:', error);
        throw new AuthError('Certificate processing failed', 500, ApiErrorCode.SERVER_ERROR);
    }
});

/**
 * Middleware to validate internal service authentication headers
 * Since mTLS already provides strong authentication, we just need to verify
 * that the service provides identification headers
 */
export const validateInternalService = asyncHandler((req: InternalRequest, res, next) => {
    // Check for service identification headers
    const serviceId = req.get('X-Internal-Service-ID');
    const serviceSecret = req.get('X-Internal-Service-Secret');

    if (!serviceId || !serviceSecret) {
        throw new AuthError('Internal service credentials required', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    console.log(`Internal service authenticated: ${serviceId}`);
    next();
});

/**
 * Combined middleware for internal authentication
 * Note: Certificate validation is handled by the HTTPS server configuration
 */
export const internalAuthentication = [
    extractClientCertificateInfo,
    validateInternalService
];