"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Settings, LogOut, User, Shield, Chrome, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { UserAvatar } from "@/components/auth/user-avatar"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useAccountSwitcher, useAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig, formatAccountName } from "@/lib/utils"

export default function AccountSelectionPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [switchingTo, setSwitchingTo] = useState<string | null>(null)
    const [actioningAccount, setActioningAccount] = useState<string | null>(null)

    const {
        accounts,
        allAccounts,
        disabledAccounts,
        switchTo,
        logoutAccount,
        reactivateAccount,
        permanentlyRemoveAccount,
        switching,
        hasActiveAccounts,
        hasDisabledAccounts,
    } = useAccountSwitcher()

    const { startOAuthSignup, startOAuthSignin } = useAuth()
    const config = getEnvironmentConfig()

    const handleSwitchAccount = async (accountId: string) => {
        try {
            setSwitchingTo(accountId)
            await switchTo(accountId)

            toast({
                title: "Account switched successfully",
                description: "You are now signed in to your account.",
                variant: "success",
            })

            // Redirect to home after successful switch
            const redirectUrl = config.homeUrl || "/dashboard"
            router.push(redirectUrl)

        } catch (error: any) {
            toast({
                title: "Failed to switch account",
                description: error.message || "Please try again.",
                variant: "destructive",
            })
        } finally {
            setSwitchingTo(null)
        }
    }

    const handleLogout = async (accountId: string) => {
        try {
            setActioningAccount(accountId)
            await logoutAccount(accountId, false) // Keep in client for reactivation

            toast({
                title: "Account logged out",
                description: "Account has been logged out but kept for easy reactivation.",
                variant: "success",
            })
        } catch (error: any) {
            toast({
                title: "Logout failed",
                description: error.message || "Please try again.",
                variant: "destructive",
            })
        } finally {
            setActioningAccount(null)
        }
    }

    const handleReactivate = async (accountId: string) => {
        try {
            setActioningAccount(accountId)
            await reactivateAccount(accountId)

            toast({
                title: "Account reactivated",
                description: "Account is now available for sign in.",
                variant: "success",
            })
        } catch (error: any) {
            toast({
                title: "Reactivation failed",
                description: error.message || "Please try again.",
                variant: "destructive",
            })
        } finally {
            setActioningAccount(null)
        }
    }

    const handleRemove = async (accountId: string) => {
        try {
            setActioningAccount(accountId)
            await permanentlyRemoveAccount(accountId)

            toast({
                title: "Account removed",
                description: "Account has been permanently removed from this device.",
                variant: "success",
            })
        } catch (error: any) {
            toast({
                title: "Remove failed",
                description: error.message || "Please try again.",
                variant: "destructive",
            })
        } finally {
            setActioningAccount(null)
        }
    }

    const handleAddOAuthAccount = (provider: "google" | "microsoft" | "facebook") => {
        const redirectUrl = "/accounts"
        startOAuthSignin(provider, redirectUrl)
    }

    const getAccountStatusBadge = (account: any) => {
        if (account.accountType === "oauth") {
            return (
                <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Chrome className="w-3 h-3 mr-1" />
                    {account.provider || "OAuth"}
                </Badge>
            )
        } else {
            return (
                <Badge variant="secondary">
                    <User className="w-3 h-3 mr-1" />
                    Local
                </Badge>
            )
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Link href="/" className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">A</span>
                                </div>
                                <span className="text-xl font-bold">{config.appName}</span>
                            </Link>
                        </div>
                        <div className="flex items-center space-x-2">
                            {config.homeUrl && (
                                <Link href={config.homeUrl}>
                                    <Button variant="ghost" size="sm">
                                        Back to {config.companyName || 'Home'}
                                    </Button>
                                </Link>
                            )}
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 max-w-5xl">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center space-y-4">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight">Choose an account</h1>
                            <p className="text-muted-foreground text-lg">
                                Select an account to continue or add a new one
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>{accounts.length} active</span>
                            </div>
                            {hasDisabledAccounts && (
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <span>{disabledAccounts.length} inactive</span>
                                </div>
                            )}
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{allAccounts.length} total</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Accounts */}
                    {hasActiveAccounts && (
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Active accounts</h2>
                                <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200">
                                    Ready to use
                                </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {accounts.map((account) => (
                                    <Card
                                        key={account.id}
                                        className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-primary/20"
                                        onClick={() => handleSwitchAccount(account.id)}
                                    >
                                        <CardHeader className="pb-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <UserAvatar
                                                        name={formatAccountName(
                                                            account.userDetails.firstName,
                                                            account.userDetails.lastName,
                                                            account.userDetails.name
                                                        )}
                                                        imageUrl={account.userDetails.imageUrl}
                                                        size="lg"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <CardTitle className="text-lg truncate">
                                                            {formatAccountName(
                                                                account.userDetails.firstName,
                                                                account.userDetails.lastName,
                                                                account.userDetails.name
                                                            )}
                                                        </CardTitle>
                                                        <CardDescription className="text-sm truncate">
                                                            {account.userDetails.email}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center space-x-2">
                                                    {getAccountStatusBadge(account)}
                                                    {account.security.twoFactorEnabled && (
                                                        <Badge variant="outline" className="border-green-200 text-green-700 dark:border-green-800 dark:text-green-400">
                                                            <Shield className="w-3 h-3 mr-1" />
                                                            2FA
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="pt-0">
                                            <div className="flex items-center justify-between">
                                                <Button
                                                    size="sm"
                                                    disabled={switching || switchingTo === account.id}
                                                    loading={switchingTo === account.id}
                                                    className="group-hover:bg-primary/90"
                                                >
                                                    {switchingTo === account.id ? "Switching..." : "Continue"}
                                                </Button>

                                                <div className="flex items-center space-x-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/accounts/${account.id}/settings`)
                                                        }}
                                                        disabled={switching}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleLogout(account.id)
                                                        }}
                                                        disabled={switching || actioningAccount === account.id}
                                                        loading={actioningAccount === account.id}
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Disabled Accounts */}
                    {hasDisabledAccounts && (
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-muted-foreground">
                                    Inactive accounts
                                </h2>
                                <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400">
                                    Requires reactivation
                                </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {disabledAccounts.map((account) => (
                                    <Card key={account.id} className="opacity-75 border-dashed">
                                        <CardHeader className="pb-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <UserAvatar
                                                        name={formatAccountName(
                                                            account.userDetails.firstName,
                                                            account.userDetails.lastName,
                                                            account.userDetails.name
                                                        )}
                                                        imageUrl={account.userDetails.imageUrl}
                                                        size="lg"
                                                        className="opacity-60"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <CardTitle className="text-lg truncate text-muted-foreground">
                                                            {formatAccountName(
                                                                account.userDetails.firstName,
                                                                account.userDetails.lastName,
                                                                account.userDetails.name
                                                            )}
                                                        </CardTitle>
                                                        <CardDescription className="text-sm truncate">
                                                            {account.userDetails.email}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                {getAccountStatusBadge(account)}
                                                <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400">
                                                    Logged out
                                                </Badge>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="pt-0">
                                            <div className="flex items-center justify-between">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReactivate(account.id)}
                                                    disabled={switching || actioningAccount === account.id}
                                                    loading={actioningAccount === account.id}
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-2" />
                                                    Reactivate
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRemove(account.id)}
                                                    disabled={switching || actioningAccount === account.id}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Add Account Section */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Add another account</h2>
                            <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400">
                                Get started
                            </Badge>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* OAuth Options */}
                            {config.enableOAuth && (
                                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-blue-200">
                                    <CardHeader>
                                        <CardTitle className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                                <Chrome className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <span className="text-lg">Continue with Google</span>
                                                <CardDescription className="text-sm mt-1">
                                                    Sign in with your existing Google account
                                                </CardDescription>
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            onClick={() => handleAddOAuthAccount("google")}
                                            disabled={switching}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Google Account
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Local Account Option */}
                            {config.enableLocalAuth && (
                                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-green-200">
                                    <CardHeader>
                                        <CardTitle className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                                <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <span className="text-lg">Create new account</span>
                                                <CardDescription className="text-sm mt-1">
                                                    Sign up with email and password
                                                </CardDescription>
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Link href="/signup">
                                            <Button className="w-full" variant="outline" disabled={switching}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Account
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </section>

                    {/* Footer Actions */}
                    <section className="border-t pt-8 space-y-4">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-4">
                                Already have an account saved on this device?
                            </p>
                            <Link href="/login">
                                <Button variant="ghost" disabled={switching}>
                                    Sign in to existing account
                                </Button>
                            </Link>
                        </div>

                        {/* Help text */}
                        <div className="text-center text-xs text-muted-foreground max-w-2xl mx-auto">
                            <p>
                                Inactive accounts are kept for easy reactivation. You can permanently remove them
                                by clicking the trash icon. For help, {config.supportEmail ? (
                                    <Link href={`mailto:${config.supportEmail}`} className="text-primary hover:underline">
                                        contact support
                                    </Link>
                                ) : "contact support"}.
                            </p>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}