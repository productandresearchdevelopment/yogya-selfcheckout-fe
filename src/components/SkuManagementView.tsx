"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  PowerOff,
  Image as ImageIcon,
  Layers,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  Camera,
  RotateCcw,
} from "lucide-react";
import {
  SKU,
  getSKUs,
  getSKU,
  createSKU,
  updateSKU,
  deactivateSKU,
  deleteSKU,
  uploadDatasetImages,
  API_BASE,
} from "@/lib/api";
import { WebcamImageCapture } from "./WebcamImageCapture";

export const SkuManagementView: React.FC = () => {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Form states
  const [formSkuCode, setFormSkuCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload modal state
  const [uploadRole, setUploadRole] = useState<"reference" | "training">("reference");
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Create SKU Modal Image Attachment States
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const [createImageSource, setCreateImageSource] = useState<"upload" | "webcam">("upload");
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [createPreviews, setCreatePreviews] = useState<string[]>([]);

  // Upload Modal Image Attachment States
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadImageSource, setUploadImageSource] = useState<"upload" | "webcam">("upload");
  const [uploadFilesList, setUploadFilesList] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);

  const resetCreateForm = () => {
    setFormSkuCode("");
    setFormName("");
    setFormCategory("");
    setFormDesc("");
    setFormError(null);
    createPreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    setCreateFiles([]);
    setCreatePreviews([]);
    setCreateImageSource("upload");
    if (createFileInputRef.current) {
      createFileInputRef.current.value = "";
    }
  };

  const resetUploadForm = () => {
    setUploadError(null);
    setUploadSuccess(null);
    setUploadFiles(null);
    uploadPreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    setUploadFilesList([]);
    setUploadPreviews([]);
    setUploadImageSource("upload");
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = "";
    }
  };

  const loadSkus = async () => {
    setLoading(true);
    try {
      const data = await getSKUs(includeInactive, search);
      setSkus(data);
      if (selectedSku) {
        const refreshed = data.find((s) => s.id === selectedSku.id);
        if (refreshed) {
          // fetch full SKU details
          const full = await getSKU(refreshed.id);
          setSelectedSku(full);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkus();
  }, [includeInactive, search]);

  const handleSelectSku = async (sku: SKU) => {
    try {
      const full = await getSKU(sku.id);
      setSelectedSku(full);
    } catch (err) {
      setSelectedSku(sku);
    }
  };

  const handleAddCreateCapture = (file: File, previewUrl: string) => {
    setCreateFiles((prev) => [...prev, file]);
    setCreatePreviews((prev) => [...prev, previewUrl]);
  };

  const handleRemoveCreateFile = (idx: number) => {
    const targetUrl = createPreviews[idx];
    if (targetUrl) {
      try {
        URL.revokeObjectURL(targetUrl);
      } catch {}
    }
    const updated = createFiles.filter((_, i) => i !== idx);
    setCreateFiles(updated);
    setCreatePreviews((prev) => prev.filter((_, i) => i !== idx));
    if (updated.length === 0 && createFileInputRef.current) {
      createFileInputRef.current.value = "";
    }
  };

  const handleCreateFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setCreateFiles((prev) => [...prev, ...newFiles]);
    setCreatePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleAddUploadCapture = (file: File, previewUrl: string) => {
    setUploadFilesList((prev) => [...prev, file]);
    setUploadPreviews((prev) => [...prev, previewUrl]);
  };

  const handleRemoveUploadFile = (idx: number) => {
    const targetUrl = uploadPreviews[idx];
    if (targetUrl) {
      try {
        URL.revokeObjectURL(targetUrl);
      } catch {}
    }
    const updated = uploadFilesList.filter((_, i) => i !== idx);
    setUploadFilesList(updated);
    setUploadPreviews((prev) => prev.filter((_, i) => i !== idx));
    if (updated.length === 0 && uploadFileInputRef.current) {
      uploadFileInputRef.current.value = "";
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createSKU({
        sku_code: formSkuCode.trim().toUpperCase(),
        name: formName.trim(),
        category: formCategory.trim() || undefined,
        description: formDesc.trim() || undefined,
      });

      // Save and index any captured or uploaded reference images into active gallery
      if (createFiles.length > 0) {
        await uploadDatasetImages(createFiles, created.id, "reference");
      }

      resetCreateForm();
      setIsCreateOpen(false);
      await loadSkus();
      const updated = await getSKU(created.id);
      setSelectedSku(updated);
    } catch (err: any) {
      setFormError(err.message || "Failed to create SKU");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await updateSKU(selectedSku.id, {
        name: formName,
        category: formCategory || undefined,
        description: formDesc || undefined,
      });
      setIsEditOpen(false);
      await loadSkus();
      setSelectedSku(updated);
    } catch (err: any) {
      setFormError(err.message || "Failed to update SKU");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (sku: SKU) => {
    if (!confirm(`Are you sure you want to deactivate SKU ${sku.sku_code}?`)) return;
    try {
      await deactivateSKU(sku.id);
      await loadSkus();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (sku: SKU) => {
    if (!confirm(`Permanently delete SKU ${sku.sku_code} and all associated images? This cannot be undone.`)) return;
    try {
      await deleteSKU(sku.id);
      if (selectedSku?.id === sku.id) setSelectedSku(null);
      await loadSkus();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) return;
    const allFiles = [...uploadFilesList];
    if (uploadFiles) {
      allFiles.push(...Array.from(uploadFiles));
    }
    if (allFiles.length === 0) {
      setUploadError("Please select or capture at least 1 image.");
      return;
    }
    setUploadError(null);
    setUploadSuccess(null);
    setSubmitting(true);
    try {
      const res = await uploadDatasetImages(allFiles, selectedSku.id, uploadRole);
      setUploadSuccess(`Uploaded and indexed ${res.length} images successfully.`);
      resetUploadForm();
      await loadSkus();
      const updatedSku = await getSKU(selectedSku.id);
      setSelectedSku(updatedSku);
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess(null);
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload images");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Package className="h-5 w-5 text-cyan-400" />
            <span>SKU Catalog Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Register target products, manage separated reference & training sets, enforce uniqueness.
          </p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          <span>Register SKU</span>
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU code or name..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
          />
          <span>Include Inactive Records</span>
        </label>
      </div>

      {/* Main Grid: SKU list on left, Details on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: SKU List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>{skus.length} Registered Products</span>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            </div>
          ) : skus.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3 bg-slate-900/20">
              <Package className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No SKU records found matching your filters.</p>
              <button
                onClick={() => {
                  resetCreateForm();
                  setIsCreateOpen(true);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                + Register First SKU
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {skus.map((sku) => {
                const isSelected = selectedSku?.id === sku.id;
                return (
                  <div
                    key={sku.id}
                    onClick={() => handleSelectSku(sku)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-cyan-500/50 bg-slate-900 shadow-md shadow-cyan-500/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-cyan-300">
                            {sku.sku_code}
                          </span>
                          {!sku.is_active && (
                            <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-800/40">
                              Inactive
                            </span>
                          )}
                          {sku.category && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                              {sku.category}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xs font-medium text-white mt-1">{sku.name}</h2>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 ${isSelected ? "text-cyan-400" : "text-slate-600"}`}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/70 pt-2.5">
                      <span className="flex items-center space-x-1 text-indigo-300">
                        <ImageIcon className="h-3 w-3" />
                        <span>{sku.reference_image_count} Reference</span>
                      </span>
                      <span className="flex items-center space-x-1 text-emerald-300">
                        <Layers className="h-3 w-3" />
                        <span>{sku.training_image_count} Training</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed View */}
        <div className="lg:col-span-7">
          {selectedSku ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-cyan-400">
                      {selectedSku.sku_code}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        selectedSku.is_active
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : "bg-rose-950 text-rose-400 border border-rose-800/40"
                      }`}
                    >
                      {selectedSku.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">{selectedSku.name}</h2>
                  {selectedSku.description && (
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">{selectedSku.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setFormName(selectedSku.name);
                      setFormCategory(selectedSku.category || "");
                      setFormDesc(selectedSku.description || "");
                      setIsEditOpen(true);
                    }}
                    className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  {selectedSku.is_active && (
                    <button
                      onClick={() => handleDeactivate(selectedSku)}
                      className="flex items-center space-x-1 rounded-lg border border-amber-800/50 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-900/40"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                      <span>Deactivate</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedSku)}
                    className="flex items-center space-x-1 rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Upload Action Bar */}
              <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
                <span className="text-xs text-slate-400">
                  Total Images: <strong className="text-white">{selectedSku.total_image_count}</strong>
                </span>
                <button
                  onClick={() => {
                    resetUploadForm();
                    setIsUploadOpen(true);
                  }}
                  className="flex items-center space-x-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 shadow-sm shadow-cyan-600/30"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Images to SKU</span>
                </button>
              </div>

              {/* Separate Reference and Training Sets as required */}
              <div className="space-y-6">
                {/* SECTION A: Reference Images */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="h-4 w-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Reference Images ({selectedSku.reference_images?.length ?? 0})
                      </h3>
                    </div>
                    <span className="text-[11px] text-indigo-400 font-mono">
                      Visual Embedding Gallery
                    </span>
                  </div>

                  {selectedSku.reference_images?.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                      No reference images uploaded. Reference images are required for cosine similarity matching.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedSku.reference_images.map((img) => (
                        <div
                          key={img.id}
                          className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-2"
                        >
                          <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
                            <img
                              src={`${API_BASE}/api/v1/datasets/images/${img.id}/file`}
                              alt={img.filename}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                (e.target as any).src = "https://placehold.co/200x200/0f172a/94a3b8?text=Image";
                              }}
                            />
                          </div>
                          <div className="text-[10px] space-y-0.5 font-mono">
                            <p className="text-slate-300 truncate font-sans">{img.filename}</p>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>{img.width}x{img.height}</span>
                              <span className="text-indigo-400">Indexed</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION B: Training Images */}
                <div className="space-y-3 border-t border-slate-800 pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Training & Validation Images ({selectedSku.training_images?.length ?? 0})
                      </h3>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      Detector Fine-Tuning Set
                    </span>
                  </div>

                  {selectedSku.training_images?.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                      No training images uploaded. Upload varied environmental angles for detector bounding box annotation.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedSku.training_images.map((img) => (
                        <div
                          key={img.id}
                          className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-2"
                        >
                          <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
                            <img
                              src={`${API_BASE}/api/v1/datasets/images/${img.id}/file`}
                              alt={img.filename}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                (e.target as any).src = "https://placehold.co/200x200/0f172a/94a3b8?text=Image";
                              }}
                            />
                          </div>
                          <div className="text-[10px] space-y-0.5 font-mono">
                            <p className="text-slate-300 truncate font-sans">{img.filename}</p>
                            <div className="flex items-center justify-between text-slate-500">
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
          ) : (
            <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 space-y-3 bg-slate-900/20">
              <Package className="h-10 w-10 text-slate-700" />
              <p className="text-xs">Select a SKU from the catalog to view details, reference gallery, and training sets.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE SKU MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="h-4 w-4 text-cyan-400" />
                <span>Register New SKU</span>
              </h3>
              <button
                onClick={() => {
                  resetCreateForm();
                  setIsCreateOpen(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Unique SKU Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-OREO-133G"
                    value={formSkuCode}
                    onChange={(e) => setFormSkuCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Enforced unique in database.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oreo Vanilla Sandwich 133g"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Biscuits / Snacks"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="Visual details, packaging info..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Reference Images Section (Upload or Direct Webcam Capture) */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold">
                    Reference Images (Direct Camera Capture or Upload)
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {createFiles.length} photo(s) selected
                  </span>
                </div>

                {/* Source Selection Tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateImageSource("upload")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      createImageSource === "upload"
                        ? "border-cyan-500 bg-cyan-950/50 text-cyan-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Images</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateImageSource("webcam")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      createImageSource === "webcam"
                        ? "border-cyan-500 bg-cyan-950/50 text-cyan-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Capture from Camera</span>
                  </button>
                </div>

                {/* Mode 1: File Upload */}
                {createImageSource === "upload" && (
                  <div className="space-y-1">
                    <input
                      ref={createFileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCreateFilesChange}
                      className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Attach multiple product photos from various angles and lighting.
                    </span>
                  </div>
                )}

                {/* Mode 2: Webcam Capture */}
                {createImageSource === "webcam" && (
                  <WebcamImageCapture
                    skuCodePrefix={formSkuCode || "SKU"}
                    onCapture={handleAddCreateCapture}
                  />
                )}

                {/* Thumbnails of attached images */}
                {createPreviews.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Attached Reference Photos ({createPreviews.length}):
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                      {createPreviews.map((preview, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square">
                          <img src={preview} alt="Reference thumbnail" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveCreateFile(idx)}
                            className="absolute top-1 right-1 p-1 rounded bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Reset Form</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetCreateForm();
                      setIsCreateOpen(false);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {submitting ? "Registering & Indexing..." : "Register & Process SKU"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SKU MODAL */}
      {isEditOpen && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Edit2 className="h-4 w-4 text-cyan-400" />
                <span>Edit SKU {selectedSku.sku_code}</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD IMAGES TO SKU MODAL */}
      {isUploadOpen && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Upload className="h-4 w-4 text-cyan-400" />
                <span>Add Reference Images for {selectedSku.sku_code}</span>
              </h3>
              <button
                onClick={() => {
                  resetUploadForm();
                  setIsUploadOpen(false);
                }}
                className="text-slate-400 hover:text-white"
              >
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
                <label className="block text-slate-300 font-medium mb-1">Image Role & Purpose</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadRole("reference")}
                    className={`rounded-lg border p-2 text-center transition-all ${
                      uploadRole === "reference"
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold">Reference Image</div>
                    <div className="text-[10px] text-slate-500">Indexed in Active Gallery</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadRole("training")}
                    className={`rounded-lg border p-2 text-center transition-all ${
                      uploadRole === "training"
                        ? "border-emerald-500 bg-emerald-950/50 text-emerald-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold">Training Image</div>
                    <div className="text-[10px] text-slate-500">For Detector BBox</div>
                  </button>
                </div>
              </div>

              {/* Source Selection Tabs */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <label className="block text-slate-300 font-medium">Image Capture Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadImageSource("upload")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      uploadImageSource === "upload"
                        ? "border-cyan-500 bg-cyan-950/50 text-cyan-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Images</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadImageSource("webcam")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      uploadImageSource === "webcam"
                        ? "border-cyan-500 bg-cyan-950/50 text-cyan-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Capture from Camera</span>
                  </button>
                </div>

                {uploadImageSource === "upload" && (
                  <div className="space-y-1">
                    <input
                      ref={uploadFileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        if (e.target.files) {
                          setUploadFiles(e.target.files);
                          const files = Array.from(e.target.files);
                          const previews = files.map((f) => URL.createObjectURL(f));
                          setUploadFilesList((prev) => [...prev, ...files]);
                          setUploadPreviews((prev) => [...prev, ...previews]);
                        }
                      }}
                      className="w-full text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      SHA-256 duplicate checking and blur/contrast inspection are executed automatically.
                    </span>
                  </div>
                )}

                {uploadImageSource === "webcam" && (
                  <WebcamImageCapture
                    skuCodePrefix={selectedSku.sku_code}
                    onCapture={handleAddUploadCapture}
                  />
                )}

                {uploadPreviews.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Pending Images to Index ({uploadPreviews.length}):
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                      {uploadPreviews.map((preview, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square">
                          <img src={preview} alt="Upload thumbnail" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveUploadFile(idx)}
                            className="absolute top-1 right-1 p-1 rounded bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    resetUploadForm();
                    setIsUploadOpen(false);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadPreviews.length === 0}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {submitting ? "Uploading & Indexing..." : "Process & Save SKU Images"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
