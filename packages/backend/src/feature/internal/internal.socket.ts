import { Server, Socket, Namespace } from 'socket.io';
import { logger } from '../../utils/logger';

// Import existing services
import * as AccountService from '../account/Account.service';
import * as SessionService from '../session/session.service';
import * as TokenService from '../tokens/Token.service';
import { verifyAccessToken, verifyRefreshToken } from '../tokens/Token.jwt';
import { ValidationUtils } from '../../utils/validation';

// Import proper Socket.IO TypeScript interfaces
import {
  InternalServerToClientEvents,
  InternalClientToServerEvents,
  InternalInterServerEvents,
  InternalSocketData,
  ConnectedServiceInfo,
} from './internal.socket.types';

// Type-safe Socket interface
export type InternalSocket = Socket<
  InternalClientToServerEvents,
  InternalServerToClientEvents,
  InternalInterServerEvents,
  InternalSocketData
>;

// Type-safe Namespace interface
export type InternalNamespace = Namespace<
  InternalClientToServerEvents,
  InternalServerToClientEvents,
  InternalInterServerEvents,
  InternalSocketData
>;

export class InternalSocketHandler {
  private io: Server;
  private internalNamespace: InternalNamespace;

  constructor(io: Server) {
    this.io = io;
    this.internalNamespace = this.io.of('/internal-socket') as InternalNamespace;
    this.init();
  }

  private init(): void {
    // Authentication middleware with proper typing
    this.internalNamespace.use((socket: InternalSocket, next) => {
      try {
        const { auth, query } = socket.handshake;
        const serviceId = (auth.serviceId || query.serviceId) as string;
        const serviceName = (auth.serviceName || query.serviceName) as string;
        const serviceSecret = (auth.serviceSecret || query.serviceSecret) as string;

        if (!serviceId || !serviceName) {
          return next(new Error('Internal service identification required'));
        }

        if (!serviceSecret) {
          logger.warn(`Internal socket connection without secret from ${serviceName}`);
        }

        const now = new Date().toISOString();

        // Store service info in socket data with proper typing
        socket.data = {
          serviceId,
          serviceName,
          authenticated: !!serviceSecret,
          connectedAt: now,
          lastActivity: now,
        };

        logger.info(`Internal service connected via socket: ${serviceName} (${serviceId})`);
        next();
      } catch {
        next(new Error('Internal authentication error'));
      }
    });

    // Connection event with proper typing
    this.internalNamespace.on('connection', (socket: InternalSocket) => {
      this.handleInternalConnection(socket);
    });
  }

  private handleInternalConnection(socket: InternalSocket): void {
    const { serviceId, serviceName, authenticated } = socket.data;

    logger.info(`Internal socket connected: ${socket.id} for service ${serviceName} (auth: ${authenticated})`);

    // Join service-specific room
    socket.join(`service-${serviceId}`);

    // Update last activity on any event
    this.setupActivityTracking(socket);

    // ========================================================================
    // Token Verification & Information Handlers
    // ========================================================================

    socket.on('auth:verify-token', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const { token, tokenType = 'access' } = data;

        if (!token || typeof token !== 'string') {
          return callback({
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Token is required' },
          });
        }

        let tokenData;

        if (tokenType === 'refresh') {
          tokenData = verifyRefreshToken(token);
        } else {
          tokenData = verifyAccessToken(token);
        }

        const tokenInfo = TokenService.getTokenInfo(token, tokenType === 'refresh');

        callback({
          success: true,
          data: {
            valid: true,
            accountId: tokenData.accountId,
            accountType: tokenData.accountType,
            isRefreshToken: tokenData.isRefreshToken,
            expiresAt: tokenData.exp ? tokenData.exp * 1000 : undefined,
            tokenInfo,
            ...(tokenData.oauthAccessToken && { oauthAccessToken: tokenData.oauthAccessToken }),
            ...(tokenData.oauthRefreshToken && { oauthRefreshToken: tokenData.oauthRefreshToken }),
          },
        });
      } catch (tokenError) {
        const tokenInfo = TokenService.getTokenInfo(data.token, data.tokenType === 'refresh');

        callback({
          success: true,
          data: {
            valid: false,
            error: tokenError instanceof Error ? tokenError.message : 'Invalid token',
            tokenInfo,
          },
        });
      }
    });

    socket.on('auth:token-info', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const { token, tokenType = 'access' } = data;

        if (!token || typeof token !== 'string') {
          return callback({
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Token is required' },
          });
        }

        const tokenInfo = TokenService.getTokenInfo(token, tokenType === 'refresh');

        callback({
          success: true,
          data: { tokenInfo, tokenType: String(tokenType) },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    // ========================================================================
    // User Information Handlers
    // ========================================================================

    socket.on('users:get-by-id', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const { accountId } = data;

        if (!accountId || typeof accountId !== 'string') {
          return callback({
            success: false,
            error: { code: 'MISSING_DATA', message: 'Account ID is required' },
          });
        }

        ValidationUtils.validateObjectId(accountId, 'Account ID');
        const user = await AccountService.findUserById(accountId);

        if (!user) {
          return callback({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        callback({
          success: true,
          data: { user, accountId },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    socket.on('users:get-by-email', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const { email } = data;

        if (!email || typeof email !== 'string') {
          return callback({
            success: false,
            error: { code: 'MISSING_DATA', message: 'Email is required' },
          });
        }

        ValidationUtils.validateEmail(email);
        const user = await AccountService.findUserByEmail(email);

        if (!user) {
          return callback({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        callback({
          success: true,
          data: { user, email },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    socket.on('users:exists', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const { accountId } = data;

        if (!accountId || typeof accountId !== 'string') {
          return callback({
            success: false,
            error: { code: 'MISSING_DATA', message: 'Account ID is required' },
          });
        }

        ValidationUtils.validateObjectId(accountId, 'Account ID');
        const user = await AccountService.findUserById(accountId);

        callback({
          success: true,
          data: { exists: !!user, accountId },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    // ========================================================================
    // Session Information Handlers
    // ========================================================================

    socket.on('session:get-info', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const mockReq = this.createMockRequest(data.sessionCookie);
        const sessionInfo = await SessionService.getAccountSession(mockReq);

        callback({
          success: true,
          data: { session: sessionInfo.session },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    socket.on('session:get-accounts', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const mockReq = this.createMockRequest(data.sessionCookie);
        const accountsData = await SessionService.getSessionAccountsData(mockReq, data.accountIds);

        callback({
          success: true,
          data: { accounts: accountsData, count: accountsData.length },
        });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    socket.on('session:validate', async (data, callback) => {
      this.updateActivity(socket);

      try {
        const mockReq = this.createMockRequest(data.sessionCookie);
        const sessionInfo = await SessionService.getAccountSession(mockReq);

        const response: any = { session: sessionInfo.session };

        if (data.accountId && typeof data.accountId === 'string') {
          ValidationUtils.validateObjectId(data.accountId, 'Account ID');
          response.accountId = data.accountId;
          response.isAccountInSession = sessionInfo.session.accountIds.includes(data.accountId);
          response.isCurrentAccount = sessionInfo.session.currentAccountId === data.accountId;
        }

        callback({ success: true, data: response });
      } catch (error) {
        callback({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    // ========================================================================
    // Utility Handlers
    // ========================================================================

    socket.on('health', (data, callback) => {
      this.updateActivity(socket);

      callback({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: 'internal-socket',
          serviceId,
          serviceName,
          authenticated,
          services: {
            accounts: 'available',
            sessions: 'available',
            tokens: 'available',
          },
        },
      });
    });

    socket.on('ping', (data, callback) => {
      this.updateActivity(socket);

      callback({
        success: true,
        data: {
          pong: true,
          timestamp: new Date().toISOString(),
          serviceId,
          serviceName,
        },
      });
    });

    // ========================================================================
    // Connection Events
    // ========================================================================

    socket.on('disconnect', (reason) => {
      logger.info(`Internal socket disconnected: ${socket.id} (${serviceName}) - ${reason}`);
    });

    socket.on('error', (socketError) => {
      logger.error(`Internal socket error for ${serviceName}:`, socketError);
    });

    // Send connection confirmation
    socket.emit('connected', {
      success: true,
      message: `Connected to internal API as ${serviceName}`,
      serviceId,
      serviceName,
      authenticated,
    });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private setupActivityTracking(socket: InternalSocket): void {
    // Track activity on any incoming event
    const originalOn = socket.on.bind(socket);
    socket.on = (event: any, listener: any) => {
      return originalOn(event, (...args: any[]) => {
        this.updateActivity(socket);
        return listener(...args);
      });
    };
  }

  private updateActivity(socket: InternalSocket): void {
    socket.data.lastActivity = new Date().toISOString();
  }

  private createMockRequest(sessionCookie?: string) {
    return {
      cookies: sessionCookie ? { account_session: sessionCookie } : {},
    } as Parameters<typeof SessionService.getAccountSession>[0];
  }

  // ========================================================================
  // Public Methods for Broadcasting
  // ========================================================================

  /**
   * Emit user updated event to all services
   */
  public notifyUserUpdated(accountId: string, user: any): void {
    this.internalNamespace.emit('user-updated', {
      accountId,
      user,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit user deleted event to all services
   */
  public notifyUserDeleted(accountId: string): void {
    this.internalNamespace.emit('user-deleted', {
      accountId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit session expired event to all services
   */
  public notifySessionExpired(accountId: string, sessionId: string): void {
    this.internalNamespace.emit('session-expired', {
      accountId,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send service notification to specific service
   */
  public notifyService(serviceId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.internalNamespace.to(`service-${serviceId}`).emit('service-notification', {
      message,
      level,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Toggle maintenance mode for all services
   */
  public toggleMaintenanceMode(enabled: boolean, message?: string): void {
    this.internalNamespace.emit('maintenance-mode', {
      enabled,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected services with activity info
   */
  public getConnectedServices(): ConnectedServiceInfo[] {
    const services: ConnectedServiceInfo[] = [];

    this.internalNamespace.sockets.forEach((socket: InternalSocket) => {
      if (socket.data) {
        services.push({
          serviceId: socket.data.serviceId,
          serviceName: socket.data.serviceName,
          authenticated: socket.data.authenticated,
          connectedAt: socket.data.connectedAt,
          lastActivity: socket.data.lastActivity,
        });
      }
    });

    return services;
  }
}

export default InternalSocketHandler;
