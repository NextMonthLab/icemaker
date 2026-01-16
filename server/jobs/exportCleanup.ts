import type { IStorage } from "../storage";
import { log } from "../index";
import { db } from "../storage";
import * as schema from "@shared/schema";
import { and, eq, lt } from "drizzle-orm";

/**
 * Background job to clean up stuck video export jobs.
 * Runs every 15 minutes and marks jobs as failed if they:
 * 1. Have status 'processing' or 'queued'
 * 2. Have been in that state for more than 30 minutes
 * 
 * This handles cases where the export process was killed (e.g., server restart)
 * and the job is left in a zombie state.
 */
export function startExportCleanupJob(storage: IStorage) {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  async function runJob() {
    try {
      const cutoffTime = new Date(Date.now() - STUCK_THRESHOLD_MS);
      
      const stuckJobs = await db.query.videoExportJobs.findMany({
        where: and(
          eq(schema.videoExportJobs.status, "processing"),
          lt(schema.videoExportJobs.createdAt, cutoffTime)
        ),
      });
      
      const queuedJobs = await db.query.videoExportJobs.findMany({
        where: and(
          eq(schema.videoExportJobs.status, "queued"),
          lt(schema.videoExportJobs.createdAt, cutoffTime)
        ),
      });
      
      const allStuckJobs = [...stuckJobs, ...queuedJobs];

      if (allStuckJobs.length === 0) {
        return;
      }

      log(`Found ${allStuckJobs.length} stuck export job(s)`, "export-cleanup");

      let cleanedCount = 0;

      for (const job of allStuckJobs) {
        try {
          await storage.updateVideoExportJob(job.jobId, {
            status: "failed",
            errorMessage: "Export timed out - the process was interrupted. Please try again.",
            completedAt: new Date(),
          });
          
          cleanedCount++;
          log(`Marked stuck export ${job.jobId} as failed`, "export-cleanup");
        } catch (error) {
          log(`Failed to clean up export ${job.jobId}: ${error}`, "export-cleanup");
        }
      }

      log(`Export cleanup complete: ${cleanedCount} jobs marked as failed`, "export-cleanup");
    } catch (error) {
      log(`Error in export cleanup job: ${error}`, "export-cleanup");
    }
  }

  // Run after a delay on startup
  setTimeout(runJob, 30 * 1000); // 30 second delay

  // Then run every 15 minutes
  setInterval(runJob, INTERVAL_MS);

  log("Started export cleanup job (runs every 15 minutes)", "export-cleanup");
}
