"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Camera,
  Edit2,
  Trash2,
  PowerOff,
  Image as ImageIcon,
  Layers,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import {
  SKU,
  getSKU,
  updateSKU,
  deactivateSKU,
  deleteSKU,
  uploadDatasetImages,
  API_BASE,
} from "@/lib/api";
import { WebcamImageCapture } from "@/components/WebcamImageCapture";

function ProductSkuDetailContent() {
  const params = useParams();
  const router = useRouter();
  const skuId = parseInt(params.skuId as string, 10);

  const [sku, setSku] = useState<SKU | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadRole, setUploadRole] = useState<"reference" | "training">("reference");
  const [uploadSource, setUploadSource] = useState<"upload" | "webcam">("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    if (!skuId || isNaN(skuId)) return;
    setLoading(true);
    try {
      const data = await getSKU(skuId);
      setSku(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [skuId]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) return;
    setSubmittingEdit(true);
    try {
      const updated = await updateSKU(sku.id, {
        name: editName.trim(),
        category: editCategory.trim() || undefined,
        description: editDesc.trim() || undefined,
      });
      setSku(updated);
      setIsEditOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeactivate = async () => {
    if (!sku || !confirm(`Deactivate SKU ${sku.sku_code}?`)) return;
    try {
      const updated = await deactivateSKU(sku.id);
      setSku(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!sku || !confirm(`Permanently delete SKU ${sku.sku_code} and all associated images?`)) return;
    try {
      await deleteSKU(sku.id);
      router.push("/dashboard/product-detection/products");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...selectedFiles, ...newFiles];
      setSelectedFiles(combined);
      setFilePreviews(combined.map((f) => URL.createObjectURL(f)));
      setUploadError(null);
    }
  };

  const handleWebcamCapture = (file: File) => {
    const combined = [...selectedFiles, file];
    setSelectedFiles(combined);
    setFilePreviews(combined.map((f) => URL.createObjectURL(f)));
    setUploadError(null);
  };

  const removeSelectedFile = (idx: number) => {
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    setFilePreviews(updated.map((f) => URL.createObjectURL(f)));
  };

  const resetUploadModal = () => {
    setIsUploadOpen(false);
    setSelectedFiles([]);
    setFilePreviews([]);
    setUploadSource("upload");
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || selectedFiles.length === 0) {
      setUploadError("Please select or capture at least one image.");
      return;
    }
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);
    try {
      const res = await uploadDatasetImages(selectedFiles, sku.id, uploadRole);
      setUploadSuccess(`Successfully saved ${res.length} image(s).`);
      setSelectedFiles([]);
      setFilePreviews([]);
      setUploadSource("upload");
      await loadData();
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-xs text-slate-400">Loading SKU details...</p>
        </div>
      </div>
    );
  }

  if (error || !sku) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/product-detection/products"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Products</span>
        </Link>
        <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-6 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-white">{error || "Product SKU not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <Link
        href="/dashboard/product-detection/products"
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Product Catalog</span>
      </Link>

      {/* Main Details Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 space-y-6">
        {/* Header and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-base font-bold text-cyan-400">
                {sku.sku_code}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                  sku.is_active
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                    : "bg-rose-950 text-rose-400 border border-rose-800/40"
                }`}
              >
                {sku.is_active ? "Active" : "Deactivated"}
              </span>
              {sku.category && (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  {sku.category}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mt-1.5">{sku.name}</h1>
            {sku.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{sku.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setEditName(sku.name);
                setEditCategory(sku.category || "");
                setEditDesc(sku.description || "");
                setIsEditOpen(true);
              }}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
            {sku.is_active && (
              <button
                onClick={handleDeactivate}
                className="flex items-center space-x-1.5 rounded-lg border border-amber-800/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/40"
              >
                <PowerOff className="h-3.5 w-3.5" />
                <span>Deactivate</span>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="flex items-center space-x-1.5 rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Upload Action Bar */}
        <div className="flex items-center justify-between rounded-xl bg-slate-950 p-4 border border-slate-800">
          <div className="text-xs text-slate-400">
            Total Images Registered: <strong className="text-white">{sku.total_image_count}</strong>
          </div>
          <button
            onClick={() => {
              resetUploadModal();
              setIsUploadOpen(true);
            }}
            className="flex items-center space-x-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 shadow-md shadow-cyan-600/30 transition-all"
          >
            <Camera className="h-4 w-4 text-emerald-300" />
            <Upload className="h-4 w-4" />
            <span>Upload & Capture Images</span>
          </button>
        </div>

        {/* SEPARATED REFERENCE AND TRAINING IMAGES */}
        <div className="space-y-8">
          {/* Section A: Reference Images */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="h-4 w-4 text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Reference Images ({sku.reference_images?.length ?? 0})
                </h2>
              </div>
              <span className="text-[11px] text-indigo-400 font-mono">
                Visual Embedding Gallery Set
              </span>
            </div>

            {sku.reference_images?.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 bg-slate-950/40">
                No reference images uploaded. Reference images are indexed into the visual gallery for cosine similarity matching.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sku.reference_images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-2"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
                      <img
                        src={`${API_BASE}/api/v1/datasets/images/${img.id}/file`}
                        alt={img.filename}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="text-[10px] font-mono space-y-0.5">
                      <p className="text-slate-300 truncate font-sans">{img.filename}</p>
                      <div className="flex justify-between text-slate-500">
                        <span>{img.width}x{img.height}</span>
                        <span className="text-indigo-400">Indexed</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Training Images */}
          <div className="space-y-3 border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Training & Validation Images ({sku.training_images?.length ?? 0})
                </h2>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono">
                Object Localization Fine-Tuning Set
              </span>
            </div>

            {sku.training_images?.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 bg-slate-950/40">
                No training images uploaded. Upload varied retail or shelf angles for bounding box annotation.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sku.training_images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-2"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
                      <img
                        src={`${API_BASE}/api/v1/datasets/images/${img.id}/file`}
                        alt={img.filename}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="text-[10px] font-mono space-y-0.5">
                      <p className="text-slate-300 truncate font-sans">{img.filename}</p>
                      <div className="flex justify-between text-slate-500">
                        <span>{img.width}x{img.height}</span>
                        <span className="text-emerald-400 uppercase">{img.split}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Edit2 className="h-4 w-4 text-cyan-400" />
                <span>Edit SKU {sku.sku_code}</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {submittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD & WEBCAM CAPTURE MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Upload className="h-4 w-4 text-cyan-400" />
                <span>Upload & Capture Images for {sku.sku_code}</span>
              </h3>
              <button onClick={resetUploadModal} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {uploadError && (
              <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/50 p-3 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Image Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadRole("reference")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      uploadRole === "reference"
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-300 shadow-sm shadow-indigo-500/20"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">Reference Image</div>
                    <div className="text-[10px] text-slate-500">Visual Gallery Match</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadRole("training")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      uploadRole === "training"
                        ? "border-emerald-500 bg-emerald-950/50 text-emerald-300 shadow-sm shadow-emerald-500/20"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">Training Image</div>
                    <div className="text-[10px] text-slate-500">For Detector BBox</div>
                  </button>
                </div>
              </div>

              {/* Source Mode Tabs */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Image Source</span>
                  <span className="text-[10px] text-slate-500">{selectedFiles.length} image(s) selected</span>
                </label>

                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUploadSource("upload")}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      uploadSource === "upload"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Files</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadSource("webcam")}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      uploadSource === "webcam"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Capture from Camera</span>
                  </button>
                </div>

                {uploadSource === "upload" ? (
                  <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-5 text-center hover:border-cyan-500 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <Upload className="h-6 w-6 text-slate-500 mb-1" />
                    <p className="text-xs font-semibold text-white">Click or drag & drop image files</p>
                    <p className="text-[10px] text-slate-500">JPG, PNG, or WEBP images</p>
                  </div>
                ) : (
                  <WebcamImageCapture
                    skuCodePrefix={sku.sku_code}
                    onCapture={handleWebcamCapture}
                  />
                )}

                {/* Selected Files Preview Thumbnails Grid */}
                {filePreviews.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] font-semibold text-slate-400">Selected Photos:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {filePreviews.map((preview, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square"
                        >
                          <img src={preview} alt="Capture preview" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="absolute top-1 right-1 p-1 rounded bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetUploadModal}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || selectedFiles.length === 0}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-500 disabled:opacity-40 transition-all"
                >
                  {isUploading
                    ? "Saving Images..."
                    : selectedFiles.length > 0
                    ? `Save ${selectedFiles.length} Image(s)`
                    : "Upload Images"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductSkuDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <ProductSkuDetailContent />
    </Suspense>
  );
}
