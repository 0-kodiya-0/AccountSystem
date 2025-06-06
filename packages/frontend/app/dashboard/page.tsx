"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useAccount, useAccountStore } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

export default function DashboardPage() {
    const router = useRouter()

    const hasActiveAccounts = useAccountStore(state => state.hasActiveAccounts);

    const {
        isAuthenticated,
        currentAccount: currentAccountFromStore
    } = useAuth()

    const config = getEnvironmentConfig()

    // Use useAccount hook to get current account data
    const { account: currentAccount, isLoading: accountLoading } = useAccount(
        currentAccountFromStore?.id,
        {
            autoFetch: true,
            refreshOnMount: false
        }
    )

    useEffect(() => {
        // If home URL is configured and different from dashboard, redirect there
        if (config.homeUrl && config.homeUrl !== "/dashboard") {
            router.replace(config.homeUrl)
            return
        }

        // If not authenticated, redirect to login
        if (!isAuthenticated || !hasActiveAccounts()) {
            router.replace("/login")
            return
        }

        // If no current account ID, redirect to account selection
        if (!currentAccountFromStore) {
            router.replace("/accounts")
            return
        }

        // If account failed to load and we're not loading, redirect to accounts
        if (!currentAccount && !accountLoading) {
            router.replace("/accounts")
            return
        }
    }, [
        isAuthenticated,
        currentAccountFromStore,
        currentAccount,
        accountLoading,
        config.homeUrl,
        router
    ])

    // Show loading state while account data is being fetched
    if (accountLoading || !currentAccount) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold text-foreground">
                            Welcome to {config.appName}
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Authentication service dashboard
                        </p>
                    </div>

                    <div className="bg-card border rounded-lg p-6 max-w-md mx-auto">
                        <h2 className="text-lg font-semibold mb-4">Current Account</h2>
                        <div className="space-y-2 text-sm">
                            <p><strong>Name:</strong> {currentAccount.userDetails.name}</p>
                            <p><strong>Email:</strong> {currentAccount.userDetails.email}</p>
                            <p><strong>Type:</strong> {currentAccount.accountType}</p>
                            {currentAccount.provider && (
                                <p><strong>Provider:</strong> {currentAccount.provider}</p>
                            )}
                            <p><strong>2FA:</strong> {currentAccount.security.twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
                            <p><strong>Created:</strong> {new Date(currentAccount.created).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="text-muted-foreground">
                        <p>
                            This is the default dashboard page for {config.appName}.
                            <br />
                            Configure <code>NEXT_PUBLIC_HOME_URL</code> to redirect users to your application.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}