"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronRight,
  Crosshair,
  Cpu,
} from "lucide-react";

interface DashboardHeaderProps {
  onToggleMobileSidebar: () => void;
  deviceInfo?: string;
  isEngineHealthy?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onToggleMobileSidebar,
  deviceInfo,
  isEngineHealthy,
}) => {
  const pathname = usePathname();

  // Generate readable breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => {
    let label = seg;
    if (seg === "dashboard") label = "Dashboard";
    else if (seg === "product-detection") label = "Product Detection";
    else if (seg === "products") label = "Products / SKU";
    else if (seg === "new") label = "Register SKU";
    else if (seg === "dataset") label = "Dataset";
    else if (seg === "recognition") label = "Playground";
    else if (seg === "training") label = "Training & Models";
    else if (seg === "settings") label = "Settings";

    const href = "/" + segments.slice(0, i + 1).join("/");
    return { label, href, isLast: i === segments.length - 1 };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileSidebar}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb Path */}
        <nav className="flex items-center space-x-1.5 text-xs">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
              {crumb.isLast ? (
                <span className="font-semibold text-white">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right Actions: Hardware Pill & Quick Test */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-2 rounded-lg bg-slate-900 px-2.5 py-1 text-xs border border-slate-800">
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-[11px] font-mono text-slate-300">{deviceInfo || "CPU"}</span>
        </div>

        <div className="flex items-center space-x-1.5 rounded-lg bg-emerald-950/40 px-2.5 py-1 text-xs border border-emerald-800/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-medium text-emerald-300">
            {isEngineHealthy !== false ? "Engine Ready" : "Disconnected"}
          </span>
        </div>

        <Link
          href="/dashboard/product-detection/recognition"
          className="hidden md:flex items-center space-x-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 shadow-sm shadow-cyan-600/30 transition-all"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Playground</span>
        </Link>
      </div>
    </header>
  );
};
