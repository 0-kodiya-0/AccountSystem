import { SessionAccount } from "../../services/session/session.types";
import { Account } from "./Account.types";

/**
 * Convert account document to safe account object (full account data)
 */
export function toSafeAccount(accountDoc: any): Account | null {
  if (!accountDoc) return null;

  try {
    return {
      id: accountDoc._id.toString(),
      created: accountDoc.created,
      updated: accountDoc.updated,
      accountType: accountDoc.accountType,
      status: accountDoc.status,
      userDetails: {
        firstName: accountDoc.userDetails?.firstName,
        lastName: accountDoc.userDetails?.lastName,
        name: accountDoc.userDetails?.name,
        email: accountDoc.userDetails?.email,
        imageUrl: accountDoc.userDetails?.imageUrl,
        birthdate: accountDoc.userDetails?.birthdate,
        username: accountDoc.userDetails?.username,
        emailVerified: accountDoc.userDetails?.emailVerified,
      },
      security: {
        twoFactorEnabled: accountDoc.security?.twoFactorEnabled || false,
        sessionTimeout: accountDoc.security?.sessionTimeout || 3600,
        autoLock: accountDoc.security?.autoLock || false,
      },
      provider: accountDoc.provider,
    };
  } catch (error) {
    console.error("Error converting account document to safe account:", error);
    return null;
  }
}

/**
 * Convert account document to safe session account object (minimal data for session)
 * Only includes basic identifying information needed for session management
 */
export function toSafeSessionAccount(accountDoc: any): SessionAccount | null {
  if (!accountDoc) return null;

  try {
    return {
      id: accountDoc._id.toString(),
      accountType: accountDoc.accountType,
      status: accountDoc.status,
      userDetails: {
        name: accountDoc.userDetails?.name,
        email: accountDoc.userDetails?.email,
        username: accountDoc.userDetails?.username,
        imageUrl: accountDoc.userDetails?.imageUrl,
      },
      provider: accountDoc.provider,
    };
  } catch (error) {
    console.error(
      "Error converting account document to safe session account:",
      error,
    );
    return null;
  }
}
