import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface RedirectingDisplayProps {
  destination: string;
  reason?: string;
  delay?: number;
}

export function RedirectingDisplay({ destination, reason, delay = 1 }: RedirectingDisplayProps) {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      window.location.href = destination;
    }, delay * 1000);

    return () => clearTimeout(timeoutId);
  }, [destination, delay]);

  const handleManualRedirect = () => {
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Redirecting</h3>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Redirecting in {delay} second{delay !== 1 ? 's' : ''}...
        </p>

        <button
          onClick={handleManualRedirect}
          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Go Now
        </button>
      </div>
    </div>
  );
}
