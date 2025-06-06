"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

export default function DashboardPage() {
    const router = useRouter()
    const { currentAccount, isAuthenticated, hasActiveAccounts } = useAuth()
    const config = getEnvironmentConfig()

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

        // If no current account, redirect to account selection
        if (!currentAccount) {
            router.replace("/accounts")
            return
        }
    }, [isAuthenticated, hasActiveAccounts, currentAccount, config.homeUrl, router])

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

                    {currentAccount && (
                        <div className="bg-card border rounded-lg p-6 max-w-md mx-auto">
                            <h2 className="text-lg font-semibold mb-4">Current Account</h2>
                            <div className="space-y-2 text-sm">
                                <p><strong>Name:</strong> {currentAccount.userDetails.name}</p>
                                <p><strong>Email:</strong> {currentAccount.userDetails.email}</p>
                                <p><strong>Type:</strong> {currentAccount.accountType}</p>
                                {currentAccount.provider && (
                                    <p><strong>Provider:</strong> {currentAccount.provider}</p>
                                )}
                            </div>
                        </div>
                    )}

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