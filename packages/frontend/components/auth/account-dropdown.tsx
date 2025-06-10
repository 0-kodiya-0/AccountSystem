"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, Users, Shield } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "./user-avatar"
import { useAuth, useAccount } from "../../../sdk/auth-react-sdk/src"
import { formatAccountName } from "@/lib/utils"

export function AccountDropdown() {
    const router = useRouter()
    const { accounts, currentAccount: currentAccountFromStore, switchAccount, logout } = useAuth()

    // Use useAccount hook to get current account data
    const { account: currentAccount, isLoading } = useAccount(currentAccountFromStore?.id, {
        autoFetch: true,
        refreshOnMount: false
    })

    // Get other accounts (limit to 3 for dropdown)
    const otherAccounts = accounts
        .filter(acc => acc.id !== currentAccountFromStore?.id)
        .slice(0, 3)

    if (!currentAccountFromStore || isLoading) {
        return (
            <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled>
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            </Button>
        )
    }

    if (!currentAccount) {
        return null
    }

    const handleSwitchAccount = async (accountId: string) => {
        try {
            await switchAccount(accountId)
        } catch (error) {
            console.error("Failed to switch account:", error)
        }
    }

    const handleLogout = async () => {
        try {
            await logout(currentAccount.id)
            router.push("/accounts")
        } catch (error) {
            console.error("Failed to logout:", error)
        }
    }

    const displayName = formatAccountName(
        currentAccount.userDetails.firstName,
        currentAccount.userDetails.lastName,
        currentAccount.userDetails.name
    )

    const hasMultipleAccounts = accounts.length > 1

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <UserAvatar
                        name={displayName}
                        imageUrl={currentAccount.userDetails.imageUrl}
                        size="md"
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end" forceMount>
                {/* Current Account Info */}
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-3">
                            <UserAvatar
                                name={displayName}
                                imageUrl={currentAccount.userDetails.imageUrl}
                                size="md"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {displayName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {currentAccount.userDetails.email}
                                </p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                                <Badge
                                    variant={currentAccount.accountType === "oauth" ? "default" : "secondary"}
                                    className="text-xs"
                                >
                                    {currentAccount.accountType === "oauth" ? currentAccount.provider : "Local"}
                                </Badge>
                                {currentAccount.security.twoFactorEnabled && (
                                    <Badge variant="outline" className="text-xs text-green-600">
                                        <Shield className="w-2 h-2 mr-1" />
                                        2FA
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Account Actions */}
                <DropdownMenuItem
                    onClick={() => router.push(`/accounts/${currentAccount.id}/settings`)}
                >
                    <Settings className="mr-2 h-4 w-4" />
                    Account Settings
                </DropdownMenuItem>

                {/* Switch Account */}
                {hasMultipleAccounts && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Switch Account</DropdownMenuLabel>

                        {/* Render other accounts */}
                        {otherAccounts.map((account) => (
                            <DropdownMenuItem
                                key={account.id}
                                onClick={() => handleSwitchAccount(account.id)}
                            >
                                <div className="flex items-center space-x-2 w-full">
                                    <UserAvatar
                                        name={formatAccountName(
                                            account.userDetails.firstName,
                                            account.userDetails.lastName,
                                            account.userDetails.name
                                        )}
                                        imageUrl={account.userDetails.imageUrl}
                                        size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">
                                            {formatAccountName(
                                                account.userDetails.firstName,
                                                account.userDetails.lastName,
                                                account.userDetails.name
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {account.userDetails.email}
                                        </p>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                        ))}

                        <DropdownMenuItem
                            onClick={() => router.push("/accounts")}
                        >
                            <Users className="mr-2 h-4 w-4" />
                            Manage All Accounts
                        </DropdownMenuItem>
                    </>
                )}

                <DropdownMenuSeparator />

                {/* Logout */}
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}