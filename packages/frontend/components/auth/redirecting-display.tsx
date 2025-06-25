import { useEffect, useState } from 'react';

interface RedirectingDisplayProps {
  destination: string;
  reason?: string;
  delay?: number;
}

export function RedirectingDisplay({ destination, reason, delay = 1 }: RedirectingDisplayProps) {
  const [remainingTime, setRemainingTime] = useState(delay);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // If delay is 0, redirect immediately
    if (delay === 0) {
      setHasRedirected(true);
      window.location.href = destination;
      return;
    }

    // Countdown timer that updates every second
    const countdownInterval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto redirect timer
    const redirectTimeout = setTimeout(() => {
      setHasRedirected(true);
      window.location.href = destination;
    }, delay * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(redirectTimeout);
    };
  }, []);

  const handleManualRedirect = () => {
    setHasRedirected(true);
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Redirecting</h3>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>

        {remainingTime > 0 ? (
          <p className="text-sm text-muted-foreground">
            Redirecting in {remainingTime} second{remainingTime !== 1 ? 's' : ''} to {destination} ...
          </p>
        ) : (
          !hasRedirected && (
            <div className="space-y-4">
              <p className="text-sm text-orange-600">Auto-redirect failed. Please click below to continue.</p>
              <button
                onClick={handleManualRedirect}
                className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors underline"
              >
                Redirect manually →
              </button>
            </div>
          )
        )}

        {hasRedirected && <p className="text-sm text-green-600">Redirecting to {destination} now...</p>}
      </div>
    </div>
  );
}
