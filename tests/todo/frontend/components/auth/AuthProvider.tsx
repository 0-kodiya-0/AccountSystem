'use client';

import React from 'react';
import { ServicesProvider } from '../../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name
import authConfig from '@/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <ServicesProvider
      config={{
        sdkConfig: authConfig,
      }}
    >
      {children}
    </ServicesProvider>
  );
}

export default AuthProvider;
