import { describe, it, expect, beforeEach, vi } from 'vitest';
import { removeCodePlugin } from './index';
import type { TransformResult } from 'vite';

// Helper function to safely call the transform hook
function callTransform(plugin: any, code: string, id: string): TransformResult | null {
  const transform = plugin.transform;
  if (typeof transform === 'function') {
    return transform.call(null, code, id);
  } else if (transform && typeof transform.handler === 'function') {
    return transform.handler.call(null, code, id);
  }
  return null;
}

// Helper to normalize whitespace for comparison
function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

describe('vite-plugin-remove-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
  });

  it('should create plugin with default options', () => {
    const plugin = removeCodePlugin();
    expect(plugin.name).toBe('vite-plugin-remove-code');
    expect(plugin.enforce).toBe('pre');
  });

  it('should remove multi-line code blocks in production - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

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
}`;

    const expectedOutput = `
function test() {
  console.log("keep this line 1");
  
  console.log("keep this line 2");
  return "final result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    console.log('=== INPUT CODE ===');
    console.log(inputCode);
    console.log('=== ACTUAL OUTPUT ===');
    console.log(actualCode);
    console.log('=== EXPECTED OUTPUT ===');
    console.log(expectedOutput);

    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should remove single-line multiline blocks in production - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const inputCode = `
function test() {
  console.log("keep this line 1");
  /* BUILD_REMOVE_START */ console.log("remove this single line"); const x = 1; /* BUILD_REMOVE_END */
  console.log("keep this line 2");
  /* BUILD_REMOVE_START */ debugger; /* BUILD_REMOVE_END */
  return "final result";
}`;

    const expectedOutput = `
function test() {
  console.log("keep this line 1");
  
  console.log("keep this line 2");
  
  return "final result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    console.log('=== SINGLE-LINE INPUT CODE ===');
    console.log(inputCode);
    console.log('=== SINGLE-LINE ACTUAL OUTPUT ===');
    console.log(actualCode);
    console.log('=== SINGLE-LINE EXPECTED OUTPUT ===');
    console.log(expectedOutput);

    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should remove single-line comment blocks in production - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

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
}`;

    const expectedOutput = `
function test() {
  console.log("keep this line 1");
  
  console.log("keep this line 2");
  return "final result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    console.log('=== COMMENT BLOCK INPUT CODE ===');
    console.log(inputCode);
    console.log('=== COMMENT BLOCK ACTUAL OUTPUT ===');
    console.log(actualCode);

    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should remove single lines marked with BUILD_REMOVE - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const inputCode = `
function test() {
  console.log("keep this line 1");
  console.log("remove this entire line"); // BUILD_REMOVE
  const keepThis = "important";
  debugger; // BUILD_REMOVE
  console.log("keep this line 2");
  return "final result";
}`;

    const expectedOutput = `
function test() {
  console.log("keep this line 1");
  const keepThis = "important";
  console.log("keep this line 2");
  return "final result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    console.log('=== SINGLE LINE REMOVAL INPUT CODE ===');
    console.log(inputCode);
    console.log('=== SINGLE LINE REMOVAL ACTUAL OUTPUT ===');
    console.log(actualCode);

    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should not remove code in development by default', () => {
    process.env.NODE_ENV = 'development';
    const plugin = removeCodePlugin();

    const code = `
function test() {
  /* BUILD_REMOVE_START */
  console.log("debug code");
  /* BUILD_REMOVE_END */
}`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeNull();
  });

  it('should handle mixed patterns correctly - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

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
}`;

    const expectedOutput = `
function test() {
  console.log("keep line 1");
  
  console.log("keep line 2");
  
  console.log("keep line 3");
  
  console.log("keep line 4");
  console.log("keep line 5");
  
  return "final result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    console.log('=== MIXED PATTERNS INPUT CODE ===');
    console.log(inputCode);
    console.log('=== MIXED PATTERNS ACTUAL OUTPUT ===');
    console.log(actualCode);
    console.log('=== MIXED PATTERNS EXPECTED OUTPUT ===');
    console.log(expectedOutput);

    // Verify specific requirements
    expect(actualCode).toContain('keep line 1');
    expect(actualCode).toContain('keep line 2');
    expect(actualCode).toContain('keep line 3');
    expect(actualCode).toContain('keep line 4');
    expect(actualCode).toContain('keep line 5');
    expect(actualCode).toContain('final result');

    // Verify removals
    expect(actualCode).not.toContain('const debug = true');
    expect(actualCode).not.toContain('remove multi-line block');
    expect(actualCode).not.toContain('remove single-line comment block');
    expect(actualCode).not.toContain('remove this entire line');
    expect(actualCode).not.toContain('const x = 1');
    expect(actualCode).not.toContain('const y = 2');

    // Verify the structure is preserved
    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should respect custom patterns - complete verification', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin({
      patterns: {
        multiLineStart: 'DEBUG_START',
        multiLineEnd: 'DEBUG_END',
        singleLineStart: 'DEBUG_START',
        singleLineEnd: 'DEBUG_END',
        singleLine: 'DEBUG_REMOVE',
      },
    });

    const inputCode = `
function test() {
  console.log("keep this");
  /* DEBUG_START */
  console.log("remove this block");
  /* DEBUG_END */
  console.log("keep this too");
  console.log("remove this line"); // DEBUG_REMOVE
  return "result";
}`;

    const expectedOutput = `
function test() {
  console.log("keep this");
  
  console.log("keep this too");
  return "result";
}`;

    const result = callTransform(plugin, inputCode, 'test.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;
    const normalizedActual = normalizeCode(actualCode);
    const normalizedExpected = normalizeCode(expectedOutput);

    expect(normalizedActual).toBe(normalizedExpected);
  });

  it('should respect exclude patterns', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin({
      exclude: ['node_modules', 'test'],
    });

    const code = `
/* BUILD_REMOVE_START */
console.log("should not be removed");
/* BUILD_REMOVE_END */
`;

    const result = callTransform(plugin, code, 'node_modules/test.ts');
    expect(result).toBeNull();
  });

  it('should respect include patterns', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin({
      include: ['.ts'],
    });

    const code = `
/* BUILD_REMOVE_START */
console.log("remove this");
/* BUILD_REMOVE_END */
`;

    // Should process .ts files
    const tsResult = callTransform(plugin, code, 'test.ts');
    expect(tsResult).toBeTruthy();

    // Should not process .vue files
    const vueResult = callTransform(plugin, code, 'test.vue');
    expect(vueResult).toBeNull();
  });

  it('should use custom environment detection', () => {
    const plugin = removeCodePlugin({
      isTargetEnvironment: () => true,
    });

    const code = `
/* BUILD_REMOVE_START */
console.log("remove this");
/* BUILD_REMOVE_END */
`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this');
  });

  it('should handle vitest environment', () => {
    process.env.VITEST = 'true';
    const plugin = removeCodePlugin({
      environments: ['test'],
    });

    const code = `
/* BUILD_REMOVE_START */
console.log("remove this in test");
/* BUILD_REMOVE_END */
`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this in test');
  });

  it('should preserve code structure and formatting - comprehensive test', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const inputCode = `export class AuthService {
  private debugMode = false;

  constructor() {
    /* BUILD_REMOVE_START */
    console.log("Service initialized in debug mode");
    this.debugMode = true;
    this.setupDebugListeners();
    /* BUILD_REMOVE_END */
  }

  public authenticate(credentials: any): boolean {
    console.log("Starting authentication"); // BUILD_REMOVE
    
    // BUILD_REMOVE_START
    if (this.debugMode) {
      console.log("Debug info:", credentials);
    }
    // BUILD_REMOVE_END
    
    const isValid = this.validateCredentials(credentials);
    
    /* BUILD_REMOVE_START */ console.log("Validation result:", isValid); /* BUILD_REMOVE_END */
    
    return isValid;
  }

  private validateCredentials(credentials: any): boolean {
    return credentials && credentials.email && credentials.password;
  }

  /* BUILD_REMOVE_START */
  private setupDebugListeners(): void {
    console.log("Setting up debug listeners...");
  }
  /* BUILD_REMOVE_END */
}`;

    const expectedOutput = `export class AuthService {
  private debugMode = false;

  constructor() {
    
  }

  public authenticate(credentials: any): boolean {
    
    
    const isValid = this.validateCredentials(credentials);
    
    
    return isValid;
  }

  private validateCredentials(credentials: any): boolean {
    return credentials && credentials.email && credentials.password;
  }

  
}`;

    const result = callTransform(plugin, inputCode, 'auth.service.ts');
    expect(result).toBeTruthy();

    const actualCode = (result as any).code;

    console.log('=== COMPREHENSIVE INPUT CODE ===');
    console.log(inputCode);
    console.log('=== COMPREHENSIVE ACTUAL OUTPUT ===');
    console.log(actualCode);

    // Verify structure is preserved
    expect(actualCode).toContain('export class AuthService');
    expect(actualCode).toContain('constructor()');
    expect(actualCode).toContain('public authenticate');
    expect(actualCode).toContain('private validateCredentials');
    expect(actualCode).toContain('return credentials && credentials.email');

    // Verify all debug code is removed
    expect(actualCode).not.toContain('Service initialized in debug mode');
    expect(actualCode).not.toContain('this.debugMode = true');
    expect(actualCode).not.toContain('this.setupDebugListeners');
    expect(actualCode).not.toContain('Starting authentication');
    expect(actualCode).not.toContain('Debug info:');
    expect(actualCode).not.toContain('Validation result:');
    expect(actualCode).not.toContain('Setting up debug listeners');

    // Verify class structure integrity
    const classMatch = actualCode.match(/export class AuthService \{[\s\S]*\}/);
    expect(classMatch).toBeTruthy();
  });
});
