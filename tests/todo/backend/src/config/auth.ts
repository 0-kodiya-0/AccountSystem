import {
  InternalHttpClient,
  InternalSocketClient,
  InternalApiSdk,
} from '../../../../../packages/sdk/auth-node-sdk/src';
import type { AuthConfig } from '@/types';

// Load configuration from environment variables
const authConfig: AuthConfig = {
  baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:7000/api/v1/account/internal',
  serviceId: process.env.AUTH_SERVICE_ID || 'todo-app-service',
  serviceName: process.env.AUTH_SERVICE_NAME || 'Todo App Backend',
  serviceSecret: process.env.AUTH_SERVICE_SECRET || 'your-service-secret-here',
  accountServerBaseUrl: process.env.ACCOUNT_SERVER_URL || 'http://localhost:7000/api/v1/account/internal',
  enableLogging: process.env.NODE_ENV === 'development',
  timeout: 30000,
  preferSocket: process.env.PREFER_SOCKET === 'true',
  maxReconnectAttempts: 5,
};

// Validate required configuration
const requiredConfig: (keyof AuthConfig)[] = ['baseUrl', 'serviceId', 'serviceSecret'];
for (const key of requiredConfig) {
  if (!authConfig[key]) {
    throw new Error(`Missing required auth configuration: ${key}`);
  }
}

// Create HTTP client
const httpClient = new InternalHttpClient({
  baseUrl: authConfig.baseUrl,
  serviceId: authConfig.serviceId,
  serviceSecret: authConfig.serviceSecret,
  timeout: authConfig.timeout,
  enableLogging: authConfig.enableLogging,
});

// Create Socket client (optional)
let socketClient: InternalSocketClient | undefined = undefined;
if (authConfig.preferSocket) {
  try {
    socketClient = new InternalSocketClient({
      baseUrl: authConfig.baseUrl,
      serviceId: authConfig.serviceId,
      serviceName: authConfig.serviceName,
      serviceSecret: authConfig.serviceSecret,
      enableLogging: authConfig.enableLogging,
      autoConnect: true,
      maxReconnectAttempts: authConfig.maxReconnectAttempts,
    });

    // Connect socket on startup if preferred
    socketClient.connect().catch((err: Error) => {
      console.warn('Failed to connect to auth service via socket, falling back to HTTP:', err.message);
    });
  } catch (error) {
    console.warn('Failed to initialize socket client, using HTTP only:', (error as Error).message);
  }
}

// Create main SDK instance
const authSdk = new InternalApiSdk({
  httpClient,
  socketClient,
  enableLogging: authConfig.enableLogging,
  preferSocket: authConfig.preferSocket,
  accountServerBaseUrl: authConfig.accountServerBaseUrl,
});

// Test connection on startup
async function testConnection(): Promise<void> {
  try {
    console.log('🔗 Testing connection to auth service...');
    const health = await httpClient.healthCheck();
    console.log('✅ Auth service connection successful:', health.status);

    if (socketClient?.isConnected()) {
      console.log('🔌 Socket connection to auth service established');
    }
  } catch (error) {
    console.error('❌ Failed to connect to auth service:', (error as Error).message);
    console.error('Please ensure the auth service is running and configuration is correct');
  }
}

// Test connection with a small delay to allow server startup
setTimeout(testConnection, 1000);

export { authSdk, httpClient, socketClient, authConfig };
