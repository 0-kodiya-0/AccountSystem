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

export interface GetAccountSessionResponse {
    session: AccountSessionInfo;
    accounts?: any[]; // Will be populated with account data if available
}