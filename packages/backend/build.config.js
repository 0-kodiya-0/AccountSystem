import esbuild from 'esbuild';
import { removeCodePlugin } from 'esbuild-plugin-remove-code';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean dist directory
function cleanDist() {
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('🧹 Cleaned dist directory');
  }
}

// Build configuration
const buildConfig = {
  entryPoints: [
    'src/index.ts', // Main server
    'src/cli.ts', // CLI tool
  ],

  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist',
  minify: true,
  sourcemap: false,
  packages: 'external',

  // External packages (don't bundle these - they'll be installed separately)
  external: [
    'mongoose',
    'mongodb',
    'bcrypt',
    'nodemailer',
    'googleapis',
    'socket.io',
    'express',
    'dotenv',
    'cookie-parser',
    'jsonwebtoken',
    'lowdb',
    'lru-cache',
    'otplib',
    'qrcode',
    // Test frameworks (mark as external so they're not bundled)
    'vitest',
    'jest',
    '@vitest/ui',
    '@vitest/coverage-v8',
    'supertest',
    'mongodb-memory-server',
  ],

  plugins: [
    // Remove code using your plugin
    removeCodePlugin({
      patterns: {
        multiLineStart: 'BUILD_REMOVE_START',
        multiLineEnd: 'BUILD_REMOVE_END',
        singleLineStart: 'BUILD_REMOVE_START',
        singleLineEnd: 'BUILD_REMOVE_END',
        singleLine: 'BUILD_REMOVE',
      },
      environments: ['production'],
      exclude: ['node_modules', '__tests__', '__test__', '__mocks__', '__mock__', 'health', 'mocks', 'test', 'tests'],
      debug: true,
    }),

    // Custom plugin to exclude test files (since esbuild doesn't have built-in exclude)
    {
      name: 'exclude-test-files',
      setup(build) {
        // Use onResolve to exclude based on import paths
        build.onResolve({ filter: /.*/ }, (args) => {
          const { path, importer } = args;

          // Check if the path being imported should be excluded
          const excludePatterns = [
            // Folder patterns - check if path contains these folders
            /\/__tests__\//,
            /\/__test__\//,
            /\/__mocks__\//,
            /\/__mock__\//,
            /\/mocks\//,
            /\/test\//,
            /\/tests\//,
            /\/health\//, // Add your health folder here
            /\/spec\//,
            /\/specs\//,

            // File patterns - check if path ends with these
            /\.test\.(ts|js)$/,
            /\.spec\.(ts|js)$/,
            /\.mock\.(ts|js)$/,

            // Specific files
            /vitest\.config\.(ts|js)$/,
            /jest\.config\.(ts|js)$/,
          ];

          // Check if the import path or importer path matches exclusion patterns
          const shouldExclude = excludePatterns.some(
            (pattern) => pattern.test(path) || (importer && pattern.test(importer)),
          );

          if (shouldExclude) {
            // Mark as external so it won't be bundled
            return { path, external: true };
          }

          // Let esbuild handle this normally
          return undefined;
        });
      },
    },
  ],
};

async function build() {
  console.log('🚀 Starting production build...');

  try {
    cleanDist();

    // Set NODE_ENV for the plugin
    process.env.NODE_ENV = 'production';

    const result = await esbuild.build(buildConfig);

    console.log('✅ Build completed successfully!');

    if (result.warnings.length > 0) {
      console.log('⚠️  Build warnings:');
      result.warnings.forEach((warning) => {
        console.log(`   ${warning.text}`);
      });
    }

    console.log('🎉 Production build ready in ./dist');
    console.log('');
    console.log('📋 Deployment Instructions:');
    console.log('  1. Copy the dist/ folder to your production server');
    console.log('  2. Copy package.json to the production server');
    console.log('  3. Run: npm install --production');
    console.log('  4. Start with: node dist/cli.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Running build...');
  build();
} else {
  console.log('Not running build - file was imported, not executed directly');
}

export { build };
