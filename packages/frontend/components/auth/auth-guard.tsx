"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useAccount } from "@accountsystem/auth-react-sdk"

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  requireAccount?: boolean
}

export function AuthGuard({
  children,
  fallback = null,
  requireAccount = true
}: AuthGuardProps) {
  const router = useRouter();

  const {
    isAuthenticated,
    currentAccount: currentAccountFromStore,
    isLoading: authLoading,
    accounts
  } = useAuth()

  // Use useAccount hook to get current account data if we have an account ID
  const { account: currentAccount, isLoading: accountLoading } = useAccount(
    currentAccountFromStore?.id,
    {
      autoFetch: true,
      refreshOnMount: false
    }
  )

  const isLoading = authLoading || (currentAccountFromStore && accountLoading)

  useEffect(() => {
    if (isLoading) return // Wait for auth state to load

    if (!isAuthenticated || accounts.length === 0) {
      // No authentication or accounts, redirect to login
      router.replace("/login")
      return
    }

    if (requireAccount) {
      if (!currentAccountFromStore) {
        // Authentication exists but no current account selected
        router.replace("/accounts")
        return
      }

      if (!currentAccount && !accountLoading) {
        // Account ID exists but failed to load account data
        router.replace("/accounts")
        return
      }
    }
  }, [
    isAuthenticated,
    currentAccountFromStore,
    currentAccount,
    isLoading,
    accountLoading,
    requireAccount,
    accounts.length,
    router
  ])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show fallback while redirecting or if auth fails
  if (
    !isAuthenticated ||
    accounts.length === 0 ||
    (requireAccount && (!currentAccountFromStore || (!currentAccount && !accountLoading)))
  ) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Auth check passed, render children
  return <>{children}</>
}