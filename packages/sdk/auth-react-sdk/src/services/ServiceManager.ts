import { HttpClient } from '../client/HttpClient';
import { SocketClient } from '../client/CustomSocketClient';
import { AuthService } from './AuthService';
import { AccountService } from './AccountService';
import { NotificationService } from './NotificationService';
import { SocketConfig } from '../types';

export class ServiceManager {
  private static instance: ServiceManager | null = null;

  private _authService: AuthService | null = null;
  private _accountService: AccountService | null = null;
  private _notificationService: NotificationService | null = null;
  private _socketClient: SocketClient | null = null;
  private _httpClient: HttpClient | null = null;
  private _socketConfig: SocketConfig | null = null;
  private _initialized: boolean = false;

  // Private constructor to prevent direct instantiation
  private constructor() {}

  // Get the singleton instance
  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  // Initialize services with HttpClient
  public initialize(httpClient: HttpClient, socketConfig?: SocketConfig): void {
    if (this._initialized) {
      console.warn('ServiceManager is already initialized');
      return;
    }

    this._httpClient = httpClient;
    this._socketConfig = socketConfig || null;

    // Initialize core services
    this._authService = new AuthService(httpClient);
    this._accountService = new AccountService(httpClient);
    this._notificationService = new NotificationService(httpClient);

    // Initialize socket client if config provided
    if (socketConfig) {
      this._socketClient = new SocketClient(socketConfig);
    }

    this._initialized = true;

    console.log('ServiceManager initialized successfully');
  }

  // Initialize socket separately (for cases where socket config comes later)
  public initializeSocket(socketConfig: SocketConfig): void {
    if (!this._initialized) {
      throw new Error('ServiceManager must be initialized before adding socket support');
    }

    this._socketConfig = socketConfig;
    this._socketClient = new SocketClient(socketConfig);

    console.log('Socket client initialized successfully');
  }

  // Reinitialize with new HttpClient (useful for config changes)
  public reinitialize(httpClient: HttpClient, socketConfig?: SocketConfig): void {
    // Disconnect existing socket if any
    if (this._socketClient) {
      this._socketClient.disconnect();
    }

    this._httpClient = httpClient;
    this._socketConfig = socketConfig || this._socketConfig;

    // Reinitialize services
    this._authService = new AuthService(httpClient);
    this._accountService = new AccountService(httpClient);
    this._notificationService = new NotificationService(httpClient);

    // Reinitialize socket if config available
    if (this._socketConfig) {
      this._socketClient = new SocketClient(this._socketConfig);
    }

    this._initialized = true;

    console.log('ServiceManager reinitialized successfully');
  }

  // Check if services are initialized
  public isInitialized(): boolean {
    return this._initialized;
  }

  // Get AuthService
  public get authService(): AuthService {
    if (!this._authService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._authService;
  }

  // Get AccountService
  public get accountService(): AccountService {
    if (!this._accountService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._accountService;
  }

  // Get NotificationService
  public get notificationService(): NotificationService {
    if (!this._notificationService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._notificationService;
  }

  // Get SocketClient
  public get socketClient(): SocketClient {
    if (!this._socketClient) {
      throw new Error('Socket client not initialized. Call initializeSocket() first.');
    }
    return this._socketClient;
  }

  // Get HttpClient
  public get httpClient(): HttpClient {
    if (!this._httpClient) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._httpClient;
  }

  // Check if socket is available
  public hasSocketClient(): boolean {
    return this._socketClient !== null;
  }

  // Reset singleton (useful for testing)
  public static reset(): void {
    if (ServiceManager.instance) {
      // Disconnect socket before resetting
      if (ServiceManager.instance._socketClient) {
        ServiceManager.instance._socketClient.disconnect();
      }

      ServiceManager.instance._authService = null;
      ServiceManager.instance._accountService = null;
      ServiceManager.instance._notificationService = null;
      ServiceManager.instance._socketClient = null;
      ServiceManager.instance._httpClient = null;
      ServiceManager.instance._socketConfig = null;
      ServiceManager.instance._initialized = false;
      ServiceManager.instance = null;
    }
  }

  // Get all services at once
  public getServices(): {
    authService: AuthService;
    accountService: AccountService;
    notificationService: NotificationService;
    socketClient?: SocketClient;
  } {
    const services = {
      authService: this.authService,
      accountService: this.accountService,
      notificationService: this.notificationService,
    };

    // Add socket client if available
    if (this._socketClient) {
      return { ...services, socketClient: this._socketClient };
    }

    return services;
  }

  // Check individual service availability
  public hasAuthService(): boolean {
    return this._authService !== null;
  }

  public hasAccountService(): boolean {
    return this._accountService !== null;
  }

  public hasNotificationService(): boolean {
    return this._notificationService !== null;
  }

  // Utility method to ensure all services are available
  public ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }

    if (!this._authService || !this._accountService || !this._notificationService) {
      throw new Error('Some services are not properly initialized.');
    }
  }

  // Utility method to ensure socket is available
  public ensureSocketInitialized(): void {
    this.ensureInitialized();

    if (!this._socketClient) {
      throw new Error('Socket client not initialized. Call initializeSocket() first.');
    }
  }
}
