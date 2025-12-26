import type { User } from "@shared/schema";

export interface TTSPermissionResult {
  allowed: boolean;
  reason?: string;
}

export async function canUseTTS(
  user: User | null | undefined,
  universeId: number
): Promise<TTSPermissionResult> {
  if (!user) {
    return { allowed: false, reason: "Authentication required" };
  }

  if (user.isAdmin) {
    return { allowed: true };
  }

  return { allowed: true };
}
