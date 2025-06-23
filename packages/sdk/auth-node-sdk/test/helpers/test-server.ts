import { Server } from 'http';
import express from 'express';
import { mockHealthResponse, mockTokenVerificationResponse, mockUserResponse } from './mock-data';

export class TestServer {
  private app: express.Application;
  private server: Server | null = null;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/internal/health', (req, res) => {
      res.json(mockHealthResponse);
    });

    // Token verification endpoint
    this.app.post('/internal/auth/verify-token', (req, res) => {
      const { token } = req.body;
      if (token === 'valid_token') {
        res.json({ success: true, data: mockTokenVerificationResponse });
      } else {
        res.status(401).json({
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid token' },
        });
      }
    });

    // User endpoints
    this.app.get('/internal/users/:accountId', (req, res) => {
      const { accountId } = req.params;
      if (accountId === '507f1f77bcf86cd799439011') {
        res.json({ success: true, data: mockUserResponse });
      } else {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }
    });
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, (err?: Error) => {
        if (err) reject(err);
        else resolve((this.server!.address() as any).port);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getApp() {
    return this.app;
  }
}
