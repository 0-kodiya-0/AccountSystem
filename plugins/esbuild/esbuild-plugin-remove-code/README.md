# esbuild-plugin-remove-code

An esbuild plugin that removes code blocks marked with special comments during the build process. Perfect for removing debug code, development-only features, or test utilities from production builds.

## Features

- 🎯 **Selective Code Removal** - Remove specific code blocks based on comment markers
- 🔧 **Environment-Aware** - Different behavior for development, test, and production
- 📝 **Multiple Comment Patterns** - Support for single-line and multi-line comment blocks
- 🚀 **Zero Runtime Dependencies** - Pure build-time transformation
- 📦 **TypeScript Support** - Full TypeScript support with type definitions
- ⚡ **Fast** - Minimal performance impact using efficient regex patterns
- 🔌 **esbuild Native** - Built specifically for esbuild's plugin architecture

## Installation

```bash
npm install esbuild-plugin-remove-code --save-dev
# or
yarn add esbuild-plugin-remove-code --dev
# or
pnpm add esbuild-plugin-remove-code --save-dev
```

## Quick Start

### 1. Add to your esbuild config

```javascript
// build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [
    removeCodePlugin({
      environments: ['production'], // Only remove code in production
    }),
  ],
}).catch(() => process.exit(1));
```

### 2. Mark code for removal

```typescript
// your-file.ts
export function myFunction() {
  console.log('This will always be included');

  /* BUILD_REMOVE_START */
  console.log('This debug code will be removed in production');
  debugger;
  const debugInfo = "This won't be in production builds";
  /* BUILD_REMOVE_END */

  console.log('Debug single line'); // BUILD_REMOVE

  return 'production code';
}
```

### 3. Build your project

```bash
# Development (keeps debug code)
npm run dev

# Production (removes debug code)
NODE_ENV=production npm run build
```

## Configuration Options

```typescript
interface RemoveCodeOptions {
  patterns?: {
    multiLineStart: string; // Default: 'BUILD_REMOVE_START'
    multiLineEnd: string; // Default: 'BUILD_REMOVE_END'
    singleLineStart: string; // Default: 'BUILD_REMOVE_START'
    singleLineEnd: string; // Default: 'BUILD_REMOVE_END'
    singleLine: string; // Default: 'BUILD_REMOVE'
  };
  environments?: ('production' | 'development' | 'test')[]; // Default: ['production']
  exclude?: string[]; // Default: []
  include?: string[]; // Default: ['.ts', '.js', '.tsx', '.jsx']
  debug?: boolean; // Default: false
  isTargetEnvironment?: () => boolean; // Custom environment detection
}
```

## Usage Examples

### Basic Usage

```javascript
// build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [
    removeCodePlugin(), // Uses defaults
  ],
});
```

### Custom Patterns

```javascript
// build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [
    removeCodePlugin({
      patterns: {
        multiLineStart: 'DEBUG_START',
        multiLineEnd: 'DEBUG_END',
        singleLineStart: 'DEV_START',
        singleLineEnd: 'DEV_END',
        singleLine: 'REMOVE_LINE',
      },
    }),
  ],
});
```

```typescript
// your-code.ts
function example() {
  /* DEBUG_START */
  console.log('Custom debug block');
  /* DEBUG_END */

  console.log('Remove this line'); // REMOVE_LINE
}
```

### Environment-Specific Removal

```javascript
// build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [
    removeCodePlugin({
      environments: ['production', 'test'], // Remove in both prod and test
    }),
  ],
});
```

### Custom Environment Detection

```javascript
// build.js
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [
    removeCodePlugin({
      isTargetEnvironment: () => {
        return process.env.REMOVE_DEBUG === 'true';
      },
    }),
  ],
});
```

### TypeScript Configuration

```typescript
// build.ts
import { build } from 'esbuild';
import { removeCodePlugin } from 'esbuild-plugin-remove-code';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  target: 'es2020',
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      debug: true,
    }),
  ],
});
```

### With Vitest

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    plugins: [
      removeCodePlugin({
        environments: ['production'], // Keep debug code during tests
      }),
    ],
  },
  test: {
    // ... your test config
  },
});
```

## Comment Patterns

### Multi-line Blocks

```typescript
/* BUILD_REMOVE_START */
console.log('This entire block');
console.log('will be removed');
debugger;
/* BUILD_REMOVE_END */
```

### Single-line Blocks

```typescript
// BUILD_REMOVE_START
console.log('This block');
console.log('will also be removed');
// BUILD_REMOVE_END
```

### Single Lines

```typescript
console.log('Remove this line'); // BUILD_REMOVE
const debug = true; // BUILD_REMOVE
```

## Advanced Usage

### Exclude Specific Files

```javascript
removeCodePlugin({
  exclude: ['node_modules', 'vendor', 'legacy'],
});
```

### Include Only Specific File Types

```javascript
removeCodePlugin({
  include: ['.ts', '.tsx'], // Only process TypeScript files
});
```

### Debug Mode

```javascript
removeCodePlugin({
  debug: true, // Logs what's being processed and removed
});
```

### Multiple Environments

```javascript
removeCodePlugin({
  environments: ['production', 'staging'],
});
```

## Integration Examples

### With React/Preact Projects

```javascript
// build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/App.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  jsx: 'automatic',
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      patterns: {
        singleLine: 'DEV_ONLY',
      },
    }),
  ],
});
```

### With Node.js Backend

```javascript
// build-server.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  outfile: 'dist/server.js',
  platform: 'node',
  target: 'node16',
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      include: ['.ts', '.js'],
      exclude: ['node_modules'],
    }),
  ],
});
```

### Build Script with Multiple Targets

```javascript
// scripts/build.js
const { build } = require('esbuild');
const { removeCodePlugin } = require('esbuild-plugin-remove-code');

const baseConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      debug: process.env.DEBUG === 'true',
    }),
  ],
};

// Build for browser
build({
  ...baseConfig,
  outfile: 'dist/browser.js',
  format: 'esm',
  target: 'es2020',
});

// Build for Node.js
build({
  ...baseConfig,
  outfile: 'dist/node.js',
  format: 'cjs',
  platform: 'node',
  target: 'node16',
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "node build.js --watch",
    "build": "NODE_ENV=production node build.js",
    "build:debug": "DEBUG=true NODE_ENV=production node build.js"
  }
}
```

## How It Works

The plugin works by:

1. **File Loading**: Intercepts file loading during esbuild's onLoad phase
2. **Pattern Matching**: Uses regex to find and remove marked code blocks
3. **Environment Check**: Only processes files when target environment conditions are met
4. **Clean Output**: Removes extra empty lines for cleaner output
5. **Loader Assignment**: Automatically detects and assigns appropriate file loaders

## Performance

- ⚡ **Fast**: Uses efficient regex patterns for minimal processing overhead
- 🎯 **Targeted**: Only processes files that match include/exclude patterns
- 💾 **Memory Efficient**: Processes files individually without loading entire project
- 🔄 **Cache Friendly**: Works with esbuild's built-in caching mechanisms
- 🚀 **Native Integration**: Built specifically for esbuild's architecture

## File Processing

The plugin processes the following file types by default:

- `.ts` - TypeScript files
- `.js` - JavaScript files
- `.tsx` - TypeScript JSX files
- `.jsx` - JavaScript JSX files

Custom file extensions can be configured via the `include` option.

## Environment Detection

The plugin detects environments in the following order:

1. **Custom Function**: If `isTargetEnvironment` is provided, uses that
2. **Vitest Mode**: If `process.env.VITEST` is set, checks for 'test' in environments
3. **NODE_ENV**: Uses `process.env.NODE_ENV` to match against environments array

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { RemoveCodeOptions } from 'esbuild-plugin-remove-code';

const options: RemoveCodeOptions = {
  environments: ['production'],
  debug: true,
};
```

## Comparison with Other Tools

| Feature           | esbuild-plugin-remove-code | webpack-strip-block | rollup-plugin-strip-code |
| ----------------- | -------------------------- | ------------------- | ------------------------ |
| esbuild Support   | ✅ Native                  | ❌                  | ❌                       |
| TypeScript        | ✅ Full Support            | ⚠️ Limited          | ⚠️ Limited               |
| Multiple Patterns | ✅                         | ⚠️ Limited          | ⚠️ Limited               |
| Environment Aware | ✅                         | ❌                  | ❌                       |
| Performance       | ⚡ Fast                    | 🐌 Slower           | 🐌 Slower                |

## Troubleshooting

### Code Not Being Removed

1. Check that `NODE_ENV` matches your `environments` configuration
2. Verify file extensions are in the `include` list
3. Ensure file paths don't match `exclude` patterns
4. Enable `debug: true` to see processing logs

### TypeScript Compilation Issues

1. Ensure `@types/node` is installed for file system operations
2. Check that esbuild is configured to handle TypeScript files
3. Verify the plugin is loaded before other TypeScript processors

### Performance Issues

1. Use specific `include` patterns to limit file processing
2. Add frequently accessed paths to `exclude` list
3. Consider using `isTargetEnvironment` for custom logic

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/esbuild-plugin-remove-code.git

# Install dependencies
npm install

# Run tests
npm test

# Build the plugin
npm run build

# Run example
npm run example
```

## Changelog

### 1.0.0

- Initial release
- Multi-line and single-line comment support
- Environment-aware code removal
- TypeScript support
- Comprehensive test suite
- esbuild native integration
- File system integration with automatic loader detection
