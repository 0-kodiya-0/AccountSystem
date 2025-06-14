import React, { JSX, ReactNode, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/AuthService';
import { AccountService } from '../services/AccountService';
import { NotificationService } from '../services/NotificationService';
import { HttpClient } from '../client/HttpClient';

interface AuthProviderProps {
  children: ReactNode;
  httpClient: HttpClient;
}

export const AuthProvider = ({ children, httpClient }: AuthProviderProps): JSX.Element | null => {
  const { _setServices, initializeSession } = useAppStore();

  useEffect(() => {
    console.log('AuthProvider effect running');
    const authService = new AuthService(httpClient);
    const accountService = new AccountService(httpClient);
    const notificationService = new NotificationService(httpClient);

    _setServices({
      authService,
      accountService,
      notificationService,
    });

    initializeSession();
  }, [httpClient, _setServices, initializeSession]);

  return <>{children}</>;
};
