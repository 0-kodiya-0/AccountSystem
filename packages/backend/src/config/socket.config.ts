import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { getProxyUrl } from './env.config';
import { logger } from '../utils/logger';

// ============================================================================
// Socket.IO Instance Management
// ============================================================================

interface SocketInstances {
  external?: SocketIOServer; // For regular users/frontend
  internal?: SocketIOServer; // For internal services
}

let socketInstances: SocketInstances = {};

/**
 * Initialize Socket.IO for external clients (users/frontend)
 * @param httpServer HTTP server to attach Socket.IO to
 * @returns Socket.IO server instance for external clients
 */
export const initializeExternalSocketIO = (httpServer: HttpServer): SocketIOServer => {
  if (socketInstances.external) {
    logger.warn('External Socket.IO instance already exists, returning existing instance');
    return socketInstances.external;
  }

  // Define allowed origins - adjust based on your environment
  const allowedOrigins = [getProxyUrl()].filter(Boolean); // Remove any undefined values

  logger.info('External Socket.IO initializing with allowed origins:', allowedOrigins);

  socketInstances.external = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    // Configure for proxy support
    path: '/socket.io',
    // Support all transports but prefer websocket
    transports: ['websocket', 'polling'],
    // Important for sticky sessions in a load balanced environment
    cookie: {
      name: 'io',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    },
    // Prevent disconnections through proxies
    pingTimeout: 60000,
    pingInterval: 25000,
    // Handle middleware timeouts
    connectTimeout: 45000,
    // Allow upgrades to websocket
    allowUpgrades: true,
  });

  // Enhanced connection error logging
  socketInstances.external.engine.on('connection_error', (err) => {
    logger.info(`External Socket.IO connection error: ${err.code} - ${err.message}`);
    logger.info('Error context:', err.context);
  });

  // Listen for connections
  socketInstances.external.on('connection', (socket) => {
    logger.info(`External client connected: ${socket.id}, transport: ${socket.conn.transport.name}`);
    logger.info(
      `External client handshake: ${socket.handshake.address} from origin: ${socket.handshake.headers.origin}`,
    );

    socket.on('disconnect', (reason) => {
      logger.info(`External client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  logger.info('External Socket.IO initialized');
  return socketInstances.external;
};

/**
 * Initialize Socket.IO for internal services
 * @param httpServer HTTP server to attach Socket.IO to
 * @returns Socket.IO server instance for internal services
 */
export const initializeInternalSocketIO = (httpServer: HttpServer): SocketIOServer => {
  if (socketInstances.internal) {
    logger.warn('Internal Socket.IO instance already exists, returning existing instance');
    return socketInstances.internal;
  }

  logger.info('Internal Socket.IO initializing for internal services');

  socketInstances.internal = new SocketIOServer(httpServer, {
    // No CORS for internal services (same network/server)
    cors: {
      origin: false,
      credentials: false,
    },
    // Different path for internal services
    path: '/internal-socket.io',
    // Prefer websocket for internal services (more reliable network)
    transports: ['websocket', 'polling'],
    // Internal services don't need cookies
    cookie: false,
    // Shorter timeouts for internal services (faster network)
    pingTimeout: 30000,
    pingInterval: 15000,
    connectTimeout: 20000,
    allowUpgrades: true,
  });

  // Enhanced connection error logging for internal services
  socketInstances.internal.engine.on('connection_error', (err) => {
    logger.error(`Internal Socket.IO connection error: ${err.code} - ${err.message}`);
    logger.error('Internal error context:', err.context);
  });

  // Listen for internal service connections
  socketInstances.internal.on('connection', (socket) => {
    logger.info(`Internal service connected: ${socket.id}, transport: ${socket.conn.transport.name}`);
    logger.info(`Internal service handshake: ${socket.handshake.address}`);

    socket.on('disconnect', (reason) => {
      logger.info(`Internal service disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  logger.info('Internal Socket.IO initialized');
  return socketInstances.internal;
};

/**
 * Initialize Socket.IO with automatic detection of client type
 * @param httpServer HTTP server to attach Socket.IO to
 * @param clientType Type of clients this instance will serve
 * @returns Socket.IO server instance
 */
export const initializeSocketIO = (
  httpServer: HttpServer,
  clientType: 'external' | 'internal' = 'external',
): SocketIOServer => {
  if (clientType === 'internal') {
    return initializeInternalSocketIO(httpServer);
  } else {
    return initializeExternalSocketIO(httpServer);
  }
};

/**
 * Get the external Socket.IO server instance
 * @returns External Socket.IO server instance
 */
export const getExternalSocketIO = (): SocketIOServer => {
  if (!socketInstances.external) {
    throw new Error('External Socket.IO has not been initialized. Call initializeExternalSocketIO first.');
  }
  return socketInstances.external;
};

/**
 * Get the internal Socket.IO server instance
 * @returns Internal Socket.IO server instance
 */
export const getInternalSocketIO = (): SocketIOServer => {
  if (!socketInstances.internal) {
    throw new Error('Internal Socket.IO has not been initialized. Call initializeInternalSocketIO first.');
  }
  return socketInstances.internal;
};

/**
 * Get Socket.IO instance by type
 * @param clientType Type of Socket.IO instance to retrieve
 * @returns Socket.IO server instance
 */
export const getSocketIO = (clientType: 'external' | 'internal' = 'external'): SocketIOServer => {
  if (clientType === 'internal') {
    return getInternalSocketIO();
  } else {
    return getExternalSocketIO();
  }
};

/**
 * Check if external Socket.IO is initialized
 */
export const isExternalSocketIOInitialized = (): boolean => {
  return !!socketInstances.external;
};

/**
 * Check if internal Socket.IO is initialized
 */
export const isInternalSocketIOInitialized = (): boolean => {
  return !!socketInstances.internal;
};

/**
 * Get all initialized Socket.IO instances
 */
export const getAllSocketInstances = (): SocketInstances => {
  return { ...socketInstances };
};

/**
 * Close all Socket.IO instances
 */
export const closeAllSocketInstances = (): void => {
  if (socketInstances.external) {
    socketInstances.external.close();
    logger.info('External Socket.IO instance closed');
  }

  if (socketInstances.internal) {
    socketInstances.internal.close();
    logger.info('Internal Socket.IO instance closed');
  }

  socketInstances = {};
  logger.info('All Socket.IO instances closed');
};

/**
 * Close specific Socket.IO instance
 */
export const closeSocketInstance = (clientType: 'external' | 'internal'): void => {
  if (clientType === 'external' && socketInstances.external) {
    socketInstances.external.close();
    socketInstances.external = undefined;
    logger.info('External Socket.IO instance closed');
  } else if (clientType === 'internal' && socketInstances.internal) {
    socketInstances.internal.close();
    socketInstances.internal = undefined;
    logger.info('Internal Socket.IO instance closed');
  }
};

// ============================================================================
// Backward Compatibility (Legacy API)
// ============================================================================

/**
 * @deprecated Use initializeExternalSocketIO instead
 */
export const getIO = getExternalSocketIO;

export default {
  initializeSocketIO,
  initializeExternalSocketIO,
  initializeInternalSocketIO,
  getSocketIO,
  getExternalSocketIO,
  getInternalSocketIO,
  isExternalSocketIOInitialized,
  isInternalSocketIOInitialized,
  getAllSocketInstances,
  closeAllSocketInstances,
  closeSocketInstance,
  // Legacy
  getIO,
};
