"use client"

import * as React from "react"
import { useState } from "react"
import { Bell, Check, Trash2, MoreVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationList } from "./notification-list"
import { useNotificationsContext } from "@accountsystem/auth-react-sdk"

interface NotificationBellProps {
    className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const {
        unreadCount,
        markAllAsRead,
        deleteAllNotifications,
        isConnected
    } = useNotificationsContext()

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead()
        } catch (error) {
            console.error("Failed to mark all as read:", error)
        }
    }

    const handleDeleteAll = async () => {
        try {
            await deleteAllNotifications()
            setIsOpen(false)
        } catch (error) {
            console.error("Failed to delete all notifications:", error)
        }
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={className}>
                    <div className="relative">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                            >
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                        )}
                        {!isConnected && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-background" />
                        )}
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    <div className="flex items-center space-x-2">
                        {!isConnected && (
                            <Badge variant="outline" className="text-yellow-600">
                                Offline
                            </Badge>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Mark all as read
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleDeleteAll} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete all
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <NotificationList maxHeight="400px" showActions={true} />
            </DropdownMenuContent>
        </DropdownMenu>
    )
}