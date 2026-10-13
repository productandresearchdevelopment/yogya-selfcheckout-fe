"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  BarChart2,
  Filter,
  RefreshCw,
  Check,
  X,
  UploadCloud,
  Crosshair,
  TrendingUp,
  Lock,
} from "lucide-react";
import {
  getHardNegatives,
  reviewHardNegative,
  deleteHardNegative,
  mineHardNegativesFromLogs,
  promoteHardNegatives,
  runErrorAnalysis,
  runThresholdCalibration,
  runComparativeBenchmark,
  promoteCandidateModel,
  getRegisteredModels,
  getSKUs,
  HardNegativeRecord,
  ErrorAnalysisResponse,
  ThresholdCalibrationResponse,
  ComparativeBenchmarkResponse,
  ModelRegistryItem,
  SKU,
  API_BASE,
} from "@/lib/api";

type ActiveTab = "errors" | "calibration" | "queue" | "benchmark";

export const ModelEvaluationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("errors");
  const [loading, setLoading] = useState<boolean>(false);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);

  // ---------------------------------------------------------------------------
  // TAB 1: ERROR ANALYSIS STATE
  // ---------------------------------------------------------------------------
  const [errSplit, setErrSplit] = useState<"val" | "test">("val");
  const [errSimTh, setErrSimTh] = useState<number>(0.50);
  const [errMarginTh, setErrMarginTh] = useState<number>(0.02);
  const [errModelId, setErrModelId] = useState<string>("");
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysisResponse | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 2: THRESHOLD CALIBRATION STATE
  // ---------------------------------------------------------------------------
  const [calibObjective, setCalibObjective] = useState<"min_far_with_recall_target" | "max_f1" | "balanced_eer">("max_f1");
  const [calibMinRecall, setCalibMinRecall] = useState<number>(0.85);
  const [calibModelId, setCalibModelId] = useState<string>("");
  const [calibrationData, setCalibrationData] = useState<ThresholdCalibrationResponse | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 3: HARD-NEGATIVE QUEUE STATE
  // ---------------------------------------------------------------------------
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>("all");
  const [hardNegatives, setHardNegatives] = useState<HardNegativeRecord[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [promoteSplit, setPromoteSplit] = useState<"train" | "val">("train");
  const [miningFeedback, setMiningFeedback] = useState<string | null>(null);
  const [promoteFeedback, setPromoteFeedback] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 4: BENCHMARK & SAFEGUARDS STATE
  // ---------------------------------------------------------------------------
  const [benchCandidateId, setBenchCandidateId] = useState<string>("");
  const [benchBaselineId, setBenchBaselineId] = useState<string>("mobilenetv3-pretrained-baseline");
  const [benchSplit, setBenchSplit] = useState<"val" | "test">("val");
  const [benchmarkResult, setBenchmarkResult] = useState<ComparativeBenchmarkResponse | null>(null);
  const [promotionFeedback, setPromotionFeedback] = useState<string | null>(null);

  // Load initial models and SKUs
  const loadPrerequisites = async () => {
    try {
      const [mList, sList] = await Promise.all([
        getRegisteredModels(),
        getSKUs(true),
      ]);
      setModels(mList);
      setSkus(sList);
      const activeModel = mList.find((m) => m.is_active && m.model_type === "embedding");
      if (activeModel) {
        setErrModelId(activeModel.model_id);
        setCalibModelId(activeModel.model_id);
      }
      const candidate = mList.find((m) => !m.is_active && m.model_type === "embedding");
      if (candidate) {
        setBenchCandidateId(candidate.model_id);
      } else if (mList.length > 0) {
        setBenchCandidateId(mList[0].model_id);
      }
    } catch (e) {
      console.error("Failed to load models and SKUs:", e);
    }
  };

  useEffect(() => {
    loadPrerequisites();
  }, []);

  // Fetch hard negatives when on queue tab or status filter changes
  const fetchHardNegatives = async () => {
    try {
      const data = await getHardNegatives(queueStatusFilter === "all" ? undefined : queueStatusFilter);
      setHardNegatives(data);
    } catch (e) {
      console.error("Failed to fetch hard negatives:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "queue") {
      fetchHardNegatives();
    }
  }, [activeTab, queueStatusFilter]);

  // Handler: Execute Error Analysis
  const handleRunErrorAnalysis = async () => {
    setLoading(true);
    try {
      const res = await runErrorAnalysis(
        errSplit,
        errSimTh,
        errMarginTh,
        errModelId || undefined
      );
      setErrorAnalysis(res);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Execute Threshold Calibration
  const handleRunCalibration = async () => {
    setLoading(true);
    try {
      const res = await runThresholdCalibration({
        target_model_id: calibModelId || undefined,
        split: "val",
        objective: calibObjective,
        min_recall_target: calibMinRecall,
      });
      setCalibrationData(res);
      // Auto-update error analysis threshold recommendation
      setErrSimTh(res.recommended_threshold);
      setErrMarginTh(res.recommended_margin);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Threshold calibration failed");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Mine from logs
  const handleMineFromLogs = async () => {
    setLoading(true);
    setMiningFeedback(null);
    try {
      const res = await mineHardNegativesFromLogs(0.35, 50);
      setMiningFeedback(res.message);
      await fetchHardNegatives();
    } catch (err: unknown) {
      setMiningFeedback(err instanceof Error ? err.message : "Mining failed");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Review hard negative
  const handleReviewRecord = async (
    id: number,
    status: "confirmed" | "corrected" | "rejected",
    groundTruthSku?: string | null
  ) => {
    try {
      await reviewHardNegative(id, {
        review_status: status,
        ground_truth_sku: groundTruthSku,
        ground_truth_label: groundTruthSku || "UNKNOWN",
        reviewer_notes: `Reviewed by supervisor as ${status}.`,
      });
      await fetchHardNegatives();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Review update failed");
    }
  };

  // Handler: Delete record
  const handleDeleteRecord = async (id: number) => {
    try {
      await deleteHardNegative(id);
      await fetchHardNegatives();
      setSelectedRecordIds((prev) => prev.filter((i) => i !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Handler: Promote selected hard negatives
  const handlePromoteSelected = async () => {
    if (selectedRecordIds.length === 0) return;
    setLoading(true);
    setPromoteFeedback(null);
    try {
      const res = await promoteHardNegatives({
        record_ids: selectedRecordIds,
        target_split: promoteSplit,
      });
      setPromoteFeedback(res.message);
      setSelectedRecordIds([]);
      await fetchHardNegatives();
    } catch (err: unknown) {
      setPromoteFeedback(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Run Benchmark
  const handleRunBenchmark = async () => {
    if (!benchCandidateId) {
      alert("Please select a candidate model to evaluate");
      return;
    }
    setLoading(true);
    setPromotionFeedback(null);
    try {
      const res = await runComparativeBenchmark({
        candidate_model_id: benchCandidateId,
        baseline_model_id: benchBaselineId || undefined,
        split: benchSplit,
      });
      setBenchmarkResult(res);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Benchmark failed");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Promote Candidate Model
  const handlePromoteCandidate = async (force = false) => {
    if (!benchCandidateId) return;
    setLoading(true);
    try {
      const res = await promoteCandidateModel(benchCandidateId, force);
      setPromotionFeedback(res.message);
      await loadPrerequisites();
    } catch (err: unknown) {
      setPromotionFeedback(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Model Evaluation, Hard-Negative Mining & False-Positive Reduction
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Section 4 Reliability Studio: Measure recognition errors, isolate detector versus embedding matching failures, calibrate similarity & margin thresholds, review hard negatives, and execute safe model promotion with strict safeguards.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              loadPrerequisites();
              if (activeTab === "queue") fetchHardNegatives();
              if (activeTab === "errors") handleRunErrorAnalysis();
            }}
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
          onClick={() => {
            setActiveTab("errors");
            if (!errorAnalysis) handleRunErrorAnalysis();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "errors"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>1. Error Analysis & Diagnostics</span>
          {errorAnalysis && (
            <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
              {(errorAnalysis.summary.top1_accuracy * 100).toFixed(1)}% Top-1
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("calibration");
            if (!calibrationData) handleRunCalibration();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "calibration"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>2. Threshold & Margin Calibration</span>
          {calibrationData && (
            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono ${calibrationData.is_provisional ? "bg-amber-950 text-amber-300" : "bg-emerald-950 text-emerald-300"}`}>
              {calibrationData.is_provisional ? "Provisional" : `Th: ${calibrationData.recommended_threshold.toFixed(2)}`}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "queue"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>3. Hard-Negative Review Queue</span>
          <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
            {hardNegatives.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("benchmark");
            if (!benchmarkResult) handleRunBenchmark();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "benchmark"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>4. Regression Benchmark & Safeguards</span>
          {benchmarkResult && (
            <span
              className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                benchmarkResult.eligible_for_promotion
                  ? "bg-emerald-950 text-emerald-400"
                  : "bg-rose-950 text-rose-400"
              }`}
            >
              {benchmarkResult.eligible_for_promotion ? "SAFEGUARDS PASS" : "BLOCKED"}
            </span>
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: ERROR ANALYSIS & DIAGNOSTICS */}
      {/* ============================================================== */}
      {activeTab === "errors" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Evaluation Split</label>
                <select
                  value={errSplit}
                  onChange={(e) => setErrSplit(e.target.value as "val" | "test")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white"
                >
                  <option value="val">Validation Split (Tuning)</option>
                  <option value="test">Held-out Test Split (Untouched)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Model Checkpoint</label>
                <select
                  value={errModelId}
                  onChange={(e) => setErrModelId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white max-w-xs font-mono"
                >
                  {models.filter((m) => m.model_type === "embedding").map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_id} {m.is_active ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">
                  Similarity Threshold: <span className="text-cyan-400 font-mono">{errSimTh.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.20"
                  max="0.90"
                  step="0.05"
                  value={errSimTh}
                  onChange={(e) => setErrSimTh(parseFloat(e.target.value))}
                  className="accent-cyan-400 w-32"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">
                  Margin Delta (Top1-Top2): <span className="text-indigo-400 font-mono">{errMarginTh.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="0.20"
                  step="0.02"
                  value={errMarginTh}
                  onChange={(e) => setErrMarginTh(parseFloat(e.target.value))}
                  className="accent-indigo-400 w-28"
                />
              </div>
            </div>

            <button
              onClick={handleRunErrorAnalysis}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Analyzing..." : "Run Error Analysis"}</span>
            </button>
          </div>

          {errorAnalysis && (
            <>
              {/* Category Breakdown Cards (10 categories) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Failure & Recognition Category Distribution ({errorAnalysis.total_samples} samples)
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Model: {errorAnalysis.model_id} • Split: {errorAnalysis.split_evaluated}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                    <span className="text-[11px] text-emerald-400 block font-medium">CORRECT KNOWN</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["CORRECT_KNOWN"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Known SKU matched correctly</span>
                  </div>

                  <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3">
                    <span className="text-[11px] text-teal-400 block font-medium">CORRECT UNKNOWN</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["CORRECT_UNKNOWN"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Non-catalog rejected as UNKNOWN</span>
                  </div>

                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3">
                    <span className="text-[11px] text-rose-400 block font-bold">FALSE POSITIVE (Unknown as Known)</span>
                    <span className="text-2xl font-bold font-mono text-rose-300 mt-0.5 block">
                      {errorAnalysis.category_breakdown["FALSE_POSITIVE_UNKNOWN_AS_KNOWN"] || 0}
                    </span>
                    <span className="text-[10px] text-rose-400/80">Tissue/fruit accepted as SKU</span>
                  </div>

                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3">
                    <span className="text-[11px] text-amber-400 block font-bold">WRONG SKU MISCLASS</span>
                    <span className="text-2xl font-bold font-mono text-amber-300 mt-0.5 block">
                      {errorAnalysis.category_breakdown["WRONG_SKU_MISCLASSIFICATION"] || 0}
                    </span>
                    <span className="text-[10px] text-amber-400/80">Known SKU matched to wrong SKU</span>
                  </div>

                  <div className="rounded-xl border border-orange-500/40 bg-orange-950/30 p-3">
                    <span className="text-[11px] text-orange-400 block font-bold">FALSE REJECTION (Known as Unk)</span>
                    <span className="text-2xl font-bold font-mono text-orange-300 mt-0.5 block">
                      {errorAnalysis.category_breakdown["FALSE_REJECTION_KNOWN_AS_UNKNOWN"] || 0}
                    </span>
                    <span className="text-[10px] text-orange-400/80">Known SKU sim &lt; threshold</span>
                  </div>

                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3">
                    <span className="text-[11px] text-purple-400 block font-medium">DETECTOR MISSED OBJECT</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["DETECTOR_MISSED_OBJECT"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">0 bounding boxes detected</span>
                  </div>

                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                    <span className="text-[11px] text-indigo-400 block font-medium">DETECTOR POOR CROP</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["DETECTOR_POOR_CROP"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">IoU &lt; 0.40 against ground truth</span>
                  </div>

                  <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
                    <span className="text-[11px] text-red-400 block font-medium">EMBEDDING INFERENCE FAIL</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["EMBEDDING_INFERENCE_FAILURE"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Zero-norm / NaN vector</span>
                  </div>

                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-3">
                    <span className="text-[11px] text-yellow-400 block font-medium">VERSION MISMATCH</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["VERSION_MISMATCH"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Query vs Gallery dim delta</span>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                    <span className="text-[11px] text-slate-400 block font-medium">LOW QUALITY / OCCLUDED</span>
                    <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                      {errorAnalysis.category_breakdown["LOW_QUALITY_OCCLUDED"] || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Severe blur or resolution</span>
                  </div>
                </div>
              </div>

              {/* Separated Detector Localization Callout */}
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-xs flex items-start space-x-3">
                <Crosshair className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-white flex items-center space-x-2">
                    <span>Detector Localization Evaluation (Strictly Isolated from Embedding Matching)</span>
                  </h4>
                  <p className="text-slate-300 mt-0.5">
                    {errorAnalysis.detector_metrics_separated.note} Missed Detections: {errorAnalysis.detector_metrics_separated.detector_missed_count}, Poor IoU Crops: {errorAnalysis.detector_metrics_separated.detector_poor_crop_count}.
                  </p>
                </div>
              </div>

              {/* Per-SKU Performance Table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Per-SKU Recognition Metrics
                  </h4>
                  <span className="text-xs text-slate-500">
                    {errorAnalysis.per_sku_metrics.length} Active SKUs
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">SKU Code</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-center">Queries</th>
                        <th className="px-4 py-3 text-center">TP / FP / FN</th>
                        <th className="px-4 py-3 text-center">Precision</th>
                        <th className="px-4 py-3 text-center">Recall</th>
                        <th className="px-4 py-3 text-center">F1-Score</th>
                        <th className="px-4 py-3 text-right">Top-1 Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {errorAnalysis.per_sku_metrics.map((s) => (
                        <tr key={s.sku_code} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono text-cyan-300 font-semibold">{s.sku_code}</td>
                          <td className="px-4 py-3 text-slate-200">{s.sku_name}</td>
                          <td className="px-4 py-3 text-center font-mono">{s.total_queries}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-400">
                            <span className="text-emerald-400">{s.true_positives}</span> /{" "}
                            <span className="text-rose-400">{s.false_positives}</span> /{" "}
                            <span className="text-amber-400">{s.false_negatives}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold">
                            {(s.precision * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold">
                            {(s.recall * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-indigo-300">
                            {s.f1_score.toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white">
                            {(s.accuracy * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confusion Matrix Visualization */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Confusion Matrix (Rows = Ground Truth, Columns = Predicted)
                </h4>
                <div className="overflow-x-auto max-h-80">
                  <table className="text-center text-[10px] font-mono border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-slate-500 text-left font-sans">Actual \ Pred</th>
                        {errorAnalysis.confusion_matrix.labels.map((l, i) => (
                          <th key={i} className="p-2 text-cyan-400 truncate max-w-[80px]" title={l}>
                            {l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {errorAnalysis.confusion_matrix.matrix.map((row, rIdx) => {
                        const rowLabel = errorAnalysis.confusion_matrix.labels[rIdx];
                        return (
                          <tr key={rIdx} className="border-t border-slate-800/60">
                            <td className="p-2 text-slate-300 text-left font-semibold truncate max-w-[100px]" title={rowLabel}>
                              {rowLabel}
                            </td>
                            {row.map((cell, cIdx) => {
                              const isDiag = rIdx === cIdx;
                              return (
                                <td
                                  key={cIdx}
                                  className={`p-2 font-bold ${
                                    isDiag
                                      ? cell > 0
                                        ? "bg-emerald-950/60 text-emerald-300"
                                        : "text-slate-600"
                                      : cell > 0
                                      ? "bg-rose-950/80 text-rose-300"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {cell}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Representative Error Examples Inspection */}
              {errorAnalysis.representative_errors.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Representative Error Inspection ({errorAnalysis.representative_errors.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {errorAnalysis.representative_errors.map((err) => (
                      <div
                        key={err.query_id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex space-x-3 text-xs"
                      >
                        {err.image_url ? (
                          <img
                            src={`${API_BASE}${err.image_url}`}
                            alt={err.filename}
                            className="h-20 w-20 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                            No Crop
                          </div>
                        )}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-cyan-300 truncate font-semibold">
                              {err.filename}
                            </span>
                            <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/30">
                              {err.error_category}
                            </span>
                          </div>
                          <div className="text-slate-300 flex items-center space-x-2">
                            <span>True: <strong className="text-white">{err.ground_truth_label}</strong></span>
                            <span>&rarr;</span>
                            <span>Pred: <strong className="text-rose-400">{err.predicted_label}</strong></span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Sim: {err.similarity_score.toFixed(4)} • Margin: {err.margin_delta !== null ? err.margin_delta?.toFixed(4) : "—"}
                          </div>
                          <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                            {err.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: THRESHOLD & MARGIN CALIBRATION */}
      {/* ============================================================== */}
      {activeTab === "calibration" && (
        <div className="space-y-6">
          {/* Isolation & Leakage Prevention Banner */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Lock className="h-5 w-5 text-cyan-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Validation Set Isolation Guard Active
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Threshold calibration is strictly conducted on the <strong>Validation Split</strong>. Decision boundaries are never fit to the held-out test split, preventing data leakage per Section 4 Requirement 5.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-cyan-950 border border-cyan-500/40 px-3 py-1 text-xs font-mono font-bold text-cyan-300 shrink-0">
              Split: VAL ONLY
            </span>
          </div>

          {/* Configuration Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Calibration Objective</label>
                <select
                  value={calibObjective}
                  onChange={(e) => setCalibObjective(e.target.value as "min_far_with_recall_target" | "max_f1" | "balanced_eer")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="min_far_with_recall_target">Min Unknown FAR (subject to Recall target)</option>
                  <option value="max_f1">Maximum Harmonic F1-Score</option>
                  <option value="balanced_eer">Balanced Equal Error Rate (FAR ≈ FRR)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Min Known Recall Target: <span className="font-mono text-cyan-400">{(calibMinRecall * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min="0.70"
                  max="0.99"
                  step="0.05"
                  value={calibMinRecall}
                  onChange={(e) => setCalibMinRecall(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 mt-2"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Target Model</label>
                <select
                  value={calibModelId}
                  onChange={(e) => setCalibModelId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white font-mono"
                >
                  {models.filter((m) => m.model_type === "embedding").map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_id} {m.is_active ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleRunCalibration}
              disabled={loading}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.01] transition disabled:opacity-50"
            >
              <Sliders className="h-4 w-4" />
              <span>{loading ? "Sweeping 2D Parameter Grid..." : "Run Repeatable Threshold Calibration Sweep"}</span>
            </button>
          </div>

          {calibrationData && (
            <div className="space-y-6">
              {/* Calibration Outcome Banner */}
              <div
                className={`rounded-2xl border p-5 ${
                  calibrationData.is_provisional
                    ? "border-amber-500/30 bg-amber-950/20"
                    : "border-emerald-500/30 bg-emerald-950/20"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Optimal Calibrated Thresholds:
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                          calibrationData.is_provisional
                            ? "bg-amber-900 text-amber-200"
                            : "bg-emerald-900 text-emerald-200"
                        }`}
                      >
                        {calibrationData.status}
                      </span>
                    </div>

                    <div className="flex items-baseline space-x-4 mt-2">
                      <div>
                        <span className="text-xs text-slate-400 block">Cosine Similarity Threshold:</span>
                        <span className="text-3xl font-extrabold font-mono text-cyan-400">
                          {calibrationData.recommended_threshold.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">Top1-Top2 Margin Threshold:</span>
                        <span className="text-3xl font-extrabold font-mono text-indigo-400">
                          {calibrationData.recommended_margin.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 max-w-2xl">
                      {calibrationData.objective_rationale}
                    </p>
                  </div>

                  <div className="text-xs text-right text-slate-400 space-y-1">
                    <div>Validation Known Samples: <strong className="text-white font-mono">{calibrationData.total_known_val_samples}</strong></div>
                    <div>Validation Unknown Samples: <strong className="text-white font-mono">{calibrationData.total_unknown_val_samples}</strong></div>
                  </div>
                </div>

                {calibrationData.provisional_warning && (
                  <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-900/30 p-3 text-xs text-amber-300 flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{calibrationData.provisional_warning}</span>
                  </div>
                )}
              </div>

              {/* 2D Sweep Curve Table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    2D Grid Sweep Curve Data ({calibrationData.sweep_results.length} points)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Objective: {calibrationData.objective_used}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Similarity Th</th>
                        <th className="px-3 py-2">Margin Th</th>
                        <th className="px-3 py-2 text-center">Known Top-1</th>
                        <th className="px-3 py-2 text-center">Unknown FAR</th>
                        <th className="px-3 py-2 text-center">Known FRR</th>
                        <th className="px-3 py-2 text-center">Precision</th>
                        <th className="px-3 py-2 text-center">Recall</th>
                        <th className="px-3 py-2 text-right">F1-Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {calibrationData.sweep_results.map((pt, i) => {
                        const isRec =
                          pt.similarity_threshold === calibrationData.recommended_threshold &&
                          pt.margin_threshold === calibrationData.recommended_margin;
                        return (
                          <tr
                            key={i}
                            className={`hover:bg-slate-800/40 ${
                              isRec ? "bg-cyan-950/30 font-bold border-l-2 border-cyan-400" : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-cyan-300">{pt.similarity_threshold.toFixed(2)}</td>
                            <td className="px-3 py-2 text-indigo-300">{pt.margin_threshold.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">{(pt.known_top1_accuracy * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center text-amber-400">{(pt.unknown_far * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center text-orange-400">{(pt.known_frr * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center">{(pt.precision * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center">{(pt.recall * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right text-emerald-400 font-bold">
                              {pt.f1_score.toFixed(4)} {isRec ? "★" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: HARD-NEGATIVE REVIEW QUEUE & MINING */}
      {/* ============================================================== */}
      {activeTab === "queue" && (
        <div className="space-y-6">
          {/* Mining Utility Banner */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Filter className="h-4 w-4 text-cyan-400" />
                <span>Hard-Negative Candidate Mining Pipeline</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically extracts ambiguous webcam queries, false positives, and near-threshold observations from actual inference logs into the review queue.
              </p>
            </div>

            <button
              onClick={handleMineFromLogs}
              disabled={loading}
              className="flex items-center space-x-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Mine Candidates from Inference Logs</span>
            </button>
          </div>

          {miningFeedback && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-cyan-300">
              {miningFeedback}
            </div>
          )}

          {promoteFeedback && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{promoteFeedback}</span>
            </div>
          )}

          {/* Queue Filter & Bulk Promotion Toolbar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Filter Review Status:</span>
              {(["all", "pending", "confirmed", "corrected", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setQueueStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold uppercase text-[10px] transition ${
                    queueStatusFilter === st
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Bulk Promote Toolbar */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-slate-400">Target Split:</span>
              <select
                value={promoteSplit}
                onChange={(e) => setPromoteSplit(e.target.value as "train" | "val")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-white text-xs"
              >
                <option value="train">Training Split (train)</option>
                <option value="val">Validation Split (val)</option>
              </select>

              <button
                onClick={handlePromoteSelected}
                disabled={loading || selectedRecordIds.length === 0}
                className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Promote Selected ({selectedRecordIds.length})</span>
              </button>
            </div>
          </div>

          {/* Hard Negatives List */}
          {hardNegatives.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {hardNegatives.map((rec) => {
                const isSelected = selectedRecordIds.includes(rec.id);
                return (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border p-4 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                      isSelected
                        ? "border-cyan-500/50 bg-cyan-950/20"
                        : "border-slate-800 bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds((prev) => [...prev, rec.id]);
                          } else {
                            setSelectedRecordIds((prev) => prev.filter((i) => i !== rec.id));
                          }
                        }}
                        className="mt-1 accent-cyan-400 rounded h-4 w-4"
                      />

                      {rec.crop_url ? (
                        <img
                          src={`${API_BASE}${rec.crop_url}`}
                          alt="Crop"
                          className="h-16 w-16 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-[10px] shrink-0">
                          Query
                        </div>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-cyan-300">#{rec.id}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase font-mono ${
                              rec.review_status === "confirmed"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                : rec.review_status === "corrected"
                                ? "bg-indigo-950 text-indigo-300 border border-indigo-500/30"
                                : rec.review_status === "rejected"
                                ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                : "bg-amber-950 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {rec.review_status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {rec.error_category}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300">
                          Pred: <strong className="text-white">{rec.predicted_sku || "UNKNOWN"}</strong> • Sim:{" "}
                          <strong className="text-cyan-400 font-mono">{rec.similarity_score?.toFixed(4) ?? "—"}</strong> • Margin:{" "}
                          <strong className="text-indigo-400 font-mono">{rec.margin_delta?.toFixed(4) ?? "—"}</strong>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                          {rec.reviewer_notes || "Mined observation awaiting human review."}
                        </p>

                        {rec.is_mined_for_training && (
                          <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                            <Check className="h-3 w-3" />
                            <span>Promoted into dataset split: {rec.dataset_split_assigned}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReviewRecord(rec.id, "confirmed", null)}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40 flex items-center space-x-1"
                        title="Confirm as UNKNOWN False Positive (Tissue/Hand/Fruit)"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm UNKNOWN</span>
                      </button>

                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleReviewRecord(rec.id, "corrected", e.target.value);
                          }
                        }}
                        defaultValue=""
                        className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1.5 text-xs text-indigo-200"
                      >
                        <option value="" disabled>
                          Correct SKU...
                        </option>
                        {skus.map((s) => (
                          <option key={s.id} value={s.sku_code}>
                            {s.sku_code} ({s.name})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleReviewRecord(rec.id, "rejected")}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                        title="Reject / Discard from queue"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="text-xs text-rose-400 hover:underline px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
              <Filter className="h-8 w-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">
                No hard-negative records found matching status &apos;{queueStatusFilter}&apos;. Click &apos;Mine Candidates&apos; above to ingest difficult observations from logs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: REGRESSION BENCHMARK & SAFEGUARDS */}
      {/* ============================================================== */}
      {activeTab === "benchmark" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span>Comparative Benchmark & Promotion Safeguard Audit</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Candidate Model Checkpoint</label>
                <select
                  value={benchCandidateId}
                  onChange={(e) => setBenchCandidateId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white font-mono"
                >
                  {models.filter((m) => m.model_type === "embedding").map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_id} {m.is_active ? "(Active Baseline)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Baseline Model</label>
                <select
                  value={benchBaselineId}
                  onChange={(e) => setBenchBaselineId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white font-mono"
                >
                  {models.filter((m) => m.model_type === "embedding").map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_id} {m.is_active ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Benchmark Split</label>
                <select
                  value={benchSplit}
                  onChange={(e) => setBenchSplit(e.target.value as "val" | "test")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="val">Validation Split (Tuned)</option>
                  <option value="test">Held-out Test Split (Untouched)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={loading}
              className="flex items-center space-x-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Evaluating Benchmark..." : "Execute Comparative Benchmark"}</span>
            </button>
          </div>

          {promotionFeedback && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-cyan-300">
              {promotionFeedback}
            </div>
          )}

          {benchmarkResult && (
            <div className="space-y-6">
              {/* Promotion Safeguards Checklist (The 4 Quality Gates) */}
              <div
                className={`rounded-2xl border p-5 ${
                  benchmarkResult.eligible_for_promotion
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : "border-rose-500/40 bg-rose-950/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Section 4 Model Promotion Quality Gates:
                    </span>
                    <h3
                      className={`text-xl font-black tracking-tight mt-0.5 ${
                        benchmarkResult.eligible_for_promotion ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {benchmarkResult.eligible_for_promotion
                        ? "ELIGIBLE FOR PRODUCTION PROMOTION"
                        : "PROMOTION BLOCKED BY SAFEGUARDS"}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handlePromoteCandidate(false)}
                      disabled={!benchmarkResult.eligible_for_promotion || loading}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                    >
                      Promote Candidate Model
                    </button>

                    {!benchmarkResult.eligible_for_promotion && (
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to force override Section 4 safeguards?")) {
                            handlePromoteCandidate(true);
                          }
                        }}
                        className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40"
                      >
                        Force Override
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                  {benchmarkResult.safeguards.map((sg, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 flex items-start space-x-3 ${
                        sg.passed
                          ? "border-emerald-500/30 bg-slate-950/80"
                          : "border-rose-500/30 bg-rose-950/40"
                      }`}
                    >
                      {sg.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white">{sg.safeguard_name}</h4>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              sg.passed ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"
                            }`}
                          >
                            {sg.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Criteria: {sg.required_criterion}
                        </span>
                        <span className="text-[11px] font-mono text-cyan-300 block mt-0.5">
                          Measured: {sg.measured_value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {benchmarkResult.rejection_reasons.length > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 space-y-1">
                    <span className="text-xs font-bold text-rose-300 block">Safeguard Rejection Reasons:</span>
                    <ul className="list-disc list-inside text-xs text-rose-200 space-y-0.5">
                      {benchmarkResult.rejection_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Side-by-side Model Metrics Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Baseline Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-white">Baseline: {benchmarkResult.baseline_summary.model_id}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {benchmarkResult.baseline_summary.embedding_dim}-dim
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block">Top-1 Accuracy</span>
                      <span className="text-lg font-bold font-mono text-cyan-400">
                        {(benchmarkResult.baseline_summary.top1_accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Unknown FAR</span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {(benchmarkResult.baseline_summary.unknown_false_acceptance_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Known FRR</span>
                      <span className="text-lg font-bold font-mono text-orange-400">
                        {(benchmarkResult.baseline_summary.known_false_rejection_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Latency</span>
                      <span className="text-lg font-bold font-mono text-slate-200">
                        {benchmarkResult.baseline_summary.average_latency_ms.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Candidate Card */}
                <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-950 to-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <span className="font-bold text-white">Candidate: {benchmarkResult.candidate_summary.model_id}</span>
                    <span className="font-mono text-[10px] text-cyan-300">
                      {benchmarkResult.candidate_summary.embedding_dim}-dim
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block">Top-1 Accuracy</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {(benchmarkResult.candidate_summary.top1_accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Unknown FAR</span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {(benchmarkResult.candidate_summary.unknown_false_acceptance_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Known FRR</span>
                      <span className="text-lg font-bold font-mono text-orange-400">
                        {(benchmarkResult.candidate_summary.known_false_rejection_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Latency</span>
                      <span className="text-lg font-bold font-mono text-slate-200">
                        {benchmarkResult.candidate_summary.average_latency_ms.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-SKU Deltas and Regressions Breakdown */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Per-SKU Performance Deltas ({benchmarkResult.per_sku_breakdown.length} SKUs evaluated)
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">SKU Code</th>
                        <th className="px-4 py-2.5 text-center">Baseline Acc</th>
                        <th className="px-4 py-2.5 text-center">Candidate Acc</th>
                        <th className="px-4 py-2.5 text-center">Accuracy Delta</th>
                        <th className="px-4 py-2.5 text-right">Stability Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {benchmarkResult.per_sku_breakdown.map((row) => (
                        <tr key={row.sku_code} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-cyan-300 font-semibold">{row.sku_code}</td>
                          <td className="px-4 py-2.5 text-center">{(row.baseline_accuracy * 100).toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-center font-bold text-white">{(row.candidate_accuracy * 100).toFixed(1)}%</td>
                          <td className={`px-4 py-2.5 text-center font-bold ${row.accuracy_delta >= 0 ? "text-emerald-400" : row.accuracy_delta < -0.15 ? "text-rose-400" : "text-amber-400"}`}>
                            {row.accuracy_delta >= 0 ? "+" : ""}{(row.accuracy_delta * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {row.regression_severity === "NONE" ? (
                              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[9px] text-emerald-400 font-sans">Stable / Improved</span>
                            ) : row.regression_severity === "MINOR" ? (
                              <span className="rounded bg-amber-950 px-2 py-0.5 text-[9px] text-amber-400 font-sans">Minor Drop</span>
                            ) : (
                              <span className="rounded bg-rose-950 px-2 py-0.5 text-[9px] text-rose-400 font-bold font-sans">Severe Regression</span>
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
        </div>
      )}
    </div>
  );
};
