export enum AccountStatus {
  Active = 'active',
  Inactive = 'inactive',
  Unverified = 'unverified',
  Suspended = 'suspended',
}

export enum OAuthProviders {
  Google = 'google',
  Microsoft = 'microsoft',
  Facebook = 'facebook',
}

export enum AccountType {
  Local = 'local',
  OAuth = 'oauth',
}

export interface SecuritySettings {
  password?: string; // Only for local accounts
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  sessionTimeout: number;
  autoLock: boolean;
  // Local account specific fields
  passwordSalt?: string;
  lastPasswordChange?: Date;
  previousPasswords?: string[];
  failedLoginAttempts?: number;
  lockoutUntil?: Date;
}

export interface DevicePreferences {
  theme: string;
  language: string;
  notifications: boolean;
}

export interface Device {
  id: string;
  installationDate: string;
  name: string;
  os: string;
  version: string;
  uniqueIdentifier: string;
  preferences: DevicePreferences;
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

export interface Account {
  id: string;
  created: string;
  updated: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: UserDetails;
  security: SecuritySettings;
  // OAuth specific fields
  provider?: OAuthProviders; // Required when accountType === 'oauth'
}

export interface AllowedAccountUpdates {
  firstName?: string;
  lastName?: string;
  name?: string;
  imageUrl?: string;
  birthdate?: string;
  username?: string;
}
