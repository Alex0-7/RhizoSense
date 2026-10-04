import React, { useState, useEffect } from "react";
import { useFarm } from "../../state/FarmContext";
import { offlineStorage } from "../../services/storage";
import {
  Wifi,
  WifiOff,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Clock,
  CloudUpload,
  AlertTriangle,
} from "lucide-react";
import { SyncRecord } from "../../types/canonical";

export const OfflineSyncPage: React.FC = () => {
  const {
    network,
    syncState,
    pendingSyncCount,
    lastSyncedAt,
    toggleSimulatedOffline,
    flushSyncQueue,
  } = useFarm();

  const [storedCount, setStoredCount] = useState<number>(0);
  const [pendingRecords, setPendingRecords] = useState<SyncRecord[]>([]);

  useEffect(() => {
    const updateStats = async () => {
      const count = await offlineStorage.getStoredItemCount();
      setStoredCount(count);
      const records = await offlineStorage.getPendingSyncRecords();
      setPendingRecords(records);
    };
    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, [pendingSyncCount, syncState]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase mb-2">
            First-Class Offline Architecture
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Offline & Cloud Synchronization
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Monitor browser IndexedDB persistence, local event queue, and network connectivity state.
          </p>
        </div>

        {/* Manual Rehearsal Toggle for SIH Demo */}
        <button
          type="button"
          onClick={toggleSimulatedOffline}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-2 ${
            network === "offline"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
        >
          {network === "offline" ? (
            <>
              <Wifi className="w-4 h-4" /> Restore Connection
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" /> Simulate Disconnect (Demo)
            </>
          )}
        </button>
      </div>

      {/* 4 Status Pillars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Internet */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-center">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Internet Uplink
          </div>
          <div
            className={`mt-1 text-sm font-black flex items-center justify-center gap-1.5 ${
              network === "online" ? "text-emerald-700" : "text-amber-600"
            }`}
          >
            {network === "online" ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {network === "online" ? "ONLINE" : "OFFLINE"}
          </div>
        </div>

        {/* Edge AI */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-center">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Edge AI Core
          </div>
          <div className="mt-1 text-sm font-black text-emerald-700 flex items-center justify-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-600" />
            LOCAL ACTIVE
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-center">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Local Storage
          </div>
          <div className="mt-1 text-sm font-black text-slate-900 flex items-center justify-center gap-1.5 font-mono">
            <Database className="w-4 h-4 text-emerald-700" />
            {storedCount} Items
          </div>
        </div>

        {/* Sync */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-center">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Sync State
          </div>
          <div
            className={`mt-1 text-sm font-black flex items-center justify-center gap-1.5 ${
              syncState === "syncing"
                ? "text-blue-600 animate-pulse"
                : pendingSyncCount > 0
                ? "text-amber-600"
                : "text-emerald-700"
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            {syncState === "syncing"
              ? "SYNCING..."
              : pendingSyncCount > 0
              ? `${pendingSyncCount} QUEUED`
              : "UP TO DATE"}
          </div>
        </div>
      </div>

      {/* Sync Queue Manager */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Offline Action Queue ({pendingRecords.length})
            </h2>
            <p className="text-xs text-slate-500">
              Farmer actions, scans, and alert resolutions generated while disconnected are queued here with retry metadata.
            </p>
          </div>

          <button
            type="button"
            disabled={syncState === "syncing" || network === "offline" || pendingRecords.length === 0}
            onClick={flushSyncQueue}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === "syncing" ? "animate-spin" : ""}`} />
            Sync Now
          </button>
        </div>

        {pendingRecords.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            All local actions are synchronized with cloud backend.
            {lastSyncedAt && (
              <div className="mt-1 font-mono text-[11px] text-slate-400">
                Last synchronized: {new Date(lastSyncedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {pendingRecords.map((rec) => (
              <div
                key={rec.local_id}
                className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-900">{rec.event_type}</span>
                    <span className="text-[10px] text-slate-500 font-mono">ID: {rec.local_id}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Zone: {rec.payload?.zone_id || "N/A"} • Action: {rec.payload?.action || rec.payload?.action_taken || "Logged"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
                    PENDING UPLOAD
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">Retries: {rec.retry_count}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
