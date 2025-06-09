"use client"

import * as React from "react"
import { useState } from "react"
import { Bell, Settings, Wifi, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { NotificationList } from "./notification-list"
import { useNotificationsContext } from "@accountsystem/auth-react-sdk"

export function NotificationCenter() {
    const [showSettings, setShowSettings] = useState(false)
    const {
        notifications,
        unreadCount,
        isConnected,
        connectionState,
        soundEnabled,
        setSoundEnabled,
        browserNotificationsEnabled,
        requestBrowserPermission,
        markAllAsRead,
        deleteAllNotifications,
        clearUpdates,
        updateCount
    } = useNotificationsContext()

    const handleToggleSound = () => {
        setSoundEnabled(!soundEnabled)
    }

    const handleRequestBrowserPermission = async () => {
        await requestBrowserPermission()
    }

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
        } catch (error) {
            console.error("Failed to delete all notifications:", error)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Notifications</h1>
                    <p className="text-muted-foreground">
                        Manage your notifications and preferences
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? (
                            <>
                                <Wifi className="w-3 h-3 mr-1" />
                                Real-time
                            </>
                        ) : (
                            <>
                                <WifiOff className="w-3 h-3 mr-1" />
                                Offline
                            </>
                        )}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Total</p>
                                <p className="text-2xl font-bold">{notifications.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-primary rounded-full" />
                            <div>
                                <p className="text-sm font-medium">Unread</p>
                                <p className="text-2xl font-bold">{unreadCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-500 rounded-full" />
                            <div>
                                <p className="text-sm font-medium">Updates</p>
                                <p className="text-2xl font-bold">{updateCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                            {isConnected ? (
                                <Wifi className="w-4 h-4 text-green-500" />
                            ) : (
                                <WifiOff className="w-4 h-4 text-red-500" />
                            )}
                            <div>
                                <p className="text-sm font-medium">Status</p>
                                <p className="text-sm font-semibold">{connectionState}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <Card>
                    <CardHeader>
                        <CardTitle>Notification Settings</CardTitle>
                        <CardDescription>
                            Configure how you receive notifications
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="sound-notifications">Sound Notifications</Label>
                                <p className="text-sm text-muted-foreground">
                                    Play a sound when new notifications arrive
                                </p>
                            </div>
                            <Switch
                                id="sound-notifications"
                                checked={soundEnabled}
                                onCheckedChange={handleToggleSound}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="browser-notifications">Browser Notifications</Label>
                                <p className="text-sm text-muted-foreground">
                                    Show desktop notifications in your browser
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                {browserNotificationsEnabled ? (
                                    <Badge variant="outline" className="text-green-600">Enabled</Badge>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRequestBrowserPermission}
                                    >
                                        Enable
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex space-x-2 pt-4 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearUpdates}
                            >
                                Clear Update History
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                disabled={unreadCount === 0}
                            >
                                Mark All Read
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteAll}
                                disabled={notifications.length === 0}
                            >
                                Delete All
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Notifications List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Recent Notifications</CardTitle>
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                disabled={unreadCount === 0}
                            >
                                Mark All Read
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <NotificationList showActions={true} />
                </CardContent>
            </Card>
        </div>
    )
}