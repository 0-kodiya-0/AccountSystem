import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  retry?: () => void;
}

export function ErrorDisplay({ error, retry }: ErrorDisplayProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        {/* Error Icon */}
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">Something went wrong</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {retry && (
            <button
              onClick={retry}
              className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
