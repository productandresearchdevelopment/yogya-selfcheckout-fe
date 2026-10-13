"use client";

import React from "react";
import {
  Package,
  Image as ImageIcon,
  Tag,
  Database,
  Crosshair,
  Cpu,
  Layers,
  ArrowRight,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { DashboardStats } from "@/lib/api";
import { NavTab } from "./Navbar";

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, loading, onNavigate }) => {
  if (loading && !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading studio metrics...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Registered SKUs",
      value: stats?.sku_count ?? 0,
      subValue: `${stats?.active_sku_count ?? 0} Active`,
      icon: Package,
      color: "from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-400",
    },
    {
      title: "Reference Images",
      value: stats?.reference_image_count ?? 0,
      subValue: "Indexed in Gallery",
      icon: ImageIcon,
      color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400",
    },
    {
      title: "Training Images",
      value: stats?.training_image_count ?? 0,
      subValue: "Dataset Candidates",
      icon: Layers,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
    },
    {
      title: "BBox Annotations",
      value: stats?.annotation_count ?? 0,
      subValue: "Detector Fine-Tuning",
      icon: Tag,
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 text-xs text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Phase 1 — Computer Vision Pipeline Baseline</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Product Recognition Studio
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Local-first computer vision studio for SKU registration, dataset management, object localization,
            and baseline visual embedding recognition. Images and models remain 100% on-device.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate("playground")}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02]"
            >
              <Crosshair className="h-4 w-4" />
              <span>Launch Recognition Playground</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onNavigate("skus")}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Package className="h-4 w-4 text-cyan-400" />
              <span>Register New SKU</span>
            </button>
            <button
              onClick={() => onNavigate("datasets")}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Manage Datasets & Annotations</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-sm transition-all hover:border-slate-600 ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div className="rounded-xl bg-slate-900/60 p-2 border border-slate-800">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-black text-white">{card.value}</span>
                <span className="text-[11px] font-medium text-slate-400">{card.subValue}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Models Status and Architecture Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Models Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Active Baseline Architecture</h2>
            </div>
            <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/40">
              Loaded
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
              <span className="text-[10px] font-semibold uppercase text-slate-500">Object Localization</span>
              <p className="font-mono text-cyan-300 font-medium mt-0.5">{stats?.active_detector || "fasterrcnn_mobilenet_v3_large_fpn"}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pretrained FasterRCNN returning real bounding boxes & crops.</p>
            </div>

            <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
              <span className="text-[10px] font-semibold uppercase text-slate-500">Visual Feature Embedder</span>
              <p className="font-mono text-indigo-300 font-medium mt-0.5">{stats?.active_embedder || "mobilenet_v3_large"}</p>
              <p className="text-[11px] text-slate-400 mt-1">960-dim pooled representation with consistent ImageNet normalization.</p>
            </div>

            <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
              <span className="text-[10px] font-semibold uppercase text-slate-500">Inference Hardware</span>
              <p className="font-mono text-emerald-300 font-medium mt-0.5">{stats?.device_info || "CPU"}</p>
              <p className="text-[11px] text-slate-400 mt-1">Dynamic device selection (CPU / CUDA / MPS).</p>
            </div>
          </div>
        </div>

        {/* Recent Evaluation Runs */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Recent Evaluation Runs</h2>
            </div>
            <button
              onClick={() => onNavigate("playground")}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>Open Playground</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {stats?.recent_runs && stats.recent_runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="pb-2.5">Query Image</th>
                    <th className="pb-2.5">Detections</th>
                    <th className="pb-2.5">Result</th>
                    <th className="pb-2.5">Cosine Similarity</th>
                    <th className="pb-2.5 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {stats.recent_runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 text-slate-300 truncate max-w-[140px] font-sans">
                        {run.query_image_name}
                      </td>
                      <td className="py-2.5 text-slate-300">
                        {run.num_detections} object{run.num_detections !== 1 ? "s" : ""}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                            run.final_status === "MATCHED"
                              ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/50"
                              : "bg-amber-950/70 text-amber-400 border border-amber-800/50"
                          }`}
                        >
                          {run.final_status === "MATCHED" ? run.top_predicted_sku : "UNKNOWN"}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300">
                        {run.top_similarity !== null ? run.top_similarity.toFixed(3) : "—"}
                      </td>
                      <td className="py-2.5 text-right text-slate-400">
                        {run.duration_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-slate-600" />
              <p className="text-xs text-slate-400">No recognition evaluation runs recorded yet.</p>
              <button
                onClick={() => onNavigate("playground")}
                className="mt-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Upload an image in the Playground &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
