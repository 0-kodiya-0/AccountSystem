import { Account, AccountSessionInfo } from './src';
import { HttpClient } from './src/client/HttpClient';
import { SocketClient } from './src/client/SocketClient';

// This export {} is crucial - it makes this file a module
export {};

declare global {
  namespace Express {
    interface Request {
      // Token data
      account?: Account;
      oauthAccount?: Account;
      localAccount?: Account;

      // Token data (set by validateTokenAccess)
      accessToken?: string;
      refreshToken?: string;
      oauthAccessToken?: string; // For OAuth accounts
      oauthRefreshToken?: string; // For OAuth accounts

      tokenData?: {
        valid: boolean;
        accountId?: string;
        accountType?: string;
        isRefreshToken?: boolean;
        expiresAt?: number;
      };

      // Session data
      sessionInfo?: AccountSessionInfo;

      // Internal API clients
      apiClients?: {
        http: HttpClient;
        socket?: SocketClient;
      };

      parentUrl?: string;
    }
  }
}
