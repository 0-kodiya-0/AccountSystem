import { ApiErrorCode, AuthSDKError, SDKConfig } from '../types';

export class HttpClient {
  private baseURL: string;
  private timeout: number;
  private proxyPath: string;
  private withCredentials: boolean;

  constructor(config: SDKConfig) {
    this.proxyPath = config.backendProxyUrl || '';

    this.baseURL = config.backendProxyUrl ? `${config.backendUrl}${config.backendProxyUrl}` : config.backendUrl;
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

    const result = await response.json();

    if (!response.ok) {
      if (result.error) {
        throw new AuthSDKError(result.error?.message || 'API error', result.error?.code || ApiErrorCode.SERVER_ERROR);
      }
      throw new AuthSDKError(
        `HTTP ${response.status}: ${response.statusText}`,
        ApiErrorCode.NETWORK_ERROR,
        response.status,
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

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('DELETE', endpoint, data);
  }
}
