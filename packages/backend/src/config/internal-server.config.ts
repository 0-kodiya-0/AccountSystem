import { ServerOptions } from 'https';
import fs from 'fs';
import {
  getInternalServerKeyPath,
  getInternalServerCertPath,
  getInternalCACertPath,
  getNodeEnv, // BUILD_REMOVE
} from './env.config';
import { logger } from '../utils/logger';

/**
 * Load SSL certificates for internal HTTPS server
 */
export function loadInternalSSLCertificates(): ServerOptions {
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

    const httpsOptions: ServerOptions = {
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
        'ECDHE-ECDSA-AES256-GCM-SHA384',
      ].join(':'),
      honorCipherOrder: true,

      // Additional TLS security
      sessionTimeout: 300, // 5 minutes
      dhparam: undefined, // Can be added if needed
    };

    logger.info('Internal SSL certificates loaded successfully');
    logger.info(`- Server Key: ${serverKeyPath}`);
    logger.info(`- Server Cert: ${serverCertPath}`);
    logger.info(`- CA Cert: ${caCertPath}`);

    return httpsOptions;
  } catch (error) {
    logger.error('Failed to load internal SSL certificates:', error);

    /* BUILD_REMOVE_START */ if (getNodeEnv() === 'production') {
      /* BUILD_REMOVE_END */
      throw new Error(`Internal SSL certificates are required in production: ${error}`);
    } // BUILD_REMOVE

    logger.warn('Internal SSL certificates not available - internal server will be disabled');
    throw error; // Re-throw to indicate failure
  }
}
