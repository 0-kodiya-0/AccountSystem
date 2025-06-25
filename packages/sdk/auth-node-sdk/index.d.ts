import { InternalHttpClient } from './src/client/auth-client';
import { InternalSocketClient } from './src/client/socket-client';

// This export {} is crucial - it makes this file a module
export {};

declare global {
  namespace Express {
    interface Request {
      // Token data
      accessToken?: string;
      refreshToken?: string;
      tokenData?: {
        valid: boolean;
        accountId?: string;
        accountType?: string;
        isRefreshToken?: boolean;
        expiresAt?: number;
      };

      // User data
      currentUser?: {
        _id: string;
        email: string;
        accountType: string;
        name?: string;
        profilePicture?: string;
        isEmailVerified?: boolean;
      };

      // Session data
      sessionInfo?: {
        accountIds: string[];
        currentAccountId: string;
        sessionId: string;
        createdAt: string;
        lastActivity: string;
      };

      // Internal API clients
      internalApi?: {
        http: InternalHttpClient;
        socket?: InternalSocketClient;
      };
    }
  }
}
