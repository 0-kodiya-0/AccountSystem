'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from '../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { CheckSquare, Shield, Users, Settings, ExternalLink, LogIn, UserPlus } from 'lucide-react';
import { routes } from '@/lib/auth';

export default function HomePage() {
  const session = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CheckSquare className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Todo App</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">A comprehensive authentication SDK testing application</p>
          <Badge variant="outline" className="text-sm">
            Auth SDK Test Environment
          </Badge>
        </header>

        {/* Authentication Status */}
        <div className="max-w-4xl mx-auto mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Authentication Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.isLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Checking authentication...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={session.isAuthenticated ? 'default' : 'destructive'}>
                      {session.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                    </Badge>
                  </div>

                  {session.isAuthenticated && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Account Selected:</span>
                        <Badge variant={session.hasAccount ? 'default' : 'secondary'}>
                          {session.hasAccount ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total Accounts:</span>
                        <span>{session.accountIds.length}</span>
                      </div>
                    </>
                  )}

                  {session.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">{session.error}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Todo Dashboard */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-green-600" />
                Todo Dashboard
              </CardTitle>
              <CardDescription>Manage your todos with full authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Access the protected todo management interface. Requires authentication.
                </p>
                <Link href="/dashboard">
                  <Button className="w-full">{session.isAuthenticated ? 'Open Dashboard' : 'Login Required'}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Auth Testing */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Auth Testing
              </CardTitle>
              <CardDescription>Test SDK features and authentication methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Comprehensive testing interface for all authentication features.
                </p>
                <Link href="/auth">
                  <Button variant="outline" className="w-full">
                    View Auth Status
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* External Auth Service */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Authentication
              </CardTitle>
              <CardDescription>Access the external authentication service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Login, signup, or manage your account through the auth service.
                </p>
                <div className="space-y-2">
                  <a href={routes.login} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full" size="sm">
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                  </a>
                  <a href={routes.signup} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full" size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Sign Up
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                SDK Features Being Tested
              </CardTitle>
              <CardDescription>This application tests all major authentication SDK features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Frontend SDK (React)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Session management with useSession</li>
                    <li>• Account data with useAccount</li>
                    <li>• AuthGuard for route protection</li>
                    <li>• Automatic token handling</li>
                    <li>• Loading and error states</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Backend SDK (Node.js)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Authentication middleware</li>
                    <li>• Token verification (HTTP/Socket)</li>
                    <li>• User data loading</li>
                    <li>• Permission checking</li>
                    <li>• Session validation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 text-sm text-muted-foreground">
          <p>Todo App - Authentication SDK Testing Environment</p>
          <p className="mt-2">
            Backend: {process.env.NEXT_PUBLIC_BACKEND_URL} | Auth Service: {process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}
          </p>
        </footer>
      </div>
    </div>
  );
}
