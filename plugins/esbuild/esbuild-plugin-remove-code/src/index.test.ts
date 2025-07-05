import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { build } from 'esbuild';
import { removeCodePlugin } from './index';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Test directory for temporary files
const testDir = join(__dirname, 'test-temp');

// Helper function to create test files
function createTestFile(filename: string, content: string): string {
  const filePath = join(testDir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

// Helper to normalize whitespace for comparison
function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

describe('esbuild-plugin-remove-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.VITEST;

    // Clean up and create test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files after each test
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should create plugin with default options', () => {
    const plugin = removeCodePlugin();
    expect(plugin.name).toBe('esbuild-plugin-remove-code');
    expect(plugin.setup).toBeInstanceOf(Function);
  });

  it('should remove multi-line code blocks in production', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep this line 1");
  /* BUILD_REMOVE_START */
  console.log("remove this line");
  debugger;
  const shouldBeRemoved = "yes";
  /* BUILD_REMOVE_END */
  console.log("keep this line 2");
  return "final result";
}
export { test };`;

    const testFile = createTestFile('test-multi-line.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('keep this line 1');
    expect(output).toContain('keep this line 2');
    expect(output).toContain('final result');
    expect(output).not.toContain('remove this line');
    expect(output).not.toContain('shouldBeRemoved');
  });

  it('should remove single-line multiline blocks in production', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep this line 1");
  /* BUILD_REMOVE_START */ console.log("remove this single line"); const x = 1; /* BUILD_REMOVE_END */
  console.log("keep this line 2");
  /* BUILD_REMOVE_START */ debugger; /* BUILD_REMOVE_END */
  return "final result";
}
export { test };`;

    const testFile = createTestFile('test-single-line-multiline.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('keep this line 1');
    expect(output).toContain('keep this line 2');
    expect(output).toContain('final result');
    expect(output).not.toContain('remove this single line');
    expect(output).not.toContain('const x = 1');
  });

  it('should remove single-line comment blocks in production', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep this line 1");
  // BUILD_REMOVE_START
  console.log("remove this");
  const debug = true;
  console.log("and this");
  // BUILD_REMOVE_END
  console.log("keep this line 2");
  return "final result";
}
export { test };`;

    const testFile = createTestFile('test-comment-blocks.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('keep this line 1');
    expect(output).toContain('keep this line 2');
    expect(output).toContain('final result');
    expect(output).not.toContain('remove this');
    expect(output).not.toContain('const debug = true');
  });

  it('should remove single lines marked with BUILD_REMOVE', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep this line 1");
  console.log("remove this entire line"); // BUILD_REMOVE
  const keepThis = "important";
  debugger; // BUILD_REMOVE
  console.log("keep this line 2");
  return "final result";
}
export { test };`;

    const testFile = createTestFile('test-single-lines.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('keep this line 1');
    expect(output).toContain('keep this line 2');
    expect(output).toContain('keepThis');
    expect(output).toContain('final result');
    expect(output).not.toContain('remove this entire line');
    expect(output).not.toContain('debugger');
  });

  it('should not remove code in development by default', async () => {
    process.env.NODE_ENV = 'development';

    const inputCode = `
function test() {
  /* BUILD_REMOVE_START */
  console.log("debug code");
  /* BUILD_REMOVE_END */
  return "result";
}
export { test };`;

    const testFile = createTestFile('test-development.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('debug code');
    expect(output).toContain('result');
  });

  it('should handle mixed patterns correctly', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep line 1");
  
  /* BUILD_REMOVE_START */ const debug = true; /* BUILD_REMOVE_END */
  
  console.log("keep line 2");
  
  /* BUILD_REMOVE_START */
  console.log("remove multi-line block");
  const x = 1;
  debugger;
  /* BUILD_REMOVE_END */
  
  console.log("keep line 3");
  
  // BUILD_REMOVE_START
  console.log("remove single-line comment block");
  const y = 2;
  // BUILD_REMOVE_END
  
  console.log("keep line 4");
  console.log("remove this entire line"); // BUILD_REMOVE
  console.log("keep line 5");
  
  return "final result";
}
export { test };`;

    const testFile = createTestFile('test-mixed-patterns.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    // Verify keeps
    expect(output).toContain('keep line 1');
    expect(output).toContain('keep line 2');
    expect(output).toContain('keep line 3');
    expect(output).toContain('keep line 4');
    expect(output).toContain('keep line 5');
    expect(output).toContain('final result');

    // Verify removals
    expect(output).not.toContain('const debug = true');
    expect(output).not.toContain('remove multi-line block');
    expect(output).not.toContain('remove single-line comment block');
    expect(output).not.toContain('remove this entire line');
    expect(output).not.toContain('const x = 1');
    expect(output).not.toContain('const y = 2');
  });

  it('should respect custom patterns', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
function test() {
  console.log("keep this");
  /* DEBUG_START */
  console.log("remove this block");
  /* DEBUG_END */
  console.log("keep this too");
  console.log("remove this line"); // DEBUG_REMOVE
  return "result";
}
export { test };`;

    const testFile = createTestFile('test-custom-patterns.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [
        removeCodePlugin({
          patterns: {
            multiLineStart: 'DEBUG_START',
            multiLineEnd: 'DEBUG_END',
            singleLineStart: 'DEBUG_START',
            singleLineEnd: 'DEBUG_END',
            singleLine: 'DEBUG_REMOVE',
          },
        }),
      ],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('keep this');
    expect(output).toContain('keep this too');
    expect(output).toContain('result');
    expect(output).not.toContain('remove this block');
    expect(output).not.toContain('remove this line');
  });

  it('should handle TypeScript files', async () => {
    process.env.NODE_ENV = 'production';

    const inputCode = `
interface TestInterface {
  name: string;
}

class TestClass implements TestInterface {
  name: string;
  
  constructor(name: string) {
    this.name = name;
    /* BUILD_REMOVE_START */
    console.log("Debug constructor");
    /* BUILD_REMOVE_END */
  }
  
  greet(): string {
    console.log("Debug greet"); // BUILD_REMOVE
    return \`Hello, \${this.name}!\`;
  }
}

export { TestClass };`;

    const testFile = createTestFile('test-typescript.ts', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [removeCodePlugin()],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('TestClass');
    expect(output).toContain('constructor');
    expect(output).toContain('greet');
    expect(output).toContain('Hello,');
    expect(output).not.toContain('Debug constructor');
    expect(output).not.toContain('Debug greet');
  });

  it('should use custom environment detection', async () => {
    const inputCode = `
function test() {
  /* BUILD_REMOVE_START */
  console.log("remove this");
  /* BUILD_REMOVE_END */
  return "result";
}
export { test };`;

    const testFile = createTestFile('test-custom-env.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [
        removeCodePlugin({
          isTargetEnvironment: () => true,
        }),
      ],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('result');
    expect(output).not.toContain('remove this');
  });

  it('should handle vitest environment', async () => {
    process.env.VITEST = 'true';

    const inputCode = `
function test() {
  /* BUILD_REMOVE_START */
  console.log("remove this in test");
  /* BUILD_REMOVE_END */
  return "result";
}
export { test };`;

    const testFile = createTestFile('test-vitest.js', inputCode);

    const result = await build({
      entryPoints: [testFile],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [
        removeCodePlugin({
          environments: ['test'],
        }),
      ],
    });

    const output = result.outputFiles[0].text;

    expect(output).toContain('result');
    expect(output).not.toContain('remove this in test');
  });
});
