/**
 * QuickBooks Sync Worker
 *
 * Background worker that continuously syncs data between the ERP system
 * and QuickBooks Online. Runs on a configurable interval, syncing all
 * connected QB accounts automatically.
 *
 * Follows the same pattern as emailQueueWorker.ts.
 */

import * as db from "./db";
import { runFullSync, type FullSyncResult } from "./quickbooksSyncService";

// Worker configuration
interface SyncWorkerConfig {
  syncIntervalMs: number;    // How often to run sync (default: 15 min)
  enabled: boolean;
}

const defaultConfig: SyncWorkerConfig = {
  syncIntervalMs: 15 * 60 * 1000, // 15 minutes
  enabled: true,
};

let workerInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let config: SyncWorkerConfig = { ...defaultConfig };
let lastSyncAt: Date | null = null;
let lastSyncResults: Map<number, FullSyncResult | { error: string }> = new Map();

/**
 * Start the QuickBooks sync worker.
 */
export function startQuickBooksSyncWorker(customConfig?: Partial<SyncWorkerConfig>): void {
  if (workerInterval) {
    console.log("[QBSyncWorker] Already running");
    return;
  }

  config = { ...defaultConfig, ...customConfig };

  if (!config.enabled) {
    console.log("[QBSyncWorker] Worker disabled in config");
    return;
  }

  console.log(`[QBSyncWorker] Starting with sync interval: ${config.syncIntervalMs / 1000}s`);

  // Initial sync after a short delay to let the server fully start
  setTimeout(runSyncCycle, 10000);

  // Set up interval
  workerInterval = setInterval(runSyncCycle, config.syncIntervalMs);

  console.log("[QBSyncWorker] Started successfully");
}

/**
 * Stop the QuickBooks sync worker.
 */
export function stopQuickBooksSyncWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[QBSyncWorker] Stopped");
  }
}

/**
 * Get worker status.
 */
export function getQuickBooksSyncWorkerStatus(): {
  running: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  config: SyncWorkerConfig;
  lastResults: Record<number, FullSyncResult | { error: string }>;
} {
  return {
    running: workerInterval !== null,
    isSyncing,
    lastSyncAt,
    nextSyncAt: lastSyncAt && workerInterval
      ? new Date(lastSyncAt.getTime() + config.syncIntervalMs)
      : null,
    config,
    lastResults: Object.fromEntries(lastSyncResults),
  };
}

/**
 * Run a single sync cycle for all connected QB accounts.
 */
async function runSyncCycle(): Promise<void> {
  if (isSyncing) {
    console.log("[QBSyncWorker] Sync already in progress, skipping cycle");
    return;
  }

  isSyncing = true;

  try {
    // Get all users with QB connections
    const connections = await db.getAllQuickBooksConnections();

    if (connections.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[QBSyncWorker] Starting sync cycle for ${connections.length} connection(s)`);

    for (const conn of connections) {
      try {
        const result = await runFullSync(conn.userId);
        lastSyncResults.set(conn.userId, result);

        if ("error" in result) {
          console.warn(`[QBSyncWorker] Sync failed for user ${conn.userId}: ${result.error}`);
        } else {
          console.log(
            `[QBSyncWorker] Sync completed for user ${conn.userId}: ` +
            `${result.totalProcessed} records in ${result.duration}ms ` +
            `(${result.totalErrors} errors)`
          );
        }
      } catch (err: any) {
        console.error(`[QBSyncWorker] Sync error for user ${conn.userId}:`, err.message);
        lastSyncResults.set(conn.userId, { error: err.message });
      }
    }

    lastSyncAt = new Date();
    console.log("[QBSyncWorker] Sync cycle complete");
  } catch (error: any) {
    console.error("[QBSyncWorker] Sync cycle failed:", error.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Manually trigger a sync cycle (used by the API).
 */
export async function triggerQuickBooksSync(userId: number): Promise<FullSyncResult | { error: string }> {
  const result = await runFullSync(userId);
  lastSyncResults.set(userId, result);
  if (!("error" in result)) {
    lastSyncAt = new Date();
  }
  return result;
}
