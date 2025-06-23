import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { mockTokenVerificationResponse, mockUserResponse } from './mock-data';

export class TestSocketServer {
  private httpServer = createServer();
  private io: SocketIOServer;

  constructor() {
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: '*' },
    });
    this.setupHandlers();
  }

  private setupHandlers() {
    const internalNamespace = this.io.of('/internal-socket');

    internalNamespace.use((socket, next) => {
      const { serviceId, serviceName, serviceSecret } = socket.handshake.auth;
      if (serviceId && serviceName) {
        socket.data = { serviceId, serviceName, authenticated: !!serviceSecret };
        next();
      } else {
        next(new Error('Authentication failed'));
      }
    });

    internalNamespace.on('connection', (socket) => {
      socket.emit('connected', {
        success: true,
        message: 'Connected successfully',
        serviceId: socket.data.serviceId,
        serviceName: socket.data.serviceName,
        authenticated: socket.data.authenticated,
      });

      socket.on('auth:verify-token', (data, callback) => {
        if (data.token === 'valid_token') {
          callback({ success: true, data: mockTokenVerificationResponse });
        } else {
          callback({
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid token' },
          });
        }
      });

      socket.on('users:get-by-id', (data, callback) => {
        if (data.accountId === '507f1f77bcf86cd799439011') {
          callback({ success: true, data: mockUserResponse });
        } else {
          callback({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }
      });

      socket.on('health', (data, callback) => {
        callback({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'internal-socket',
            serviceId: socket.data.serviceId,
            serviceName: socket.data.serviceName,
            authenticated: socket.data.authenticated,
          },
        });
      });
    });
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer.listen(port, () => {
        resolve((this.httpServer.address() as any).port);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => resolve());
      });
    });
  }
}
