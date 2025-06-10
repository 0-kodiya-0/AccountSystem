"use client"

import * as React from "react"
import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { 
    AlertCircle, 
    CheckCircle, 
    Info, 
    AlertTriangle, 
    ExternalLink, 
    MoreVertical,
    Eye,
    Trash2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Notification, NotificationType, useNotifications } from "@accountsystem/auth-react-sdk"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
    notification: Notification
    showActions?: boolean
    onClick?: () => void
}

export function NotificationItem({ notification, showActions = true, onClick }: NotificationItemProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const { markAsRead, deleteNotification } = useNotifications();

    const getNotificationIcon = (type: NotificationType) => {
        const iconClass = "h-4 w-4"
        switch (type) {
            case 'success':
                return <CheckCircle className={cn(iconClass, "text-green-600")} />
            case 'error':
                return <AlertCircle className={cn(iconClass, "text-red-600")} />
            case 'warning':
                return <AlertTriangle className={cn(iconClass, "text-yellow-600")} />
            case 'info':
            default:
                return <Info className={cn(iconClass, "text-blue-600")} />
        }
    }

    const getNotificationBgColor = (type: NotificationType, isRead: boolean) => {
        if (isRead) return "bg-background"
        
        switch (type) {
            case 'success':
                return "bg-green-50 dark:bg-green-900/10"
            case 'error':
                return "bg-red-50 dark:bg-red-900/10"
            case 'warning':
                return "bg-yellow-50 dark:bg-yellow-900/10"
            case 'info':
            default:
                return "bg-blue-50 dark:bg-blue-900/10"
        }
    }

    const handleMarkAsRead = async () => {
        if (notification.read) return
        
        try {
            await markAsRead(notification.id)
        } catch (error) {
            console.error("Failed to mark notification as read:", error)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteNotification(notification.id)
        } catch (error) {
            console.error("Failed to delete notification:", error)
            setIsDeleting(false)
        }
    }

    const handleClick = () => {
        handleMarkAsRead()
        
        if (notification.link) {
            window.open(notification.link, '_blank')
        }
        
        onClick?.()
    }

    const formatTime = (timestamp: number) => {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    }

    return (
        <div
            className={cn(
                "p-4 border-b transition-colors",
                getNotificationBgColor(notification.type, notification.read),
                notification.link && "cursor-pointer hover:bg-muted/50",
                isDeleting && "opacity-50"
            )}
            onClick={notification.link ? handleClick : undefined}
        >
            <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <h4 className={cn(
                                "text-sm font-medium truncate",
                                !notification.read && "font-semibold"
                            )}>
                                {notification.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                            </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-2">
                            {notification.link && (
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            )}
                            {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full" />
                            )}
                            {showActions && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreVertical className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {!notification.read && (
                                            <DropdownMenuItem onClick={handleMarkAsRead}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                Mark as read
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem 
                                            onClick={handleDelete} 
                                            className="text-destructive"
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                            {formatTime(notification.timestamp)}
                        </span>
                        {notification.type && (
                            <Badge variant="outline" className="text-xs">
                                {notification.type}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}