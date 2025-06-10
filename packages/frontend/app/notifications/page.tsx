"use client"

import * as React from "react"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { AccountDropdown } from "@/components/auth/account-dropdown"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { AuthGuard, NotificationsProvider } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"
import { LoadingSpinner } from "@/components/auth/loading-spinner"
import { RedirectingSpinner } from "@/components/auth/redirecting-spinner"
import { socketConfig } from "@/lib/auth"

export default function NotificationsPage() {
    const router = useRouter()
    const config = getEnvironmentConfig()

    return (
        <AuthGuard
            requireAccount={true}
            loadingComponent={LoadingSpinner}
            redirectingComponent={RedirectingSpinner}
        >
            <NotificationsProvider
                socketConfig={socketConfig}
                autoSubscribe={true}
                enableSound={true}
                enableBrowserNotifications={true}
            >
                <div className="min-h-screen bg-background">
                    {/* Header */}
                    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                        <div className="container mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => router.back()}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                            <span className="text-white font-bold text-lg">A</span>
                                        </div>
                                        <span className="text-xl font-bold">{config.appName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <ThemeToggle />
                                    <AccountDropdown />
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className="container mx-auto px-4 py-8">
                        <NotificationCenter />
                    </main>
                </div>
            </NotificationsProvider>
        </AuthGuard>
    )
}