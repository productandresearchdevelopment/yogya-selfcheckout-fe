"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  ChevronRight,
  PowerOff,
  Trash2,
  Image as ImageIcon,
  Layers,
} from "lucide-react";
import { SKU, getSKUs, deactivateSKU, deleteSKU } from "@/lib/api";

export default function ProductsListPage() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const loadSkus = async () => {
    setLoading(true);
    try {
      const data = await getSKUs(includeInactive, search);
      setSkus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkus();
  }, [includeInactive, search]);

  const handleDeactivate = async (e: React.MouseEvent, sku: SKU) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Deactivate SKU ${sku.sku_code}?`)) return;
    try {
      await deactivateSKU(sku.id);
      await loadSkus();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (e: React.MouseEvent, sku: SKU) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Permanently delete SKU ${sku.sku_code} and all associated images?`)) return;
    try {
      await deleteSKU(sku.id);
      await loadSkus();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Package className="h-5 w-5 text-cyan-400" />
            <span>Product Catalog / SKU Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Register target products, manage separated reference & training sets, enforce uniqueness.
          </p>
        </div>

        <Link
          href="/dashboard/product-detection/products/new"
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          <span>Register New SKU</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU code or product name..."
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

      {/* SKU Catalog Table / Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{skus.length} Registered Products</span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          </div>
        ) : skus.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-3 bg-slate-900/20">
            <Package className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No SKU records found matching your filters.</p>
            <Link
              href="/dashboard/product-detection/products/new"
              className="inline-block text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              + Register First Product SKU
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skus.map((sku) => (
              <Link
                key={sku.id}
                href={`/dashboard/product-detection/products/${sku.id}`}
                className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-cyan-500/50 hover:bg-slate-900/90 hover:shadow-md hover:shadow-cyan-500/10"
              >
                <div>
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
                      <h2 className="text-xs font-medium text-white mt-1 group-hover:text-cyan-200 transition-colors">
                        {sku.name}
                      </h2>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </div>

                  {sku.description && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                      {sku.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-3 text-slate-400">
                    <span className="flex items-center space-x-1 text-indigo-300">
                      <ImageIcon className="h-3 w-3" />
                      <span>{sku.reference_image_count} Ref</span>
                    </span>
                    <span className="flex items-center space-x-1 text-emerald-300">
                      <Layers className="h-3 w-3" />
                      <span>{sku.training_image_count} Train</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {sku.is_active && (
                      <button
                        onClick={(e) => handleDeactivate(e, sku)}
                        title="Deactivate SKU"
                        className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800"
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, sku)}
                      title="Delete SKU"
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
