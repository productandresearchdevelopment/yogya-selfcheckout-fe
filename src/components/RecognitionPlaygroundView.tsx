"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crosshair,
  Camera,
  CameraOff,
  Video,
  VideoOff,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Sliders,
  Info,
  Clock,
  Maximize2,
  Upload,
  Trash2,
  Eye,
  Cpu,
  Zap,
  X,
  Layers,
  Search,
} from "lucide-react";
import {
  RecognitionResult,
  DetectedObject,
  RecognitionStatusSummary,
  FewShotEnrollmentResponse,
  runRecognition,
  predictWebcamFrame,
  enrollFewShotSku,
  getRecognitionStatus,
  API_BASE,
} from "@/lib/api";
import { WebcamImageCapture } from "./WebcamImageCapture";

interface TrackedDetection {
  id: string;
  boxId: number;
  skuCode: string;
  skuName: string;
  status: "KNOWN" | "UNKNOWN" | "UNCLASSIFIED";
  similarity: number;
  confidence: number;
  lastSeen: number;
}

export const RecognitionPlaygroundView: React.FC = () => {
  // Navigation Tab: Webcam vs Static Image Playground
  const [activeTab, setActiveTab] = useState<"webcam" | "static">("webcam");

  // Recognition Status & Compatibility
  const [statusInfo, setStatusInfo] = useState<RecognitionStatusSummary | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Hyperparameters
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.35);
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.60);
  const [marginThreshold, setMarginThreshold] = useState<number>(0.05);
  const [topK, setTopK] = useState<number>(5);
  const [webcamThrottleMs, setWebcamThrottleMs] = useState<number>(300);

  // Webcam State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState<boolean>(true);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraResolution, setCameraResolution] = useState<{ width: number; height: number } | null>(null);
  const [isSecureContext, setIsSecureContext] = useState<boolean>(true);

  // Webcam Performance & Measurements
  const [measuredLatency, setMeasuredLatency] = useState<number>(0);
  const [measuredFps, setMeasuredFps] = useState<number>(0);
  const [isInFlight, setIsInFlight] = useState<boolean>(false);
  const [activeDetectionsCount, setActiveDetectionsCount] = useState<number>(0);
  const [trackedItems, setTrackedItems] = useState<TrackedDetection[]>([]);

  // Refs for Webcam Loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const frameSeqRef = useRef<number>(0);
  const fpsTimestampsRef = useRef<number[]>([]);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Static Image Mode State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isStaticLoading, setIsStaticLoading] = useState<boolean>(false);
  const [staticResult, setStaticResult] = useState<RecognitionResult | null>(null);
  const [staticError, setStaticError] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticImageRef = useRef<HTMLImageElement | null>(null);

  // Few-Shot SKU Enrollment Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [enrollSkuCode, setEnrollSkuCode] = useState<string>("");
  const [enrollName, setEnrollName] = useState<string>("");
  const [enrollCategory, setEnrollCategory] = useState<string>("");
  const [enrollDescription, setEnrollDescription] = useState<string>("");
  const [enrollFiles, setEnrollFiles] = useState<File[]>([]);
  const [enrollPreviews, setEnrollPreviews] = useState<string[]>([]);
  const [enrollImageSource, setEnrollImageSource] = useState<"upload" | "webcam">("upload");
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // 1. Fetch System & Model Registry Status
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const data = await getRecognitionStatus();
      setStatusInfo(data);
    } catch (e: any) {
      console.error("Failed to load recognition status:", e);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (typeof window !== "undefined") {
      setIsSecureContext(window.isSecureContext);
    }
  }, [fetchStatus]);

  // 2. Camera Device Enumeration
  const loadCameraDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setCameraError("Camera device access is not supported in this environment.");
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: unknown) {
      console.warn("Could not enumerate camera devices:", err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    loadCameraDevices();
  }, [loadCameraDevices]);

  // 3. Start Camera Stream
  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera API (getUserMedia) unavailable. Browsers require HTTPS or http://localhost to access webcams."
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            setCameraResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
            setIsCameraActive(true);
          }
        };
      }
      await loadCameraDevices();
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Failed to access webcam.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission denied by browser. Please grant camera access in site settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No compatible camera device detected on this system.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Camera is currently in use by another application or blocked by the operating system.";
      } else if (!window.isSecureContext) {
        msg = "Camera API requires a Secure Context (HTTPS or http://localhost). Insecure origins cannot capture video.";
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // 4. Stop Camera Stream & Cleanup
  const stopCamera = () => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsCameraActive(false);
    setIsInFlight(false);
    isProcessingRef.current = false;
    setCameraResolution(null);
    setActiveDetectionsCount(0);
    setTrackedItems([]);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 5. Letterbox-Aware Bounding Box Drawing on Video Overlay
  const drawBoxesOnWebcamCanvas = useCallback(
    (detections: DetectedObject[]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const dpr = window.devicePixelRatio || 1;
      const displayW = video.clientWidth;
      const displayH = video.clientHeight;

      if (displayW === 0 || displayH === 0) return;

      if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
        canvas.width = displayW * dpr;
        canvas.height = displayH * dpr;
      }
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayW, displayH);

      if (!detections || detections.length === 0) {
        ctx.restore();
        return;
      }

      // Compute letterbox / pillarbox scaling
      const videoW = video.videoWidth || displayW;
      const videoH = video.videoHeight || displayH;
      const videoRatio = videoW / videoH;
      const displayRatio = displayW / displayH;

      let renderW = displayW;
      let renderH = displayH;
      let offsetX = 0;
      let offsetY = 0;

      if (displayRatio > videoRatio) {
        renderW = displayH * videoRatio;
        offsetX = (displayW - renderW) / 2;
      } else {
        renderH = displayW / videoRatio;
        offsetY = (displayH - renderH) / 2;
      }

      detections.forEach((obj) => {
        // Phase D (Rule 3): ONLY display a bounding box and label when BOTH conditions are satisfied:
        // 1. detector_confidence >= configured detection threshold
        // 2. sku_similarity >= configured similarity threshold
        // If either fails, do NOT display bounding box, do NOT display SKU label, and do NOT display UNKNOWN.
        const meetsConf = (obj.detector_confidence ?? 0) >= confidenceThreshold;
        const meetsSim = (obj.top_similarity_score ?? 0) >= similarityThreshold;
        const isUnknown = obj.is_unknown || obj.recognition_status === "UNKNOWN" || !obj.predicted_sku || obj.predicted_sku === "UNKNOWN";

        if (!meetsConf || !meetsSim || isUnknown) {
          return; // Strict filter: never draw bounding box, never draw UNKNOWN
        }

        const x = offsetX + obj.x_min * renderW;
        const y = offsetY + obj.y_min * renderH;
        const w = (obj.x_max - obj.x_min) * renderW;
        const h = (obj.y_max - obj.y_min) * renderH;

        const boxColor = "#06b6d4"; // Vibrant cyan for accepted recognized products

        // Draw rectangle
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, w, h);

        // Fill highlight
        ctx.fillStyle = `${boxColor}20`;
        ctx.fillRect(x, y, w, h);

        // Label formulation: SKU code, similarity, confidence (separate values per Rule 4)
        const simStr = obj.top_similarity_score != null ? `Sim: ${obj.top_similarity_score.toFixed(2)}` : "";
        const confStr = `Conf: ${(obj.detector_confidence * 100).toFixed(0)}%`;
        const skuCode = obj.predicted_sku || "KNOWN";
        const label = `${skuCode} — ${simStr} (${confStr})`;

        ctx.font = "bold 11px monospace, system-ui";
        const textWidth = ctx.measureText(label).width;
        const badgeH = 20;
        const badgeW = textWidth + 12;
        const badgeY = Math.max(0, y - badgeH);

        ctx.fillStyle = boxColor;
        ctx.fillRect(x, badgeY, badgeW, badgeH);

        ctx.fillStyle = "#000000";
        ctx.fillText(label, x + 6, badgeY + 14);
      });

      ctx.restore();
    },
    [confidenceThreshold, similarityThreshold]
  );

  // 6. Webcam Frame Capture and Inference Loop with In-Flight Throttling
  const processWebcamTick = useCallback(async () => {
    if (!isCameraActive || !isRecognitionActive || isProcessingRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    if (vWidth === 0 || vHeight === 0) {
      return;
    }

    isProcessingRef.current = true;
    setIsInFlight(true);

    const currentSeq = ++frameSeqRef.current;
    const tickStart = performance.now();

    try {
      // Offscreen canvas frame grabber
      const offscreen = document.createElement("canvas");
      offscreen.width = vWidth;
      offscreen.height = vHeight;
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        isProcessingRef.current = false;
        setIsInFlight(false);
        return;
      }

      ctx.drawImage(video, 0, 0, vWidth, vHeight);

      offscreen.toBlob(
        async (blob) => {
          if (!blob) {
            isProcessingRef.current = false;
            setIsInFlight(false);
            return;
          }

          try {
            const result = await predictWebcamFrame(blob, {
              confidenceThreshold,
              similarityThreshold,
              marginThreshold,
              topK,
              allowFallback: false, // Strict: empty frame returns 0 detections and clears boxes
              frameSeq: currentSeq,
            });

            // Discard stale or out-of-order responses
            if (currentSeq < frameSeqRef.current - 1) {
              return;
            }

            const latency = Math.round(performance.now() - tickStart);
            setMeasuredLatency(latency);

            // FPS calculation over rolling window
            const now = performance.now();
            fpsTimestampsRef.current = [...fpsTimestampsRef.current.filter((t) => now - t < 2000), now];
            const calculatedFps = Math.max(1, Math.round(fpsTimestampsRef.current.length / 2));
            setMeasuredFps(calculatedFps);

            // Phase D Rule 3: Strict filtering for live webcam detections
            const acceptedDetections = (result.detected_objects || []).filter(
              (obj) =>
                !obj.is_unknown &&
                obj.predicted_sku &&
                obj.predicted_sku !== "UNKNOWN" &&
                (obj.detector_confidence ?? 0) >= confidenceThreshold &&
                (obj.top_similarity_score ?? 0) >= similarityThreshold
            );

            // Render boxes
            drawBoxesOnWebcamCanvas(acceptedDetections);
            setActiveDetectionsCount(acceptedDetections.length);

            // Update tracked detections list (only accepted verified products)
            const currentTimestamp = Date.now();
            setTrackedItems((prev) => {
              const updated = [...prev];
              acceptedDetections.forEach((obj) => {
                const key = obj.predicted_sku!;
                const idx = updated.findIndex((t) => t.id === key);
                const item: TrackedDetection = {
                  id: key,
                  boxId: obj.box_id,
                  skuCode: obj.predicted_sku!,
                  skuName: obj.predicted_sku_name || obj.predicted_sku!,
                  status: "KNOWN",
                  similarity: obj.top_similarity_score ?? 0,
                  confidence: obj.detector_confidence,
                  lastSeen: currentTimestamp,
                };
                if (idx >= 0) {
                  updated[idx] = item;
                } else {
                  updated.unshift(item);
                }
              });

              // Decay items not seen for > 3.0 seconds
              return updated.filter((item) => currentTimestamp - item.lastSeen < 3000).slice(0, 8);
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("Frame inference failed:", msg);
          } finally {
            isProcessingRef.current = false;
            setIsInFlight(false);
          }
        },
        "image/jpeg",
        0.7
      );
    } catch (e: unknown) {
      console.error("Tick error:", e);
      isProcessingRef.current = false;
      setIsInFlight(false);
    }
  }, [
    isCameraActive,
    isRecognitionActive,
    confidenceThreshold,
    similarityThreshold,
    marginThreshold,
    topK,
    drawBoxesOnWebcamCanvas,
  ]);

  useEffect(() => {
    if (!isCameraActive || !isRecognitionActive) {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const tick = async () => {
      if (!isSubscribed) return;
      await processWebcamTick();
      if (isSubscribed) {
        loopTimeoutRef.current = setTimeout(tick, webcamThrottleMs);
      }
    };

    loopTimeoutRef.current = setTimeout(tick, webcamThrottleMs);

    return () => {
      isSubscribed = false;
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
  }, [isCameraActive, isRecognitionActive, processWebcamTick, webcamThrottleMs]);

  // 7. Static Image Playground Execution
  const handleStaticFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStaticResult(null);
      setStaticError(null);
      setSelectedBoxId(null);
    }
  };

  const handleRunStaticRecognition = async () => {
    if (!selectedFile) return;
    setIsStaticLoading(true);
    setStaticError(null);
    try {
      const res = await runRecognition(
        selectedFile,
        confidenceThreshold,
        similarityThreshold,
        topK,
        marginThreshold,
        10,
        true
      );
      setStaticResult(res);
      if (res.detected_objects.length > 0) {
        setSelectedBoxId(res.detected_objects[0].box_id);
      }
    } catch (err: any) {
      setStaticError(err.message || "Recognition pipeline execution failed");
    } finally {
      setIsStaticLoading(false);
    }
  };

  const drawStaticBoxes = useCallback(() => {
    const canvas = staticCanvasRef.current;
    const img = staticImageRef.current;
    if (!canvas || !img || !staticResult) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Phase D Rule 3: Only display accepted products meeting BOTH thresholds
    const acceptedObjects = (staticResult.detected_objects || []).filter(
      (obj) =>
        !obj.is_unknown &&
        obj.predicted_sku &&
        obj.predicted_sku !== "UNKNOWN" &&
        (obj.detector_confidence ?? 0) >= confidenceThreshold &&
        (obj.top_similarity_score ?? 0) >= similarityThreshold
    );

    acceptedObjects.forEach((obj) => {
      const isSelected = selectedBoxId === obj.box_id;
      const x = obj.x_min * canvas.width;
      const y = obj.y_min * canvas.height;
      const w = (obj.x_max - obj.x_min) * canvas.width;
      const h = (obj.y_max - obj.y_min) * canvas.height;

      const boxColor = "#06b6d4";

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = isSelected ? `${boxColor}33` : `${boxColor}15`;
      ctx.fillRect(x, y, w, h);

      const statusText = `${obj.predicted_sku} (${obj.top_similarity_score?.toFixed(2)})`;
      const labelText = `#${obj.box_id + 1}: ${statusText}`;

      ctx.font = "bold 11px monospace";
      const textMetrics = ctx.measureText(labelText);
      const labelW = textMetrics.width + 10;
      const labelH = 18;
      const labelY = Math.max(0, y - labelH);

      ctx.fillStyle = boxColor;
      ctx.fillRect(x, labelY, labelW, labelH);

      ctx.fillStyle = "#000000";
      ctx.fillText(labelText, x + 5, labelY + 13);
    });
  }, [staticResult, selectedBoxId, confidenceThreshold, similarityThreshold]);

  useEffect(() => {
    if (staticResult) {
      drawStaticBoxes();
    }
  }, [staticResult, selectedBoxId, drawStaticBoxes]);

  // 8. Few-Shot SKU Enrollment Actions
  const handleEnrollFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...enrollFiles, ...newFiles];
      setEnrollFiles(combined);
      const previews = combined.map((f) => URL.createObjectURL(f));
      setEnrollPreviews(previews);
      setEnrollError(null);
    }
  };

  const removeEnrollFile = (index: number) => {
    const updatedFiles = enrollFiles.filter((_, i) => i !== index);
    setEnrollFiles(updatedFiles);
    const previews = updatedFiles.map((f) => URL.createObjectURL(f));
    setEnrollPreviews(previews);
  };

  const handleAddEnrollWebcamCapture = (file: File) => {
    setEnrollFiles((prev) => [...prev, file]);
    setEnrollPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    setEnrollError(null);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollSkuCode.trim() || !enrollName.trim()) {
      setEnrollError("SKU Code and Product Name are mandatory.");
      return;
    }
    if (enrollFiles.length === 0) {
      setEnrollError("Please attach at least 1 reference image for visual embedding enrollment.");
      return;
    }

    setIsEnrolling(true);
    setEnrollError(null);
    setEnrollSuccess(null);

    const formData = new FormData();
    formData.append("sku_code", enrollSkuCode.trim().toUpperCase());
    formData.append("name", enrollName.trim());
    if (enrollCategory.trim()) formData.append("category", enrollCategory.trim());
    if (enrollDescription.trim()) formData.append("description", enrollDescription.trim());

    enrollFiles.forEach((file) => {
      formData.append("reference_images", file);
    });

    try {
      const res: FewShotEnrollmentResponse = await enrollFewShotSku(formData);
      setEnrollSuccess(res.message);
      // Reset form
      setEnrollSkuCode("");
      setEnrollName("");
      setEnrollCategory("");
      setEnrollDescription("");
      setEnrollFiles([]);
      setEnrollPreviews([]);
      setEnrollImageSource("upload");
      // Refresh status so reference count updates
      await fetchStatus();
    } catch (err: any) {
      setEnrollError(err.message || "Failed to enroll SKU into active gallery.");
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Crosshair className="h-5 w-5 text-cyan-400" />
            <span>Product Recognition Studio</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time object localization, visual metric embeddings, cosine similarity search & open-set UNKNOWN rejection.
          </p>
        </div>

        {/* Action Buttons: Few-Shot Modal & Mode Tabs */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setIsEnrollModalOpen(true);
              setEnrollError(null);
              setEnrollSuccess(null);
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Enroll New SKU (Few-Shot)</span>
          </button>

          <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setActiveTab("webcam")}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "webcam"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Live Webcam</span>
            </button>
            <button
              onClick={() => setActiveTab("static")}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "static"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Static Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* Runtime Diagnostics & Model Compatibility HUD Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Cpu className="h-3 w-3 text-cyan-400" />
            <span>Active Embedder</span>
          </span>
          <p className="font-mono text-xs font-bold text-white truncate" title={statusInfo?.active_embedding_model}>
            {statusInfo ? statusInfo.active_embedding_model : "Loading..."}
          </p>
          <span className="text-[10px] text-cyan-400 font-mono">
            {statusInfo ? `${statusInfo.embedding_dim}-dim vector` : "--"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Layers className="h-3 w-3 text-emerald-400" />
            <span>Gallery References</span>
          </span>
          <p className="font-mono text-xs font-bold text-emerald-400">
            {statusInfo ? `${statusInfo.gallery_reference_count} Vectors` : "--"}
          </p>
          <span className="text-[10px] text-slate-500">
            {statusInfo ? `${statusInfo.registered_sku_count} Active SKUs` : "--"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Clock className="h-3 w-3 text-indigo-400" />
            <span>Inference Latency</span>
          </span>
          <p className="font-mono text-xs font-bold text-indigo-300">
            {activeTab === "webcam" ? (isCameraActive ? `${measuredLatency} ms` : "Standby") : `${staticResult?.duration_ms ?? 0} ms`}
          </p>
          <span className="text-[10px] text-slate-500">
            {activeTab === "webcam" && isCameraActive ? `~${measuredFps} FPS (Sampled)` : "On-Demand"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span>Camera Pipeline</span>
          </span>
          <div className="flex items-center space-x-1.5 pt-0.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
              }`}
            />
            <span className="text-xs font-bold text-white">
              {isCameraActive ? (isRecognitionActive ? "Recognizing" : "Stream Only") : "Inactive"}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            {cameraResolution ? `${cameraResolution.width}x${cameraResolution.height}` : "No Stream"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Eye className="h-3 w-3 text-cyan-400" />
            <span>Current Detections</span>
          </span>
          <p className="font-mono text-xs font-bold text-cyan-400">
            {activeTab === "webcam" ? activeDetectionsCount : (staticResult?.objects_detected_count ?? 0)} Objects
          </p>
          <span className="text-[10px] text-slate-500">
            {isInFlight ? "Processing..." : "Ready"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Crosshair className="h-3 w-3 text-purple-400" />
            <span>Detector Model</span>
          </span>
          <p className="font-mono text-xs font-bold text-purple-300 truncate" title="FasterRCNN-MobileNetV3">
            {statusInfo?.active_detector || "FasterRCNN"}
          </p>
          <span className="text-[10px] text-slate-500">
            COCO Proposal Head
          </span>
        </div>
      </div>

      {/* SECURE CONTEXT WARNING (if on insecure HTTP) */}
      {!isSecureContext && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3.5 text-xs text-amber-300 flex items-start space-x-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Insecure Context Warning (Camera API Constraint)</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Standard browser security policy requires a Secure Context (<code>https://</code> or <code>http://localhost</code>) to access physical webcams. If accessing from a remote IP via plain HTTP, the browser will block <code>navigator.mediaDevices.getUserMedia</code>.
            </p>
          </div>
        </div>
      )}

      {/* MAIN VIEW: WEBCAM MODE VS STATIC IMAGE MODE */}
      {activeTab === "webcam" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Video Canvas & Camera Toolbar (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
              {/* Camera Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  {/* Start / Stop Camera Button */}
                  {isCameraActive ? (
                    <button
                      onClick={stopCamera}
                      className="flex items-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition-all"
                    >
                      <CameraOff className="h-4 w-4" />
                      <span>Stop Camera</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => startCamera(selectedDeviceId)}
                      className="flex items-center space-x-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 transition-all"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Start Camera</span>
                    </button>
                  )}

                  {/* Pause / Resume Recognition */}
                  {isCameraActive && (
                    <button
                      onClick={() => setIsRecognitionActive(!isRecognitionActive)}
                      className={`flex items-center space-x-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                        isRecognitionActive
                          ? "border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-950/70"
                          : "border-emerald-800/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70"
                      }`}
                    >
                      {isRecognitionActive ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                      <span>{isRecognitionActive ? "Pause Recognition" : "Resume Recognition"}</span>
                    </button>
                  )}
                </div>

                {/* Device Selector Dropdown */}
                {availableDevices.length > 1 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">Device:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedDeviceId(newId);
                        if (isCameraActive) {
                          startCamera(newId);
                        }
                      }}
                      className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {availableDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>
                          {d.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Video & Canvas Overlay Viewport */}
              <div className="relative min-h-[420px] max-h-[580px] w-full flex items-center justify-center overflow-hidden rounded-xl bg-slate-950 border border-slate-800">
                {/* Real HTML5 Video element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full max-h-[560px] object-contain rounded-lg ${
                    isCameraActive ? "block" : "hidden"
                  }`}
                />

                {/* Canvas Overlay for live bounding box rendering */}
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 pointer-events-none ${
                    isCameraActive ? "block" : "hidden"
                  }`}
                />

                {/* Empty State / Inactive Camera Display */}
                {!isCameraActive && (
                  <div className="flex flex-col items-center justify-center text-center text-slate-600 space-y-3 py-20 px-4">
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                      <Camera className="h-10 w-10 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Live Video Stream Inactive</p>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Click <strong>Start Camera</strong> above to initialize your camera stream and begin real-time product recognition with open-set matching.
                      </p>
                    </div>
                    {cameraError && (
                      <div className="rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300 max-w-md text-left flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stream Live Indicator Badge */}
                {isCameraActive && (
                  <div className="absolute top-3 left-3 flex items-center space-x-2 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/80 px-2.5 py-1 text-[11px] font-mono">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-slate-300">LIVE</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-cyan-400">{measuredLatency} ms</span>
                  </div>
                )}
              </div>

              {/* Real-Time Recognition Legend */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
                    <span>Matched Known SKU</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    <span>Rejected as UNKNOWN</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" />
                    <span>Detector Proposal</span>
                  </span>
                </div>
                <span className="text-slate-500 font-mono">
                  Sample Rate: {webcamThrottleMs}ms
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Detection Feed & Hyperparameter Sliders (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Detected Products Feed */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Real-Time SKU Feed</span>
                </h2>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  {trackedItems.length} Identified
                </span>
              </div>

              {trackedItems.length > 0 ? (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {trackedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-all ${
                        item.status === "KNOWN"
                          ? "border-cyan-900/60 bg-cyan-950/20"
                          : "border-amber-900/60 bg-amber-950/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              item.status === "KNOWN"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                : "bg-amber-950 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {item.status}
                          </span>
                          <h3 className="text-xs font-bold text-white mt-1">
                            {item.skuName}
                          </h3>
                          <p className="text-[10px] font-mono text-slate-400">{item.skuCode}</p>
                        </div>
                        <div className="text-right space-y-0.5 font-mono">
                          <span className="text-[11px] font-bold text-cyan-400 block">
                            Sim: {item.similarity.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Conf: {(item.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Search className="h-8 w-8 mx-auto text-slate-600" />
                  <p className="text-xs">No active objects detected in stream.</p>
                  <p className="text-[10px] text-slate-600">
                    Place a registered product in front of the camera to view live identification.
                  </p>
                </div>
              )}
            </div>

            {/* Inference Sliders Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 text-xs shadow-xl">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <span>Open-Set Decision Rules</span>
              </h2>

              {/* Slider 1: Confidence */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Detector Confidence:</span>
                  <span className="font-mono text-cyan-400 font-bold">{confidenceThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Slider 2: Similarity Acceptance */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Similarity Threshold:</span>
                  <span className="font-mono text-emerald-400 font-bold">{similarityThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.95"
                  step="0.05"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Scores below this are rejected and labeled <strong>UNKNOWN</strong>.
                </p>
              </div>

              {/* Slider 3: Top-1 vs Top-2 Margin */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Top-1 / Top-2 Margin:</span>
                  <span className="font-mono text-indigo-400 font-bold">{marginThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.25"
                  step="0.01"
                  value={marginThreshold}
                  onChange={(e) => setMarginThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Requires top candidate to lead runner-up by this margin to prevent ambiguous false matches.
                </p>
              </div>

              {/* Frame Throttling interval */}
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Frame Sampling Rate:</span>
                  <span className="font-mono text-purple-400 font-bold">{webcamThrottleMs} ms</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="1000"
                  step="50"
                  value={webcamThrottleMs}
                  onChange={(e) => setWebcamThrottleMs(parseInt(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Throttles capture rate to match host CPU capabilities and avoid request queuing.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STATIC IMAGE EVALUATION MODE (Preserves Section 1/2 workflow) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Upload and Parameters */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <Upload className="h-4 w-4 text-cyan-400" />
                  <span>Static Query Image Input</span>
                </h2>

                <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-6 text-center hover:border-cyan-500 transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleStaticFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <Upload className="h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-xs font-semibold text-white">
                    {selectedFile ? selectedFile.name : "Click or drag & drop query image"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">JPEG, PNG, WebP up to 15MB</p>
                </div>

                {/* Hyperparameter Sliders for static mode */}
                <div className="space-y-3 border-t border-slate-800 pt-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Detector Confidence:</span>
                      <span className="font-mono text-cyan-400 font-bold">{confidenceThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="0.95"
                      step="0.05"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Similarity Threshold:</span>
                      <span className="font-mono text-emerald-400 font-bold">{similarityThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.20"
                      max="0.95"
                      step="0.05"
                      value={similarityThreshold}
                      onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Margin Threshold:</span>
                      <span className="font-mono text-indigo-400 font-bold">{marginThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.20"
                      step="0.01"
                      value={marginThreshold}
                      onChange={(e) => setMarginThreshold(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  onClick={handleRunStaticRecognition}
                  disabled={!selectedFile || isStaticLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 p-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:opacity-95 disabled:opacity-40 transition-all"
                >
                  <Crosshair className={`h-4 w-4 ${isStaticLoading ? "animate-spin" : ""}`} />
                  <span>{isStaticLoading ? "Running Recognition..." : "Run Recognition Pipeline"}</span>
                </button>

                {staticError && (
                  <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{staticError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Visual Canvas Overlay for static mode */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                    <Maximize2 className="h-4 w-4 text-cyan-400" />
                    <span>Visual Localization Overlay</span>
                  </h2>
                  {staticResult && (
                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{staticResult.duration_ms} ms</span>
                      <span className="text-slate-600">|</span>
                      <span>{staticResult.objects_detected_count} Object(s)</span>
                    </div>
                  )}
                </div>

                <div className="relative flex min-h-[380px] max-h-[560px] items-center justify-center overflow-auto rounded-xl bg-slate-950 border border-slate-800 p-2">
                  {previewUrl ? (
                    <div className="relative inline-block select-none">
                      <img
                        ref={staticImageRef}
                        src={previewUrl}
                        alt="Query Image"
                        className="max-h-[500px] max-w-full object-contain rounded-lg"
                        onLoad={drawStaticBoxes}
                      />
                      <canvas ref={staticCanvasRef} className="absolute inset-0 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center text-slate-600 space-y-2 py-16">
                      <Crosshair className="h-10 w-10 text-slate-700" />
                      <p className="text-xs text-slate-400">No test image selected.</p>
                      <p className="text-[11px] text-slate-500">
                        Upload an image on the left to inspect bounding boxes and candidate matches.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Static Results Section */}
          {staticResult && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span>Inference Results & Candidate Rankings</span>
                  </h2>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[11px]">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                    Backbone: {staticResult.embedding_model}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-300">
                    Device: {staticResult.device_used}
                  </span>
                </div>
              </div>

              {/* Detections Grid — Filtered strictly by Rule 3 */}
              {(() => {
                const acceptedStatic = (staticResult.detected_objects || []).filter(
                  (obj) =>
                    !obj.is_unknown &&
                    obj.predicted_sku &&
                    obj.predicted_sku !== "UNKNOWN" &&
                    (obj.detector_confidence ?? 0) >= confidenceThreshold &&
                    (obj.top_similarity_score ?? 0) >= similarityThreshold
                );

                if (acceptedStatic.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400 space-y-2">
                      <Search className="h-7 w-7 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-300">No Recognized Products Meet Both Acceptance Thresholds</p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                        Detections require both Detection Confidence &ge; {(confidenceThreshold * 100).toFixed(0)}% and SKU Similarity &ge; {(similarityThreshold * 100).toFixed(0)}% to be displayed.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {acceptedStatic.map((obj) => (
                      <div
                        key={obj.box_id}
                        onClick={() => setSelectedBoxId(obj.box_id)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          selectedBoxId === obj.box_id
                            ? "border-cyan-500 bg-slate-950 shadow-lg shadow-cyan-500/10"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
                            {obj.crop_image_url ? (
                              <img
                                src={`${API_BASE}${obj.crop_image_url}`}
                                alt="Object Crop"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">
                                No Crop
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-200">
                                Box #{obj.box_id + 1}
                              </span>
                              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                {obj.predicted_sku}
                              </span>
                            </div>
                            <p className="text-[11px] text-white truncate font-medium">
                              {obj.predicted_sku_name || obj.predicted_sku}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                              <span>Conf: {(obj.detector_confidence * 100).toFixed(0)}%</span>
                              <span>
                                Sim:{" "}
                                <strong className="text-cyan-400">
                                  {obj.top_similarity_score != null ? obj.top_similarity_score.toFixed(3) : "N/A"}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* FEW-SHOT SKU ENROLLMENT MODAL */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Few-Shot SKU Enrollment</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Registers a new product identity into the active gallery without retraining the embedding model.
                </p>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Model Architecture Confirmation Notice */}
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3 text-[11px] text-emerald-300 flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <strong>Zero-Retraining Vector Indexing:</strong> Embeddings will be computed using the active visual backbone (
                <code>{statusInfo?.active_embedding_model}</code>, {statusInfo?.embedding_dim}-dim) and immediately persisted to the reference gallery.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    SKU Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TEH-BOTOL-250ML"
                    value={enrollSkuCode}
                    onChange={(e) => setEnrollSkuCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Teh Botol Sosro 250ml"
                    value={enrollName}
                    onChange={(e) => setEnrollName(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Category (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Beverages, Snacks, Personal Care"
                  value={enrollCategory}
                  onChange={(e) => setEnrollCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Multi-Image Reference Upload Dropzone / Webcam Capture */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Reference Images (Multiple Angles Recommended) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-slate-500">{enrollFiles.length} file(s) selected</span>
                </label>

                {/* Source Selection Tabs */}
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEnrollImageSource("upload")}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      enrollImageSource === "upload"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Files</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollImageSource("webcam")}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      enrollImageSource === "webcam"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Capture from Camera</span>
                  </button>
                </div>

                {enrollImageSource === "upload" ? (
                  <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-5 text-center hover:border-emerald-500 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleEnrollFilesChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <Upload className="h-6 w-6 text-slate-500 mb-1" />
                    <p className="text-xs font-semibold text-white">Click or drag & drop reference photos</p>
                    <p className="text-[10px] text-slate-500">Provide multiple viewpoints or lighting conditions for high matching quality</p>
                  </div>
                ) : (
                  <WebcamImageCapture
                    skuCodePrefix={enrollSkuCode || "SKU"}
                    onCapture={handleAddEnrollWebcamCapture}
                  />
                )}

                {/* Previews Grid */}
                {enrollPreviews.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
                    {enrollPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square">
                        <img src={preview} alt="Reference preview" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeEnrollFile(idx)}
                          className="absolute top-1 right-1 p-1 rounded bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status & Error Feedback */}
              {enrollError && (
                <div className="rounded-xl border border-rose-800/80 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{enrollError}</span>
                </div>
              )}

              {enrollSuccess && (
                <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/50 p-3 text-xs text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{enrollSuccess}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isEnrolling || enrollFiles.length === 0}
                  className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95 disabled:opacity-40 transition-all"
                >
                  <Sparkles className={`h-4 w-4 ${isEnrolling ? "animate-spin" : ""}`} />
                  <span>{isEnrolling ? "Indexing Embeddings..." : "Enroll SKU into Gallery"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
