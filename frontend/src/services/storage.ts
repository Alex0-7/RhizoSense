/**
 * RhizoSense V2 — Offline Persistence Engine
 * Uses IndexedDB with localStorage fallback for resilient offline operation.
 * Adheres to docs/07_OFFLINE_FIRST.md
 */

import { Zone, DiagnosisResult, SyncRecord } from "../types/canonical";
import { Notification } from "../types";

const DB_NAME = "RhizoSense_V2_DB";
const DB_VERSION = 1;

interface DBSchema {
  zones: Zone;
  diagnoses: DiagnosisResult;
  alerts: Notification;
  sync_queue: SyncRecord;
}

class OfflineStorage {
  private dbPromise: Promise<IDBDatabase | null>;
  private isAvailable: boolean = true;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !window.indexedDB) {
      this.isAvailable = false;
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains("zones")) {
            db.createObjectStore("zones", { keyPath: "zone_id" });
          }
          if (!db.objectStoreNames.contains("diagnoses")) {
            db.createObjectStore("diagnoses", { keyPath: "zone_id" });
          }
          if (!db.objectStoreNames.contains("alerts")) {
            db.createObjectStore("alerts", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("sync_queue")) {
            db.createObjectStore("sync_queue", { keyPath: "local_id" });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[OfflineStorage] IndexedDB failed to open, falling back to localStorage");
          this.isAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn("[OfflineStorage] IndexedDB initialization error:", err);
        this.isAvailable = false;
        resolve(null);
      }
    });
  }

  // Generic store save
  private async putItem<T>(storeName: "zones" | "diagnoses" | "alerts" | "sync_queue", item: T, keyFallback: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          store.put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    } else {
      // LocalStorage fallback
      try {
        const existing = JSON.parse(localStorage.getItem(`rhizo_${storeName}`) || "{}");
        existing[keyFallback] = item;
        localStorage.setItem(`rhizo_${storeName}`, JSON.stringify(existing));
      } catch (e) {
        console.error("[OfflineStorage] LocalStorage error:", e);
      }
    }
  }

  // Generic store get all
  private async getAllItems<T>(storeName: "zones" | "diagnoses" | "alerts" | "sync_queue"): Promise<T[]> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    } else {
      try {
        const existing = JSON.parse(localStorage.getItem(`rhizo_${storeName}`) || "{}");
        return Object.values(existing) as T[];
      } catch {
        return [];
      }
    }
  }

  // Zones
  async saveZones(zones: Zone[]): Promise<void> {
    for (const z of zones) {
      await this.putItem("zones", z, z.zone_id);
    }
  }

  async getZones(): Promise<Zone[]> {
    return this.getAllItems<Zone>("zones");
  }

  // Diagnoses
  async saveDiagnosis(diag: DiagnosisResult): Promise<void> {
    await this.putItem("diagnoses", diag, diag.zone_id);
  }

  async getDiagnosis(zone_id: string): Promise<DiagnosisResult | null> {
    const all = await this.getAllItems<DiagnosisResult>("diagnoses");
    return all.find((d) => d.zone_id === zone_id) || null;
  }

  async getAllDiagnoses(): Promise<DiagnosisResult[]> {
    return this.getAllItems<DiagnosisResult>("diagnoses");
  }

  // Alerts
  async saveAlerts(alerts: Notification[]): Promise<void> {
    for (const a of alerts) {
      await this.putItem("alerts", a, a.id);
    }
  }

  async getAlerts(): Promise<Notification[]> {
    return this.getAllItems<Notification>("alerts");
  }

  // Sync Queue
  async enqueueSyncRecord(record: SyncRecord): Promise<void> {
    await this.putItem("sync_queue", record, record.local_id);
  }

  async getPendingSyncRecords(): Promise<SyncRecord[]> {
    const all = await this.getAllItems<SyncRecord>("sync_queue");
    return all.filter((r) => r.sync_status === "PENDING");
  }

  async removeSyncRecord(local_id: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction("sync_queue", "readwrite");
          const store = tx.objectStore("sync_queue");
          store.delete(local_id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    } else {
      try {
        const existing = JSON.parse(localStorage.getItem("rhizo_sync_queue") || "{}");
        delete existing[local_id];
        localStorage.setItem("rhizo_sync_queue", JSON.stringify(existing));
      } catch {}
    }
  }

  async clearSyncedRecords(): Promise<void> {
    const pending = await this.getPendingSyncRecords();
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      store.clear();
      for (const p of pending) {
        store.put(p);
      }
    }
  }

  async getStoredItemCount(): Promise<number> {
    const zones = await this.getZones();
    const diagnoses = await this.getAllDiagnoses();
    const alerts = await this.getAlerts();
    return zones.length + diagnoses.length + alerts.length;
  }
}

export const offlineStorage = new OfflineStorage();
