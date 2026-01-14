import type { IStorage } from "../storage";
import { log } from "../index";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";

const objectStorage = new ObjectStorageService();

/**
 * Background job to clean up orphaned media assets.
 * Runs every 6 hours and removes files from object storage that:
 * 1. Have status 'orphan' in the database
 * 2. Have been orphaned for more than 7 days (grace period)
 * 
 * This prevents accumulation of unused files while allowing
 * time for recovery if something was accidentally orphaned.
 */
export function startOrphanCleanupJob(storage: IStorage) {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const ORPHAN_GRACE_DAYS = 7; // Keep orphans for 7 days before deletion

  async function runJob() {
    try {
      // Skip if object storage is not configured
      if (!objectStorage.isConfigured()) {
        return;
      }

      const orphanedAssets = await storage.getOrphanedAssets(ORPHAN_GRACE_DAYS);

      if (orphanedAssets.length === 0) {
        return;
      }

      log(`Found ${orphanedAssets.length} orphaned asset(s) older than ${ORPHAN_GRACE_DAYS} days`, "orphan-cleanup");

      let deletedCount = 0;
      let failedCount = 0;

      for (const asset of orphanedAssets) {
        try {
          // Delete from object storage
          await objectStorage.deleteObject(asset.fileKey);
          
          // Delete from database
          await storage.deleteMediaAsset(asset.id);
          
          deletedCount++;
          log(`Deleted orphan: ${asset.fileKey} (${(asset.fileSizeBytes / 1024).toFixed(1)}KB)`, "orphan-cleanup");
        } catch (error) {
          failedCount++;
          log(`Failed to delete orphan ${asset.fileKey}: ${error}`, "orphan-cleanup");
        }
      }

      log(`Orphan cleanup complete: ${deletedCount} deleted, ${failedCount} failed`, "orphan-cleanup");
    } catch (error) {
      log(`Error in orphan cleanup job: ${error}`, "orphan-cleanup");
    }
  }

  // Run after a delay on startup (don't block server startup)
  setTimeout(runJob, 60 * 1000); // 1 minute delay

  // Then run every 6 hours
  setInterval(runJob, INTERVAL_MS);

  log("Started orphan cleanup job (runs every 6 hours)", "orphan-cleanup");
}
