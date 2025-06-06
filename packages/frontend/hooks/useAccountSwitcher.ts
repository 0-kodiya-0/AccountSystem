import { useAccountStore, useAuth } from "@accountsystem/auth-react-sdk"

export function useAccountSwitcher() {
    const hasActiveAccounts = useAccountStore(state => state.hasActiveAccounts);
    
    const {
        accounts,
        allAccounts,
        disabledAccounts,
        switchAccount,
        logout,
        enableAccount,
        removeAccount,
        isAccountDisabled,
        isLoading
    } = useAuth()

    const switchTo = async (accountId: string) => {
        if (isAccountDisabled(accountId)) {
            throw new Error("Cannot switch to disabled account")
        }
        await switchAccount(accountId)
    }

    const logoutAccount = async (accountId: string, clearClientAccountState = true) => {
        await logout(accountId, clearClientAccountState)
    }

    const reactivateAccount = async (accountId: string) => {
        enableAccount(accountId)
    }

    const permanentlyRemoveAccount = async (accountId: string) => {
        await removeAccount(accountId)
    }

    const hasMultipleAccounts = accounts.length > 1
    const hasDisabledAccounts = disabledAccounts.length > 0
    const switching = isLoading

    return {
        accounts,
        allAccounts,
        disabledAccounts,
        switchTo,
        logoutAccount,
        reactivateAccount,
        permanentlyRemoveAccount,
        hasMultipleAccounts,
        hasActiveAccounts,
        hasDisabledAccounts,
        switching,
        isAccountDisabled
    }
}
