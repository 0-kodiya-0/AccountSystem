"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useAccount, useAccountStore } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

export default function AuthRedirect() {
    const router = useRouter()

    const hasActiveAccounts = useAccountStore(state => state.hasActiveAccounts);

    const {
        isAuthenticated,
        currentAccount: currentAccountFromStore,
        isLoading: authLoading
    } = useAuth()

    const config = getEnvironmentConfig()

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

        if (isAuthenticated && hasActiveAccounts()) {
            if (currentAccountFromStore) {
                if (currentAccount) {
                    // User is fully authenticated with account data, redirect to home
                    const redirectUrl = config.homeUrl || "/dashboard"
                    router.replace(redirectUrl)
                } else if (!accountLoading) {
                    // Account ID exists but failed to load data, go to account selection
                    router.replace("/accounts")
                }
                // If still loading account data, wait
            } else {
                // Has accounts but no current account selected, go to account selection
                router.replace("/accounts")
            }
        } else if (hasActiveAccounts()) {
            // User has accounts but none currently active, go to account selection
            router.replace("/accounts")
        } else {
            // No authentication, redirect to login
            router.replace("/login")
        }
    }, [
        isAuthenticated,
        currentAccountFromStore,
        currentAccount,
        isLoading,
        accountLoading,
        router,
        config.homeUrl
    ])

    // Show loading spinner while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    )
}