import { useState, useCallback, useEffect } from 'react';
import { LoadingInfo, LoadingState } from '../types';

export interface UseLoadingOptions {
  initialState?: LoadingState;
  initialReason?: string;
  includeTimestamp?: boolean;
  autoResetError?: boolean;
  autoResetDelay?: number;
}

export interface UseLoadingReturn {
  // Current state info
  loadingInfo: LoadingInfo;

  // Derived boolean states for easy checking
  isPending: boolean;
  isReady: boolean;
  hasError: boolean;

  // State management functions
  setLoadingState: (
    state: LoadingState,
    reason?: string,
    metadata?: Record<string, unknown>,
  ) => void;
  updateLoadingReason: (reason: string) => void;
  updateMetadata: (metadata: Record<string, unknown>) => void;

  // Convenience state setters
  setPending: (reason?: string) => void;
  setReady: (reason?: string) => void;
  setError: (reason?: string, metadata?: Record<string, unknown>) => void;

  // State checkers
  isState: (state: LoadingState) => boolean;
  getStateAge: () => number;

  // Utilities
  reset: (reason?: string) => void;
  clearError: () => void;
}

export const useLoading = (
  options: UseLoadingOptions = {},
): UseLoadingReturn => {
  const {
    initialState = LoadingState.PENDING,
    initialReason = 'Initializing',
    includeTimestamp = true,
    autoResetError = false,
    autoResetDelay = 5000,
  } = options;

  const [loadingInfo, setLoadingInfo] = useState<LoadingInfo>({
    state: initialState,
    reason: initialReason,
    lastUpdated: includeTimestamp ? Date.now() : undefined,
  });

  // Derived boolean states for easy checking
  const isPending = loadingInfo.state === LoadingState.PENDING;
  const isReady = loadingInfo.state === LoadingState.READY;
  const hasError = loadingInfo.state === LoadingState.ERROR;

  // OPTIMIZED: useCallback with minimal dependencies for stable references
  const setLoadingState = useCallback(
    (
      state: LoadingState,
      reason?: string,
      metadata?: Record<string, unknown>,
    ) => {
      setLoadingInfo((prev) => ({
        state,
        reason: reason || prev.reason,
        lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated,
        metadata: metadata || prev.metadata,
      }));
    },
    [includeTimestamp],
  ); // Only depends on includeTimestamp option

  const updateLoadingReason = useCallback(
    (reason: string) => {
      setLoadingInfo((prev) => ({
        ...prev,
        reason,
        lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated,
      }));
    },
    [includeTimestamp],
  ); // Only depends on includeTimestamp option

  const updateMetadata = useCallback(
    (metadata: Record<string, unknown>) => {
      setLoadingInfo((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, ...metadata },
        lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated,
      }));
    },
    [includeTimestamp],
  ); // Only depends on includeTimestamp option

  // Convenience state setters - OPTIMIZED: All stable via useCallback
  const setPending = useCallback(
    (reason?: string) => {
      setLoadingState(LoadingState.PENDING, reason);
    },
    [setLoadingState],
  );

  const setReady = useCallback(
    (reason?: string) => {
      setLoadingState(LoadingState.READY, reason);
    },
    [setLoadingState],
  );

  const setError = useCallback(
    (reason?: string, metadata?: Record<string, unknown>) => {
      setLoadingState(LoadingState.ERROR, reason, metadata);
    },
    [setLoadingState],
  );

  const isState = useCallback(
    (state: LoadingState) => {
      return loadingInfo.state === state;
    },
    [loadingInfo.state],
  ); // Only depends on current state

  const getStateAge = useCallback(() => {
    if (!includeTimestamp || !loadingInfo.lastUpdated) return 0;
    return Date.now() - loadingInfo.lastUpdated;
  }, [includeTimestamp, loadingInfo.lastUpdated]); // Depends on timestamp option and last update

  const reset = useCallback(
    (reason?: string) => {
      setLoadingState(initialState, reason || initialReason);
    },
    [setLoadingState, initialState, initialReason],
  ); // All stable values

  const clearError = useCallback(() => {
    if (hasError) {
      setReady('Error cleared');
    }
  }, [hasError, setReady]); // hasError changes, setReady is stable

  // OPTIMIZED: Auto-reset error effect - only runs when needed
  useEffect(() => {
    if (!autoResetError || !hasError || autoResetDelay <= 0) {
      return; // Early return prevents timer setup
    }

    const timer = setTimeout(() => {
      setReady('Error auto-cleared');
    }, autoResetDelay);

    return () => clearTimeout(timer);
  }, [autoResetError, hasError, autoResetDelay]);

  return {
    // Current state info
    loadingInfo,

    // Derived boolean states
    isPending,
    isReady,
    hasError,

    // State management functions
    setLoadingState,
    updateLoadingReason,
    updateMetadata,

    // Convenience state setters
    setPending,
    setReady,
    setError,

    // State checkers
    isState,
    getStateAge,

    // Utilities
    reset,
    clearError,
  };
};

// OPTIMIZED: Specialized hooks with stable options (no dependencies needed)
export const useAuthLoading = () => {
  return useLoading({
    initialState: LoadingState.PENDING,
    initialReason: 'Initializing authentication system',
    includeTimestamp: true,
  });
};

export const useDataLoading = (entityName: string = 'data') => {
  return useLoading({
    initialState: LoadingState.PENDING,
    initialReason: `Loading ${entityName}`,
    includeTimestamp: true,
  });
};

export const useOperationalLoading = () => {
  return useLoading({
    initialState: LoadingState.READY,
    initialReason: 'Ready for operations',
    includeTimestamp: true,
  });
};
