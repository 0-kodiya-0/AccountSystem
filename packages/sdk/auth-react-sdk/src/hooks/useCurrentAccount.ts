import { UseAccountOptions } from "../types";
import { useAccount } from "./useAccount";

/**
 * Convenience hook for the current account
 */
export const useCurrentAccount = (options?: UseAccountOptions) => {
    return useAccount(undefined, options);
};