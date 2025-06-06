import * as React from "react"
import { Check, X } from "lucide-react"
import { validatePasswordStrength } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface PasswordStrengthIndicatorProps {
    password: string
    showRequirements?: boolean
}

export function PasswordStrengthIndicator({
    password,
    showRequirements = true
}: PasswordStrengthIndicatorProps) {
    const strength = validatePasswordStrength(password)

    const getStrengthColor = (strength: string) => {
        switch (strength) {
            case "weak":
                return "bg-destructive"
            case "fair":
                return "bg-yellow-500"
            case "strong":
                return "bg-green-500"
            default:
                return "bg-gray-200"
        }
    }

    const getStrengthText = (strength: string) => {
        switch (strength) {
            case "weak":
                return "Weak"
            case "fair":
                return "Fair"
            case "strong":
                return "Strong"
            default:
                return ""
        }
    }

    const requirements = [
        {
            text: "At least 8 characters",
            met: password.length >= 8,
        },
        {
            text: "One uppercase letter",
            met: /[A-Z]/.test(password),
        },
        {
            text: "One lowercase letter",
            met: /[a-z]/.test(password),
        },
        {
            text: "One number",
            met: /[0-9]/.test(password),
        },
        {
            text: "One special character",
            met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
        },
    ]

    const progress = requirements.filter(req => req.met).length / requirements.length * 100

    return (
        <div className="space-y-3">
            {/* Strength Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength</span>
                    <span className={cn(
                        "font-medium",
                        strength.strength === "weak" && "text-destructive",
                        strength.strength === "fair" && "text-yellow-600",
                        strength.strength === "strong" && "text-green-600"
                    )}>
                        {getStrengthText(strength.strength)}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                        className={cn(
                            "h-2 rounded-full transition-all duration-300",
                            getStrengthColor(strength.strength)
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Requirements List */}
            {showRequirements && password && (
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Password requirements:</p>
                    <div className="grid grid-cols-1 gap-1">
                        {requirements.map((requirement, index) => (
                            <div key={index} className="flex items-center space-x-2 text-xs">
                                {requirement.met ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <X className="h-3 w-3 text-gray-400" />
                                )}
                                <span className={cn(
                                    requirement.met ? "text-green-600" : "text-gray-500"
                                )}>
                                    {requirement.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}