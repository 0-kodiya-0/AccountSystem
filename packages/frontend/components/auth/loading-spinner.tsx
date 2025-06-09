export function LoadingSpinner({ reason }: { reason?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">{reason || 'Loading...'}</p>
            </div>
        </div>
    )
}