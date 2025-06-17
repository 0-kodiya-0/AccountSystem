'use client';

import React from 'react';
import { ServicesProvider } from '../../../sdk/auth-react-sdk/src';
import { authClient } from '@/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <ServicesProvider
      config={{
        sdkConfig: {
          backendUrl: authClient.getRedirectBaseUrl(),
          timeout: 30000,
          withCredentials: true,
        },
      }}
    >
      {children}
    </ServicesProvider>
  );
}
