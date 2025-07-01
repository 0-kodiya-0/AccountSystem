import { describe, it, expect, vi } from 'vitest';
import { Request } from 'express';
import { getStrippedPathPrefix, createRedirectUrl } from '../redirect';

// Mock request object helper
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    get: vi.fn(),
    parentUrl: '',
    ...overrides,
  } as unknown as Request;
};

describe('Redirect Utils', () => {
  describe('getStrippedPathPrefix', () => {
    it('should return path prefix from X-Path-Prefix header', () => {
      const mockGet = vi.fn().mockReturnValue('/api/v1');
      const req = createMockRequest({ get: mockGet });

      const result = getStrippedPathPrefix(req);

      expect(result).toBe('/api/v1');
      expect(mockGet).toHaveBeenCalledWith('X-Path-Prefix');
    });

    it('should return empty string when no X-Path-Prefix header', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      const req = createMockRequest({ get: mockGet });

      const result = getStrippedPathPrefix(req);

      expect(result).toBe('');
      expect(mockGet).toHaveBeenCalledWith('X-Path-Prefix');
    });

    it('should return empty string when header is empty', () => {
      const mockGet = vi.fn().mockReturnValue('');
      const req = createMockRequest({ get: mockGet });

      const result = getStrippedPathPrefix(req);

      expect(result).toBe('');
    });
  });

  describe('createRedirectUrl', () => {
    describe('Absolute URLs', () => {
      it('should handle absolute HTTP URLs', () => {
        const req = createMockRequest();
        const result = createRedirectUrl(req, 'http://example.com/callback');

        expect(result).toBe('http://example.com/callback');
      });

      it('should handle absolute HTTPS URLs', () => {
        const req = createMockRequest();
        const result = createRedirectUrl(req, 'https://secure.example.com/callback');

        expect(result).toBe('https://secure.example.com/callback');
      });

      it('should preserve query parameters in absolute URLs', () => {
        const req = createMockRequest();
        const result = createRedirectUrl(req, 'https://example.com/callback?existing=param');

        expect(result).toBe('https://example.com/callback?existing=param');
      });

      it('should add data parameters to absolute URLs', () => {
        const req = createMockRequest();
        const data = { code: 'success', accountId: '123' };
        const result = createRedirectUrl(req, 'https://example.com/callback', data);

        expect(result).toContain('https://example.com/callback?');
        expect(result).toContain('code=success');
        expect(result).toContain('accountId=123');
      });
    });

    describe('Relative URLs with Path Notation', () => {
      it('should handle ../ notation with parentUrl', () => {
        const req = createMockRequest({
          parentUrl: '/oauth',
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '../callback');

        expect(result).toBe('/oauth/callback');
      });

      it('should handle ../ notation with pathPrefix', () => {
        const req = createMockRequest({
          parentUrl: '/oauth',
          get: vi.fn().mockReturnValue('/api'),
        });
        const result = createRedirectUrl(req, '../callback');

        expect(result).toBe('/api/oauth/callback');
      });

      it('should handle ./ notation', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue('/api'),
        });
        const result = createRedirectUrl(req, './callback');

        expect(result).toBe('/api/callback');
      });

      it('should handle ./ notation without pathPrefix', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, './callback');

        expect(result).toBe('/callback');
      });
    });

    describe('Direct Path URLs', () => {
      it('should handle direct paths with pathPrefix', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue('/api'),
        });
        const result = createRedirectUrl(req, 'callback');

        expect(result).toBe('/api/callback');
      });

      it('should handle direct paths without pathPrefix', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, 'callback');

        expect(result).toBe('/callback');
      });

      it('should handle paths that already start with /', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue('/api'),
        });
        const result = createRedirectUrl(req, '/callback');

        expect(result).toBe('/api/callback');
      });
    });

    describe('Query Parameter Handling', () => {
      it('should add data parameters to URL', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const data = { status: 'success', userId: '456' };
        const result = createRedirectUrl(req, '/callback', data);

        expect(result).toContain('/callback?');
        expect(result).toContain('status=success');
        expect(result).toContain('userId=456');
      });

      it('should encode data parameters', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const data = { message: 'hello world', redirect: 'https://example.com' };
        const result = createRedirectUrl(req, '/callback', data);

        expect(result).toContain('message=hello%20world');
        expect(result).toContain('redirect=https%3A%2F%2Fexample.com');
      });

      it('should handle existing query parameters in relative URLs', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const data = { newParam: 'value' };
        const result = createRedirectUrl(req, '/callback?existing=param', data);

        expect(result).toContain('existing=param');
        expect(result).toContain('newParam=value');
        expect(result).toContain('&'); // Should join with &
      });

      it('should add originalUrl as redirectUrl parameter', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const data = { code: 'success' };
        const originalUrl = '/original/path?param=value';
        const result = createRedirectUrl(req, '/callback', data, originalUrl);

        expect(result).toContain('code=success');
        expect(result).toContain('redirectUrl=' + encodeURIComponent(originalUrl));
      });

      it('should handle non-object data', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const data = 'simple string';
        const result = createRedirectUrl(req, '/callback', data);

        expect(result).toContain('data=' + encodeURIComponent(JSON.stringify(data)));
      });

      it('should handle null data', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '/callback', null);

        expect(result).toBe('/callback');
      });

      it('should handle undefined data', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '/callback', undefined);

        expect(result).toBe('/callback');
      });
    });

    describe('URL Decoding', () => {
      it('should decode URL-encoded base URLs', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '/callback%3Ftest%3Dvalue');

        expect(result).toContain('/callback?test=value');
      });
    });

    describe('Path Normalization', () => {
      it('should normalize multiple slashes in relative paths', () => {
        const req = createMockRequest({
          parentUrl: '/oauth/',
          get: vi.fn().mockReturnValue('/api/'),
        });
        const result = createRedirectUrl(req, '..//callback//path');

        // Should normalize to single slashes
        expect(result).toBe('/api/oauth/callback/path');
      });

      it('should handle complex path combinations', () => {
        const req = createMockRequest({
          parentUrl: '/api/v1/oauth',
          get: vi.fn().mockReturnValue('/backend'),
        });
        const result = createRedirectUrl(req, '../success');

        expect(result).toBe('/backend/api/v1/oauth/success');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty baseUrl', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '');

        expect(result).toBe('/');
      });

      it('should handle baseUrl with only query parameters', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '?param=value');

        expect(result).toBe('/?param=value');
      });

      it('should handle invalid absolute URL gracefully', () => {
        const req = createMockRequest({
          get: vi.fn().mockReturnValue(''),
        });
        // This should not throw and should treat as relative path
        const result = createRedirectUrl(req, 'http://[invalid-url');

        expect(result).toBe('/http://[invalid-url');
      });

      it('should handle missing parentUrl for ../ notation', () => {
        const req = createMockRequest({
          parentUrl: undefined,
          get: vi.fn().mockReturnValue(''),
        });
        const result = createRedirectUrl(req, '../callback');

        expect(result).toBe('/callback');
      });
    });
  });
});
