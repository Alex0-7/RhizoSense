/**
 * RhizoSense V2 — Sync Manager
 * Manages offline queueing, connectivity detection, and opportunistic synchronization.
 * Adheres to docs/07_OFFLINE_FIRST.md
 */

import { offlineStorage } from "./storage";
import { SyncRecord } from "../types/canonical";

export type NetworkStatus = "online" | "offline";
export type SyncStatusState = "idle" | "syncing" | "synced" | "error";

export interface SyncStateInfo {
  network: NetworkStatus;
  syncState: SyncStatusState;
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

type SyncListener = (state: SyncStateInfo) => void;

class SyncManager {
  private network: NetworkStatus = typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online";
  private syncState: SyncStatusState = "idle";
  private pendingCount: number = 0;
  private lastSyncedAt: string | null = null;
  private errorMessage?: string;
  private listeners: Set<SyncListener> = new Set();
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.network = navigator.onLine ? "online" : "offline";
      window.addEventListener("online", () => this.handleNetworkChange("online"));
      window.addEventListener("offline", () => this.handleNetworkChange("offline"));
      this.refreshPendingCount();
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  getState(): SyncStateInfo {
    return {
      network: this.network,
      syncState: this.syncState,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      errorMessage: this.errorMessage,
    };
  }

  private async refreshPendingCount() {
    const pending = await offlineStorage.getPendingSyncRecords();
    this.pendingCount = pending.length;
    this.notify();
  }

  private async handleNetworkChange(status: NetworkStatus) {
    this.network = status;
    this.notify();
    if (status === "online") {
      console.log("[SyncManager] Connectivity restored. Initiating opportunistic sync...");
      await this.flushQueue();
    }
  }

  async enqueueAction(eventType: string, payload: Record<string, any>): Promise<SyncRecord> {
    const local_id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: SyncRecord = {
      local_id,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      payload,
      sync_status: "PENDING",
      retry_count: 0,
    };

    await offlineStorage.enqueueSyncRecord(record);
    await this.refreshPendingCount();

    // If online, attempt to sync immediately
    if (this.network === "online") {
      this.flushQueue().catch(console.error);
    }

    return record;
  }

  async flushQueue(): Promise<void> {
    if (this.isSyncing) return;
    if (this.network === "offline") {
      this.notify();
      return;
    }

    const pending = await offlineStorage.getPendingSyncRecords();
    if (pending.length === 0) {
      this.syncState = "synced";
      this.notify();
      return;
    }

    this.isSyncing = true;
    this.syncState = "syncing";
    this.notify();

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with HTTP ${response.status}`);
      }

      // Success: clear synced records
      for (const rec of pending) {
        await offlineStorage.removeSyncRecord(rec.local_id);
      }

      this.lastSyncedAt = new Date().toISOString();
      this.syncState = "synced";
      this.errorMessage = undefined;
    } catch (err: any) {
      console.warn("[SyncManager] Sync failed, will retry later:", err);
      this.syncState = "error";
      this.errorMessage = err.message || "Failed to synchronize records";
    } finally {
      this.isSyncing = false;
      await this.refreshPendingCount();
    }
  }

  // Force simulated offline toggle for demo rehearsal (FR-009, 10_DEMO_SCENARIO.md)
  setSimulatedOffline(isOffline: boolean) {
    this.handleNetworkChange(isOffline ? "offline" : "online");
  }
}

export const syncManager = new SyncManager();
