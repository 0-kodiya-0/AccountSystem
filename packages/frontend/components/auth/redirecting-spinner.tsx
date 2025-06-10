import { AuthGuardDecision } from "../../../sdk/auth-react-sdk/src"

interface RedirectingSpinnerProps {
    destination?: string
    reason?: string
    decision: AuthGuardDecision
}

export function RedirectingSpinner({ destination, reason, decision }: RedirectingSpinnerProps) {
    const getMessage = () => {
        switch (decision) {
            case AuthGuardDecision.REDIRECT_TO_LOGIN:
                return "Redirecting to sign in..."
            case AuthGuardDecision.REDIRECT_TO_ACCOUNTS:
                return "Redirecting to account selection..."
            case AuthGuardDecision.REDIRECT_CUSTOM:
                return reason || "Redirecting..."
            default:
                return "Redirecting..."
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">{getMessage()}</p>
                {destination && (
                    <p className="text-xs text-muted-foreground">Destination: {destination}</p>
                )}
            </div>
        </div>
    )
}