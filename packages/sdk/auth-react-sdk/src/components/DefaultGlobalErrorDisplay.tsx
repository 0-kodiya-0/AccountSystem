import React from 'react';

// Default Global Error Display Component
interface DefaultGlobalErrorDisplayProps {
  error: string;
  clearError?: () => void;
  retry?: () => void;
}

const DefaultGlobalErrorDisplay: React.FC<DefaultGlobalErrorDisplayProps> = ({ error, clearError, retry }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '16px',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <p style={{ color: '#dc2626', fontSize: '16px', margin: '0 0 16px 0', fontWeight: '500' }}>System Error</p>
        <p style={{ color: '#7f1d1d', fontSize: '14px', margin: '0 0 16px 0' }}>{error}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {clearError && (
            <button
              onClick={clearError}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Dismiss
            </button>
          )}
          {retry && (
            <button
              onClick={retry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DefaultGlobalErrorDisplay;
