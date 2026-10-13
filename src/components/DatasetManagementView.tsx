"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Upload,
  Trash2,
  Tag,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  Eye,
} from "lucide-react";
import {
  SKU,
  ProductImageSummary,
  Annotation,
  getSKUs,
  getDatasetImages,
  deleteDatasetImage,
  updateImageSplit,
  uploadDatasetImages,
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
  exportYOLODataset,
  exportCOCODataset,
  reindexGallery,
  API_BASE,
} from "@/lib/api";

export interface DatasetManagementViewProps {
  initialRole?: string;
  initialSku?: string;
}

export const DatasetManagementView: React.FC<DatasetManagementViewProps> = ({
  initialRole = "all",
  initialSku = "all",
}) => {
  const [images, setImages] = useState<ProductImageSummary[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSku, setFilterSku] = useState<string>(initialSku);
  const [filterRole, setFilterRole] = useState<string>(initialRole);
  const [filterSplit, setFilterSplit] = useState<string>("all");
  const [filterValid, setFilterValid] = useState<string>("all");

  // Selected image for detail inspection / quality breakdown
  const [inspectedImage, setInspectedImage] = useState<ProductImageSummary | null>(null);

  // Annotation Modal & Canvas State
  const [annotatingImage, setAnnotatingImage] = useState<ProductImageSummary | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x_min: number; y_min: number; x_max: number; y_max: number } | null>(null);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Action status messages
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadSkuId, setUploadSkuId] = useState<number | "">("");
  const [uploadRole, setUploadRole] = useState<"reference" | "training" | "validation" | "test">("training");
  const [uploadSplit, setUploadSplit] = useState<string>("train");
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [skusData, imgsData] = await Promise.all([
        getSKUs(true),
        getDatasetImages({
          sku_id: filterSku !== "all" ? parseInt(filterSku) : undefined,
          role: filterRole !== "all" ? filterRole : undefined,
          split: filterSplit !== "all" ? filterSplit : undefined,
          is_valid: filterValid === "valid" ? true : filterValid === "invalid" ? false : undefined,
        }),
      ]);
      setSkus(skusData);
      setImages(imgsData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterSku, filterRole, filterSplit, filterValid]);

  const handleDelete = async (img: ProductImageSummary) => {
    if (!confirm(`Delete image ${img.filename}? This will remove it from the dataset.`)) return;
    try {
      await deleteDatasetImage(img.id);
      if (inspectedImage?.id === img.id) setInspectedImage(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSplitChange = async (imageId: number, newSplit: string) => {
    try {
      await updateImageSplit(imageId, newSplit);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportYolo = async () => {
    try {
      const res = await exportYOLODataset();
      alert(`Export Successful!\nFormat: YOLO detection format\nArchive: ${res.archive_path}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportCoco = async () => {
    try {
      const res = await exportCOCODataset();
      alert(`Export Successful!\nFormat: COCO JSON format\nJSON file: ${res.archive_path}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const res = await reindexGallery();
      setStatusMessage(`Reindexed ${res.indexed_count} reference embeddings in gallery.`);
      setTimeout(() => setStatusMessage(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReindexing(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSkuId || !uploadFiles || uploadFiles.length === 0) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const filesArr = Array.from(uploadFiles);
      await uploadDatasetImages(filesArr, Number(uploadSkuId), uploadRole, uploadSplit);
      setIsUploadOpen(false);
      setUploadFiles(null);
      await loadData();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  // --- ANNOTATION WORKFLOW ---
  const openAnnotationTool = async (img: ProductImageSummary) => {
    setAnnotatingImage(img);
    setCurrentBox(null);
    // Suggest SKU code as default label
    const sku = skus.find((s) => s.id === (img as any).sku_id);
    setAnnotationLabel(sku?.sku_code || "PRODUCT");
    try {
      const annList = await getAnnotations(img.id);
      setAnnotations(annList);
    } catch (err) {
      setAnnotations([]);
    }
  };

  const drawAnnotationsOnCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !annotatingImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing annotations
    annotations.forEach((ann) => {
      const x = ann.x_min * canvas.width;
      const y = ann.y_min * canvas.height;
      const w = (ann.x_max - ann.x_min) * canvas.width;
      const h = (ann.y_max - ann.y_min) * canvas.height;

      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
      ctx.fillRect(x, y, w, h);

      // Label background
      ctx.fillStyle = "#06b6d4";
      ctx.font = "bold 11px monospace";
      const text = `${ann.label} (${ann.source})`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(x, Math.max(0, y - 18), textWidth + 8, 18);

      ctx.fillStyle = "#000000";
      ctx.fillText(text, x + 4, Math.max(12, y - 5));
    });

    // Draw actively dragged current box
    if (currentBox) {
      const x = currentBox.x_min * canvas.width;
      const y = currentBox.y_min * canvas.height;
      const w = (currentBox.x_max - currentBox.x_min) * canvas.width;
      const h = (currentBox.y_max - currentBox.y_min) * canvas.height;

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
      ctx.fillRect(x, y, w, h);
    }
  };

  useEffect(() => {
    if (annotatingImage) {
      drawAnnotationsOnCanvas();
    }
  }, [annotations, currentBox, annotatingImage]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentBox({ x_min: x, y_min: y, x_max: x, y_max: y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x_min = Math.min(drawStart.x, curX);
    const x_max = Math.max(drawStart.x, curX);
    const y_min = Math.min(drawStart.y, curY);
    const y_max = Math.max(drawStart.y, curY);

    setCurrentBox({ x_min, y_min, x_max, y_max });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleSaveCurrentBox = async () => {
    if (!annotatingImage || !currentBox || !annotationLabel) return;
    const boxW = currentBox.x_max - currentBox.x_min;
    const boxH = currentBox.y_max - currentBox.y_min;
    if (boxW < 0.02 || boxH < 0.02) {
      alert("Drawn box is too small. Please drag a bounding box around the product.");
      return;
    }

    try {
      const newAnn = await createAnnotation(annotatingImage.id, {
        x_min: currentBox.x_min,
        y_min: currentBox.y_min,
        x_max: currentBox.x_max,
        y_max: currentBox.y_max,
        label: annotationLabel.trim(),
        confidence: 1.0,
        source: "manual",
      });
      setAnnotations([...annotations, newAnn]);
      setCurrentBox(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAnnotation = async (annId: number) => {
    try {
      await deleteAnnotation(annId);
      setAnnotations(annotations.filter((a) => a.id !== annId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Database className="h-5 w-5 text-emerald-400" />
            <span>Dataset & Image Quality Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect resolution, blur & contrast metrics, manage dataset splits, and annotate bounding boxes for detector fine-tuning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="flex items-center space-x-1.5 rounded-xl border border-indigo-700/60 bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReindexing ? "animate-spin" : ""}`} />
            <span>Reindex Gallery</span>
          </button>

          <button
            onClick={handleExportYolo}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export YOLO</span>
          </button>

          <button
            onClick={handleExportCoco}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export COCO</span>
          </button>

          <button
            onClick={() => {
              setUploadError(null);
              setUploadFiles(null);
              setIsUploadOpen(true);
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:opacity-95"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Images</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/50 p-3 text-xs text-cyan-300 flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Filter by SKU</label>
          <select
            value={filterSku}
            onChange={(e) => setFilterSku(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Registered SKUs</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku_code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Filter by Role</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="reference">Reference (Gallery)</option>
            <option value="training">Training (Detector)</option>
            <option value="validation">Validation</option>
            <option value="test">Test</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Dataset Split</label>
          <select
            value={filterSplit}
            onChange={(e) => setFilterSplit(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Splits</option>
            <option value="train">Train</option>
            <option value="val">Validation</option>
            <option value="test">Test</option>
            <option value="reference">Reference</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Quality Status</label>
          <select
            value={filterValid}
            onChange={(e) => setFilterValid(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Images</option>
            <option value="valid">Quality Verified</option>
            <option value="invalid">Flagged with Issues</option>
          </select>
        </div>
      </div>

      {/* Image Gallery Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{images.length} Images Found</span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-500 space-y-3 bg-slate-900/20">
            <Database className="h-10 w-10 text-slate-700 mx-auto" />
            <p className="text-xs">No images match your criteria. Upload images to build your dataset.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all hover:border-slate-700 hover:bg-slate-900"
              >
                {/* Image Preview */}
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-950">
                  <img
                    src={`${API_BASE}/api/v1/datasets/images/${img.id}/file`}
                    alt={img.filename}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.target as any).src = "https://placehold.co/250x250/0f172a/94a3b8?text=Image";
                    }}
                  />

                  {/* Quality Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-md ${
                        img.role === "reference"
                          ? "bg-indigo-950/80 text-indigo-300 border border-indigo-700/60"
                          : "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                      }`}
                    >
                      {img.role}
                    </span>
                    {!img.is_valid && (
                      <span className="rounded bg-amber-950/90 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300 border border-amber-800/80">
                        Quality Issue
                      </span>
                    )}
                  </div>

                  {/* Action Overlays */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openAnnotationTool(img)}
                      title="Annotate Bounding Box"
                      className="rounded-lg bg-slate-900/90 p-1.5 text-cyan-300 hover:bg-cyan-600 hover:text-white border border-slate-700"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setInspectedImage(img)}
                      title="Inspect Quality Metrics"
                      className="rounded-lg bg-slate-900/90 p-1.5 text-slate-300 hover:bg-slate-800 border border-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(img)}
                      title="Delete Image"
                      className="rounded-lg bg-slate-900/90 p-1.5 text-rose-400 hover:bg-rose-600 hover:text-white border border-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <p className="font-mono text-[10px] text-slate-400 truncate" title={img.filename}>
                      {img.filename}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
                      <span>{img.width}x{img.height}</span>
                      <span>Sharpness: {img.blur_score?.toFixed(0) ?? "N/A"}</span>
                    </div>
                  </div>

                  {/* Dataset Split Selector */}
                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                    <span className="text-slate-400">Split:</span>
                    <select
                      value={img.split}
                      onChange={(e) => handleSplitChange(img.id, e.target.value)}
                      className="rounded bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-800 focus:outline-none"
                    >
                      <option value="train">train</option>
                      <option value="val">val</option>
                      <option value="test">test</option>
                      <option value="reference">reference</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QUALITY METRICS INSPECTION MODAL */}
      {inspectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileCheck className="h-4 w-4 text-cyan-400" />
                <span>Image Quality Diagnostics</span>
              </h3>
              <button onClick={() => setInspectedImage(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 space-y-1">
                <p className="text-[11px] text-slate-400 font-mono truncate">{inspectedImage.filename}</p>
                <p className="text-slate-500 text-[10px]">SHA-256: {inspectedImage.file_hash}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Laplacian Blur Score</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {inspectedImage.blur_score ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-slate-500">Threshold: &gt; 80.0 is sharp</span>
                </div>

                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Mean Brightness</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {inspectedImage.brightness_score ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-slate-500">Range: 30.0 - 235.0</span>
                </div>

                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Contrast Score</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {inspectedImage.contrast_score ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-slate-500">RMS dynamic variance</span>
                </div>

                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Dimensions</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {inspectedImage.width} x {inspectedImage.height}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {(inspectedImage.file_size_bytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Validation Notes</span>
                <p className="text-slate-300 mt-1">{inspectedImage.validation_notes || "All checks passed."}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedImage(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOUNDING BOX ANNOTATION CANVAS MODAL */}
      {annotatingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-cyan-400" />
                  <span>Bounding Box Annotation Tool</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click and drag over the image to define product bounding boxes for detector fine-tuning.
                </p>
              </div>
              <button onClick={() => setAnnotatingImage(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Canvas and Image Container */}
            <div className="relative flex-1 overflow-auto rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 min-h-[360px]">
              <div className="relative inline-block select-none">
                <img
                  ref={imageElementRef}
                  src={`${API_BASE}/api/v1/datasets/images/${annotatingImage.id}/file`}
                  alt="Annotation Target"
                  className="max-h-[55vh] max-w-full object-contain pointer-events-none rounded-lg"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (canvasRef.current) {
                      canvasRef.current.width = img.clientWidth;
                      canvasRef.current.height = img.clientHeight;
                      drawAnnotationsOnCanvas();
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className="absolute inset-0 cursor-crosshair"
                />
              </div>
            </div>

            {/* Annotation Controls & Existing List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={annotationLabel}
                    onChange={(e) => setAnnotationLabel(e.target.value)}
                    placeholder="Enter SKU Code / Object Class..."
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveCurrentBox}
                    disabled={!currentBox}
                    className="rounded-lg bg-cyan-600 px-3 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
                  >
                    Save Box
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {currentBox
                    ? `Current Box: [${(currentBox.x_min * 100).toFixed(0)}%, ${(currentBox.y_min * 100).toFixed(0)}%] to [${(currentBox.x_max * 100).toFixed(0)}%, ${(currentBox.y_max * 100).toFixed(0)}%]`
                    : "Drag crosshair across product region to create a new box."}
                </p>
              </div>

              {/* Existing Annotations list */}
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                  Existing Annotations ({annotations.length})
                </span>
                {annotations.length === 0 ? (
                  <p className="text-[11px] text-slate-600">No bounding boxes registered yet.</p>
                ) : (
                  annotations.map((ann) => (
                    <div
                      key={ann.id}
                      className="flex items-center justify-between rounded-lg bg-slate-950 p-1.5 border border-slate-800"
                    >
                      <span className="font-mono text-[10px] text-cyan-300">
                        {ann.label} ({ann.source})
                      </span>
                      <button
                        onClick={() => handleDeleteAnnotation(ann.id)}
                        className="text-rose-400 hover:text-rose-300 p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAnnotatingImage(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD IMAGES MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Upload className="h-4 w-4 text-emerald-400" />
                <span>Upload Dataset Images</span>
              </h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {uploadError && (
              <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target SKU</label>
                <select
                  required
                  value={uploadSkuId}
                  onChange={(e) => setUploadSkuId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select SKU...</option>
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sku_code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Image Role</label>
                  <select
                    value={uploadRole}
                    onChange={(e: any) => setUploadRole(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="reference">Reference (Gallery)</option>
                    <option value="training">Training (Detector)</option>
                    <option value="validation">Validation</option>
                    <option value="test">Test</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Dataset Split</label>
                  <select
                    value={uploadSplit}
                    onChange={(e) => setUploadSplit(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="train">train</option>
                    <option value="val">val</option>
                    <option value="test">test</option>
                    <option value="reference">reference</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Files</label>
                <input
                  type="file"
                  multiple
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setUploadFiles(e.target.files)}
                  className="w-full text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFiles}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload & Validate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
