import React, { createContext, useContext, ReactNode, JSX } from 'react';
import { HttpClient } from '../client/HttpClient';
import { AuthService } from '../services/AuthService';
import { AccountService } from '../services/AccountService';
import { SDKConfig } from '../types';

/**
 * Services interface
 */
export interface Services {
  httpClient: HttpClient;
  authService: AuthService;
  accountService: AccountService;
}

/**
 * Configuration for creating services
 */
export interface ServicesConfig {
  sdkConfig: SDKConfig;
}

/**
 * Create services with proper dependencies
 */
const createServices = (config: ServicesConfig): Services => {
  if (!config.sdkConfig?.backendUrl) {
    throw new Error('SDKConfig with backendUrl is required');
  }

  // Create HTTP client as foundation
  const httpClient = new HttpClient(config.sdkConfig);

  // Create core services that depend on HTTP client
  const authService = new AuthService(httpClient);
  const accountService = new AccountService(httpClient);

  return {
    httpClient,
    authService,
    accountService,
  };
};

/**
 * React Context for services
 */
const ServicesContext = createContext<Services | null>(null);

/**
 * Props for ServicesProvider
 */
interface ServicesProviderProps {
  children: ReactNode;
  config: ServicesConfig;
}

/**
 * Provider component that creates and provides services to the component tree
 */
export const ServicesProvider = ({ children, config }: ServicesProviderProps): JSX.Element | null => {
  const [services] = React.useState(() => createServices(config));

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
};

/**
 * Base hook to get services from context
 * Throws error if used outside of ServicesProvider
 */
const useServices = (): Services => {
  const services = useContext(ServicesContext);

  if (!services) {
    throw new Error(
      'useServices must be used within a ServicesProvider. ' +
        'Make sure to wrap your app with <AuthProvider> and provide the required configuration.',
    );
  }

  return services;
};

/**
 * Individual service hooks
 */
export const useHttpClient = () => {
  const { httpClient } = useServices();
  return httpClient;
};

export const useAuthService = () => {
  const { authService } = useServices();
  return authService;
};

export const useAccountService = () => {
  const { accountService } = useServices();
  return accountService;
};
