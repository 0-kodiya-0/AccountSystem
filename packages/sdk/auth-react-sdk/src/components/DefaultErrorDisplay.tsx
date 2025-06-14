import React from 'react';

// Default Error Display Component
interface DefaultErrorDisplayProps {
  error: string;
  retry?: () => void;
}

const DefaultErrorDisplay: React.FC<DefaultErrorDisplayProps> = ({ error, retry }) => {
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
      <p style={{ color: '#dc2626', fontSize: '16px', margin: '0 0 16px 0' }}>{error}</p>
      {retry && (
        <button
          onClick={retry}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
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
  );
};

export default DefaultErrorDisplay;
