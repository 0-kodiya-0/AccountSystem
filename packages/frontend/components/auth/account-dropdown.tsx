"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, User, Users, Shield } from "lucide-react"

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
import { useAccountSwitcher, useAuth } from "@accountsystem/auth-react-sdk"
import { formatAccountName } from "@/lib/utils"

export function AccountDropdown() {
    const router = useRouter()
    const { currentAccount } = useAuth()
    const {
        accounts,
        switchTo,
        logoutAccount,
        hasMultipleAccounts,
        switching
    } = useAccountSwitcher()

    if (!currentAccount) {
        return null
    }

    const handleSwitchAccount = async (accountId: string) => {
        try {
            await switchTo(accountId)
        } catch (error) {
            console.error("Failed to switch account:", error)
        }
    }

    const handleLogout = async () => {
        try {
            await logoutAccount(currentAccount.id, false)
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
                        {accounts
                            .filter(account => account.id !== currentAccount.id)
                            .slice(0, 3) // Show max 3 other accounts
                            .map((account) => (
                                <DropdownMenuItem
                                    key={account.id}
                                    onClick={() => handleSwitchAccount(account.id)}
                                    disabled={switching}
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