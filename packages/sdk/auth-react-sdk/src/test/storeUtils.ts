import { useAppStore } from '../store/useAppStore';
import { AccountSessionInfo, SessionAccount } from '../types';

// === STORE UTILITIES ===
export const resetAppStore = () => {
  useAppStore.setState({
    session: {
      data: null,
      status: 'idle',
      currentOperation: null,
      error: null,
      lastLoaded: null,
    },
    accounts: {},
    sessionAccounts: {
      data: [],
      status: 'idle',
      currentOperation: null,
      error: null,
      lastLoaded: null,
    },
  });
};

export const setMockSessionState = (sessionData: AccountSessionInfo, accounts: SessionAccount[] = []) => {
  useAppStore.setState({
    session: {
      data: sessionData,
      status: 'success',
      currentOperation: null,
      error: null,
      lastLoaded: Date.now(),
    },
    accounts: {},
    sessionAccounts: {
      data: accounts,
      status: 'success',
      currentOperation: null,
      error: null,
      lastLoaded: Date.now(),
    },
  });
};
