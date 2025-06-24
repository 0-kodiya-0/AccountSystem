import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../HttpClient';
import { ApiErrorCode, AuthSDKError } from '../../types';
import { createMockFetchResponse } from '../../test/utils';

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    httpClient = new HttpClient({
      backendUrl: 'http://localhost:3001',
      timeout: 30000,
      withCredentials: true,
    });
  });

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(httpClient).toBeInstanceOf(HttpClient);
    });

    it('should handle proxy URL configuration', () => {
      const clientWithProxy = new HttpClient({
        backendUrl: 'http://localhost:3001',
        backendProxyUrl: '/api',
        timeout: 30000,
        withCredentials: true,
      });

      expect(clientWithProxy).toBeInstanceOf(HttpClient);
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockData = { message: 'success' };
      mockFetch.mockResolvedValue(createMockFetchResponse(mockData));

      const result = await httpClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }),
      );
      expect(result).toEqual(mockData);
    });

    it('should make successful POST request with data', async () => {
      const mockData = { message: 'created' };
      const postData = { name: 'test' };
      mockFetch.mockResolvedValue(createMockFetchResponse(mockData));

      const result = await httpClient.post('/test', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(postData),
        }),
      );
      expect(result).toEqual(mockData);
    });

    it('should make successful PATCH request', async () => {
      const mockData = { message: 'updated' };
      const patchData = { name: 'updated' };
      mockFetch.mockResolvedValue(createMockFetchResponse(mockData));

      const result = await httpClient.patch('/test', patchData);

      expect(result).toEqual(mockData);
    });

    it('should make successful DELETE request', async () => {
      const mockData = { message: 'deleted' };
      mockFetch.mockResolvedValue(createMockFetchResponse(mockData));

      const result = await httpClient.delete('/test');

      expect(result).toEqual(mockData);
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse),
      });

      await expect(httpClient.get('/test')).rejects.toThrow(AuthSDKError);
    });

    it('should handle HTTP error without API error structure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(httpClient.get('/test')).rejects.toThrow(AuthSDKError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(httpClient.get('/test')).rejects.toThrow();
    });

    it('should not include body for GET requests', async () => {
      mockFetch.mockResolvedValue(createMockFetchResponse({}));

      await httpClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.not.objectContaining({
          body: expect.anything(),
        }),
      );
    });
  });

  describe('withCredentials configuration', () => {
    it('should set credentials to omit when withCredentials is false', () => {
      const client = new HttpClient({
        backendUrl: 'http://localhost:3001',
        withCredentials: false,
      });

      mockFetch.mockResolvedValue(createMockFetchResponse({}));
      client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          credentials: 'omit',
        }),
      );
    });
  });
});
