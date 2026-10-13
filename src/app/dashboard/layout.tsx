"use client";

import React, { useState, useEffect, Suspense } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { getSystemHealth, SystemHealth } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    getSystemHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex selection:bg-cyan-500 selection:text-black">
      {/* Desktop Sidebar */}
      <Suspense fallback={<aside className="fixed top-0 left-0 w-64 h-screen bg-[#090d16]" />}>
        <DashboardSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          deviceInfo={health?.device}
          isEngineHealthy={health?.status === "HEALTHY"}
        />
      </Suspense>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-64 h-full bg-[#090d16]"
            onClick={(e) => e.stopPropagation()}
          >
            <Suspense fallback={<aside className="w-64 h-full bg-[#090d16]" />}>
              <DashboardSidebar
                collapsed={false}
                onToggleCollapse={() => setMobileOpen(false)}
                deviceInfo={health?.device}
                isEngineHealthy={health?.status === "HEALTHY"}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? "md:pl-20" : "md:pl-64"
        }`}
      >
        <Suspense fallback={<header className="h-16 w-full bg-slate-950/80" />}>
          <DashboardHeader
            onToggleMobileSidebar={() => setMobileOpen(true)}
            deviceInfo={health?.device}
            isEngineHealthy={health?.status === "HEALTHY"}
          />
        </Suspense>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<div className="p-8 text-slate-500">Loading...</div>}>
            {children}
          </Suspense>
        </main>

        <footer className="w-full border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 VisionStudio — Product Detection Phase 1</p>
            <p className="font-mono text-[11px] text-slate-600">
              PyTorch • FasterRCNN • MobileNetV3 • NumPy Cosine Similarity • SQLite
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
