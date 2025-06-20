import { InternalHttpClient } from '../client/auth-client';
import { InternalSocketClient } from '../client/socket-client';
import { InternalApiSdk, InternalApiSdkConfig } from '../middleware/auth-middleware';
import { InternalHttpClientConfig, InternalSocketClientConfig } from '../types';

export function createHttpClient(config: InternalHttpClientConfig): InternalHttpClient {
  return new InternalHttpClient(config);
}

export function createSocketClient(config: InternalSocketClientConfig): InternalSocketClient {
  return new InternalSocketClient(config);
}

export function createInternalApiSdk(config: InternalApiSdkConfig): InternalApiSdk {
  return new InternalApiSdk(config);
}
