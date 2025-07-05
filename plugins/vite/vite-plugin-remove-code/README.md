# vite-plugin-remove-code

A Vite plugin that removes code blocks marked with special comments during the build process. Perfect for removing debug code, development-only features, or test utilities from production builds.

## Features

- 🎯 **Selective Code Removal** - Remove specific code blocks based on comment markers
- 🔧 **Environment-Aware** - Different behavior for development, test, and production
- 📝 **Multiple Comment Patterns** - Support for single-line and multi-line comment blocks
- 🚀 **Zero Runtime Dependencies** - Pure build-time transformation
- 📦 **TypeScript Support** - Full TypeScript support with type definitions
- ⚡ **Fast** - Minimal performance impact using efficient regex patterns

## Installation

```bash
npm install vite-plugin-remove-code --save-dev
# or
yarn add vite-plugin-remove-code --dev
# or
pnpm add vite-plugin-remove-code --save-dev
```

## Quick Start

### 1. Add to your Vite config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      environments: ['production'], // Only remove code in production
    }),
  ],
});
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

```typescript
// vite.config.ts
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin(), // Uses defaults
  ],
});
```

### Custom Patterns

```typescript
// vite.config.ts
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
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

```typescript
// vite.config.ts
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      environments: ['production', 'test'], // Remove in both prod and test
    }),
  ],
});
```

### Custom Environment Detection

```typescript
// vite.config.ts
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      isTargetEnvironment: () => {
        return process.env.REMOVE_DEBUG === 'true';
      },
    }),
  ],
});
```

### With Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      environments: ['production'], // Keep debug code during tests
    }),
  ],
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

```typescript
removeCodePlugin({
  exclude: ['node_modules', 'vendor', 'legacy'],
});
```

### Include Only Specific File Types

```typescript
removeCodePlugin({
  include: ['.ts', '.tsx'], // Only process TypeScript files
});
```

### Debug Mode

```typescript
removeCodePlugin({
  debug: true, // Logs what's being processed and removed
});
```

### Multiple Environments

```typescript
removeCodePlugin({
  environments: ['production', 'staging'],
});
```

## Integration Examples

### With React/Vue Projects

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    react(),
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

```typescript
// vite.config.ts for SSR
import { defineConfig } from 'vite';
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      include: ['.ts', '.js'],
      exclude: ['node_modules'],
    }),
  ],
  build: {
    ssr: true,
  },
});
```

## How It Works

The plugin works by:

1. **Transform Phase**: Intercepts file content during Vite's transform phase
2. **Pattern Matching**: Uses regex to find and remove marked code blocks
3. **Environment Check**: Only processes files when target environment conditions are met
4. **Clean Output**: Removes extra empty lines for cleaner output

## Performance

- ⚡ **Fast**: Uses efficient regex patterns for minimal processing overhead
- 🎯 **Targeted**: Only processes files that match include/exclude patterns
- 💾 **Memory Efficient**: Processes files individually without loading entire project
- 🔄 **Cache Friendly**: Works with Vite's built-in caching mechanisms

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { RemoveCodeOptions } from 'vite-plugin-remove-code';

const options: RemoveCodeOptions = {
  environments: ['production'],
  debug: true,
};
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Changelog

### 1.0.0

- Initial release
- Multi-line and single-line comment support
- Environment-aware code removal
- TypeScript support
- Comprehensive test suite
