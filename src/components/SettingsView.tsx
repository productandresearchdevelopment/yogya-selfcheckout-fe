"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
  RefreshCw,
  Archive,
  Download,
  Trash2,
  Activity,
  AlertTriangle,
  Play,
} from "lucide-react";
import {
  SystemHealth,
  getSystemHealth,
  SystemReadinessResponse,
  getSystemReadiness,
  ResourceUsageResponse,
  getResourceUsage,
  BackupItem,
  listBackups,
  createBackup,
  restoreBackup,
  cleanupArtifacts,
} from "@/lib/api";

export const SettingsView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [readiness, setReadiness] = useState<SystemReadinessResponse | null>(null);
  const [resources, setResources] = useState<ResourceUsageResponse | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Backup & Cleanup State
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupLabel, setBackupLabel] = useState("manual_backup");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [h, r, res, b] = await Promise.all([
        getSystemHealth(),
        getSystemReadiness(),
        getResourceUsage(),
        listBackups(),
      ]);
      setHealth(h);
      setReadiness(r);
      setResources(res);
      setBackups(b);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setFeedback(null);
    try {
      const res = await createBackup(backupLabel);
      setFeedback(`Backup created successfully: ${res.backup_name} (${(res.archive_size_bytes / (1024 * 1024)).toFixed(2)} MB, ${res.total_files_archived} files).`);
      const updatedBackups = await listBackups();
      setBackups(updatedBackups);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleTestRestore = async (filename: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await restoreBackup(filename, true);
      setFeedback(`Dry-run restoration test passed! Verified and staged ${res.files_restored} files into temporary isolated sandbox: ${res.destination}`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Restoration test failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupArtifacts = async (dryRun: boolean) => {
    setIsCleaning(true);
    setFeedback(null);
    try {
      const res = await cleanupArtifacts(3, dryRun);
      setFeedback(res.message);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Settings className="h-5 w-5 text-indigo-400" />
            <span>Production Readiness, Resource Monitor & Storage</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Section 5 Production Suite: System resource telemetry, gallery readiness, verifiable backup archives, and safe retention management.
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 text-xs text-cyan-300 flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Production Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">CPU Utilization</span>
          <span className="text-2xl font-bold font-mono text-white block">
            {resources?.cpu.cpu_percent.toFixed(1) ?? "0.0"}%
          </span>
          <span className="text-[10px] text-slate-500">{resources?.cpu.cpu_cores ?? "—"} Logical Cores • {resources?.runtime.torch_threads ?? 1} Torch Threads</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">System RAM</span>
          <span className="text-2xl font-bold font-mono text-cyan-400 block">
            {resources?.ram.used_gb.toFixed(1) ?? "—"} / {resources?.ram.total_gb.toFixed(1) ?? "—"} GB
          </span>
          <span className="text-[10px] text-slate-500">{resources?.ram.available_gb.toFixed(1) ?? "—"} GB Free • Process RSS: {resources?.ram.process_rss_mb.toFixed(0) ?? "—"} MB</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Storage Capacity</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 block">
            {resources?.disk.free_gb.toFixed(1) ?? "—"} GB
          </span>
          <span className="text-[10px] text-slate-500">{resources?.disk.percent_used.toFixed(0) ?? "0"}% Used ({resources?.disk.total_gb.toFixed(1) ?? "—"} GB Total)</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Gallery Synchronization</span>
          <span className={`text-2xl font-bold font-mono block ${readiness?.gallery_synchronization === "SYNCHRONIZED" ? "text-emerald-400" : "text-amber-400"}`}>
            {readiness?.gallery_synchronization ?? "UNKNOWN"}
          </span>
          <span className="text-[10px] text-slate-500">{readiness?.gallery_stats.active_reference_vectors ?? 0} active vectors ({readiness?.gallery_stats.registered_active_skus ?? 0} SKUs)</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Acceleration & Readiness */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Inference Hardware & Model Readiness</span>
            </h2>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
              Active: {health?.device || "Detecting..."}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span className="text-slate-400">Application Status</span>
              <span className="font-mono text-emerald-400 font-bold flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{readiness?.application_health || "ONLINE"}</span>
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span className="text-slate-400">Model Serving Readiness</span>
              <span className="font-mono text-white font-semibold">
                {readiness?.model_readiness || "READY"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span className="text-slate-400">Active Visual Backbone</span>
              <span className="font-mono text-cyan-300">
                {readiness?.active_models.embedding_model} ({readiness?.active_models.embedding_dim}-dim)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span className="text-slate-400">Active Object Detector</span>
              <span className="font-mono text-indigo-300">
                {readiness?.active_models.detector_model}
              </span>
            </div>
          </div>
        </div>

        {/* Local Storage Architecture */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-emerald-400" />
              <span>Local File Storage Architecture</span>
            </h2>
            <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/40">
              Local-First
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {health?.storage_paths ? (
              Object.entries(health.storage_paths).map(([key, path]) => (
                <div key={key} className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase text-slate-500 font-sans block">{key}</span>
                  <p className="text-[11px] text-slate-300 truncate" title={path}>
                    {path}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs">Loading storage paths...</div>
            )}
          </div>
        </div>
      </div>

      {/* Storage, Backup & Disaster Recovery Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Archive className="h-4 w-4 text-cyan-400" />
              <span>Verifiable Backup, Restoration & Retention Management</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Atomic ZIP archives containing SQLite database, registered images, checkpoints, and SHA-256 manifests.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={backupLabel}
              onChange={(e) => setBackupLabel(e.target.value)}
              placeholder="Backup label..."
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white"
            />
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="flex items-center space-x-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50 shrink-0"
            >
              <Download className={`h-3.5 w-3.5 ${isCreatingBackup ? "animate-spin" : ""}`} />
              <span>{isCreatingBackup ? "Archiving..." : "Create Backup"}</span>
            </button>
          </div>
        </div>

        {/* Backup Archives Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Backup Archives ({backups.length})
          </h4>

          {backups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[10px] font-semibold text-slate-400 border-b border-slate-800 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Archive Filename</th>
                    <th className="px-4 py-2.5">Label</th>
                    <th className="px-4 py-2.5 text-center">Files</th>
                    <th className="px-4 py-2.5 text-center">SKUs / Images</th>
                    <th className="px-4 py-2.5 text-center">Size</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {backups.map((b) => (
                    <tr key={b.filename} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 text-cyan-300">{b.filename}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-sans">{b.label}</td>
                      <td className="px-4 py-2.5 text-center">{b.total_files}</td>
                      <td className="px-4 py-2.5 text-center text-slate-400">
                        {b.skus_count} SKUs • {b.images_count} Imgs
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {(b.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans">
                        <button
                          onClick={() => handleTestRestore(b.filename)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mr-2"
                          title="Extract to isolated temporary sandbox and verify integrity"
                        >
                          Test Restore (Staging)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-slate-950/60 border border-slate-800">
              No backup archives created yet. Click "Create Backup" above to archive database, images, and model checkpoints.
            </div>
          )}
        </div>

        {/* Safe Artifact Retention Cleanup Utility */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Trash2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Safe Artifact Retention & Obsolete Checkpoint Pruning</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identifies abandoned checkpoints from failed training jobs and temporary crops older than 48 hours. Strictly protects active models, baselines, and registered gallery images.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCleanupArtifacts(true)}
              disabled={isCleaning}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Dry Run (Preview)
            </button>
            <button
              onClick={() => {
                if (confirm("Purge obsolete checkpoints and expired crops? Active models and reference images will be protected.")) {
                  handleCleanupArtifacts(false);
                }
              }}
              disabled={isCleaning}
              className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/40"
            >
              Execute Safe Prune
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
