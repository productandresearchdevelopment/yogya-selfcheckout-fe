// API Client for Product Recognition Studio Backend

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_V1 = `${API_BASE}/api/v1`;

export interface ProductImageSummary {
  id: number;
  role: string;
  split: string;
  filename: string;
  file_path: string;
  file_hash: string;
  file_size_bytes: number;
  width: number;
  height: number;
  blur_score?: number | null;
  brightness_score?: number | null;
  contrast_score?: number | null;
  is_valid: boolean;
  validation_notes?: string | null;
  created_at: string;
  has_embedding: boolean;
}

export interface SKU {
  id: number;
  sku_code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  reference_image_count: number;
  training_image_count: number;
  total_image_count: number;
  reference_images: ProductImageSummary[];
  training_images: ProductImageSummary[];
}

export interface SKUCreatePayload {
  sku_code: string;
  name: string;
  category?: string;
  description?: string;
}

export interface SKUUpdatePayload {
  name?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
}

export interface Annotation {
  id: number;
  image_id: number;
  sku_id?: number | null;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  px_x?: number | null;
  px_y?: number | null;
  px_width?: number | null;
  px_height?: number | null;
  label: string;
  confidence: number;
  source: string;
  created_at: string;
}

export interface AnnotationCreatePayload {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  label: string;
  sku_id?: number;
  confidence?: number;
  source?: string;
}

export interface RecognitionCandidate {
  sku_id: number;
  sku_code: string;
  sku_name: string;
  similarity_score: number;
  reference_image_id?: number | null;
  reference_image_url?: string | null;
  rank: number;
}

export interface DetectedObject {
  box_id: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  px_x: number;
  px_y: number;
  px_width: number;
  px_height: number;
  detector_confidence: number;
  detector_class: string;
  is_fallback: boolean;
  crop_image_url?: string | null;
  is_unknown: boolean;
  recognition_status?: "KNOWN" | "UNKNOWN" | "UNCLASSIFIED";
  predicted_sku?: string | null;
  predicted_sku_name?: string | null;
  top_similarity_score?: number | null;
  margin_threshold?: number | null;
  margin_delta?: number | null;
  rejection_reason?: string | null;
  candidates: RecognitionCandidate[];
}

export interface RecognitionResult {
  query_image_name: string;
  query_image_url: string;
  image_width: number;
  image_height: number;
  detector_model: string;
  embedding_model: string;
  device_used: string;
  detection_threshold: number;
  similarity_threshold: number;
  margin_threshold?: number;
  objects_detected_count: number;
  has_fallback_detection: boolean;
  detected_objects: DetectedObject[];
  duration_ms: number;
  frame_seq?: number;
  warnings: string[];
  timestamp: string;
}

export interface RecognitionHistoryItem {
  id: number;
  query_image_name: string;
  num_detections: number;
  final_status: string;
  top_predicted_sku?: string | null;
  top_similarity?: number | null;
  detector_model: string;
  embedding_model: string;
  duration_ms: number;
  created_at: string;
}

export interface DashboardStats {
  sku_count: number;
  active_sku_count: number;
  image_count: number;
  reference_image_count: number;
  training_image_count: number;
  annotation_count: number;
  embedding_count: number;
  recent_recognitions_count: number;
  device_info: string;
  active_detector: string;
  active_embedder: string;
  recent_runs: {
    id: number;
    query_image_name: string;
    num_detections: number;
    final_status: string;
    top_predicted_sku: string | null;
    top_similarity: number | null;
    duration_ms: number;
    created_at: string;
  }[];
}

export interface SystemHealth {
  status: string;
  torch_available: boolean;
  torch_version: string | null;
  device: string;
  cuda_available: boolean;
  cuda_device_name: string | null;
  mps_available: boolean;
  cpu_cores: number;
  storage_paths: Record<string, string>;
  model_versions: Record<string, string>;
  database_connected: boolean;
}

// Helper fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_V1}${endpoint}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const json = await res.json();
        errorMsg = json.detail || json.message || errorMsg;
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
  }
}

// --- SKU API ---
export async function getSKUs(includeInactive = false, search = ""): Promise<SKU[]> {
  const params = new URLSearchParams();
  if (includeInactive) params.append("include_inactive", "true");
  if (search) params.append("search", search);
  return apiFetch<SKU[]>(`/skus?${params.toString()}`);
}

export async function getSKU(id: number): Promise<SKU> {
  return apiFetch<SKU>(`/skus/${id}`);
}

export async function createSKU(payload: SKUCreatePayload): Promise<SKU> {
  return apiFetch<SKU>("/skus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSKU(id: number, payload: SKUUpdatePayload): Promise<SKU> {
  return apiFetch<SKU>(`/skus/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deactivateSKU(id: number): Promise<SKU> {
  return apiFetch<SKU>(`/skus/${id}/deactivate`, { method: "POST" });
}

export async function deleteSKU(id: number): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/skus/${id}`, { method: "DELETE" });
}

// --- Dataset API ---
export async function uploadDatasetImages(
  files: File[],
  skuId: number,
  role: "reference" | "training" | "validation" | "test",
  split?: string
): Promise<ProductImageSummary[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("sku_id", skuId.toString());
  formData.append("role", role);
  if (split) formData.append("split", split);

  const res = await fetch(`${API_V1}/datasets/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Upload failed with status ${res.status}`);
  }
  return await res.json();
}

export async function getDatasetImages(params?: {
  sku_id?: number;
  role?: string;
  split?: string;
  is_valid?: boolean;
}): Promise<ProductImageSummary[]> {
  const query = new URLSearchParams();
  if (params?.sku_id) query.append("sku_id", params.sku_id.toString());
  if (params?.role) query.append("role", params.role);
  if (params?.split) query.append("split", params.split);
  if (params?.is_valid !== undefined) query.append("is_valid", params.is_valid.toString());
  return apiFetch<ProductImageSummary[]>(`/datasets/images?${query.toString()}`);
}

export async function deleteDatasetImage(imageId: number): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/datasets/images/${imageId}`, {
    method: "DELETE",
  });
}

export async function updateImageSplit(imageId: number, split: string): Promise<ProductImageSummary> {
  return apiFetch<ProductImageSummary>(`/datasets/images/${imageId}/split`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, split }),
  });
}

export async function getAnnotations(imageId: number): Promise<Annotation[]> {
  return apiFetch<Annotation[]>(`/datasets/images/${imageId}/annotations`);
}

export async function createAnnotation(
  imageId: number,
  payload: AnnotationCreatePayload
): Promise<Annotation> {
  return apiFetch<Annotation>(`/datasets/images/${imageId}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteAnnotation(annotationId: number): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/datasets/annotations/${annotationId}`, {
    method: "DELETE",
  });
}

export async function exportYOLODataset(): Promise<{ format: string; archive_path: string; message: string }> {
  return apiFetch<{ format: string; archive_path: string; message: string }>("/datasets/export/yolo", {
    method: "POST",
  });
}

export async function exportCOCODataset(): Promise<{ format: string; archive_path: string; message: string }> {
  return apiFetch<{ format: string; archive_path: string; message: string }>("/datasets/export/coco", {
    method: "POST",
  });
}

export async function reindexGallery(): Promise<{ status: string; indexed_count: number; message: string }> {
  return apiFetch<{ status: string; indexed_count: number; message: string }>("/datasets/reindex", {
    method: "POST",
  });
}

// --- Recognition Playground API ---
export interface RecognitionStatusSummary {
  active_detector: string;
  active_embedding_model: string;
  embedding_dim: number;
  gallery_reference_count: number;
  registered_sku_count: number;
  is_gallery_compatible: boolean;
  device_used: string;
  default_detection_threshold: number;
  default_similarity_threshold: number;
}

export interface FewShotEnrollmentResponse {
  status: string;
  sku_id: number;
  sku_code: string;
  name: string;
  category?: string | null;
  enrolled_images_count: number;
  model_id: string;
  embedding_dim: number;
  message: string;
  retrained: boolean;
  sku: SKU;
}

export async function getRecognitionStatus(): Promise<RecognitionStatusSummary> {
  return apiFetch<RecognitionStatusSummary>("/recognition/status");
}

export async function runRecognition(
  file: File,
  confidenceThreshold = 0.35,
  similarityThreshold = 0.60,
  topK = 5,
  marginThreshold = 0.0,
  minCropSize = 10,
  allowFallback = true
): Promise<RecognitionResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("confidence_threshold", confidenceThreshold.toString());
  formData.append("similarity_threshold", similarityThreshold.toString());
  formData.append("top_k", topK.toString());
  formData.append("margin_threshold", marginThreshold.toString());
  formData.append("min_crop_size", minCropSize.toString());
  formData.append("allow_fallback", allowFallback.toString());

  const res = await fetch(`${API_V1}/recognition/predict`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Recognition request failed with status ${res.status}`);
  }
  return await res.json();
}

export async function predictWebcamFrame(
  frameBlob: Blob,
  params: {
    confidenceThreshold?: number;
    similarityThreshold?: number;
    marginThreshold?: number;
    topK?: number;
    minCropSize?: number;
    allowFallback?: boolean;
    frameSeq?: number;
  } = {}
): Promise<RecognitionResult> {
  const formData = new FormData();
  formData.append("file", frameBlob, "webcam_frame.jpg");
  formData.append("confidence_threshold", (params.confidenceThreshold ?? 0.35).toString());
  formData.append("similarity_threshold", (params.similarityThreshold ?? 0.60).toString());
  formData.append("top_k", (params.topK ?? 5).toString());
  formData.append("margin_threshold", (params.marginThreshold ?? 0.0).toString());
  formData.append("min_crop_size", (params.minCropSize ?? 10).toString());
  formData.append("allow_fallback", (params.allowFallback ?? false).toString());
  if (params.frameSeq !== undefined) {
    formData.append("frame_seq", params.frameSeq.toString());
  }

  const res = await fetch(`${API_V1}/recognition/predict-frame`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Webcam frame recognition failed with status ${res.status}`);
  }
  return await res.json();
}

export async function enrollFewShotSku(formData: FormData): Promise<FewShotEnrollmentResponse> {
  const res = await fetch(`${API_V1}/skus/enroll-few-shot`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Few-shot SKU enrollment failed with status ${res.status}`);
  }
  return await res.json();
}

export async function getRecognitionHistory(limit = 20): Promise<RecognitionHistoryItem[]> {
  return apiFetch<RecognitionHistoryItem[]>(`/recognition/history?limit=${limit}`);
}

// --- System & Diagnostics API ---
export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/system/dashboard");
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return apiFetch<SystemHealth>("/system/health");
}

export async function getSettings(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/system/settings");
}

// ==========================================
// SECTION 2: Metric Learning, Registry & Evaluation APIs
// ==========================================

export interface DatasetReadinessSummary {
  total_skus: number;
  active_skus: number;
  total_images: number;
  reference_images: number;
  training_images: number;
  validation_images: number;
  test_images: number;
  unassigned_images: number;
  distinct_training_identities: number;
  skus_with_multiple_images: number;
  skus_with_zero_images: number;
  hard_negative_unknown_count: number;
  corrupt_images_count: number;
  duplicate_images_count: number;
  blurry_images_count: number;
  annotated_bounding_boxes: number;
}

export interface SkuReadinessDetail {
  sku_id: number;
  sku_code: string;
  sku_name: string;
  total_images: number;
  reference_images: number;
  training_images: number;
  val_images: number;
  test_images: number;
  has_sufficient_pairs: boolean;
}

export interface DatasetReadinessResponse {
  status: "READY" | "INSUFFICIENT_DATA";
  is_ready: boolean;
  summary: DatasetReadinessSummary;
  blockers: string[];
  recommendations: string[];
  sku_details: SkuReadinessDetail[];
}

export interface StartTrainingRequest {
  epochs: number;
  embedding_dim: number;
  learning_rate: number;
  margin: number;
  p_classes?: number;
  k_instances?: number;
}

export interface TrainingEpochRecord {
  epoch: number;
  train_loss: number;
  val_loss: number;
  val_accuracy: number;
  duration_s: number;
}

export interface TrainingJobResponse {
  job_id: string;
  model_id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "INSUFFICIENT_DATA";
  total_epochs: number;
  current_epoch: number;
  train_loss?: number | null;
  val_loss?: number | null;
  val_accuracy?: number | null;
  history: TrainingEpochRecord[];
  logs?: string | null;
  error_message?: string | null;
  checkpoint_path?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface ModelRegistryItem {
  id: number;
  model_id: string;
  model_type: "embedding" | "detector";
  architecture: string;
  pretrained_source: string;
  weight_version: string;
  embedding_dim: number;
  checkpoint_path?: string | null;
  hyperparameters?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  status: string;
  is_active: boolean;
  license: string;
  created_at: string;
}

export interface ModelActivationResponse {
  status: string;
  model_id: string;
  previous_model_id?: string | null;
  migrated_vectors_count: number;
  embedding_dim: number;
  message: string;
}

export interface DetectorEvaluationResponse {
  status: string;
  detector_model?: string | null;
  confidence_threshold: number;
  metrics: {
    annotated_images_count: number;
    total_ground_truth_boxes?: number;
    total_detected_boxes?: number;
    true_positives_iou_50?: number;
    precision_at_iou_50?: number;
    recall_at_iou_50?: number;
    map_50?: number;
    average_iou?: number;
  };
  eval_duration_ms: number;
  message?: string | null;
}

export interface HardNegativeEvaluationItem {
  sample_filename: string;
  type: string;
  top_matched_sku: string;
  top_similarity: number;
  correctly_rejected: boolean;
}

export interface EvaluatedModelStats {
  model_id: string;
  architecture: string;
  embedding_dim: number;
  top1_accuracy: number;
  top3_accuracy: number;
  known_false_rejection_rate: number;
  unknown_false_acceptance_rate: number;
  average_latency_ms: number;
  per_sku_accuracy: Record<string, number>;
  hard_negatives: HardNegativeEvaluationItem[];
}

export interface EmbeddingEvaluationResponse {
  status: string;
  evaluated_images_count?: number;
  gallery_reference_count?: number;
  similarity_threshold?: number;
  baseline_model?: EvaluatedModelStats;
  active_model?: EvaluatedModelStats;
  comparison_delta?: {
    top1_accuracy_delta: number;
    top3_accuracy_delta: number;
    latency_delta_ms: number;
    unknown_far_delta: number;
  };
  threshold_calibration?: Array<{
    threshold: number;
    top1_accuracy: number;
    false_acceptance_rate: number;
    false_rejection_rate: number;
    calibrated_f1_score: number;
  }>;
  message?: string | null;
}

export async function getDatasetReadiness(): Promise<DatasetReadinessResponse> {
  return apiFetch<DatasetReadinessResponse>("/training/readiness");
}

export async function seedDatasetSamples(): Promise<{ status: string; created_samples_count: number; message: string }> {
  return apiFetch<{ status: string; created_samples_count: number; message: string }>("/training/seed-samples", {
    method: "POST",
  });
}

export async function startTrainingJob(config: StartTrainingRequest): Promise<TrainingJobResponse> {
  return apiFetch<TrainingJobResponse>("/training/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function getTrainingJobs(): Promise<TrainingJobResponse[]> {
  return apiFetch<TrainingJobResponse[]>("/training/jobs");
}

export async function getTrainingJob(jobId: string): Promise<TrainingJobResponse> {
  return apiFetch<TrainingJobResponse>(`/training/jobs/${jobId}`);
}

export async function cancelTrainingJob(jobId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/training/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

export async function getRegisteredModels(modelType?: "embedding" | "detector"): Promise<ModelRegistryItem[]> {
  const query = modelType ? `?model_type=${modelType}` : "";
  return apiFetch<ModelRegistryItem[]>(`/models/${query}`);
}

export async function activateModel(modelId: string): Promise<ModelActivationResponse> {
  return apiFetch<ModelActivationResponse>(`/models/${modelId}/activate`, {
    method: "POST",
  });
}

export async function runDetectorEvaluation(confidenceThreshold = 0.35): Promise<DetectorEvaluationResponse> {
  return apiFetch<DetectorEvaluationResponse>(`/models/evaluate/detector?confidence_threshold=${confidenceThreshold}`, {
    method: "POST",
  });
}

export async function runEmbeddingEvaluation(
  targetModelId?: string,
  similarityThreshold = 0.60
): Promise<EmbeddingEvaluationResponse> {
  const query = targetModelId
    ? `?target_model_id=${targetModelId}&similarity_threshold=${similarityThreshold}`
    : `?similarity_threshold=${similarityThreshold}`;
  return apiFetch<EmbeddingEvaluationResponse>(`/models/evaluate/embedding${query}`, {
    method: "POST",
  });
}

// ===========================================================================
// SECTION 4: ERROR ANALYSIS, HARD NEGATIVES & THRESHOLD CALIBRATION
// ===========================================================================

export interface HardNegativeRecord {
  id: number;
  sample_type: string;
  image_path: string;
  crop_path?: string | null;
  crop_url?: string | null;
  predicted_sku?: string | null;
  predicted_sku_name?: string | null;
  ground_truth_sku?: string | null;
  ground_truth_label: string;
  detector_confidence?: number | null;
  similarity_score?: number | null;
  margin_delta?: number | null;
  top_candidates?: Array<{
    sku_id: number;
    sku_code: string;
    sku_name: string;
    similarity_score: number;
    rank: number;
  }> | null;
  model_version: string;
  error_category: string;
  review_status: string; // 'pending' | 'confirmed' | 'corrected' | 'rejected'
  reviewer_notes?: string | null;
  is_mined_for_training: boolean;
  dataset_split_assigned?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface HardNegativeReviewPayload {
  review_status: "confirmed" | "corrected" | "rejected";
  ground_truth_sku?: string | null;
  ground_truth_label?: string;
  reviewer_notes?: string | null;
  error_category?: string;
}

export interface PromoteHardNegativesPayload {
  record_ids: number[];
  target_split: "train" | "val";
  as_sku_id?: number | null;
}

export interface PerSkuMetric {
  sku_id?: number | null;
  sku_code: string;
  sku_name: string;
  total_queries: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  mean_similarity: number;
}

export interface ConfusionMatrixData {
  labels: string[];
  matrix: number[][];
}

export interface ErrorExampleRecord {
  query_id: number;
  filename: string;
  image_url?: string | null;
  ground_truth_label: string;
  predicted_label: string;
  similarity_score: number;
  margin_delta?: number | null;
  error_category: string;
  detector_confidence?: number | null;
  reason: string;
}

export interface ErrorAnalysisResponse {
  status: string;
  model_id: string;
  split_evaluated: string;
  similarity_threshold: number;
  margin_threshold: number;
  total_samples: number;
  total_known_samples: number;
  total_unknown_samples: number;
  category_breakdown: Record<string, number>;
  per_sku_metrics: PerSkuMetric[];
  confusion_matrix: ConfusionMatrixData;
  representative_errors: ErrorExampleRecord[];
  detector_metrics_separated: {
    detector_model: string;
    detector_missed_count: number;
    detector_poor_crop_count: number;
    note: string;
  };
  summary: {
    top1_accuracy: number;
    overall_accuracy: number;
    unknown_false_acceptance_rate: number;
    known_false_rejection_rate: number;
    error_rate: number;
  };
}

export interface ThresholdSweepPoint {
  similarity_threshold: number;
  margin_threshold: number;
  known_top1_accuracy: number;
  unknown_far: number;
  known_frr: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface ThresholdCalibrationPayload {
  target_model_id?: string;
  split?: "val";
  min_similarity?: number;
  max_similarity?: number;
  similarity_step?: number;
  margin_thresholds?: number[];
  objective?: "min_far_with_recall_target" | "max_f1" | "balanced_eer";
  min_recall_target?: number;
}

export interface ThresholdCalibrationResponse {
  status: string;
  model_id: string;
  split_evaluated: string;
  total_known_val_samples: number;
  total_unknown_val_samples: number;
  sweep_results: ThresholdSweepPoint[];
  recommended_threshold: number;
  recommended_margin: number;
  objective_used: string;
  objective_rationale: string;
  is_provisional: boolean;
  provisional_warning?: string | null;
  per_sku_accuracy_at_recommended: Record<string, number>;
}

export interface PerSkuBenchmarkDelta {
  sku_code: string;
  baseline_accuracy: number;
  candidate_accuracy: number;
  accuracy_delta: number;
  has_regressed: boolean;
  regression_severity: "NONE" | "MINOR" | "SEVERE";
}

export interface PromotionSafeguardCheck {
  safeguard_name: string;
  status: "PASS" | "FAIL";
  required_criterion: string;
  measured_value: string;
  passed: boolean;
}

export interface ComparativeBenchmarkPayload {
  candidate_model_id: string;
  baseline_model_id?: string;
  split?: "val" | "test";
  similarity_threshold?: number;
  margin_threshold?: number;
}

export interface ComparativeBenchmarkResponse {
  status: string;
  candidate_model_id: string;
  baseline_model_id: string;
  split_evaluated: string;
  evaluated_samples_count: number;
  similarity_threshold: number;
  margin_threshold: number;
  baseline_summary: {
    model_id: string;
    architecture: string;
    embedding_dim: number;
    top1_accuracy: number;
    top3_accuracy: number;
    unknown_false_acceptance_rate: number;
    known_false_rejection_rate: number;
    average_latency_ms: number;
    total_known_queries: number;
    total_unknown_queries: number;
    per_sku_accuracy: Record<string, number>;
  };
  candidate_summary: {
    model_id: string;
    architecture: string;
    embedding_dim: number;
    top1_accuracy: number;
    top3_accuracy: number;
    unknown_false_acceptance_rate: number;
    known_false_rejection_rate: number;
    average_latency_ms: number;
    total_known_queries: number;
    total_unknown_queries: number;
    per_sku_accuracy: Record<string, number>;
  };
  comparison_deltas: {
    top1_accuracy_delta: number;
    top3_accuracy_delta: number;
    unknown_far_delta: number;
    known_frr_delta: number;
    latency_delta_ms: number;
  };
  per_sku_breakdown: PerSkuBenchmarkDelta[];
  safeguards: PromotionSafeguardCheck[];
  eligible_for_promotion: boolean;
  rejection_reasons: string[];
}

export interface PromoteCandidateResponse {
  promoted: boolean;
  status: string;
  model_id: string;
  previous_active_model_id?: string | null;
  migrated_gallery_count: number;
  message: string;
  safeguards_status: string;
}

// Section 4 API Functions

export async function getHardNegatives(
  status?: string,
  category?: string,
  limit = 100,
  offset = 0
): Promise<HardNegativeRecord[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (category) params.append("category", category);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());
  return apiFetch<HardNegativeRecord[]>(`/evaluation/hard-negatives?${params.toString()}`);
}

export async function reviewHardNegative(
  id: number,
  data: HardNegativeReviewPayload
): Promise<HardNegativeRecord> {
  return apiFetch<HardNegativeRecord>(`/evaluation/hard-negatives/${id}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteHardNegative(id: number): Promise<{ status: string; id: number }> {
  return apiFetch<{ status: string; id: number }>(`/evaluation/hard-negatives/${id}`, {
    method: "DELETE",
  });
}

export async function mineHardNegativesFromLogs(
  minSimilarity = 0.35,
  limit = 50
): Promise<{ mined_count: number; message: string; records: HardNegativeRecord[] }> {
  return apiFetch<{ mined_count: number; message: string; records: HardNegativeRecord[] }>(
    "/evaluation/hard-negatives/mine-from-logs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min_similarity: minSimilarity, limit }),
    }
  );
}

export async function promoteHardNegatives(
  payload: PromoteHardNegativesPayload
): Promise<{ promoted_count: number; target_split: string; created_image_ids: number[]; message: string }> {
  return apiFetch<{ promoted_count: number; target_split: string; created_image_ids: number[]; message: string }>(
    "/evaluation/hard-negatives/promote",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function runErrorAnalysis(
  split = "val",
  similarityThreshold = 0.60,
  marginThreshold = 0.05,
  modelId?: string
): Promise<ErrorAnalysisResponse> {
  const params = new URLSearchParams();
  params.append("split", split);
  params.append("similarity_threshold", similarityThreshold.toString());
  params.append("margin_threshold", marginThreshold.toString());
  if (modelId) params.append("model_id", modelId);
  return apiFetch<ErrorAnalysisResponse>(`/evaluation/error-analysis?${params.toString()}`, {
    method: "POST",
  });
}

export async function runThresholdCalibration(
  payload: ThresholdCalibrationPayload = {}
): Promise<ThresholdCalibrationResponse> {
  return apiFetch<ThresholdCalibrationResponse>("/evaluation/threshold-calibration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function runComparativeBenchmark(
  payload: ComparativeBenchmarkPayload
): Promise<ComparativeBenchmarkResponse> {
  return apiFetch<ComparativeBenchmarkResponse>("/evaluation/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function promoteCandidateModel(
  candidateModelId: string,
  force = false
): Promise<PromoteCandidateResponse> {
  return apiFetch<PromoteCandidateResponse>("/evaluation/promote-candidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_model_id: candidateModelId, force }),
  });
}

// ===========================================================================
// SECTION 5: PRODUCTION READINESS, PERFORMANCE & BACKUP API
// ===========================================================================

export interface SystemReadinessResponse {
  overall_status: "READY" | "DEGRADED";
  application_health: string;
  model_readiness: "READY" | "UNAVAILABLE";
  gallery_synchronization: "SYNCHRONIZED" | "NEEDS_REINDEX";
  active_models: {
    embedding_model?: string | null;
    embedding_dim?: number | null;
    detector_model?: string | null;
  };
  gallery_stats: {
    registered_active_skus: number;
    active_reference_vectors: number;
  };
}

export interface ResourceUsageResponse {
  cpu: {
    cpu_cores: number;
    physical_cores: number;
    cpu_percent: number;
  };
  ram: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    percent: number;
    process_rss_mb: number;
  };
  disk: {
    storage_path: string;
    total_gb: number;
    free_gb: number;
    percent_used: number;
  };
  runtime: {
    torch_threads: number;
    device: string;
  };
}

export interface BackupItem {
  filename: string;
  file_path: string;
  file_size_bytes: number;
  created_at: string;
  backup_id: string;
  label: string;
  total_files: number;
  skus_count: number;
  images_count: number;
}

export interface CreateBackupResponse {
  status: string;
  backup_name: string;
  backup_path: string;
  archive_size_bytes: number;
  total_files_archived: number;
  manifest: Record<string, any>;
}

export interface RestoreBackupResponse {
  status: string;
  is_isolated_dry_run: boolean;
  destination: string;
  files_restored: number;
  backup_id: string;
  manifest?: Record<string, any>;
}

export interface CleanupResponse {
  dry_run: boolean;
  protected_models: string[];
  identified_orphaned_checkpoints: string[];
  purged_checkpoints_count: number;
  identified_orphaned_crops: string[];
  purged_crops_count: number;
  message: string;
}

export async function getSystemReadiness(): Promise<SystemReadinessResponse> {
  return apiFetch<SystemReadinessResponse>("/system/readiness");
}

export async function getResourceUsage(): Promise<ResourceUsageResponse> {
  return apiFetch<ResourceUsageResponse>("/system/resources");
}

export async function createBackup(label = "manual_backup"): Promise<CreateBackupResponse> {
  return apiFetch<CreateBackupResponse>(`/system/backup/create?label=${encodeURIComponent(label)}`, {
    method: "POST",
  });
}

export async function listBackups(): Promise<BackupItem[]> {
  return apiFetch<BackupItem[]>("/system/backup/list");
}

export async function restoreBackup(filename: string, dryRun = true): Promise<RestoreBackupResponse> {
  return apiFetch<RestoreBackupResponse>(
    `/system/backup/restore?filename=${encodeURIComponent(filename)}&dry_run=${dryRun}`,
    {
      method: "POST",
    }
  );
}

export async function cleanupArtifacts(retainCheckpoints = 3, dryRun = true): Promise<CleanupResponse> {
  return apiFetch<CleanupResponse>(
    `/system/cleanup?retain_checkpoints=${retainCheckpoints}&dry_run=${dryRun}`,
    {
      method: "POST",
    }
  );
}

