#!/usr/bin/env node

import { startProxy, stopProxy } from './index';
import fs from 'fs';

const VERSION = '1.0.0';

function showHelp(): void {
  console.log(`
AccountSystem Proxy Server v${VERSION}

USAGE:
  accountsystem-proxy <config-file>
  asp <config-file>

ARGUMENTS:
  config-file    Path to the JSON configuration file (required)

OPTIONS:
  -h, --help     Show help
  -v, --version  Show version

EXAMPLES:
  accountsystem-proxy proxy-config.json
  asp ./configs/production.json

DOCUMENTATION:
  Configuration: https://github.com/0-kodiya-0/AccountSystem/blob/main/packages/proxy/docs/Configuration.md
  Repository:    https://github.com/0-kodiya-0/AccountSystem
  Examples:      https://github.com/0-kodiya-0/AccountSystem/blob/main/packages/proxy/docs/Examples.md
`);
}

function showVersion(): void {
  console.log(`AccountSystem Proxy Server v${VERSION}`);
}

function parseArgs(): {
  configPath?: string;
  help?: boolean;
  version?: boolean;
} {
  const args = process.argv.slice(2);
  const result: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-v':
      case '--version':
        result.version = true;
        break;
      default:
        // Only treat as config path if it's not a flag and we don't already have help/version
        if (!arg.startsWith('-') && !result.configPath && !result.help && !result.version) {
          result.configPath = arg;
        }
        break;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Handle help and version first, before checking for config
  if (args.help) {
    showHelp();
    return;
  }

  if (args.version) {
    showVersion();
    return;
  }

  // Only check for config file if we're not showing help or version
  if (!args.configPath) {
    console.error('Error: Configuration file path is required');
    console.log('\nUsage: accountsystem-proxy <config-file>');
    console.log('Use --help for more information');
    process.exit(1);
  }

  // Check if config file exists
  if (!fs.existsSync(args.configPath)) {
    console.error(`Error: Configuration file not found: ${args.configPath}`);
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await stopProxy();
      console.log('Proxy server stopped');
      process.exit(0);
    } catch (error) {
      console.error(`Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start the proxy
  try {
    console.log(`Starting proxy server with config: ${args.configPath}`);
    await startProxy(args.configPath);
  } catch (error) {
    console.error(`Failed to start proxy server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
