export interface AuthSDKConfig {
    authServiceUrl: string;
    serviceName: string;
    certificates: {
        key: string;
        cert: string;
        ca: string;
    };
    serviceSecret: string;
    requestTimeout?: number;
}

export enum AccountStatus {
    Active = 'active',
    Inactive = 'inactive',
    Unverified = 'unverified',
    Suspended = 'suspended'
}

export enum OAuthProviders {
    Google = 'google',
    Microsoft = 'microsoft',
    Facebook = 'facebook'
}

export enum AccountType {
    Local = 'local',
    OAuth = 'oauth'
}

export interface UserDetails {
    firstName?: string;
    lastName?: string;
    name: string;
    email?: string;
    imageUrl?: string;
    birthdate?: string;
    username?: string;
    emailVerified?: boolean;
}

export interface SafeAccount {
    id: string;
    created: string;
    updated: string;
    accountType: AccountType;
    status: AccountStatus;
    provider?: OAuthProviders;
    userDetails: UserDetails;
    security: {
        twoFactorEnabled: boolean;
        sessionTimeout: number;
        autoLock: boolean;
    };
}

export interface SessionValidationResult {
    valid: boolean;
    account: SafeAccount;
    accountType: AccountType;
    tokenType: 'access' | 'refresh';
    oauthAccessToken?: string;
    oauthRefreshToken?: string;
}

export interface GoogleValidationResult {
    valid: boolean;
    accountId: string;
    tokenInfo: any;
    scopeResults: Record<string, boolean>;
    allScopesGranted: boolean;
    requiredScopes: string[];
}

export interface TokenVerificationResult {
    valid: boolean;
    reason?: string;
    accountId: string;
}

export interface GoogleTokenInfoResult {
    accountId: string;
    tokenInfo: {
        accessToken: string;
        scope?: string;
        audience?: string;
        expiresIn?: number;
        issuedAt?: number;
        userId?: string;
        email?: string;
        emailVerified?: boolean;
    };
    grantedScopes: string[];
    storedScopes: string[];
    scopeCounts: {
        granted: number;
        stored: number;
    };
}

export interface UserSearchResult {
    account: SafeAccount;
    accountType: AccountType;
    status: AccountStatus;
}

export interface ScopesResult {
    accountId: string;
    scopes: string[];
    scopeCount: number;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: any;
    };
}

export interface InternalNotificationData {
    accountId?: string;
    timestamp: string;
    [key: string]: any;
}

// API Error Codes (copied from backend)
export enum ApiErrorCode {
    INVALID_STATE = 'INVALID_STATE',
    INVALID_PROVIDER = 'INVALID_PROVIDER',
    MISSING_DATA = 'MISSING_DATA',
    DATABASE_ERROR = 'DATABASE_ERROR',
    AUTH_FAILED = 'AUTH_FAILED',
    USER_EXISTS = 'USER_EXISTS',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
    WORKSPACE_MEMBER_NOT_FOUND = 'WORKSPACE_MEMBER_NOT_FOUND',
    MISSING_EMAIL = 'MISSING_EMAIL',
    INVALID_DETAILS = 'INVALID_DETAILS',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
    INVALID_REQUEST = 'INVALID_REQUEST',
    INVALID_SERVICE = 'INVALID_SERVICE',
    INVALID_SCOPE = 'INVALID_SCOPE',
    SERVER_ERROR = 'SERVER_ERROR',
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    RESOURCE_EXISTS = 'RESOURCE_EXISTS',
    RESOURCE_DELETED = 'RESOURCE_DELETED',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_INVALID = 'TOKEN_INVALID',
    TOKEN_REVOKED = 'TOKEN_REVOKED',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_PARAMETERS = 'INVALID_PARAMETERS'
}
