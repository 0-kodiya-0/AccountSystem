import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { OAuthProviders } from '../feature/account/Account.types';

// ES module equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email Mock Configuration Schema (existing)
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

// OAuth Mock Configuration Schema (new)
const MockOAuthAccountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  emailVerified: z.boolean(),
  provider: z.nativeEnum(OAuthProviders),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().min(0),
  twoFactorEnabled: z.boolean().optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
});

const OAuthMockConfigSchema = z.object({
  enabled: z.boolean(),
  simulateDelay: z.boolean(),
  delayMs: z.number().int().min(0).max(10000),
  simulateErrors: z.boolean(),
  errorRate: z.number().min(0).max(1),
  mockAccounts: z.array(MockOAuthAccountSchema),
  failOnEmails: z.array(z.string().email()),
  blockEmails: z.array(z.string().email()),
  autoApprove: z.boolean(),
  requireConsent: z.boolean(),
  logRequests: z.boolean(),
  // Mock server settings
  mockServerEnabled: z.boolean(),
  mockServerPort: z.number().int().min(1000).max(65535),
});

// Combined Mock Configuration Schema
const MockConfigSchema = z.object({
  email: EmailMockConfigSchema,
  oauth: OAuthMockConfigSchema,
});

// Export types derived from schemas
export type EmailMockConfig = z.infer<typeof EmailMockConfigSchema>;
export type MockOAuthAccount = z.infer<typeof MockOAuthAccountSchema>;
export type OAuthMockConfig = z.infer<typeof OAuthMockConfigSchema>;
export type MockConfig = z.infer<typeof MockConfigSchema>;

// Default configuration
const DEFAULT_MOCK_CONFIG: MockConfig = {
  email: {
    enabled: true,
    logEmails: true,
    simulateDelay: false,
    delayMs: 100,
    simulateFailures: false,
    failureRate: 0.1,
    failOnEmails: [],
    blockEmails: [],
  },
  oauth: {
    enabled: true,
    simulateDelay: false,
    delayMs: 1000,
    simulateErrors: false,
    errorRate: 0.05,
    mockAccounts: [
      // Default test accounts
      {
        id: 'mock_user_1',
        email: 'test.user@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://via.placeholder.com/150',
        emailVerified: true,
        provider: OAuthProviders.Google,
        accessToken: 'mock_access_token_1',
        refreshToken: 'mock_refresh_token_1',
        expiresIn: 3600,
        twoFactorEnabled: false,
        status: 'active',
      },
      {
        id: 'mock_user_2',
        email: 'admin@example.com',
        name: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        imageUrl: 'https://via.placeholder.com/150',
        emailVerified: true,
        provider: OAuthProviders.Google,
        accessToken: 'mock_access_token_2',
        refreshToken: 'mock_refresh_token_2',
        expiresIn: 3600,
        twoFactorEnabled: true,
        status: 'active',
      },
      {
        id: 'mock_user_3',
        email: 'suspended@example.com',
        name: 'Suspended User',
        firstName: 'Suspended',
        lastName: 'User',
        imageUrl: 'https://via.placeholder.com/150',
        emailVerified: true,
        provider: OAuthProviders.Google,
        accessToken: 'mock_access_token_3',
        refreshToken: 'mock_refresh_token_3',
        expiresIn: 3600,
        twoFactorEnabled: false,
        status: 'suspended',
      },
    ],
    failOnEmails: ['fail@example.com', 'error@test.com'],
    blockEmails: ['blocked@example.com', 'spam@test.com'],
    autoApprove: true,
    requireConsent: false,
    logRequests: true,
    mockServerEnabled: true,
    mockServerPort: 8080,
  },
};

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
  private config: MockConfig;
  private isInitialized = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): MockConfigManager {
    if (!MockConfigManager.instance) {
      MockConfigManager.instance = new MockConfigManager();
    }
    return MockConfigManager.instance;
  }

  private loadConfiguration(): MockConfig {
    // Start with default configuration
    let config: MockConfig = JSON.parse(JSON.stringify(DEFAULT_MOCK_CONFIG));

    try {
      // Load from mock.config.json file if it exists
      const configFromFile = this.loadFromFile();
      if (configFromFile) {
        // Validate the loaded config
        const validatedConfig = validateMockConfig(configFromFile);
        config = { ...config, ...validatedConfig };
      }

      this.isInitialized = true;
      logger.info('Mock configuration loaded and validated successfully');
    } catch (error) {
      logger.error('Failed to load mock configuration:', error);
      logger.warn('Using default mock configuration');
      this.isInitialized = true;
    }

    return config;
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
    if (!this.isInitialized) {
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

  public updateEmailConfig(updates: Partial<EmailMockConfig>): void {
    const newEmailConfig = { ...this.config.email, ...updates };
    validateEmailMockConfig(newEmailConfig);
    this.config.email = newEmailConfig;
    logger.info('Email mock configuration updated and validated', updates);
  }

  public updateOAuthConfig(updates: Partial<OAuthMockConfig>): void {
    const newOAuthConfig = { ...this.config.oauth, ...updates };
    validateOAuthMockConfig(newOAuthConfig);
    this.config.oauth = newOAuthConfig;
    logger.info('OAuth mock configuration updated and validated', updates);
  }

  public updateConfig(updates: Partial<MockConfig>): void {
    const newConfig = {
      email: { ...this.config.email, ...(updates.email || {}) },
      oauth: { ...this.config.oauth, ...(updates.oauth || {}) },
    };
    validateMockConfig(newConfig);
    this.config = newConfig;
    logger.info('Mock configuration updated and validated', updates);
  }

  public resetToDefaults(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_MOCK_CONFIG));
    logger.info('Mock configuration reset to defaults');
  }

  public isConfigValid(): boolean {
    try {
      validateMockConfig(this.config);
      return true;
    } catch {
      return false;
    }
  }

  public saveConfigToFile(filePath?: string): void {
    const configPath = filePath || path.resolve(process.cwd(), 'mock.config.json');

    // Validate before saving
    validateMockConfig(this.config);

    const configString = JSON.stringify(this.config, null, 2);
    fs.writeFileSync(configPath, configString, 'utf-8');
    logger.info(`Mock configuration saved to: ${configPath}`);
  }
}

// Export singleton instance
export const mockConfig = MockConfigManager.getInstance();

// Convenience functions for email (existing)
export const getEmailMockConfig = (): EmailMockConfig => mockConfig.getEmailConfig();
export const updateEmailMockConfig = (updates: Partial<EmailMockConfig>): void => mockConfig.updateEmailConfig(updates);

// Convenience functions for OAuth (new)
export const getOAuthMockConfig = (): OAuthMockConfig => mockConfig.getOAuthConfig();
export const updateOAuthMockConfig = (updates: Partial<OAuthMockConfig>): void => mockConfig.updateOAuthConfig(updates);

// General convenience functions
export const resetMockConfig = (): void => mockConfig.resetToDefaults();
export const saveMockConfig = (filePath?: string): void => mockConfig.saveConfigToFile(filePath);

export const isMockingEnabled = (): boolean => {
  return process.env.MOCK_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
};

// Initialize configuration on module load
mockConfig.getConfig();
