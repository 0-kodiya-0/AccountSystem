import { AuthSDKError, ErrorCode, SDKConfig } from '../types';

export class HttpClient {
  private baseURL: string;
  private timeout: number;
  private proxyPath: string;
  private withCredentials: boolean;

  constructor(config: SDKConfig) {
    this.proxyPath = config.proxyPath || '';

    this.baseURL = config.proxyPath
      ? `${config.backendUrl}${config.proxyPath}`
      : config.backendUrl;
    this.timeout = config.timeout || 30000;
    this.withCredentials = config.withCredentials !== false;
  }

  async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: this.withCredentials ? 'include' : 'omit',
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new AuthSDKError(
        `HTTP ${response.status}: ${response.statusText}`,
        ErrorCode.NETWORK_ERROR,
        response.status,
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new AuthSDKError(
        result.error?.message || 'API error',
        result.error?.code || ErrorCode.SERVER_ERROR,
      );
    }

    return result.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  /**
   * Get the redirect URL for OAuth and token operations
   * Uses proxyPath if provided, otherwise uses baseURL
   */
  getRedirectBaseUrl(): string {
    if (this.proxyPath) {
      // Use current origin + proxy path
      return `${window.location.origin}${this.proxyPath}`;
    }
    // Fall back to configured baseURL
    return window.location.origin;
  }
}
