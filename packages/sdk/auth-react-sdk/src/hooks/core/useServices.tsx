import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { AuthService } from '../../services/AuthService';
import { AccountService } from '../../services/AccountService';
import { NotificationService } from '../../services/NotificationService';
import { HttpClient } from '../../client/HttpClient';
import { GoogleService } from '../../services/GoogleService';

// Define the services interface
interface Services {
  authService: AuthService;
  accountService: AccountService;
  notificationService: NotificationService;
  googleService: GoogleService;
}

// Create the context with proper typing
const ServicesContext = createContext<Services | null>(null);

// Define the provider props interface
interface ServicesProviderProps {
  children: ReactNode;
  httpClient: HttpClient;
}

// Services Provider component
export const ServicesProvider: React.FC<ServicesProviderProps> = ({
  children,
  httpClient,
}) => {
  // Memoize services to prevent recreation on every render
  const services = useMemo(
    () => ({
      authService: new AuthService(httpClient),
      accountService: new AccountService(httpClient),
      googleService: new GoogleService(httpClient),
      notificationService: new NotificationService(httpClient),
    }),
    [httpClient],
  );

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
};

// Hook to use services
export const useServices = (): Services => {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServicesProvider');
  }
  return context;
};
