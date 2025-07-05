# Code Removal Comments

A comprehensive VSCode extension to easily add removal comments for conditional code compilation. Works perfectly with `vite-plugin-remove-code` and similar build tools.

## Features

✨ **Multiple Comment Styles**
- Multi-line block comments: `/* BUILD_REMOVE_START */ ... /* BUILD_REMOVE_END */`
- Single-line block comments: `// BUILD_REMOVE_START ... // BUILD_REMOVE_END`
- Inline comments: `/* BUILD_REMOVE_START */ code /* BUILD_REMOVE_END */`
- Single-line markers: `// BUILD_REMOVE`

🎯 **Environment-Specific Wrapping**
- Production-only code: `/* PRODUCTION_ONLY_START */ ... /* PRODUCTION_ONLY_END */`
- Development-only code: `/* DEV_ONLY_START */ ... /* DEV_ONLY_END */`
- Test-only code: `/* TEST_ONLY_START */ ... /* TEST_ONLY_END */`
- Debug blocks: `/* DEBUG_START */ ... /* DEBUG_END */`

🔧 **Advanced Features**
- Remove existing markers (cleanup)
- Convert block comments to inline
- Smart indentation preservation
- Configurable spacing and formatting

⚙️ **Fully Configurable**
- Custom comment patterns for all types
- Configurable spacing and indentation
- Per-workspace settings
- Default style preferences

## Usage

### Quick Access
- **Right-click** → **Code Removal** submenu
- **Command Palette** (`Ctrl+Shift+P`) → Search "Code Removal"
- **Keyboard shortcuts** (see below)

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Wrap with Multi-line Comments** | `Ctrl+Shift+R M` | Standard removal blocks |
| **Wrap with Single-line Comments** | `Ctrl+Shift+R S` | Single-line style blocks |
| **Wrap Inline** | `Ctrl+Shift+R I` | Inline single-line wrapping |
| **Mark Line for Removal** | `Ctrl+Shift+R L` | Add line markers |
| **Production Only** | `Ctrl+Shift+R P` | Wrap as production-only |
| **Development Only** | `Ctrl+Shift+R D` | Wrap as development-only |
| **Test Only** | `Ctrl+Shift+R T` | Wrap as test-only |
| **Debug Block** | `Ctrl+Shift+R B` | Wrap as debug block |
| **Remove Markers** | `Ctrl+Shift+R R` | Clean up existing markers |
| **Configure** | - | Open configuration |

### Examples

#### Standard Multi-line Wrapping
**Before:**
```typescript
console.log("Debug info");
debugger;
const temp = "test";
```

**After:** (Select code → `Ctrl+Shift+R M`)
```typescript
/* BUILD_REMOVE_START */
console.log("Debug info");
debugger;
const temp = "test";
/* BUILD_REMOVE_END */
```

#### Inline Wrapping
**Before:**
```typescript
const debug = true;
```

**After:** (Select code → `Ctrl+Shift+R I`)
```typescript
/* BUILD_REMOVE_START */ const debug = true; /* BUILD_REMOVE_END */
```

#### Environment-Specific Wrapping
**Before:**
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Dev mode');
}
```

**After:** (Select code → `Ctrl+Shift+R D`)
```typescript
/* DEV_ONLY_START */
if (process.env.NODE_ENV === 'development') {
  console.log('Dev mode');
}
/* DEV_ONLY_END */
```

#### Line Marking
**Before:**
```typescript
console.log("Keep this");
console.log("Remove this");
console.log("Keep this too");
```

**After:** (Select middle line → `Ctrl+Shift+R L`)
```typescript
console.log("Keep this");
console.log("Remove this"); // BUILD_REMOVE
console.log("Keep this too");
```

#### Cleanup Existing Markers
**Before:**
```typescript
/* BUILD_REMOVE_START */
console.log("debug");
/* BUILD_REMOVE_END */
const x = 1; // BUILD_REMOVE
```

**After:** (Select all → `Ctrl+Shift+R R`)
```typescript
console.log("debug");
const x = 1;
```

## Configuration

Access configuration via:
- **Command Palette** → "Code Removal: Configure Comment Patterns"
- **Settings** → Search "Code Removal"

### Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeRemoval.multiLineStart` | `BUILD_REMOVE_START` | Standard start marker |
| `codeRemoval.multiLineEnd` | `BUILD_REMOVE_END` | Standard end marker |
| `codeRemoval.singleLineMarker` | `BUILD_REMOVE` | Single line marker |
| `codeRemoval.productionOnlyStart` | `PRODUCTION_ONLY_START` | Production start marker |
| `codeRemoval.productionOnlyEnd` | `PRODUCTION_ONLY_END` | Production end marker |
| `codeRemoval.developmentOnlyStart` | `DEV_ONLY_START` | Development start marker |
| `codeRemoval.developmentOnlyEnd` | `DEV_ONLY_END` | Development end marker |
| `codeRemoval.testOnlyStart` | `TEST_ONLY_START` | Test start marker |
| `codeRemoval.testOnlyEnd` | `TEST_ONLY_END` | Test end marker |
| `codeRemoval.debugStart` | `DEBUG_START` | Debug start marker |
| `codeRemoval.debugEnd` | `DEBUG_END` | Debug end marker |
| `codeRemoval.useSpacing` | `true` | Add spaces around markers |
| `codeRemoval.defaultCommentStyle` | `multiline` | Default style |
| `codeRemoval.preserveIndentation` | `true` | Preserve indentation |
| `codeRemoval.addEmptyLines` | `true` | Add empty lines around blocks |

### Custom Patterns Example

```json
{
  "codeRemoval.multiLineStart": "REMOVE_IN_PROD_START",
  "codeRemoval.multiLineEnd": "REMOVE_IN_PROD_END",
  "codeRemoval.debugStart": "LOG_START",
  "codeRemoval.debugEnd": "LOG_END",
  "codeRemoval.useSpacing": false,
  "codeRemoval.preserveIndentation": true
}
```

## Integration

### With vite-plugin-remove-code

```typescript
// vite.config.ts
import { removeCodePlugin } from 'vite-plugin-remove-code';

export default defineConfig({
  plugins: [
    removeCodePlugin({
      environments: ['production'],
      patterns: {
        multiLineStart: 'BUILD_REMOVE_START',
        multiLineEnd: 'BUILD_REMOVE_END',
        singleLine: 'BUILD_REMOVE',
      },
    }),
  ],
});
```

### With Custom Build Tools

```typescript
// Custom plugin configuration
const buildConfig = {
  removePatterns: [
    { start: 'BUILD_REMOVE_START', end: 'BUILD_REMOVE_END' },
    { start: 'DEV_ONLY_START', end: 'DEV_ONLY_END' },
    { start: 'DEBUG_START', end: 'DEBUG_END' },
    { line: 'BUILD_REMOVE' }
  ],
  environments: ['production']
};
```

## Keyboard Shortcuts Reference

### Basic Wrapping
- `Ctrl+Shift+R M` - Multi-line wrap
- `Ctrl+Shift+R S` - Single-line wrap  
- `Ctrl+Shift+R I` - Inline wrap
- `Ctrl+Shift+R L` - Mark line

### Environment-Specific
- `Ctrl+Shift+R P` - Production only
- `Ctrl+Shift+R D` - Development only
- `Ctrl+Shift+R T` - Test only
- `Ctrl+Shift+R B` - Debug block

### Utilities
- `Ctrl+Shift+R R` - Remove markers

**Mac Users:** Replace `Ctrl` with `Cmd`

## Use Cases

### 🔨 **Build-Time Code Removal**
Remove debug code, console.logs, and development utilities from production builds.

### 🌍 **Environment-Specific Code**
Include different code for production, development, and test environments.

### 🐛 **Debug Code Management**
Easily add and remove debugging code without manual cleanup.

### 📦 **Bundle Size Optimization**
Remove unnecessary code to reduce final bundle size.

### 🧪 **Test Code Isolation**
Keep test utilities separate from production code.

## Installation

1. **From VS Code Marketplace:**
   - Open VSCode
   - Go to Extensions (`Ctrl+Shift+X`)
   - Search "Code Removal Comments"
   - Click Install

2. **From VSIX file:**
   ```bash
   code --install-extension code-removal-comments-1.0.0.vsix
   ```

## Changelog

### 1.0.0
- ✨ Multi-line and single-line comment wrapping
- ✨ Inline comment wrapping
- ✨ Environment-specific markers (production, development, test)
- ✨ Debug block wrapping
- ✨ Line marking functionality
- ✨ Remove existing markers (cleanup)
- ✨ Convert block to inline
- ✨ Fully configurable comment patterns
- ✨ Keyboard shortcuts and context menu
- ✨ Advanced settings (indentation, spacing, empty lines)

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.