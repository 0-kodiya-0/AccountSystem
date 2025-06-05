// packages/sdk/auth-frontend-sdk/src/types/index.ts

// Core Data Types
export enum AccountStatus {
    Active = 'active',
    Inactive = 'inactive',
    Unverified = 'unverified',
    Suspended = 'suspended'
}

export enum AccountType {
    Local = 'local',
    OAuth = 'oauth'
}

export enum OAuthProviders {
    Google = 'google',
    Microsoft = 'microsoft',
    Facebook = 'facebook'
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

export interface SecuritySettings {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    autoLock: boolean;
}

export interface Account {
    id: string;
    created: string;
    updated: string;
    accountType: AccountType;
    status: AccountStatus;
    userDetails: UserDetails;
    security: SecuritySettings;
    provider?: OAuthProviders;
}

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

// Local Auth Types
export interface LocalSignupRequest {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    password: string;
    confirmPassword: string;
    birthdate?: string;
    agreeToTerms: boolean;
}

export interface LocalLoginRequest {
    email?: string;
    username?: string;
    password: string;
    rememberMe?: boolean;
}

export interface LocalLoginResponse {
    accountId?: string;
    name?: string;
    requiresTwoFactor?: boolean;
    tempToken?: string;
}

export interface TwoFactorVerifyRequest {
    token: string;
    tempToken: string;
}

export interface PasswordResetRequest {
    email: string;
}

export interface ResetPasswordRequest {
    password: string;
    confirmPassword: string;
}

export interface PasswordChangeRequest {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface TwoFactorSetupRequest {
    password: string;
    enableTwoFactor: boolean;
}

export interface TwoFactorSetupResponse {
    qrCode?: string;
    secret?: string;
    backupCodes?: string[];
}

// Google Permission Types
export type ServiceType = 'gmail' | 'calendar' | 'drive' | 'docs' | 'sheets' | 'people' | 'meet';
export type ScopeLevel = 'readonly' | 'full' | 'send' | 'compose' | 'events' | 'file' | 'create' | 'edit';

export interface GoogleTokenInfo {
    accessToken: string;
    scope?: string;
    audience?: string;
    expiresIn?: number;
    issuedAt?: number;
    userId?: string;
    email?: string;
    emailVerified?: boolean;
}

export interface ScopeCheckResult {
    hasAccess: boolean;
    scopeName: string;
    scopeUrl: string;
}

export interface TokenCheckResponse {
    summary: {
        totalRequested: number;
        totalGranted: number;
        allGranted: boolean;
    };
    requestedScopeNames: string[];
    requestedScopeUrls: string[];
    results: Record<string, ScopeCheckResult>;
}

// Notification Types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    accountId: string;
    title: string;
    message: string;
    type: NotificationType;
    read: boolean;
    link?: string;
    timestamp: number;
    expiresAt?: number;
    metadata?: Record<string, any>;
}

export interface CreateNotificationRequest {
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    expiresAt?: number;
    metadata?: Record<string, any>;
}

export interface NotificationListResponse {
    notifications: Notification[];
    total: number;
    unreadCount: number;
}

// SDK Configuration
export interface SDKConfig {
    baseURL: string;
    timeout?: number;
    withCredentials?: boolean;
}

// Error Types
export class AuthSDKError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode?: number,
        public data?: any
    ) {
        super(message);
        this.name = 'AuthSDKError';
    }
}

export enum ErrorCode {
    NETWORK_ERROR = 'NETWORK_ERROR',
    AUTH_FAILED = 'AUTH_FAILED',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    SERVER_ERROR = 'SERVER_ERROR'
}

// OAuth Types
export interface OAuthAuthUrls {
    google: string;
    microsoft: string;
    facebook: string;
}

export interface OAuthCallbackParams {
    state?: string;
    code?: string;
    error?: string;
    redirectUrl?: string;
}