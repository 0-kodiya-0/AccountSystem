import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatAccountName(firstName?: string, lastName?: string, name?: string): string {
    if (firstName && lastName) {
        return `${firstName} ${lastName}`
    }
    return name || 'Unknown User'
}

export function getAccountInitials(name: string): string {
    const words = name.trim().split(' ')
    if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.charAt(0).toUpperCase()
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export function validatePasswordStrength(password: string): {
    isValid: boolean
    errors: string[]
    strength: 'weak' | 'fair' | 'strong'
} {
    const errors: string[] = []

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        errors.push('Password must contain at least one special character')
    }

    const isValid = errors.length === 0
    let strength: 'weak' | 'fair' | 'strong' = 'weak'

    if (errors.length <= 1) {
        strength = 'strong'
    } else if (errors.length <= 2) {
        strength = 'fair'
    }

    return { isValid, errors, strength }
}

export function formatNotificationTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) {
        return 'Just now'
    } else if (minutes < 60) {
        return `${minutes}m ago`
    } else if (hours < 24) {
        return `${hours}h ago`
    } else if (days < 7) {
        return `${days}d ago`
    } else {
        return new Date(timestamp).toLocaleDateString()
    }
}

export function getEnvironmentConfig() {
    return {
        backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
        socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
        appName: process.env.NEXT_PUBLIC_APP_NAME || 'AccountSystem',
        homeUrl: process.env.NEXT_PUBLIC_HOME_URL,
        enableOAuth: process.env.NEXT_PUBLIC_ENABLE_OAUTH !== 'false',
        enableLocalAuth: process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH !== 'false',
        enable2FA: process.env.NEXT_PUBLIC_ENABLE_2FA !== 'false',
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME,
        supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
        privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL,
        termsUrl: process.env.NEXT_PUBLIC_TERMS_URL,
        debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
    }
}

export function getRedirectUrl(): string {
    const config = getEnvironmentConfig()
    return config.homeUrl || '/dashboard'
}

export function handleError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return 'An unexpected error occurred'
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function copyToClipboard(text: string): Promise<void> {
    return navigator.clipboard.writeText(text)
}

export function downloadBackupCodes(codes: string[], filename: string = 'backup-codes.txt'): void {
    const content = codes.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function isValidUrl(string: string): boolean {
    try {
        new URL(string)
        return true
    } catch (_) {
        return false
    }
}

export function generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
}

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func(...args), delay)
    }
}