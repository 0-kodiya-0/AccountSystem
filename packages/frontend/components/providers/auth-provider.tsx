'use client';

import React from 'react';
import { ServicesProvider } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';

const config = getEnvironmentConfig();

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <ServicesProvider
      config={{
        sdkConfig: {
          backendUrl: `${config.backendUrl}${config.proxyPath}`,
          timeout: 30000,
          withCredentials: true,
        },
      }}
    >
      {children}
    </ServicesProvider>
  );
}
