import type { Plugin } from 'esbuild';
import { readFileSync } from 'fs';
import { extname } from 'path';

export interface RemoveCodeOptions {
  /**
   * Comment patterns to match for code removal
   */
  patterns?: {
    /** Start marker for multi-line blocks */
    multiLineStart: string;
    /** End marker for multi-line blocks */
    multiLineEnd: string;
    /** Start marker for single-line blocks */
    singleLineStart: string;
    /** End marker for single-line blocks */
    singleLineEnd: string;
    /** Marker for single lines to remove */
    singleLine: string;
  };

  /**
   * Environments where code removal should occur
   * @default ['production']
   */
  environments?: ('production' | 'development' | 'test')[];

  /**
   * File patterns to exclude from processing
   * @default []
   */
  exclude?: string[];

  /**
   * File patterns to include for processing
   * @default ['.ts', '.js', '.tsx', '.jsx']
   */
  include?: string[];

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom environment detection function
   */
  isTargetEnvironment?: () => boolean;
}

const defaultOptions: Required<Omit<RemoveCodeOptions, 'isTargetEnvironment'>> = {
  patterns: {
    multiLineStart: 'BUILD_REMOVE_START',
    multiLineEnd: 'BUILD_REMOVE_END',
    singleLineStart: 'BUILD_REMOVE_START',
    singleLineEnd: 'BUILD_REMOVE_END',
    singleLine: 'BUILD_REMOVE',
  },
  environments: ['production'],
  exclude: [],
  include: ['.ts', '.js', '.tsx', '.jsx'],
  debug: false,
};

/**
 * esbuild plugin to remove code blocks marked with special comments
 */
export function removeCodePlugin(options: RemoveCodeOptions = {}): Plugin {
  const config = { ...defaultOptions, ...options };

  const log = (message: string, ...args: any[]) => {
    if (config.debug) {
      console.log(`[esbuild-plugin-remove-code] ${message}`, ...args);
    }
  };

  return {
    name: 'esbuild-plugin-remove-code',
    setup(build) {
      log('Plugin initialized with config:', {
        platform: build.initialOptions.platform,
        format: build.initialOptions.format,
        environment: process.env.NODE_ENV,
      });

      // Filter files based on include/exclude patterns
      const filter = new RegExp(config.include.map((ext) => `\\${ext}$`).join('|'));

      build.onLoad({ filter }, async (args) => {
        const { path } = args;

        // Skip if file is in exclude list
        if (config.exclude.some((pattern) => path.includes(pattern))) {
          log('Excluding file:', path);
          return undefined;
        }

        // Check if current environment should trigger code removal
        let shouldRemove = false;

        if (config.isTargetEnvironment) {
          shouldRemove = config.isTargetEnvironment();
        } else {
          const currentEnv = process.env.NODE_ENV;
          const isVitest = !!process.env.VITEST;

          if (isVitest) {
            shouldRemove = config.environments.includes('test');
          } else {
            shouldRemove = config.environments.includes(currentEnv as any);
          }
        }

        if (!shouldRemove) {
          log('Skipping code removal for environment');
          return undefined;
        }

        log('Processing file:', path);

        // Read file content
        let contents: string;
        try {
          contents = readFileSync(path, 'utf8');
        } catch (error) {
          log('Error reading file:', path, error);
          return undefined;
        }

        let transformedCode = contents;
        let hasChanges = false;

        // Remove multi-line blocks /* PATTERN_START */ ... /* PATTERN_END */
        const multiLineRegex = new RegExp(
          `\\/\\*\\s*${escapeRegex(config.patterns.multiLineStart)}\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*${escapeRegex(
            config.patterns.multiLineEnd,
          )}\\s*\\*\\/`,
          'g',
        );
        const multiLineMatch = transformedCode.match(multiLineRegex);
        if (multiLineMatch) {
          log('Removing multi-line blocks:', multiLineMatch.length);
          transformedCode = transformedCode.replace(multiLineRegex, '');
          hasChanges = true;
        }

        // Remove single-line blocks // PATTERN_START ... // PATTERN_END
        const singleLineBlockRegex = new RegExp(
          `\\/\\/\\s*${escapeRegex(config.patterns.singleLineStart)}[\\s\\S]*?\\/\\/\\s*${escapeRegex(
            config.patterns.singleLineEnd,
          )}`,
          'g',
        );
        const singleLineBlockMatch = transformedCode.match(singleLineBlockRegex);
        if (singleLineBlockMatch) {
          log('Removing single-line blocks:', singleLineBlockMatch.length);
          transformedCode = transformedCode.replace(singleLineBlockRegex, '');
          hasChanges = true;
        }

        // Remove single lines // PATTERN
        const singleLineRegex = new RegExp(`^.*\\/\\/\\s*${escapeRegex(config.patterns.singleLine)}.*$`, 'gm');
        const singleLineMatch = transformedCode.match(singleLineRegex);
        if (singleLineMatch) {
          log('Removing single lines:', singleLineMatch.length);
          transformedCode = transformedCode.replace(singleLineRegex, '');
          hasChanges = true;
        }

        // Clean up extra empty lines
        if (hasChanges) {
          transformedCode = transformedCode.replace(/\n\s*\n\s*\n/g, '\n\n');
          log('Code transformation completed for:', path);
        }

        if (hasChanges) {
          return {
            contents: transformedCode,
            loader: getLoader(path),
          };
        }

        return undefined;
      });
    },
  };
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the appropriate loader for the file extension
 */
function getLoader(path: string): 'js' | 'ts' | 'jsx' | 'tsx' {
  const ext = extname(path);
  switch (ext) {
    case '.ts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.jsx':
      return 'jsx';
    case '.js':
    default:
      return 'js';
  }
}

// Export types
export type { Plugin };

// Default export for convenience
export default removeCodePlugin;
