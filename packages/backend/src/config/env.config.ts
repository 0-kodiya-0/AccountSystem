import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger } from '../utils/logger';

// ES module equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define required environment variables
const REQUIRED_ENV_VARS = [
  // Core Authentication & Security
  'JWT_SECRET',
  'SESSION_SECRET',

  // Google OAuth (Required for main functionality)
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',

  // Application URLs
  'BASE_URL',

  // Application Identity
  'APP_NAME',

  // Email Configuration (Required for user verification, password reset, etc.)
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_APP_PASSWORD',
  'SENDER_EMAIL',
  'SENDER_NAME',

  'MONGODB_USERNAME',
  'MONGODB_PASSWORD',
] as const;

// Define optional environment variables with defaults
const OPTIONAL_ENV_VARS = {
  // Environment & Server
  NODE_ENV: 'development',
  PORT: '3000',

  // Frontend & Proxy URLs
  PROXY_URL: 'http://localhost:7000',

  // Database URIs (have hardcoded fallbacks in db.config.ts)
  ACCOUNTS_DB_URI: '',

  // Token Expiry
  ACCESS_TOKEN_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY: '7d',
  COOKIE_MAX_AGE: '31536000000', // 1 year in milliseconds

  // Optional OAuth Providers
  MICROSOFT_CLIENT_ID: '',
  MICROSOFT_CLIENT_SECRET: '',
  FACEBOOK_CLIENT_ID: '',
  FACEBOOK_CLIENT_SECRET: '',

  INTERNAL_PORT: '4443',
  INTERNAL_SERVER_ENABLED: 'true',

  INTERNAL_SERVER_KEY_PATH: '',
  INTERNAL_SERVER_CERT_PATH: '',
  INTERNAL_CA_CERT_PATH: '',

  // Mock Configuration
  MOCK_ENABLED: 'false',

  // Memory Database Configuration
  USE_MEMORY_DB: 'false',
  MEMORY_DB_NAME: 'test-accounts-db',
  MEMORY_DB_VERSION: '7.0.0',

  // Test Database Configuration
  TEST_DB_CLEAR_ON_START: 'false',
  TEST_DB_SEED_ON_START: 'false',
} as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];
type OptionalEnvVar = keyof typeof OPTIONAL_ENV_VARS;

// Environment configuration cache
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private configCache: Record<string, string> = {};
  private isInitialized = false;

  private constructor() {}

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadEnvironmentFile(): void {
    const possiblePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env'),
    ];

    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        return;
      }
    }
  }

  private validateAndCacheEnvironment(): void {
    this.loadEnvironmentFile();

    const missingVars: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
      const value = process.env[varName];
      if (!value) {
        missingVars.push(varName);
      } else {
        this.configCache[varName] = value;
      }
    }

    // Cache optional variables with defaults
    for (const [varName, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
      const value = process.env[varName] || defaultValue;
      this.configCache[varName] = value;
    }

    // Exit if missing required variables
    if (missingVars.length > 0) {
      logger.error('Missing required environment variables:');
      missingVars.forEach((varName) => logger.error(`  - ${varName}`));
      process.exit(1);
    }

    this.isInitialized = true;
  }

  public initialize(): void {
    if (!this.isInitialized) {
      this.validateAndCacheEnvironment();
    }
  }

  public get(key: RequiredEnvVar | OptionalEnvVar): string {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.configCache[key];
  }

  public getAll(): Record<string, string> {
    if (!this.isInitialized) {
      this.initialize();
    }
    return { ...this.configCache };
  }

  public isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  public isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  public isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }

  public isMockEnabled(): boolean {
    return this.get('MOCK_ENABLED') === 'true';
  }
}

// Export singleton instance
export const envConfig = EnvironmentConfig.getInstance();

// Convenience getters for commonly used variables
export const getJwtSecret = (): string => envConfig.get('JWT_SECRET');
export const getSessionSecret = (): string => envConfig.get('SESSION_SECRET');
export const getPort = (): number => parseInt(envConfig.get('PORT'));
export const getNodeEnv = (): string => envConfig.get('NODE_ENV');
export const getBaseUrl = (): string => envConfig.get('BASE_URL');
export const getProxyUrl = (): string => envConfig.get('PROXY_URL');
export const getAppName = (): string => envConfig.get('APP_NAME');

// Database URIs
export const getAccountsDbUri = (): string => envConfig.get('ACCOUNTS_DB_URI');

// Google OAuth
export const getGoogleClientId = (): string => envConfig.get('GOOGLE_CLIENT_ID');
export const getGoogleClientSecret = (): string => envConfig.get('GOOGLE_CLIENT_SECRET');

// Optional OAuth Providers
export const getMicrosoftClientId = (): string => envConfig.get('MICROSOFT_CLIENT_ID');
export const getMicrosoftClientSecret = (): string => envConfig.get('MICROSOFT_CLIENT_SECRET');
export const getFacebookClientId = (): string => envConfig.get('FACEBOOK_CLIENT_ID');
export const getFacebookClientSecret = (): string => envConfig.get('FACEBOOK_CLIENT_SECRET');

// Email configuration
export const getSmtpHost = (): string => envConfig.get('SMTP_HOST');
export const getSmtpPort = (): number => parseInt(envConfig.get('SMTP_PORT'));
export const getSmtpSecure = (): boolean => envConfig.get('SMTP_SECURE') === 'true';
export const getSmtpAppPassword = (): string => envConfig.get('SMTP_APP_PASSWORD');
export const getSenderEmail = (): string => envConfig.get('SENDER_EMAIL');
export const getSenderName = (): string => envConfig.get('SENDER_NAME');

// Token expiry
export const getAccessTokenExpiry = (): string => envConfig.get('ACCESS_TOKEN_EXPIRY');
export const getRefreshTokenExpiry = (): string => envConfig.get('REFRESH_TOKEN_EXPIRY');
export const getCookieMaxAge = (): number => parseInt(envConfig.get('COOKIE_MAX_AGE'));

export const getMongodbUsername = (): string => envConfig.get('MONGODB_USERNAME');
export const getMongodbPassword = (): string => envConfig.get('MONGODB_PASSWORD');

// Internal server configuration
export const getInternalPort = (): number => parseInt(envConfig.get('INTERNAL_PORT'));
export const getInternalServerEnabled = (): boolean => envConfig.get('INTERNAL_SERVER_ENABLED') === 'true';

// Internal SSL certificate paths
export const getInternalServerKeyPath = (): string => envConfig.get('INTERNAL_SERVER_KEY_PATH');
export const getInternalServerCertPath = (): string => envConfig.get('INTERNAL_SERVER_CERT_PATH');
export const getInternalCACertPath = (): string => envConfig.get('INTERNAL_CA_CERT_PATH');

// NEW: Mock configuration
export const isMockEnabled = (): boolean => envConfig.isMockEnabled();
export const getMockEnabled = (): boolean => envConfig.get('MOCK_ENABLED') === 'true';

// Memory Database configuration
export const getUseMemoryDb = (): boolean => envConfig.get('USE_MEMORY_DB') === 'true';
export const getMemoryDbName = (): string => envConfig.get('MEMORY_DB_NAME');
export const getMemoryDbVersion = (): string => envConfig.get('MEMORY_DB_VERSION');

// Test Database configuration
export const getTestDbClearOnStart = (): boolean => envConfig.get('TEST_DB_CLEAR_ON_START') === 'true';
export const getTestDbSeedOnStart = (): boolean => envConfig.get('TEST_DB_SEED_ON_START') === 'true';
