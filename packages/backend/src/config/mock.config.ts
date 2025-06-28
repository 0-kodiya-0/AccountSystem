import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';
import { z } from 'zod'; // npm install zod

// ES module equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Zod schema for email mock configuration
const EmailMockConfigSchema = z.object({
  logEmails: z.boolean(),
  simulateDelay: z.boolean(),
  delayMs: z.number().int().min(0).max(10000),
  simulateFailures: z.boolean(),
  failureRate: z.number().min(0).max(1),
  failOnEmails: z.array(z.string().email()),
  blockEmails: z.array(z.string().email()),
});

// Export type derived from schema
export type EmailMockConfig = z.infer<typeof EmailMockConfigSchema>;

// Default configuration for development
const DEFAULT_EMAIL_MOCK_CONFIG: EmailMockConfig = {
  logEmails: true,
  simulateDelay: false,
  delayMs: 100,
  simulateFailures: false,
  failureRate: 0.1,
  failOnEmails: [],
  blockEmails: [],
};

// Validation function
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

class MockConfigManager {
  private static instance: MockConfigManager;
  private config: EmailMockConfig;
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

  private loadConfiguration(): EmailMockConfig {
    // Start with default configuration
    let config: EmailMockConfig = { ...DEFAULT_EMAIL_MOCK_CONFIG };

    try {
      // Load from mock.config.json file if it exists
      const configFromFile = this.loadFromFile();
      if (configFromFile) {
        // Validate the loaded config
        const validatedConfig = validateEmailMockConfig(configFromFile);
        config = { ...config, ...validatedConfig };
      }

      this.isInitialized = true;
      logger.info('Email mock configuration loaded and validated successfully');
    } catch (error) {
      logger.error('Failed to load email mock configuration:', error);
      logger.warn('Using default email mock configuration');
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
          logger.info(`Email mock configuration loaded from: ${configPath}`);
          return config;
        } catch (error) {
          logger.warn(`Failed to parse mock config file at ${configPath}:`, error);
        }
      }
    }

    return null;
  }

  public getConfig(): EmailMockConfig {
    if (!this.isInitialized) {
      this.config = this.loadConfiguration();
    }
    return { ...this.config };
  }

  public updateConfig(updates: Partial<EmailMockConfig>): void {
    // Validate updates before applying
    const newConfig = { ...this.config, ...updates };
    validateEmailMockConfig(newConfig); // This will throw if invalid

    this.config = newConfig;
    logger.info('Email mock configuration updated and validated', updates);
  }

  public resetToDefaults(): void {
    this.config = { ...DEFAULT_EMAIL_MOCK_CONFIG };
    logger.info('Email mock configuration reset to defaults');
  }

  public isConfigValid(): boolean {
    try {
      validateEmailMockConfig(this.config);
      return true;
    } catch {
      return false;
    }
  }

  public saveConfigToFile(filePath?: string): void {
    const configPath = filePath || path.resolve(process.cwd(), 'mock.config.json');

    // Validate before saving
    validateEmailMockConfig(this.config);

    const configString = JSON.stringify(this.config, null, 2);
    fs.writeFileSync(configPath, configString, 'utf-8');
    logger.info(`Email mock configuration saved to: ${configPath}`);
  }
}

// Export singleton instance
export const mockConfig = MockConfigManager.getInstance();

// Convenience functions
export const getEmailMockConfig = (): EmailMockConfig => mockConfig.getConfig();
export const updateEmailMockConfig = (updates: Partial<EmailMockConfig>): void => mockConfig.updateConfig(updates);
export const resetEmailMockConfig = (): void => mockConfig.resetToDefaults();
export const saveEmailMockConfig = (filePath?: string): void => mockConfig.saveConfigToFile(filePath);

// Initialize configuration on module load
mockConfig.getConfig();
