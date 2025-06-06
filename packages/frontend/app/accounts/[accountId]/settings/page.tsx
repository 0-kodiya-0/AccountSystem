"use client"

import * as React from "react"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Shield, Key, User, Trash2, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { AccountDropdown } from "@/components/auth/account-dropdown"
import { UserAvatar } from "@/components/auth/user-avatar"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { AuthGuard } from "@/components/auth/auth-guard"
import { useAccount, useAuth } from "@accountsystem/auth-react-sdk"
import { formatAccountName, getEnvironmentConfig } from "@/lib/utils"

export default function AccountSettingsPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const accountId = params.accountId as string

    // Use useAccount hook to get account data
    const { account, isLoading, error, refresh } = useAccount(accountId, {
        autoFetch: true,
        refreshOnMount: true // Force refresh on mount for settings page
    })

    const { removeAccount } = useAuth()
    const config = getEnvironmentConfig()

    const [deleteConfirm, setDeleteConfirm] = useState(false)

    // Show loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Loading account settings...</p>
                </div>
            </div>
        )
    }

    // Show error state
    if (error || !account) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Account not found</h1>
                    <p className="text-muted-foreground">
                        {error || "Unable to load account data"}
                    </p>
                    <div className="space-x-2">
                        <Button onClick={() => refresh()} variant="outline">
                            Try Again
                        </Button>
                        <Button onClick={() => router.push("/accounts")}>
                            Back to Accounts
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const displayName = formatAccountName(
        account.userDetails.firstName,
        account.userDetails.lastName,
        account.userDetails.name
    )

    const handleDeleteAccount = async () => {
        if (!deleteConfirm) {
            setDeleteConfirm(true)
            return
        }

        try {
            await removeAccount(accountId)
            toast({
                title: "Account removed",
                description: "Your account has been removed from this device.",
                variant: "success",
            })
            router.push("/accounts")
        } catch (error: unknown) {
            toast({
                title: "Failed to remove account",
                description: error instanceof Error ? error.message : "Please try again.",
                variant: "destructive",
            })
        }
    }

    const handleDownloadData = () => {
        // Create account data export
        const accountData = {
            name: displayName,
            email: account.userDetails.email,
            accountType: account.accountType,
            provider: account.provider,
            twoFactorEnabled: account.security.twoFactorEnabled,
            created: account.created,
            exportedAt: new Date().toISOString(),
        }

        const blob = new Blob([JSON.stringify(accountData, null, 2)], {
            type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `account-data-${accountId}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast({
            title: "Data exported",
            description: "Your account data has been downloaded.",
            variant: "success",
        })
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                <main className="container mx-auto px-4 py-8 max-w-4xl">
                    <div className="space-y-8">
                        {/* Page Header */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold">Account Settings</h1>
                            <p className="text-muted-foreground">
                                Manage your account information and security settings
                            </p>
                        </div>

                        {/* Account Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <User className="h-5 w-5" />
                                    <span>Account Information</span>
                                </CardTitle>
                                <CardDescription>
                                    View your account details and type
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start space-x-4">
                                    <UserAvatar
                                        name={displayName}
                                        imageUrl={account.userDetails.imageUrl}
                                        size="lg"
                                    />
                                    <div className="flex-1 space-y-2">
                                        <div>
                                            <h3 className="text-lg font-medium">{displayName}</h3>
                                            <p className="text-muted-foreground">{account.userDetails.email}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Badge variant={account.accountType === "oauth" ? "default" : "secondary"}>
                                                {account.accountType === "oauth" ? `${account.provider} Account` : "Local Account"}
                                            </Badge>
                                            {account.security.twoFactorEnabled && (
                                                <Badge variant="outline" className="text-green-600">
                                                    <Shield className="w-3 h-3 mr-1" />
                                                    2FA Enabled
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    <div>
                                        <p className="text-sm font-medium">Account Created</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(account.created).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Last Updated</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(account.updated).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Security Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Shield className="h-5 w-5" />
                                    <span>Security Settings</span>
                                </CardTitle>
                                <CardDescription>
                                    Manage your account security and authentication
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Two-Factor Authentication */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-1">
                                        <h4 className="font-medium">Two-Factor Authentication</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {account.security.twoFactorEnabled
                                                ? "Your account is protected with 2FA"
                                                : "Add an extra layer of security to your account"
                                            }
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {account.security.twoFactorEnabled && (
                                            <Badge variant="outline" className="text-green-600">
                                                <Shield className="w-3 h-3 mr-1" />
                                                Enabled
                                            </Badge>
                                        )}
                                        <Button
                                            variant={account.security.twoFactorEnabled ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => router.push(`/accounts/${accountId}/two-factor`)}
                                        >
                                            {account.security.twoFactorEnabled ? "Manage" : "Enable"} 2FA
                                        </Button>
                                    </div>
                                </div>

                                {/* Password Change (Local accounts only) */}
                                {account.accountType === "local" && (
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-1">
                                            <h4 className="font-medium">Password</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Change your account password
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`/accounts/${accountId}/change-password`)}
                                        >
                                            <Key className="w-4 h-4 mr-2" />
                                            Change Password
                                        </Button>
                                    </div>
                                )}

                                {/* Session Timeout */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-1">
                                        <h4 className="font-medium">Session Timeout</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Sessions expire after {Math.floor(account.security.sessionTimeout / 60)} minutes of inactivity
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {Math.floor(account.security.sessionTimeout / 60)}m
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Data Management */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Data Management</CardTitle>
                                <CardDescription>
                                    Export or delete your account data
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Export Data */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-1">
                                        <h4 className="font-medium">Export Account Data</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Download a copy of your account information
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownloadData}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Export Data
                                    </Button>
                                </div>

                                {/* Delete Account */}
                                <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                                    <div className="space-y-1">
                                        <h4 className="font-medium text-destructive">Remove Account</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {deleteConfirm
                                                ? "This will remove the account from this device only. Click again to confirm."
                                                : "Remove this account from this device (does not delete the account)"
                                            }
                                        </p>
                                    </div>
                                    <Button
                                        variant={deleteConfirm ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={handleDeleteAccount}
                                        onBlur={() => setTimeout(() => setDeleteConfirm(false), 3000)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {deleteConfirm ? "Confirm Remove" : "Remove Account"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                                <CardDescription>
                                    Common account management tasks
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-auto p-4 justify-start"
                                        onClick={() => router.push("/accounts")}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">Switch Account</div>
                                            <div className="text-sm text-muted-foreground">
                                                Manage multiple accounts
                                            </div>
                                        </div>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-auto p-4 justify-start"
                                        onClick={() => {
                                            const homeUrl = config.homeUrl || "/dashboard"
                                            router.push(homeUrl)
                                        }}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">Back to App</div>
                                            <div className="text-sm text-muted-foreground">
                                                Return to main application
                                            </div>
                                        </div>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}