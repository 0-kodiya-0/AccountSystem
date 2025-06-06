import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAccountInitials } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
    name: string
    imageUrl?: string
    size?: "sm" | "md" | "lg" | "xl"
    className?: string
}

const sizeMap = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
    xl: "h-12 w-12 text-lg"
}

export function UserAvatar({
    name,
    imageUrl,
    size = "md",
    className
}: UserAvatarProps) {
    const initials = getAccountInitials(name)

    return (
        <Avatar className={cn(sizeMap[size], className)}>
            <AvatarImage
                src={imageUrl}
                alt={name}
                className="object-cover"
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
            </AvatarFallback>
        </Avatar>
    )
}