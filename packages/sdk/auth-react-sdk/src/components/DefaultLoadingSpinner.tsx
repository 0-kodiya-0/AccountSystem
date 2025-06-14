import React from 'react';

// Loading Spinner Component
interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DefaultLoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', size = 'md' }) => {
  const sizeStyles = {
    sm: { width: '20px', height: '20px' },
    md: { width: '32px', height: '32px' },
    lg: { width: '48px', height: '48px' },
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          ...sizeStyles[size],
          border: '2px solid #e2e8f0',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ color: '#64748b', fontSize: '14px' }}>{message}</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DefaultLoadingSpinner;
