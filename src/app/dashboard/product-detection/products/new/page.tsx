"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Camera,
  Upload,
  Trash2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { createSKU, uploadDatasetImages } from "@/lib/api";
import { WebcamImageCapture } from "@/components/WebcamImageCapture";

export default function NewProductSkuPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [skuCode, setSkuCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageSource, setImageSource] = useState<"upload" | "webcam">("webcam");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleResetForm = () => {
    setSkuCode("");
    setName("");
    setCategory("");
    setDescription("");
    filePreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    setSelectedFiles([]);
    setFilePreviews([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...selectedFiles, ...newFiles];
      setSelectedFiles(combined);
      setFilePreviews(combined.map((f) => URL.createObjectURL(f)));
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleWebcamCapture = (file: File) => {
    const combined = [...selectedFiles, file];
    setSelectedFiles(combined);
    setFilePreviews(combined.map((f) => URL.createObjectURL(f)));
    setError(null);
    setSuccessMessage(null);
  };

  const removeSelectedFile = (idx: number) => {
    const targetUrl = filePreviews[idx];
    if (targetUrl) {
      try {
        URL.revokeObjectURL(targetUrl);
      } catch {}
    }
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    setFilePreviews(updated.map((f) => URL.createObjectURL(f)));
    if (updated.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent, stayOnPage = false) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      const created = await createSKU({
        sku_code: skuCode.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (selectedFiles.length > 0) {
        await uploadDatasetImages(selectedFiles, created.id, "reference");
      }

      handleResetForm();

      if (stayOnPage) {
        setSuccessMessage(`Successfully registered SKU "${created.sku_code}". All form inputs have been reset for your next product.`);
      } else {
        router.push(`/dashboard/product-detection/products/${created.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <Link
        href="/dashboard/product-detection/products"
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Product Catalog</span>
      </Link>

      {/* Main Form Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Package className="h-5 w-5 text-cyan-400" />
            <span>Register New Product SKU</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create an official SKU record in the local studio catalog before uploading reference and training sets.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-3.5 text-xs text-rose-300 flex items-start space-x-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block">Registration Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/50 p-3.5 text-xs text-emerald-300 flex items-start space-x-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Registration Successful</span>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Unique SKU Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SKU-OREO-133G, SKU-PEPSI-330ML"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Enforced unique identifier. Duplicates are rejected automatically.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Product Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Oreo Vanilla Sandwich Cookies 133g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Category (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Confectionery, Beverages, Dairy"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Visual Specifications / Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Describe packaging colors, aspect ratio, distinguishing logos or label details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Reference Images with Camera / File Upload */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-300 font-semibold">
                  Reference Images (Optional)
                </label>
                <p className="text-[11px] text-slate-400">
                  Take photos with your webcam or upload reference photos to enroll this SKU into the recognition gallery immediately.
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400">
                {selectedFiles.length} photo(s)
              </span>
            </div>

            {/* Source Mode Switcher */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setImageSource("webcam")}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  imageSource === "webcam"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Capture from Camera</span>
              </button>
              <button
                type="button"
                onClick={() => setImageSource("upload")}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  imageSource === "upload"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Files</span>
              </button>
            </div>

            {imageSource === "webcam" ? (
              <WebcamImageCapture
                skuCodePrefix={skuCode || "SKU"}
                onCapture={handleWebcamCapture}
              />
            ) : (
              <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-6 text-center hover:border-cyan-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <Upload className="h-6 w-6 text-slate-500 mb-1" />
                <p className="text-xs font-semibold text-white">Click or drag & drop reference photos</p>
                <p className="text-[10px] text-slate-500">Provide multiple viewpoints or lighting conditions</p>
              </div>
            )}

            {/* Previews Grid */}
            {filePreviews.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-semibold text-slate-400">Captured Photos:</span>
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleResetForm}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>Reset Form</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <Link
                href="/dashboard/product-detection/products"
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting || !skuCode.trim() || !name.trim()}
                className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/50 bg-cyan-950/40 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Save & Add Another</span>
              </button>
              <button
                type="submit"
                disabled={submitting || !skuCode.trim() || !name.trim()}
                className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 font-bold text-white shadow-md shadow-cyan-500/25 hover:opacity-95 disabled:opacity-40 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>{submitting ? "Registering..." : "Create Product SKU"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
