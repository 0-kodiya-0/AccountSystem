import { useState, useCallback } from 'react';
import { LoadingInfo, LoadingState } from '../types';

/**
 * Options for initializing the loading hook
 */
export interface UseLoadingOptions {
    initialState?: LoadingState;
    initialReason?: string;
    includeTimestamp?: boolean;
}

/**
 * Return type for the loading hook
 */
export interface UseLoadingReturn {
    // Current state info
    loadingInfo: LoadingInfo;
    
    // Derived boolean states for easy checking
    isPending: boolean;
    isReady: boolean;
    hasError: boolean;
    
    // State management functions
    setLoadingState: (state: LoadingState, reason?: string, metadata?: Record<string, unknown>) => void;
    updateLoadingReason: (reason: string) => void;
    updateMetadata: (metadata: Record<string, unknown>) => void;
    
    // Convenience state setters
    setPending: (reason?: string) => void;
    setReady: (reason?: string) => void;
    setError: (reason?: string, metadata?: Record<string, unknown>) => void;
    
    // State checkers
    isState: (state: LoadingState) => boolean;
    getStateAge: () => number; // How long in current state (ms)
    
    // Utilities
    reset: (reason?: string) => void;
    clearError: () => void;
}

/**
 * Reusable hook for managing loading patterns with three states
 * 
 * @param options Configuration options for the hook
 * @returns Object with loading state and management functions
 * 
 * @example
 * ```typescript
 * const {
 *   isPending,
 *   isReady,
 *   hasError,
 *   setPending,
 *   setReady,
 *   setError,
 *   loadingInfo
 * } = useLoading({
 *   initialState: LoadingState.PENDING,
 *   initialReason: 'Initializing component'
 * });
 * 
 * // In async operation
 * const fetchData = async () => {
 *   setPending('Loading user data');
 *   try {
 *     const data = await api.fetchUser();
 *     setReady('User data loaded successfully');
 *     return data;
 *   } catch (error) {
 *     setError('Failed to load user data', { originalError: error });
 *     throw error;
 *   }
 * };
 * 
 * // In render
 * if (isPending) return <Loading message={loadingInfo.reason} />;
 * if (hasError) return <Error message={loadingInfo.reason} />;
 * if (isReady) return <Content />;
 * ```
 */
export const useLoading = (
    options: UseLoadingOptions = {}
): UseLoadingReturn => {
    const {
        initialState = LoadingState.PENDING,
        initialReason = 'Initializing',
        includeTimestamp = true
    } = options;

    const [loadingInfo, setLoadingInfo] = useState<LoadingInfo>({
        state: initialState,
        reason: initialReason,
        lastUpdated: includeTimestamp ? Date.now() : undefined
    });

    // Derived boolean states for easy checking
    const isPending = loadingInfo.state === LoadingState.PENDING;
    const isReady = loadingInfo.state === LoadingState.READY;
    const hasError = loadingInfo.state === LoadingState.ERROR;

    // Primary state management function
    const setLoadingState = useCallback((
        state: LoadingState,
        reason?: string,
        metadata?: Record<string, unknown>
    ) => {
        setLoadingInfo(prev => ({
            state,
            reason: reason || prev.reason,
            lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated,
            metadata: metadata || prev.metadata
        }));
    }, [includeTimestamp]);

    // Update just the reason without changing state
    const updateLoadingReason = useCallback((reason: string) => {
        setLoadingInfo(prev => ({
            ...prev,
            reason,
            lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated
        }));
    }, [includeTimestamp]);

    // Update just the metadata without changing state
    const updateMetadata = useCallback((metadata: Record<string, unknown>) => {
        setLoadingInfo(prev => ({
            ...prev,
            metadata: { ...prev.metadata, ...metadata },
            lastUpdated: includeTimestamp ? Date.now() : prev.lastUpdated
        }));
    }, [includeTimestamp]);

    // Convenience state setters
    const setPending = useCallback((reason?: string) => {
        setLoadingState(LoadingState.PENDING, reason);
    }, [setLoadingState]);

    const setReady = useCallback((reason?: string) => {
        setLoadingState(LoadingState.READY, reason);
        clearError();
    }, [setLoadingState]);

    const setError = useCallback((reason?: string, metadata?: Record<string, unknown>) => {
        setLoadingState(LoadingState.ERROR, reason, metadata);
    }, [setLoadingState]);

    // State checker function
    const isState = useCallback((state: LoadingState) => {
        return loadingInfo.state === state;
    }, [loadingInfo.state]);

    // Get how long we've been in current state
    const getStateAge = useCallback(() => {
        if (!includeTimestamp || !loadingInfo.lastUpdated) return 0;
        return Date.now() - loadingInfo.lastUpdated;
    }, [includeTimestamp, loadingInfo.lastUpdated]);

    // Reset to initial state
    const reset = useCallback((reason?: string) => {
        setLoadingState(
            initialState,
            reason || initialReason
        );
    }, [setLoadingState, initialState, initialReason]);

    // Clear error and return to ready state
    const clearError = useCallback(() => {
        if (hasError) {
            setReady('Error cleared');
        }
    }, [hasError, setReady]);

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
        clearError
    };
};

/**
 * Hook variant specifically for auth operations
 * Pre-configured with auth-specific initial state and messages
 */
export const useAuthLoading = () => {
    return useLoading({
        initialState: LoadingState.PENDING,
        initialReason: 'Initializing authentication system',
        includeTimestamp: true
    });
};

/**
 * Hook variant specifically for data fetching operations
 * Pre-configured with data-specific initial state and messages
 */
export const useDataLoading = (entityName: string = 'data') => {
    return useLoading({
        initialState: LoadingState.PENDING,
        initialReason: `Loading ${entityName}`,
        includeTimestamp: true
    });
};

/**
 * Hook variant that starts in READY state
 * Useful for components that start ready and only show loading during operations
 */
export const useOperationalLoading = () => {
    return useLoading({
        initialState: LoadingState.READY,
        initialReason: 'Ready for operations',
        includeTimestamp: true
    });
};
