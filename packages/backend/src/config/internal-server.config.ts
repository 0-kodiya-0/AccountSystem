import https from 'https';
import fs from 'fs';
import { 
    getNodeEnv, 
    getInternalPort, 
    getInternalServerEnabled,
    getInternalServerKeyPath,
    getInternalServerCertPath,
    getInternalCACertPath
} from './env.config';

export interface InternalServerConfig {
    port: number;
    httpsOptions: https.ServerOptions;
    enabled: boolean;
}

/**
 * Load SSL certificates for internal HTTPS server from environment-specified paths
 */
export function loadInternalSSLCertificates(): https.ServerOptions {
    try {
        const serverKeyPath = getInternalServerKeyPath();
        const serverCertPath = getInternalServerCertPath();
        const caCertPath = getInternalCACertPath();

        // Validate that all certificate files exist
        if (!fs.existsSync(serverKeyPath)) {
            throw new Error(`Server key file not found: ${serverKeyPath}`);
        }
        if (!fs.existsSync(serverCertPath)) {
            throw new Error(`Server certificate file not found: ${serverCertPath}`);
        }
        if (!fs.existsSync(caCertPath)) {
            throw new Error(`CA certificate file not found: ${caCertPath}`);
        }

        const httpsOptions: https.ServerOptions = {
            // Server certificate and key (account server's certificate)
            key: fs.readFileSync(serverKeyPath),
            cert: fs.readFileSync(serverCertPath),
            
            // CA certificate for client verification (same CA that signed account server cert)
            ca: fs.readFileSync(caCertPath),
            
            // Require client certificates signed by the same CA
            requestCert: true,
            rejectUnauthorized: true,
            
            // Enhanced security options
            secureProtocol: 'TLSv1_2_method',
            ciphers: [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES128-SHA256',
                'ECDHE-RSA-AES256-SHA384',
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-AES256-GCM-SHA384'
            ].join(':'),
            honorCipherOrder: true,
            
            // Additional TLS security
            sessionTimeout: 300, // 5 minutes
            dhparam: undefined // Can be added if needed
        };

        console.log('Internal SSL certificates loaded successfully');
        console.log(`- Server Key: ${serverKeyPath}`);
        console.log(`- Server Cert: ${serverCertPath}`);
        console.log(`- CA Cert: ${caCertPath}`);

        return httpsOptions;
    } catch (error) {
        console.error('Failed to load internal SSL certificates:', error);
        
        if (getNodeEnv() === 'production') {
            throw new Error(`Internal SSL certificates are required in production: ${error}`);
        }
        
        console.warn('Internal SSL certificates not available - internal server will be disabled');
        return {};
    }
}

/**
 * Get internal server configuration
 */
export function getInternalServerConfig(): InternalServerConfig {
    const enabled = getInternalServerEnabled();
    
    if (!enabled) {
        return {
            port: getInternalPort(),
            httpsOptions: {},
            enabled: false
        };
    }

    const httpsOptions = loadInternalSSLCertificates();
    const hasValidCerts = Object.keys(httpsOptions).length > 0;

    return {
        port: getInternalPort(),
        httpsOptions,
        enabled: hasValidCerts
    };
}

/**
 * Validate internal server configuration
 */
export function validateInternalServerConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!getInternalServerEnabled()) {
        return { valid: true, errors: ['Internal server is disabled'] };
    }

    try {
        const serverKeyPath = getInternalServerKeyPath();
        const serverCertPath = getInternalServerCertPath();
        const caCertPath = getInternalCACertPath();

        if (!serverKeyPath) {
            errors.push('INTERNAL_SERVER_KEY_PATH environment variable is required');
        } else if (!fs.existsSync(serverKeyPath)) {
            errors.push(`Server key file not found: ${serverKeyPath}`);
        }

        if (!serverCertPath) {
            errors.push('INTERNAL_SERVER_CERT_PATH environment variable is required');
        } else if (!fs.existsSync(serverCertPath)) {
            errors.push(`Server certificate file not found: ${serverCertPath}`);
        }

        if (!caCertPath) {
            errors.push('INTERNAL_CA_CERT_PATH environment variable is required');
        } else if (!fs.existsSync(caCertPath)) {
            errors.push(`CA certificate file not found: ${caCertPath}`);
        }

        const port = getInternalPort();
        if (isNaN(port) || port < 1 || port > 65535) {
            errors.push(`Invalid internal port: ${port}`);
        }

    } catch (error) {
        errors.push(`Configuration validation error: ${error}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}