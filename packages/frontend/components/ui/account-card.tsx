"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, Shield, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/auth/user-avatar"
import { Account, useAccount } from "@accountsystem/auth-react-sdk"
import { formatAccountName } from "@/lib/utils"

// Separate component for account cards to handle individual data fetching
interface AccountCardProps {
    accountId: string
    onSwitch?: (accountId: string) => void
    onLogout?: (accountId: string) => void
    onReactivate?: (accountId: string) => void
    onRemove?: (accountId: string) => void
    switchingTo?: string | null
    actioningAccount?: string | null
    getAccountStatusBadge: (account: Account) => React.ReactNode
    isActive: boolean
}

export default function AccountCard({
    accountId,
    onSwitch,
    onLogout,
    onReactivate,
    onRemove,
    switchingTo,
    actioningAccount,
    getAccountStatusBadge,
    isActive
}: AccountCardProps) {
    const router = useRouter()

    // Use useAccount hook to get account data
    const { account, isLoading } = useAccount(accountId, {
        autoFetch: true,
        refreshOnMount: false
    })

    if (isLoading || !account) {
        return (
            <Card className={isActive ? "group cursor-pointer" : "opacity-75 border-dashed"}>
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                            <div className="flex-1 min-w-0">
                                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                                <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="h-8 bg-gray-200 rounded animate-pulse" />
                </CardContent>
            </Card>
        )
    }

    const displayName = formatAccountName(
        account.userDetails.firstName,
        account.userDetails.lastName,
        account.userDetails.name
    )

    if (isActive) {
        return (
            <Card
                className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-2 hover:border-primary/20"
                onClick={() => onSwitch?.(account.id)}
            >
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                            <UserAvatar
                                name={displayName}
                                imageUrl={account.userDetails.imageUrl}
                                size="lg"
                            />
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate">
                                    {displayName}
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
                            disabled={!!switchingTo || switchingTo === account.id}
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
                                disabled={!!switchingTo}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onLogout?.(account.id)
                                }}
                                disabled={!!switchingTo || actioningAccount === account.id}
                                loading={actioningAccount === account.id}
                            >
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Inactive account card
    return (
        <Card className="opacity-75 border-dashed">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <UserAvatar
                            name={displayName}
                            imageUrl={account.userDetails.imageUrl}
                            size="lg"
                            className="opacity-60"
                        />
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate text-muted-foreground">
                                {displayName}
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
                        onClick={() => onReactivate?.(account.id)}
                        disabled={!!switchingTo || actioningAccount === account.id}
                        loading={actioningAccount === account.id}
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reactivate
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove?.(account.id)}
                        disabled={!!switchingTo || actioningAccount === account.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}