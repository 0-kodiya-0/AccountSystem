export interface SessionMockStatusData {
  currentSession: unknown;
  cookies: {
    hasAccountSession: boolean;
    sessionToken: string;
  };
}

export interface CreateSessionRequest {
  accountIds: string[];
  currentAccountId?: string;
}

export interface CreateSessionResponse {
  message: string;
  token: string;
  sessionData: {
    accountIds: string[];
    currentAccountId: string | null;
  };
}

export interface UpdateSessionRequest {
  action: 'add' | 'remove' | 'setCurrent';
  accountId?: string;
  currentAccountId?: string;
}

export interface UpdateSessionResponse {
  message: string;
  token: string;
  sessionData: {
    accountIds: string[];
    currentAccountId: string | null;
  };
  action: string;
}

export interface ValidateSessionRequest {
  token: string;
}

export interface ValidateSessionResponse {
  valid: boolean;
  sessionData: unknown;
  message: string;
}

export interface ClearSessionResponse {
  message: string;
  cleared: boolean;
}

export interface GenerateSessionsRequest {
  count?: number;
  accountsPerSession?: number;
}

export interface GenerateSessionsResponse {
  message: string;
  sessions: Array<{
    token: string;
    sessionData: {
      accountIds: string[];
      currentAccountId: string;
    };
  }>;
  count: number;
}

export interface CorruptSessionRequest {
  type?: 'malformed' | 'expired' | 'invalid_signature' | 'empty';
}

export interface CorruptSessionResponse {
  message: string;
  type: string;
  corruptedToken: string;
}

export interface SessionMockInfoResponse {
  session: unknown;
  authCookies: Record<string, string>;
  cookieCount: number;
  userAgent?: string;
  ip?: string;
  timestamp: string;
}
