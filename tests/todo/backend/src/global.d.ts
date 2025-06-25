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
        http: any; // Will be typed based on your SDK
        socket?: any; // Will be typed based on your SDK
      };

      // User context for todo operations
      userContext?: {
        userId: string;
        email: string;
        name?: string;
        accountType: string;
        isEmailVerified?: boolean;
      };
    }
  }
}

export {};
