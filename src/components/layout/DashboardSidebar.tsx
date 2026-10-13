"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Database,
  Crosshair,
  Layers,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from "lucide-react";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  deviceInfo?: string;
  isEngineHealthy?: boolean;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  deviceInfo,
  isEngineHealthy,
}) => {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Overview",
      href: "/dashboard/product-detection",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      title: "Products / SKU",
      href: "/dashboard/product-detection/products",
      icon: Package,
      exact: false,
    },
    {
      title: "Dataset",
      href: "/dashboard/product-detection/dataset",
      icon: Database,
      exact: false,
    },
    {
      title: "Recognition Playground",
      href: "/dashboard/product-detection/recognition",
      icon: Crosshair,
      exact: false,
    },
    {
      title: "Training & Models",
      href: "/dashboard/product-detection/training",
      icon: Layers,
      exact: false,
    },
    {
      title: "Model Evaluation",
      href: "/dashboard/product-detection/evaluation",
      icon: ShieldCheck,
      exact: false,
    },
    {
      title: "Settings",
      href: "/dashboard/product-detection/settings",
      icon: Settings,
      exact: false,
    },
  ];

  const isItemActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-slate-800 bg-[#090d16] flex flex-col justify-between ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Top Branding Section */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80">
          <Link
            href="/dashboard/product-detection"
            className="flex items-center space-x-3 overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-500 shadow-md shadow-cyan-500/20">
              <Crosshair className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm tracking-tight text-white truncate">
                    VisionStudio
                  </span>
                  <span className="rounded bg-cyan-950 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400 border border-cyan-800/60">
                    Phase 1
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Product Detection</p>
              </div>
            )}
          </Link>

          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Section Label */}
        {!collapsed && (
          <div className="px-5 pt-5 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Studio Navigation
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.href, item.exact);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                } ${collapsed ? "justify-center" : "space-x-3"}`}
                title={collapsed ? item.title : undefined}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    active ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Hardware & Health Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        {!collapsed ? (
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between rounded-lg bg-slate-900/90 px-2.5 py-2 border border-slate-800">
              <div className="flex items-center space-x-2 truncate">
                <Cpu className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="font-mono text-slate-300 truncate">
                  {deviceInfo || "CPU"}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-slate-500 uppercase">Device</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-emerald-950/30 px-2.5 py-1.5 border border-emerald-800/40">
              <div className="flex items-center space-x-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">Local-First</span>
              </div>
              <span className="text-[9px] text-emerald-300 font-mono">
                {isEngineHealthy !== false ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2 py-1">
            <div
              className="h-2 w-2 rounded-full bg-emerald-500"
              title="Engine: Online"
            />
          </div>
        )}
      </div>
    </aside>
  );
};
