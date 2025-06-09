"use client"

import React, { useEffect } from "react"
import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Upload, X, User, Mail, Calendar, Chrome, CheckCircle, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { AccountDropdown } from "@/components/auth/account-dropdown"
import { UserAvatar } from "@/components/auth/user-avatar"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { AuthGuard, useAccount, useAuth } from "@accountsystem/auth-react-sdk"
import { formatAccountName, getEnvironmentConfig } from "@/lib/utils"
import { LoadingSpinner } from "@/components/auth/loading-spinner"
import { RedirectingSpinner } from "@/components/auth/redirecting-spinner"

const profileSchema = z.object({
    firstName: z.string()
        .min(1, "First name is required")
        .max(50, "First name too long"),
    lastName: z.string()
        .min(1, "Last name is required")
        .max(50, "Last name too long"),
    username: z.string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username too long")
        .optional()
        .or(z.literal("")),
    birthdate: z.string().optional().or(z.literal("")),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfileEditPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const accountId = params.accountId as string
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isUpdating, setIsUpdating] = useState(false)
    const [profileImage, setProfileImage] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [removeImage, setRemoveImage] = useState(false)

    // Use useAccount hook to get account data
    const { account, isLoading, error, refresh } = useAccount(accountId, {
        autoFetch: true,
        refreshOnMount: true
    })

    const { updateAccount } = useAuth()
    const config = getEnvironmentConfig()

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        reset: resetForm } = useForm<ProfileFormData>({
            resolver: zodResolver(profileSchema),
        })

    // Update form with account data when loaded
    useEffect(() => {
        if (account) {
            resetForm({
                firstName: account.userDetails.firstName || "",
                lastName: account.userDetails.lastName || "",
                username: account.userDetails.username || "",
                birthdate: account.userDetails.birthdate || "",
            })
            setProfileImage(account.userDetails.imageUrl || null)
        }
    }, [account])

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

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid file type",
                description: "Please select an image file.",
                variant: "destructive",
            })
            return
        }

        // Validate file size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: "File too large",
                description: "Please select an image smaller than 2MB.",
                variant: "destructive",
            })
            return
        }

        // Create preview URL
        const reader = new FileReader()
        reader.onload = (e) => {
            if (e.target?.result) {
                setProfileImage(e.target.result as string)
                setImageFile(file)
                setRemoveImage(false)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveImage = () => {
        setProfileImage(null)
        setImageFile(null)
        setRemoveImage(true)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const onSubmit = async (data: ProfileFormData) => {
        try {
            setIsUpdating(true)

            // Prepare update data
            const updateData: any = {
                userDetails: {
                    ...account.userDetails,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    name: `${data.firstName} ${data.lastName}`.trim(),
                    username: data.username || undefined,
                    birthdate: data.birthdate || undefined,
                }
            }

            // Handle image updates
            if (removeImage) {
                updateData.userDetails.imageUrl = null
            } else if (imageFile) {
                // In a real app, you'd upload the image to a storage service
                // For now, we'll just keep the base64 data URL
                updateData.userDetails.imageUrl = profileImage
            }

            await updateAccount(accountId, updateData)

            toast({
                title: "Profile updated successfully",
                description: "Your account information has been saved.",
                variant: "success",
            })

            // Refresh account data
            await refresh()

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to update profile"
            toast({
                title: "Profile update failed",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsUpdating(false)
        }
    }

    const hasChanges = isDirty || imageFile || removeImage

    return (
        <AuthGuard
            requireAccount={true}
            loadingComponent={LoadingSpinner}
            redirectingComponent={RedirectingSpinner}
        >
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
                <main className="container mx-auto px-4 py-8 max-w-2xl">
                    <div className="space-y-8">
                        {/* Page Header */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <UserAvatar
                                    name={displayName}
                                    imageUrl={profileImage || undefined}
                                    size="xl"
                                />
                                <div>
                                    <h1 className="text-3xl font-bold">Edit Profile</h1>
                                    <p className="text-muted-foreground">
                                        Update your account information and profile picture
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Badge variant={account.accountType === "oauth" ? "default" : "secondary"}>
                                    {account.accountType === "oauth" ? (
                                        <>
                                            <Chrome className="w-3 h-3 mr-1" />
                                            {account.provider} Account
                                        </>
                                    ) : (
                                        <>
                                            <User className="w-3 h-3 mr-1" />
                                            Local Account
                                        </>
                                    )}
                                </Badge>
                                {account.userDetails.emailVerified && (
                                    <Badge variant="outline" className="text-green-600">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Verified
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* OAuth Account Notice */}
                        {account.accountType === "oauth" && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <Chrome className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                            {account.provider} Account Information
                                        </p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Some information is managed by {account.provider} and may sync automatically.
                                            Your email address cannot be changed here.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Profile Picture Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Picture</CardTitle>
                                <CardDescription>
                                    Upload a new profile picture or remove the current one
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-6">
                                    <UserAvatar
                                        name={displayName}
                                        imageUrl={profileImage || undefined}
                                        size="xl"
                                        className="border-2 border-muted"
                                    />
                                    <div className="space-y-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                        <div className="flex space-x-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUpdating}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload New
                                            </Button>
                                            {profileImage && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleRemoveImage}
                                                    disabled={isUpdating}
                                                >
                                                    <X className="w-4 h-4 mr-2" />
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            JPG, PNG or GIF. Max size 2MB.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Profile Information Form */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Personal Information</CardTitle>
                                <CardDescription>
                                    Update your personal details
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                    {/* Name Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name</Label>
                                            <Input
                                                id="firstName"
                                                placeholder="John"
                                                error={!!errors.firstName}
                                                disabled={isUpdating}
                                                {...register("firstName")}
                                            />
                                            {errors.firstName && (
                                                <p className="text-sm text-destructive">
                                                    {errors.firstName.message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                placeholder="Doe"
                                                error={!!errors.lastName}
                                                disabled={isUpdating}
                                                {...register("lastName")}
                                            />
                                            {errors.lastName && (
                                                <p className="text-sm text-destructive">
                                                    {errors.lastName.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Email Field (Read-only) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <div className="relative">
                                            <Input
                                                id="email"
                                                type="email"
                                                value={account.userDetails.email || ""}
                                                disabled={true}
                                                className="bg-muted"
                                            />
                                            <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {account.accountType === "oauth"
                                                ? `Email is managed by ${account.provider} and cannot be changed here.`
                                                : "Email changes require verification and must be done through account settings."
                                            }
                                        </p>
                                    </div>

                                    {/* Username Field (Local accounts only) */}
                                    {account.accountType === "local" && (
                                        <div className="space-y-2">
                                            <Label htmlFor="username">Username (Optional)</Label>
                                            <Input
                                                id="username"
                                                placeholder="johndoe"
                                                error={!!errors.username}
                                                disabled={isUpdating}
                                                {...register("username")}
                                            />
                                            {errors.username && (
                                                <p className="text-sm text-destructive">
                                                    {errors.username.message}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                You can use this to sign in instead of your email
                                            </p>
                                        </div>
                                    )}

                                    {/* Birthdate Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="birthdate">Date of Birth (Optional)</Label>
                                        <div className="relative">
                                            <Input
                                                id="birthdate"
                                                type="date"
                                                error={!!errors.birthdate}
                                                disabled={isUpdating}
                                                {...register("birthdate")}
                                            />
                                            <Calendar className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                        {errors.birthdate && (
                                            <p className="text-sm text-destructive">
                                                {errors.birthdate.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Account Info */}
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

                                    {/* Action Buttons */}
                                    <div className="flex space-x-3 pt-4">
                                        <Button
                                            type="submit"
                                            disabled={isUpdating || !hasChanges}
                                            loading={isUpdating}
                                        >
                                            Save Changes
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => router.push(`/accounts/${accountId}/settings`)}
                                            disabled={isUpdating}
                                        >
                                            Cancel
                                        </Button>
                                    </div>

                                    {/* Unsaved Changes Warning */}
                                    {hasChanges && (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                            <div className="flex items-start space-x-3">
                                                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                                        Unsaved Changes
                                                    </p>
                                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                        You have unsaved changes. Make sure to save before leaving this page.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Account Management</CardTitle>
                                <CardDescription>
                                    Additional account management options
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-auto p-4 justify-start"
                                        onClick={() => router.push(`/accounts/${accountId}/settings`)}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">Account Settings</div>
                                            <div className="text-sm text-muted-foreground">
                                                Security, privacy, and more
                                            </div>
                                        </div>
                                    </Button>

                                    {account.accountType === "local" && (
                                        <Button
                                            variant="outline"
                                            className="h-auto p-4 justify-start"
                                            onClick={() => router.push(`/accounts/${accountId}/change-password`)}
                                        >
                                            <div className="text-left">
                                                <div className="font-medium">Change Password</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Update your password
                                                </div>
                                            </div>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}