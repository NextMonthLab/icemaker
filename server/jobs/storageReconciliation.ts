import type { IStorage } from "../storage";
import { log } from "../index";

/**
 * Background job to reconcile storage usage across all profiles.
 * Runs every 24 hours and ensures that usedStorageBytes in creator_profiles
 * accurately reflects the sum of active media_assets.
 * 
 * This catches any discrepancies from:
 * - Failed uploads where storage was incremented but file wasn't saved
 * - Manual database interventions
 * - Race conditions during high-traffic periods
 * - Orphaned assets that weren't properly accounted for
 */
export function startStorageReconciliationJob(storage: IStorage) {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function runJob() {
    try {
      const profiles = await storage.getAllProfilesForReconciliation();

      if (profiles.length === 0) {
        return;
      }

      log(`Starting storage reconciliation for ${profiles.length} profile(s)`, "storage-reconcile");

      let correctedCount = 0;
      let totalDifference = 0;

      for (const profile of profiles) {
        try {
          const { calculatedBytes, previousBytes } = await storage.recalculateProfileStorage(profile.id);
          
          if (calculatedBytes !== previousBytes) {
            const diff = calculatedBytes - previousBytes;
            totalDifference += Math.abs(diff);
            correctedCount++;
            
            const diffStr = diff > 0 ? `+${(diff / 1024 / 1024).toFixed(2)}MB` : `${(diff / 1024 / 1024).toFixed(2)}MB`;
            log(`Profile ${profile.id}: corrected ${(previousBytes / 1024 / 1024).toFixed(2)}MB -> ${(calculatedBytes / 1024 / 1024).toFixed(2)}MB (${diffStr})`, "storage-reconcile");
          }
        } catch (error) {
          log(`Failed to reconcile profile ${profile.id}: ${error}`, "storage-reconcile");
        }
      }

      if (correctedCount > 0) {
        log(`Storage reconciliation complete: ${correctedCount} profile(s) corrected, total adjustment: ${(totalDifference / 1024 / 1024).toFixed(2)}MB`, "storage-reconcile");
      } else {
        log("Storage reconciliation complete: all profiles accurate", "storage-reconcile");
      }
    } catch (error) {
      log(`Error in storage reconciliation job: ${error}`, "storage-reconcile");
    }
  }

  // Run after a longer delay on startup (low priority)
  setTimeout(runJob, 5 * 60 * 1000); // 5 minute delay

  // Then run every 24 hours
  setInterval(runJob, INTERVAL_MS);

  log("Started storage reconciliation job (runs every 24 hours)", "storage-reconcile");
}
