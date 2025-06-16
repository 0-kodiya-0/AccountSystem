import React, { JSX, ReactNode, useEffect } from 'react';
import { ServicesProvider, ServicesConfig } from './ServicesProvider';
import { useAuth } from '../hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
  config: ServicesConfig;
}

/**
 * Main AuthProvider that sets up services and initializes the session
 * This is the single entry point for the SDK
 */
export const AuthProvider = ({ children, config }: AuthProviderProps): JSX.Element => {
  return (
    <ServicesProvider config={config}>
      <SessionInitializer>{children}</SessionInitializer>
    </ServicesProvider>
  );
};

/**
 * Internal component that initializes the session after services are available
 */
const SessionInitializer = ({ children }: { children: ReactNode }): JSX.Element => {
  const { initializeSession } = useAuth();

  useEffect(() => {
    console.log('AuthProvider: Services available, initializing session');

    // Services are guaranteed to be available here due to context
    // useAuth will handle all service interactions
    initializeSession().catch((error) => {
      console.error('Failed to initialize session:', error);
    });
  }, [initializeSession]);

  return <>{children}</>;
};
