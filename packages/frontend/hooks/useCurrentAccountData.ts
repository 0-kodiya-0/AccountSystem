import { useAuth, useAccount } from "@accountsystem/auth-react-sdk"

export function useCurrentAccountData() {
    const { currentAccount: currentAccountFromStore } = useAuth()
    
    const { 
        account: currentAccount, 
        isLoading, 
        error, 
        refresh 
    } = useAccount(currentAccountFromStore?.id, {
        autoFetch: true,
        refreshOnMount: false
    })

    return {
        currentAccount,
        currentAccountId: currentAccountFromStore?.id,
        isLoading,
        error,
        refresh,
        hasCurrentAccount: !!currentAccount
    }
}