import express from 'express';
import https from 'https';
import cors from 'cors';
import { Socket } from 'net';
import { TLSSocket } from 'tls';
import { getInternalServerConfig, validateInternalServerConfig } from './config/internal-server.config';
import { applyErrorHandlers } from './utils/response';
import { internalAuthentication, InternalRequest } from './middleware/internal-auth.middleware';

// Validate configuration first
const validation = validateInternalServerConfig();

if (!validation.valid) {
    console.error('Internal server configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
}

const app = express();
const config = getInternalServerConfig();

if (!config.enabled) {
    console.log('Internal server is disabled');
    process.exit(1);
}

// Basic middleware for internal server
app.use(express.json({
    limit: '10mb',
    strict: true
}));

// Disable CORS for internal routes (internal services only)
app.use(cors({
    origin: false,
    credentials: false
}));

// Request logging middleware for internal requests
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    console.log(`[INTERNAL] ${timestamp} - ${req.method} ${req.url} - ${clientIP}`);
    next();
});

// Apply internal authentication middleware to all routes
app.use('/internal', internalAuthentication);

// Health check endpoint (with authentication)
app.get('/internal/health', (req, res) => {
    const internalReq = req as InternalRequest;
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'internal-https',
            certificate: {
                fingerprint: internalReq.clientCertificate?.fingerprint,
                subject: internalReq.clientCertificate?.subject,
                signedBySameCA: internalReq.clientCertificate?.signedBySameCA
            },
            service: req.get('X-Internal-Service-ID')
        }
    });
});

// Apply error handlers
applyErrorHandlers(app);

// 404 handler for internal routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'INTERNAL_ENDPOINT_NOT_FOUND',
            message: 'Internal endpoint not found'
        }
    });
});

// Create HTTPS server with client certificate authentication
const httpsServer = https.createServer(config.httpsOptions, app);

// Enhanced error handling for the HTTPS server
httpsServer.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Internal HTTPS server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use for internal server`);
    }
});

httpsServer.on('clientError', (error: Error, socket: Socket) => {
    console.error('Internal client error:', error.message);

    // Handle client certificate errors gracefully
    if ('code' in error && (error.code === 'EPROTO' || error.code === 'ECONNRESET')) {
        console.warn('Client certificate validation failed or connection reset');
    }

    try {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch {
        // Socket might already be closed
    }
});

// Handle TLS/SSL errors
httpsServer.on('tlsClientError', (error: Error) => {
    console.error('TLS client error:', error.message);

    if ('code' in error && error.code === 'EPROTO') {
        console.warn('Client presented invalid or unauthorized certificate');
    }
});

httpsServer.on('secureConnection', (tlsSocket: TLSSocket) => {
    const cert = tlsSocket.getPeerCertificate();
    if (cert && Object.keys(cert).length > 0) {
        const commonName = cert.subject?.CN || 'unknown';
        console.log(`Secure connection established with certificate: ${commonName}`);
    }
});

httpsServer.listen(config.port, () => {
    console.log(`🔒 Internal HTTPS server running on port ${config.port}`);
    console.log('   ✓ Client certificate authentication enabled');
    console.log('   ✓ Same-CA certificate validation enabled');
    console.log('   ✓ Internal service authentication required');
    console.log(`   📡 Health check: https://localhost:${config.port}/internal/health`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down internal server gracefully');
    httpsServer.close(() => {
        console.log('Internal server closed');
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down internal server gracefully');
    httpsServer.close(() => {
        console.log('Internal server closed');
    });
});