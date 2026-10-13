"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  Brain,
  Crosshair,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Play,
  Square,
  Sliders,
  Check,
  Zap,
  Activity,
  Cpu,
  ShieldAlert,
  BarChart2,
  Terminal,
  Sparkles,
} from "lucide-react";
import {
  getSystemHealth,
  getDatasetReadiness,
  seedDatasetSamples,
  startTrainingJob,
  getTrainingJobs,
  getTrainingJob,
  cancelTrainingJob,
  getRegisteredModels,
  activateModel,
  runDetectorEvaluation,
  runEmbeddingEvaluation,
  SystemHealth,
  DatasetReadinessResponse,
  TrainingJobResponse,
  ModelRegistryItem,
  DetectorEvaluationResponse,
  EmbeddingEvaluationResponse,
} from "@/lib/api";

type TabType = "readiness" | "train" | "registry" | "evaluation";

export default function TrainingModelsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("readiness");
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [readiness, setReadiness] = useState<DatasetReadinessResponse | null>(null);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [jobs, setJobs] = useState<TrainingJobResponse[]>([]);
  const [activeJob, setActiveJob] = useState<TrainingJobResponse | null>(null);

  // Training Form State
  const [epochs, setEpochs] = useState<number>(3);
  const [embeddingDim, setEmbeddingDim] = useState<number>(512);
  const [learningRate, setLearningRate] = useState<number>(0.0001);
  const [margin, setMargin] = useState<number>(0.2);
  const [isSubmittingTrain, setIsSubmittingTrain] = useState<boolean>(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  // Seeding State
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Activation State
  const [activatingModelId, setActivatingModelId] = useState<string | null>(null);
  const [activationFeedback, setActivationFeedback] = useState<string | null>(null);

  // Evaluation State
  const [evalLoading, setEvalLoading] = useState<boolean>(false);
  const [detEval, setDetEval] = useState<DetectorEvaluationResponse | null>(null);
  const [embEval, setEmbEval] = useState<EmbeddingEvaluationResponse | null>(null);
  const [evalSimThreshold, setEvalSimThreshold] = useState<number>(0.60);

  // Loading indicator
  const [loading, setLoading] = useState<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCoreData = async () => {
    setLoading(true);
    try {
      const [h, r, m, j] = await Promise.all([
        getSystemHealth(),
        getDatasetReadiness(),
        getRegisteredModels(),
        getTrainingJobs(),
      ]);
      setHealth(h);
      setReadiness(r);
      setModels(m);
      setJobs(j);
      if (j.length > 0 && (j[0].status === "RUNNING" || j[0].status === "QUEUED")) {
        setActiveJob(j[0]);
      } else if (j.length > 0 && !activeJob) {
        setActiveJob(j[0]);
      }
    } catch (err) {
      console.error("Error fetching studio training data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoreData();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll active training job when RUNNING or QUEUED
  useEffect(() => {
    if (activeJob && (activeJob.status === "RUNNING" || activeJob.status === "QUEUED")) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await getTrainingJob(activeJob.job_id);
          setActiveJob(updated);
          if (updated.status !== "RUNNING" && updated.status !== "QUEUED") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            // Refresh models and jobs list
            const [m, jList] = await Promise.all([getRegisteredModels(), getTrainingJobs()]);
            setModels(m);
            setJobs(jList);
          }
        } catch {
          // ignore transient poll error
        }
      }, 2000);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeJob?.status, activeJob?.job_id]);

  const handleStartTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTrain(true);
    setTrainError(null);
    try {
      const job = await startTrainingJob({
        epochs,
        embedding_dim: embeddingDim,
        learning_rate: learningRate,
        margin,
      });
      setActiveJob(job);
      setActiveTab("train");
      const jList = await getTrainingJobs();
      setJobs(jList);
    } catch (err: unknown) {
      setTrainError(err instanceof Error ? err.message : "Training request failed");
    } finally {
      setIsSubmittingTrain(false);
    }
  };

  const handleCancelTraining = async () => {
    if (!activeJob) return;
    try {
      await cancelTrainingJob(activeJob.job_id);
      const updated = await getTrainingJob(activeJob.job_id);
      setActiveJob(updated);
    } catch (err: unknown) {
      console.error("Cancel failed:", err);
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const res = await seedDatasetSamples();
      setSeedMessage(res.message);
      const r = await getDatasetReadiness();
      setReadiness(r);
    } catch (err: unknown) {
      setSeedMessage(err instanceof Error ? err.message : "Seeding failed");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleActivateModel = async (modelId: string) => {
    setActivatingModelId(modelId);
    setActivationFeedback(null);
    try {
      const res = await activateModel(modelId);
      setActivationFeedback(res.message);
      const [m, h] = await Promise.all([getRegisteredModels(), getSystemHealth()]);
      setModels(m);
      setHealth(h);
    } catch (err: unknown) {
      setActivationFeedback(err instanceof Error ? err.message : "Failed to activate model");
    } finally {
      setActivatingModelId(null);
    }
  };

  const handleRunEvaluation = async () => {
    setEvalLoading(true);
    try {
      const [d, e] = await Promise.all([
        runDetectorEvaluation(0.35),
        runEmbeddingEvaluation(undefined, evalSimThreshold),
      ]);
      setDetEval(d);
      setEmbEval(e);
    } catch (err) {
      console.error("Evaluation execution failed:", err);
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400">
              <Brain className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Pretrained Models, Deep Metric Learning & Model Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Section 2 Metric Learning Studio: Fine-tune MobileNetV3 visual embeddings via Triplet Loss with Hard Negative Mining, manage versioned checkpoints in the registry, and atomically migrate gallery embeddings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchCoreData}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("readiness")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "readiness"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Database className="h-4 w-4" />
          <span>1. Dataset Readiness</span>
          {readiness && (
            <span
              className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono ${
                readiness.is_ready ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"
              }`}
            >
              {readiness.status}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("train")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "train"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>2. Deep Metric Training</span>
          {activeJob && (activeJob.status === "RUNNING" || activeJob.status === "QUEUED") && (
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("registry")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "registry"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>3. Model Registry & Checkpoints</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 ml-1">
            {models.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("evaluation");
            if (!detEval && !embEval) handleRunEvaluation();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "evaluation"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>4. Comparative Benchmarks</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: DATASET READINESS & VALIDATION */}
      {/* ============================================================== */}
      {activeTab === "readiness" && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div
            className={`rounded-2xl border p-5 ${
              readiness?.is_ready
                ? "border-emerald-500/30 bg-emerald-950/20"
                : "border-amber-500/30 bg-amber-950/20"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start space-x-3">
                {readiness?.is_ready ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Dataset Metric Learning Status:</span>
                    <span
                      className={`font-mono px-2 py-0.5 rounded text-xs ${
                        readiness?.is_ready ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"
                      }`}
                    >
                      {readiness?.status || "CHECKING"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {readiness?.is_ready
                      ? "The dataset contains multiple active SKU identities with suitable positive & negative examples for contrastive triplet loss."
                      : "The dataset does not yet meet minimum metric learning conditions. Review the blockers below."}
                  </p>
                </div>
              </div>

              {/* Sample seeder utility */}
              <button
                onClick={handleSeedSamples}
                disabled={isSeeding}
                className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/60 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 disabled:opacity-50 shrink-0"
              >
                <Sparkles className={`h-4 w-4 ${isSeeding ? "animate-spin" : ""}`} />
                <span>{isSeeding ? "Generating..." : "Generate Train/Val Augmentations"}</span>
              </button>
            </div>

            {seedMessage && (
              <div className="mt-4 rounded-xl bg-slate-900/80 p-3 text-xs text-cyan-300 border border-slate-800">
                {seedMessage}
              </div>
            )}
          </div>

          {/* Blockers & Recommendations List */}
          {readiness && readiness.blockers.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4" />
                <span>Active Dataset Blockers ({readiness.blockers.length})</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {readiness.blockers.map((b, i) => (
                  <li key={i} className="text-amber-300 font-medium">{b}</li>
                ))}
              </ul>
              {readiness.recommendations.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Actionable Recommendations:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
                    {readiness.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Metric Learning Dataset Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Total SKUs</span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">
                {readiness?.summary.total_skus ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">{readiness?.summary.active_skus ?? 0} active</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Total Images</span>
              <span className="text-2xl font-bold font-mono text-cyan-400 mt-1 block">
                {readiness?.summary.total_images ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">
                {readiness?.summary.reference_images ?? 0} ref • {readiness?.summary.training_images ?? 0} train • {readiness?.summary.validation_images ?? 0} val
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">SKUs with &gt;= 2 Images</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {readiness?.summary.skus_with_multiple_images ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">Required for positive pairs</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Hard Negatives & Unknowns</span>
              <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                {readiness?.summary.hard_negative_unknown_count ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">Tissue, fruits, hands</span>
            </div>
          </div>

          {/* Hardware & Memory Constraints Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <span>Runtime Hardware & Training Resource Strategy</span>
              </h4>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-700">
                Active: {health?.device || "Detecting..."}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
                <span className="text-slate-400 block">Host Processor</span>
                <span className="font-semibold text-white mt-0.5 block">Intel Core i5-13420H ({health?.cpu_cores ?? "N/A"} Cores)</span>
                <span className="text-[10px] text-slate-500 mt-1 block">Optimized for PyTorch CPU multi-threading</span>
              </div>
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
                <span className="text-slate-400 block">Memory Allocation</span>
                <span className="font-semibold text-white mt-0.5 block">8 GB RAM (Conservative Budget)</span>
                <span className="text-[10px] text-slate-500 mt-1 block">Single training mutex + small batch size (P=2, K=2)</span>
              </div>
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
                <span className="text-slate-400 block">Backbone Strategy</span>
                <span className="font-semibold text-white mt-0.5 block">Frozen Feature Extractor + Projection Head</span>
                <span className="text-[10px] text-slate-500 mt-1 block">Preserves pretrained zero-shot generalization</span>
              </div>
            </div>
          </div>

          {/* Per-SKU Image Distribution Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                SKU Identity & Split Distribution
              </h4>
              <span className="text-xs text-slate-500">
                {readiness?.sku_details.length ?? 0} Active SKUs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">SKU Code</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3 text-center">Ref Gallery</th>
                    <th className="px-4 py-3 text-center">Train Split</th>
                    <th className="px-4 py-3 text-center">Val Split</th>
                    <th className="px-4 py-3 text-center">Total Images</th>
                    <th className="px-4 py-3 text-right">Metric Pair Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {readiness?.sku_details.map((sku) => (
                    <tr key={sku.sku_id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-cyan-300 font-semibold">{sku.sku_code}</td>
                      <td className="px-4 py-3 text-slate-200">{sku.sku_name}</td>
                      <td className="px-4 py-3 text-center font-mono">{sku.reference_images}</td>
                      <td className="px-4 py-3 text-center font-mono">{sku.training_images}</td>
                      <td className="px-4 py-3 text-center font-mono">{sku.val_images}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{sku.total_images}</td>
                      <td className="px-4 py-3 text-right">
                        {sku.has_sufficient_pairs ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                            <Check className="h-3 w-3" />
                            <span>Pair Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-950/60 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                            <span>Needs &gt;=2 Imgs</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DEEP METRIC TRAINING PIPELINE */}
      {/* ============================================================== */}
      {activeTab === "train" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <span>Hyperparameter Configuration</span>
              </h3>
              <p className="text-xs text-slate-400">
                Supervised contrastive triplet loss with semi-hard negative mining. Runs on CPU with memory bounds.
              </p>

              <form onSubmit={handleStartTraining} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Training Epochs ({epochs})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={epochs}
                    onChange={(e) => setEpochs(parseInt(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1 (Fast)</span>
                    <span>3 (Recommended)</span>
                    <span>10 (Full)</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Embedding Projection Dimension
                  </label>
                  <select
                    value={embeddingDim}
                    onChange={(e) => setEmbeddingDim(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value={256}>256-dim (Ultra Compact)</option>
                    <option value={512}>512-dim (Balanced Metric Space)</option>
                    <option value={768}>768-dim (High Capacity)</option>
                    <option value={960}>960-dim (Backbone Matched)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Learning Rate (AdamW)
                  </label>
                  <input
                    type="number"
                    step="0.00005"
                    value={learningRate}
                    onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Cosine Triplet Margin (α = {margin})
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={margin}
                    onChange={(e) => setMargin(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Higher margin enforces wider angular separation between distinct SKUs.
                  </span>
                </div>

                {trainError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300">
                    {trainError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingTrain || activeJob?.status === "RUNNING"}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.01] transition disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  <span>
                    {isSubmittingTrain
                      ? "Starting..."
                      : activeJob?.status === "RUNNING"
                      ? "Job in Progress..."
                      : "Start Metric Learning Job"}
                  </span>
                </button>
              </form>
            </div>

            {/* Live Job Console & Metrics */}
            <div className="lg:col-span-2 space-y-4">
              {activeJob ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-cyan-400 font-semibold">{activeJob.job_id}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                            activeJob.status === "COMPLETED"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                              : activeJob.status === "RUNNING"
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30 animate-pulse"
                              : activeJob.status === "FAILED"
                              ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {activeJob.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Model ID: {activeJob.model_id}
                      </span>
                    </div>

                    {activeJob.status === "RUNNING" && (
                      <button
                        onClick={handleCancelTraining}
                        className="flex items-center space-x-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40"
                      >
                        <Square className="h-3.5 w-3.5" />
                        <span>Cancel Job</span>
                      </button>
                    )}
                  </div>

                  {/* Progress & Loss Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <span className="text-slate-400 block">Epoch Progress</span>
                      <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                        {activeJob.current_epoch} / {activeJob.total_epochs}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <span className="text-slate-400 block">Train Loss</span>
                      <span className="text-lg font-bold font-mono text-cyan-400 mt-0.5 block">
                        {activeJob.train_loss !== null ? activeJob.train_loss?.toFixed(4) : "—"}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <span className="text-slate-400 block">Validation Loss</span>
                      <span className="text-lg font-bold font-mono text-indigo-400 mt-0.5 block">
                        {activeJob.val_loss !== null ? activeJob.val_loss?.toFixed(4) : "—"}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <span className="text-slate-400 block">Val Top-1 Accuracy</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                        {activeJob.val_accuracy !== null ? `${(activeJob.val_accuracy! * 100).toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Visual SVG Loss Curve */}
                  {activeJob.history && activeJob.history.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                      <span className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                        <Activity className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Training Loss Convergence Curve</span>
                      </span>

                      <div className="h-32 w-full flex items-end space-x-3 pt-4 px-2">
                        {activeJob.history.map((rec, idx) => {
                          const maxLoss = 0.5;
                          const heightPct = Math.min(100, Math.max(10, (rec.train_loss / maxLoss) * 100));
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                              <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition">
                                {rec.train_loss.toFixed(3)}
                              </span>
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-indigo-500 opacity-80 hover:opacity-100 transition"
                              />
                              <span className="text-[10px] font-mono text-slate-500">
                                E{rec.epoch}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Terminal Execution Log Console */}
                  <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center space-x-1.5">
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Execution Logs</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-600">PyTorch CPU Runtime</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {activeJob.logs || "No logs available yet..."}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
                  <Play className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs">No active training jobs. Configure hyperparameters on the left to start a real metric learning job.</p>
                </div>
              )}

              {jobs.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Training Jobs History ({jobs.length})
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-2">Job ID</th>
                          <th className="py-2 px-2">Status</th>
                          <th className="py-2 px-2">Epochs</th>
                          <th className="py-2 px-2">Train Loss</th>
                          <th className="py-2 px-2">Val Loss</th>
                          <th className="py-2 px-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {jobs.map((j) => (
                          <tr key={j.job_id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-2 text-cyan-300">{j.job_id}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  j.status === "COMPLETED"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : j.status === "FAILED"
                                    ? "bg-rose-950 text-rose-400"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {j.status}
                              </span>
                            </td>
                            <td className="py-2 px-2">{j.current_epoch}/{j.total_epochs}</td>
                            <td className="py-2 px-2 text-slate-300">{j.train_loss?.toFixed(4) ?? "—"}</td>
                            <td className="py-2 px-2 text-slate-300">{j.val_loss?.toFixed(4) ?? "—"}</td>
                            <td className="py-2 px-2 font-sans">
                              <button
                                onClick={() => setActiveJob(j)}
                                className="text-[11px] text-cyan-400 hover:underline"
                              >
                                View Logs
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MODEL REGISTRY & CHECKPOINT HISTORY */}
      {/* ============================================================== */}
      {activeTab === "registry" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Registered Model Checkpoints</h3>
              <p className="text-xs text-slate-400">
                Tracked pretrained baselines and fine-tuned checkpoints. Activating a checkpoint atomically regenerates the SKU reference gallery.
              </p>
            </div>
          </div>

          {activationFeedback && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{activationFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {models.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-5 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  m.is_active
                    ? "border-cyan-500/40 bg-gradient-to-r from-slate-900/90 to-cyan-950/20 shadow-lg shadow-cyan-500/5"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center space-x-2.5">
                    {m.is_active ? (
                      <span className="flex items-center space-x-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                        <Check className="h-3 w-3" />
                        <span>Active Model</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono text-slate-400">
                        Inactive Checkpoint
                      </span>
                    )}

                    <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-slate-700">
                      {m.model_type.toUpperCase()}
                    </span>

                    <span className="text-xs font-mono text-slate-500">
                      {m.embedding_dim > 0 ? `${m.embedding_dim}-dim` : "Detector"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{m.model_id}</h4>
                    <p className="text-xs text-slate-300 mt-0.5">{m.architecture}</p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono">
                    <span>Source: {m.pretrained_source}</span>
                    <span>License: {m.license}</span>
                    <span>Created: {m.created_at.slice(0, 16)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {m.is_active ? (
                    <span className="text-xs font-semibold text-cyan-400 flex items-center space-x-1">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Currently Serving</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleActivateModel(m.model_id)}
                      disabled={activatingModelId !== null}
                      className="rounded-xl border border-cyan-500/30 bg-cyan-950/60 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-900/60 transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <Zap className={`h-3.5 w-3.5 ${activatingModelId === m.model_id ? "animate-spin" : ""}`} />
                      <span>{activatingModelId === m.model_id ? "Migrating Gallery..." : "Activate Checkpoint"}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: SEPARATED EVALUATION & BENCHMARKS */}
      {/* ============================================================== */}
      {activeTab === "evaluation" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Comparative Model Benchmarks</h3>
              <p className="text-xs text-slate-400">
                Evaluation adheres to Requirements 5 & 6: Object detector localization is evaluated separately from embedding recognition.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <span>Threshold:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="0.9"
                  value={evalSimThreshold}
                  onChange={(e) => setEvalSimThreshold(parseFloat(e.target.value))}
                  className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <button
                onClick={handleRunEvaluation}
                disabled={evalLoading}
                className="flex items-center space-x-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${evalLoading ? "animate-spin" : ""}`} />
                <span>{evalLoading ? "Evaluating..." : "Run Benchmark"}</span>
              </button>
            </div>
          </div>

          {/* Section A: Separate Object Detector Evaluation Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Crosshair className="h-4 w-4 text-cyan-400" />
                <span>Object Detector Localization Benchmark (Separated Evaluation)</span>
              </h4>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                FasterRCNN-MobileNetV3 FPN
              </span>
            </div>

            {detEval ? (
              detEval.status === "NO_GROUND_TRUTH_ANNOTATIONS" ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 text-xs text-amber-300">
                  {detEval.message}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                    <span className="text-slate-400 block">Annotated Images</span>
                    <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                      {detEval.metrics.annotated_images_count}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                    <span className="text-slate-400 block">Precision @ IoU &gt; 0.5</span>
                    <span className="text-lg font-bold font-mono text-cyan-400 mt-0.5 block">
                      {((detEval.metrics.precision_at_iou_50 ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                    <span className="text-slate-400 block">Recall @ IoU &gt; 0.5</span>
                    <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                      {((detEval.metrics.recall_at_iou_50 ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                    <span className="text-slate-400 block">Average Localization IoU</span>
                    <span className="text-lg font-bold font-mono text-indigo-400 mt-0.5 block">
                      {detEval.metrics.average_iou !== null ? detEval.metrics.average_iou?.toFixed(3) : "N/A"}
                    </span>
                  </div>
                </div>
              )
            ) : (
              <span className="text-xs text-slate-500">Run benchmark to load detector metrics.</span>
            )}
          </div>

          {/* Section B: Comparative Embedding Model Benchmark Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                <span>Visual Embedding Recognition: Baseline vs Active Model</span>
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Similarity Acceptance Threshold: {evalSimThreshold.toFixed(2)}
              </span>
            </div>

            {embEval && embEval.baseline_model && embEval.active_model ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model 1: Baseline */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">Pretrained Baseline</span>
                      <span className="font-mono text-[10px] text-slate-400">960-dim</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Top-1 Accuracy</span>
                        <span className="text-base font-bold font-mono text-cyan-400">
                          {(embEval.baseline_model.top1_accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Top-3 Retrieval</span>
                        <span className="text-base font-bold font-mono text-indigo-400">
                          {(embEval.baseline_model.top3_accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Unknown False Accept (FAR)</span>
                        <span className="text-base font-bold font-mono text-amber-400">
                          {(embEval.baseline_model.unknown_false_acceptance_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Inference Latency</span>
                        <span className="text-base font-bold font-mono text-slate-200">
                          {embEval.baseline_model.average_latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Model 2: Active / Fine-Tuned */}
                  <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-950 to-cyan-950/20 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                      <span className="font-bold text-white">Active Serving Model</span>
                      <span className="font-mono text-[10px] text-cyan-300">
                        {embEval.active_model.embedding_dim}-dim
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Top-1 Accuracy</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {(embEval.active_model.top1_accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Top-3 Retrieval</span>
                        <span className="text-base font-bold font-mono text-cyan-400">
                          {(embEval.active_model.top3_accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Unknown False Accept (FAR)</span>
                        <span className="text-base font-bold font-mono text-amber-400">
                          {(embEval.active_model.unknown_false_acceptance_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Inference Latency</span>
                        <span className="text-base font-bold font-mono text-slate-200">
                          {embEval.active_model.average_latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hard-Negative Scenario Breakdown Table */}
                {embEval.active_model.hard_negatives && embEval.active_model.hard_negatives.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                    <span className="text-xs font-bold text-white block">
                      Hard-Negative & Unknown Object Testing Scenarios
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Test Negative Item</th>
                            <th className="py-2">Type</th>
                            <th className="py-2">Top Matched SKU</th>
                            <th className="py-2">Top Similarity</th>
                            <th className="py-2 text-right">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {embEval.active_model.hard_negatives.map((neg, i) => (
                            <tr key={i}>
                              <td className="py-2 text-slate-200 font-sans">{neg.sample_filename}</td>
                              <td className="py-2 text-slate-400">{neg.type}</td>
                              <td className="py-2 text-cyan-300">{neg.top_matched_sku}</td>
                              <td className="py-2 text-slate-300">{neg.top_similarity.toFixed(4)}</td>
                              <td className="py-2 text-right">
                                {neg.correctly_rejected ? (
                                  <span className="text-emerald-400 font-bold">REJECTED AS UNKNOWN</span>
                                ) : (
                                  <span className="text-rose-400 font-bold">FALSE ACCEPTANCE</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500">Run benchmark to compute comparative metrics.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
