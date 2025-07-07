import { AccountType, AccountStatus, OAuthProviders } from '../../feature/account';

export interface SessionError {
  error: boolean;
  message: string;
  code: string;
}

export interface AccountSessionData {
  accountIds: string[];
  currentAccountId: string | null;
}

export interface AccountSessionTokenPayload extends AccountSessionData {
  iat: number; // issued at
  // Note: No expiration - this token should not expire
}

export interface AccountSessionInfo {
  hasSession: boolean;
  accountIds: string[];
  currentAccountId: string | null;
  isValid: boolean;
}

/**
 * Minimal account data for session responses
 * Only contains essential information needed for session management
 */
export interface SessionAccount {
  id: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: {
    name: string;
    email?: string;
    username?: string;
    imageUrl?: string;
  };
  provider?: OAuthProviders;
}

export type GetAccountSessionDataResponse = SessionAccount[];

export type GetAccountSessionResponse = AccountSessionInfo & { missingAccountIds: string[] };
