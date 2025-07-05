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

  it('should remove multi-line code blocks in production', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const code = `
function test() {
  console.log("keep this");
  /* BUILD_REMOVE_START */
  console.log("remove this");
  debugger;
  /* BUILD_REMOVE_END */
  console.log("keep this too");
}`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this');
    expect((result as any).code).toContain('keep this');
  });

  it('should remove single-line blocks in production', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const code = `
function test() {
  console.log("keep this");
  // BUILD_REMOVE_START
  console.log("remove this");
  console.log("and this");
  // BUILD_REMOVE_END
  console.log("keep this too");
}`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this');
    expect((result as any).code).toContain('keep this');
  });

  it('should remove single lines marked with BUILD_REMOVE', () => {
    process.env.NODE_ENV = 'production';
    const plugin = removeCodePlugin();

    const code = `
function test() {
  console.log("keep this");
  console.log("remove this"); // BUILD_REMOVE
  console.log("keep this too");
}`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this');
    expect((result as any).code).toContain('keep this');
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

  it('should respect custom patterns', () => {
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

    const code = `
function test() {
  /* DEBUG_START */
  console.log("remove this");
  /* DEBUG_END */
  console.log("debug line"); // DEBUG_REMOVE
}`;

    const result = callTransform(plugin, code, 'test.ts');
    expect(result).toBeTruthy();
    expect((result as any).code).not.toContain('remove this');
    expect((result as any).code).not.toContain('debug line');
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
});
