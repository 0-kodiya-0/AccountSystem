import React, { ReactNode } from 'react';
import { ServicesProvider } from '../hooks/core/useServices';
import { HttpClient } from '../client/HttpClient';

// Define the props interface
interface AuthProviderProps {
  children: ReactNode;
  httpClient: HttpClient;
  autoLoadSession?: boolean;
}

/**
 * Main AuthProvider component that wraps the entire authentication system
 *
 * This provider sets up:
 * - Services layer (HTTP client, auth service, account service, etc.)
 * - Global state management via Zustand store
 * - Makes all auth hooks available to child components
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  httpClient,
}) => {
  return (
    <ServicesProvider httpClient={httpClient}>{children}</ServicesProvider>
  );
};
