import { AccountType } from '../account';

export interface SetupTwoFactorRequest {
  enableTwoFactor: boolean;
  // For local accounts: password required
  password?: string;
  // For OAuth accounts: access token is extracted from middleware
}

export interface VerifySetupTwoFactorRequest {
  token: string; // 6-digit TOTP code
  setupToken: string; // NEW: Setup token from the setup step
}

export interface GenerateBackupCodesRequest {
  // For local accounts: password required
  password?: string;
  // For OAuth accounts: access token is extracted from middleware
}

export interface VerifyTwoFactorLoginRequest {
  token: string; // 6-digit TOTP code or backup code
  tempToken: string; // Temporary token from login process
}

export interface TwoFactorSetupResponse {
  message: string;
  secret?: string;
  qrCode?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
  setupToken?: string; // NEW: Token to be used in verify-setup
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  backupCodesCount?: number;
  lastSetupDate?: string;
}

export interface BackupCodesResponse {
  message: string;
  backupCodes: string[];
}

export interface TwoFactorLoginResponse {
  accountId: string;
  name: string;
  message: string;
  accountType: AccountType; // NEW: Include account type for token creation
  // OAuth specific fields
  needsAdditionalScopes?: boolean;
  missingScopes?: string[];
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    userInfo?: any;
  };
}

// Temporary token interface for 2FA verification during login
export interface TwoFactorTempToken {
  token: string;
  accountId: string;
  email: string;
  accountType: 'local' | 'oauth';
  expiresAt: string;
  // OAuth specific data
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    userInfo?: any;
  };
}

// NEW: Setup token interface for 2FA setup verification
export interface TwoFactorSetupToken {
  token: string;
  accountId: string;
  secret: string; // The 2FA secret that was generated
  accountType: 'local' | 'oauth';
  expiresAt: string;
  createdAt: string;
}

export interface TwoFactorCache {
  // Save temporary data during login flow
  saveTempToken: (accountId: string, email: string, accountType: 'local' | 'oauth', oauthTokens?: any) => string;
  getTempToken: (tempToken: string) => TwoFactorTempToken | null;
  removeTempToken: (tempToken: string) => void;

  // NEW: Save temporary data during setup flow
  saveSetupToken: (accountId: string, secret: string, accountType: 'local' | 'oauth') => string;
  getSetupToken: (setupToken: string) => TwoFactorSetupToken | null;
  removeSetupToken: (setupToken: string) => void;
}
