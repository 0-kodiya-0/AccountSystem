'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, useAccount } from '../../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name
import { authApi, ApiError } from '@/lib/api';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Alert,
  AlertDescription,
} from '@/components/ui';
import AuthStatus from '@/components/auth/AuthStatus';
import { ArrowLeft, Shield, TestTube, Mail, Key, User, Users, Activity, Wifi, ExternalLink } from 'lucide-react';

export default function AuthPage() {
  const session = useSession();
  const account = useAccount();

  // Test states
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testLoading, setTestLoading] = useState<Set<string>>(new Set());
  const [testInputs, setTestInputs] = useState({
    accountId: '',
    email: '',
    token: '',
    tokenType: 'access' as 'access' | 'refresh',
  });

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    try {
      setTestLoading((prev) => new Set(prev).add(testName));
      setTestResults((prev) => ({ ...prev, [testName]: null }));

      const result = await testFn();
      setTestResults((prev) => ({
        ...prev,
        [testName]: {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
      setTestResults((prev) => ({
        ...prev,
        [testName]: {
          success: false,
          error: error instanceof ApiError ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setTestLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(testName);
        return newSet;
      });
    }
  };

  const isTestLoading = (testName: string) => testLoading.has(testName);
  const getTestResult = (testName: string) => testResults[testName];

  const TestButton = ({
    testName,
    onClick,
    icon: Icon,
    disabled = false,
  }: {
    testName: string;
    onClick: () => void;
    icon: any;
    disabled?: boolean;
  }) => {
    const loading = isTestLoading(testName);
    const result = getTestResult(testName);

    return (
      <div className="space-y-2">
        <Button
          onClick={onClick}
          disabled={disabled || loading}
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Icon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {testName}
        </Button>

        {result && (
          <div
            className={`text-xs p-2 rounded border ${
              result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="font-medium mb-1">{result.success ? '✅ Success' : '❌ Failed'}</div>
            {result.error && <div>Error: {result.error}</div>}
            {result.data && (
              <details className="mt-1">
                <summary className="cursor-pointer">View Data</summary>
                <pre className="mt-1 text-xs overflow-auto max-h-32">{JSON.stringify(result.data, null, 2)}</pre>
              </details>
            )}
            <div className="text-xs mt-1 opacity-70">{new Date(result.timestamp).toLocaleTimeString()}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold">Authentication Testing</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-muted-foreground">Comprehensive testing interface for authentication SDK features</p>
        </header>

        {/* Current Auth Status */}
        <div className="mb-8">
          <AuthStatus />
        </div>

        {/* Test Categories */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Basic Auth Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Basic Authentication Tests
              </CardTitle>
              <CardDescription>Test basic authentication and status endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TestButton
                testName="Get Auth Status"
                onClick={() => runTest('auth-status', authApi.getStatus)}
                icon={Shield}
              />

              <TestButton
                testName="Get Current User"
                onClick={() => runTest('current-user', authApi.getMe)}
                icon={User}
                disabled={!session.isAuthenticated}
              />

              <TestButton
                testName="Get Session Info"
                onClick={() => runTest('session-info', authApi.getSession)}
                icon={Users}
                disabled={!session.isAuthenticated}
              />

              <TestButton
                testName="Check Auth Service Health"
                onClick={() => runTest('health-check', authApi.getHealth)}
                icon={Activity}
              />

              <TestButton
                testName="Check Socket Status"
                onClick={() => runTest('socket-status', authApi.getSocketStatus)}
                icon={Wifi}
              />
            </CardContent>
          </Card>

          {/* Permission Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Permission Tests
              </CardTitle>
              <CardDescription>Test different permission requirements and validations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TestButton
                testName="Test Email Verified Requirement"
                onClick={() => runTest('email-verified', authApi.testEmailVerified)}
                icon={Mail}
                disabled={!session.isAuthenticated}
              />

              <TestButton
                testName="Test OAuth Account Requirement"
                onClick={() => runTest('oauth-only', authApi.testOAuthOnly)}
                icon={Shield}
                disabled={!session.isAuthenticated}
              />

              <TestButton
                testName="Test Local Account Requirement"
                onClick={() => runTest('local-only', authApi.testLocalOnly)}
                icon={User}
                disabled={!session.isAuthenticated}
              />
            </CardContent>
          </Card>

          {/* Advanced Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Advanced API Tests
              </CardTitle>
              <CardDescription>Test advanced features with custom inputs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account ID Validation */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Account ID Validation:</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Account ID"
                    value={testInputs.accountId}
                    onChange={(e) => setTestInputs((prev) => ({ ...prev, accountId: e.target.value }))}
                    className="text-sm"
                  />
                  <Button
                    onClick={() => runTest('validate-account', () => authApi.validateAccount(testInputs.accountId))}
                    disabled={!testInputs.accountId || !session.isAuthenticated}
                    size="sm"
                  >
                    Test
                  </Button>
                </div>
              </div>

              {/* User Lookup by Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">User Lookup by Email:</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Email address"
                    value={testInputs.email}
                    onChange={(e) => setTestInputs((prev) => ({ ...prev, email: e.target.value }))}
                    className="text-sm"
                  />
                  <Button
                    onClick={() => runTest('user-by-email', () => authApi.getUserByEmail(testInputs.email))}
                    disabled={!testInputs.email || !session.isAuthenticated}
                    size="sm"
                  >
                    Test
                  </Button>
                </div>
              </div>

              {/* Current User Lookup */}
              {account.data && (
                <TestButton
                  testName={`Get User by ID (${account.data.id.slice(0, 8)}...)`}
                  onClick={() => runTest('user-by-id', () => authApi.getUserById(account.data!.id))}
                  icon={User}
                  disabled={!session.isAuthenticated}
                />
              )}
            </CardContent>
          </Card>

          {/* Token Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Token Testing
              </CardTitle>
              <CardDescription>Test token validation with custom tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Token to Validate:</label>
                <Input
                  placeholder="Enter token (or leave empty to test current)"
                  value={testInputs.token}
                  onChange={(e) => setTestInputs((prev) => ({ ...prev, token: e.target.value }))}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Token Type:</label>
                <select
                  value={testInputs.tokenType}
                  onChange={(e) => setTestInputs((prev) => ({ ...prev, tokenType: e.target.value as any }))}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="access">Access Token</option>
                  <option value="refresh">Refresh Token</option>
                </select>
              </div>

              <Button
                onClick={() =>
                  runTest('validate-token', () =>
                    authApi.validateToken(testInputs.token || 'current', testInputs.tokenType),
                  )
                }
                disabled={!session.isAuthenticated}
                className="w-full"
                size="sm"
              >
                Validate Token
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
            <CardDescription>How to effectively test the authentication SDK</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Getting Started:</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>
                    First, authenticate through the external auth service (use the "Login" button on the home page)
                  </li>
                  <li>Return to this page to see your authentication status</li>
                  <li>Run basic tests to verify the SDK is working correctly</li>
                  <li>Try permission tests to see how different account types and statuses affect access</li>
                </ol>
              </div>

              <div>
                <h4 className="font-medium mb-2">Test Categories:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>
                    <strong>Basic Tests:</strong> Core authentication status and health checks
                  </li>
                  <li>
                    <strong>Permission Tests:</strong> Account type requirements and email verification
                  </li>
                  <li>
                    <strong>Advanced Tests:</strong> Account validation and user lookups
                  </li>
                  <li>
                    <strong>Token Tests:</strong> Token validation and inspection
                  </li>
                </ul>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Note:</strong> Some tests require authentication and will be disabled if you're not logged in.
                  Permission tests may fail based on your account type and verification status - this is expected
                  behavior.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
