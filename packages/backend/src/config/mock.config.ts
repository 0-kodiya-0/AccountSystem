import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { OAuthProviders, AccountType, AccountStatus } from '../feature/account/Account.types';

// ES module equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email Mock Configuration Schema (unchanged)
const EmailMockConfigSchema = z.object({
  enabled: z.boolean(),
  logEmails: z.boolean(),
  simulateDelay: z.boolean(),
  delayMs: z.number().int().min(0).max(10000),
  simulateFailures: z.boolean(),
  failureRate: z.number().min(0).max(1),
  failOnEmails: z.array(z.string().email()),
  blockEmails: z.array(z.string().email()),
});

// OAuth Provider Config Schema
const OAuthProviderConfigSchema = z.object({
  enabled: z.boolean(),
});

// OAuth Mock Configuration Schema (updated)
const OAuthMockConfigSchema = z.object({
  enabled: z.boolean(),
  simulateDelay: z.boolean(),
  delayMs: z.number().int().min(0).max(10000),
  simulateErrors: z.boolean(),
  errorRate: z.number().min(0).max(1),
  failOnEmails: z.array(z.string().email()),
  blockEmails: z.array(z.string().email()),
  autoApprove: z.boolean(),
  requireConsent: z.boolean(),
  logRequests: z.boolean(),
  mockServerEnabled: z.boolean(),
  mockServerPort: z.number().int().min(1000).max(65535),
  providers: z
    .object({
      google: OAuthProviderConfigSchema.optional(),
      microsoft: OAuthProviderConfigSchema.optional(),
      facebook: OAuthProviderConfigSchema.optional(),
    })
    .optional(),
});

// Mock Account Schema
const MockAccountSchema = z
  .object({
    id: z.string(),
    accountType: z.nativeEnum(AccountType),
    email: z.string().email(),
    name: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    imageUrl: z.string().url().optional(),
    emailVerified: z.boolean(),
    provider: z.nativeEnum(OAuthProviders).optional(),
    password: z.string().optional(),
    twoFactorEnabled: z.boolean().optional().default(false),
    status: z.nativeEnum(AccountStatus).optional().default(AccountStatus.Active),
    birthdate: z.string().optional(),
  })
  .refine(
    (data) => {
      // If accountType is oauth, provider is required
      if (data.accountType === AccountType.OAuth && !data.provider) {
        return false;
      }
      // If accountType is local, password is required
      if (data.accountType === AccountType.Local && !data.password) {
        return false;
      }
      return true;
    },
    {
      message: 'OAuth accounts require a provider, local accounts require a password',
    },
  );

// Accounts Mock Configuration Schema
const AccountsMockConfigSchema = z.object({
  enabled: z.boolean(),
  clearOnSeed: z.boolean().optional().default(false),
  accounts: z.array(MockAccountSchema),
});

// Combined Mock Configuration Schema
const MockConfigSchema = z.object({
  email: EmailMockConfigSchema,
  oauth: OAuthMockConfigSchema,
  accounts: AccountsMockConfigSchema,
});

// Export types derived from schemas
export type EmailMockConfig = z.infer<typeof EmailMockConfigSchema>;
export type OAuthProviderConfig = z.infer<typeof OAuthProviderConfigSchema>;
export type OAuthMockConfig = z.infer<typeof OAuthMockConfigSchema>;
export type MockAccount = z.infer<typeof MockAccountSchema>;
export type AccountsMockConfig = z.infer<typeof AccountsMockConfigSchema>;
export type MockConfig = z.infer<typeof MockConfigSchema>;

// No default configuration - must be loaded from file

// Validation functions
export function validateEmailMockConfig(config: unknown): EmailMockConfig {
  try {
    return EmailMockConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Invalid email mock configuration: ${formattedErrors}`);
    }
    throw error;
  }
}

export function validateOAuthMockConfig(config: unknown): OAuthMockConfig {
  try {
    return OAuthMockConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Invalid OAuth mock configuration: ${formattedErrors}`);
    }
    throw error;
  }
}

export function validateAccountsMockConfig(config: unknown): AccountsMockConfig {
  try {
    return AccountsMockConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Invalid accounts mock configuration: ${formattedErrors}`);
    }
    throw error;
  }
}

export function validateMockConfig(config: unknown): MockConfig {
  try {
    return MockConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Invalid mock configuration: ${formattedErrors}`);
    }
    throw error;
  }
}

class MockConfigManager {
  private static instance: MockConfigManager;
  private config: MockConfig | null = null;
  private isInitialized = false;

  private constructor() {
    // Don't auto-load - only load when explicitly requested
  }

  static getInstance(): MockConfigManager {
    if (!MockConfigManager.instance) {
      MockConfigManager.instance = new MockConfigManager();
    }
    return MockConfigManager.instance;
  }

  private loadConfiguration(): MockConfig {
    try {
      // Load from mock.config.json file - no defaults
      const configFromFile = this.loadFromFile();
      if (!configFromFile) {
        throw new Error('Mock configuration file not found');
      }

      // Validate the loaded config
      const validatedConfig = validateMockConfig(configFromFile);

      this.isInitialized = true;
      logger.info('Mock configuration loaded and validated successfully');
      return validatedConfig;
    } catch (error) {
      logger.error('Failed to load mock configuration:', error);
      throw error;
    }
  }

  private loadFromFile(): unknown | null {
    const possiblePaths = [
      path.resolve(process.cwd(), 'mock.config.json'),
      path.resolve(__dirname, '../../mock.config.json'),
      path.resolve(__dirname, '../../../mock.config.json'),
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const fileContent = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(fileContent);
          logger.info(`Mock configuration loaded from: ${configPath}`);
          return config;
        } catch (error) {
          logger.warn(`Failed to parse mock config file at ${configPath}:`, error);
        }
      }
    }

    return null;
  }

  public getConfig(): MockConfig {
    if (!this.config) {
      this.config = this.loadConfiguration();
    }
    return JSON.parse(JSON.stringify(this.config));
  }

  public getEmailConfig(): EmailMockConfig {
    return this.getConfig().email;
  }

  public getOAuthConfig(): OAuthMockConfig {
    return this.getConfig().oauth;
  }

  public getAccountsConfig(): AccountsMockConfig {
    return this.getConfig().accounts;
  }

  public updateEmailConfig(updates: Partial<EmailMockConfig>): void {
    const config = this.getConfig();
    const newEmailConfig = { ...config.email, ...updates };
    validateEmailMockConfig(newEmailConfig);
    config.email = newEmailConfig;
    this.config = config;
    logger.info('Email mock configuration updated and validated', updates);
  }

  public updateOAuthConfig(updates: Partial<OAuthMockConfig>): void {
    const config = this.getConfig();
    const newOAuthConfig = { ...config.oauth, ...updates };
    validateOAuthMockConfig(newOAuthConfig);
    config.oauth = newOAuthConfig;
    this.config = config;
    logger.info('OAuth mock configuration updated and validated', updates);
  }

  public updateAccountsConfig(updates: Partial<AccountsMockConfig>): void {
    const config = this.getConfig();
    const newAccountsConfig = { ...config.accounts, ...updates };
    validateAccountsMockConfig(newAccountsConfig);
    config.accounts = newAccountsConfig;
    this.config = config;
    logger.info('Accounts mock configuration updated and validated', updates);
  }

  public updateConfig(updates: Partial<MockConfig>): void {
    const config = this.getConfig();
    const newConfig = {
      email: { ...config.email, ...(updates.email || {}) },
      oauth: { ...config.oauth, ...(updates.oauth || {}) },
      accounts: { ...config.accounts, ...(updates.accounts || {}) },
    };
    validateMockConfig(newConfig);
    this.config = newConfig;
    logger.info('Mock configuration updated and validated', updates);
  }

  public resetToDefaults(): void {
    throw new Error('Reset to defaults not supported - configuration must be loaded from file');
  }

  public isConfigValid(): boolean {
    try {
      validateMockConfig(this.getConfig());
      return true;
    } catch {
      return false;
    }
  }

  public saveConfigToFile(filePath?: string): void {
    const config = this.getConfig();
    const configPath = filePath || path.resolve(process.cwd(), 'mock.config.json');

    // Validate before saving
    validateMockConfig(config);

    const configString = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, configString, 'utf-8');
    logger.info(`Mock configuration saved to: ${configPath}`);
  }

  public refreshConfig(): void {
    this.config = null;
    this.isInitialized = false;
    this.getConfig(); // Force reload
  }
}

// Export singleton instance
export const mockConfig = MockConfigManager.getInstance();

// Convenience functions for email
export const getEmailMockConfig = (): EmailMockConfig => mockConfig.getEmailConfig();
export const updateEmailMockConfig = (updates: Partial<EmailMockConfig>): void => mockConfig.updateEmailConfig(updates);

// Convenience functions for OAuth
export const getOAuthMockConfig = (): OAuthMockConfig => mockConfig.getOAuthConfig();
export const updateOAuthMockConfig = (updates: Partial<OAuthMockConfig>): void => mockConfig.updateOAuthConfig(updates);

// Convenience functions for accounts
export const getAccountsMockConfig = (): AccountsMockConfig => mockConfig.getAccountsConfig();
export const updateAccountsMockConfig = (updates: Partial<AccountsMockConfig>): void =>
  mockConfig.updateAccountsConfig(updates);

// General convenience functions
export const resetMockConfig = (): void => mockConfig.resetToDefaults();
export const saveMockConfig = (filePath?: string): void => mockConfig.saveConfigToFile(filePath);
