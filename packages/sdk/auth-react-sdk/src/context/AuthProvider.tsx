import React, { JSX, ReactNode, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/AuthService';
import { AccountService } from '../services/AccountService';
import { NotificationService } from '../services/NotificationService';
import { GoogleService } from '../services/GoogleService';
import { HttpClient } from '../client/HttpClient';

interface AuthProviderProps {
  children: ReactNode;
  httpClient: HttpClient;
}

export const AuthProvider = ({ children, httpClient }: AuthProviderProps): JSX.Element | null => {
  const { _setServices, initializeSession } = useAppStore();

  useEffect(() => {
    const authService = new AuthService(httpClient);
    const accountService = new AccountService(httpClient);
    const notificationService = new NotificationService(httpClient);
    const googleService = new GoogleService(httpClient);

    _setServices({
      authService,
      accountService,
      notificationService,
      googleService,
    });

    initializeSession();
  }, [httpClient, _setServices, initializeSession]);

  return <>{children}</>;
};
