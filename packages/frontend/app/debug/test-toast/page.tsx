'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function ToastTestPage() {
  const { toast, toasts } = useToast();

  console.log('ToastTestPage rendered');
  console.log('Current toasts:', toasts);

  const handleTestToast = () => {
    console.log('Button clicked, creating toast...');

    const result = toast({
      title: 'Test Toast',
      description: 'This is a test toast message',
      variant: 'success',
    });

    console.log('Toast created:', result);
  };

  const handleErrorToast = () => {
    console.log('Error button clicked...');

    toast({
      title: 'Error Toast',
      description: 'This is an error message',
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Toast Test Page</h1>

        <div className="space-y-2">
          <p>Current toasts count: {toasts.length}</p>
          <pre className="text-xs bg-gray-100 p-2 rounded">{JSON.stringify(toasts, null, 2)}</pre>
        </div>

        <div className="space-y-2">
          <Button onClick={handleTestToast} className="w-full">
            Test Success Toast
          </Button>

          <Button onClick={handleErrorToast} variant="destructive" className="w-full">
            Test Error Toast
          </Button>
        </div>

        <div className="mt-8 p-4 border rounded">
          <h3 className="font-semibold mb-2">Debug Info:</h3>
          <ul className="text-sm space-y-1">
            <li>• Check browser console for logs</li>
            <li>• Check if Toaster component is rendered</li>
            <li>• Check if ToastViewport is visible</li>
            <li>• Toasts should appear in bottom-right corner</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
