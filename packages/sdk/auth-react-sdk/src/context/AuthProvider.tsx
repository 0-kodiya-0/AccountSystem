import React, { JSX, ReactNode, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { HttpClient } from '../client/HttpClient';

interface AuthProviderProps {
  children: ReactNode;
  httpClient: HttpClient;
}

export const AuthProvider = ({ children, httpClient }: AuthProviderProps): JSX.Element | null => {
  const { initializeSession } = useAppStore();

  useEffect(() => {
    console.log('AuthProvider effect running');

    // Initialize ServiceManager with HttpClient
    const serviceManager = ServiceManager.getInstance();
    serviceManager.initialize(httpClient);

    // Initialize session after services are ready
    initializeSession();
  }, []);

  return <>{children}</>;
};
