"use client";

import React from "react";
import {
  LayoutDashboard,
  Package,
  Database,
  Crosshair,
  Settings,
  Cpu,
} from "lucide-react";

export type NavTab = "dashboard" | "skus" | "datasets" | "playground" | "settings";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  systemHealth: {
    status: string;
    device: string;
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, systemHealth }) => {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "skus", label: "SKU Catalog", icon: Package },
    { id: "datasets", label: "Dataset & Quality", icon: Database },
    { id: "playground", label: "Recognition Playground", icon: Crosshair },
    { id: "settings", label: "System Diagnostics", icon: Settings },
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-500 shadow-md shadow-cyan-500/20">
            <Crosshair className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold tracking-tight text-white">
                VisionStudio
              </span>
              <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-800/60">
                Phase 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Local-First Product Recognition</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as NavTab)}
                className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System Badges */}
        <div className="flex items-center space-x-2.5">
          <div className="hidden sm:flex items-center space-x-2 rounded-lg bg-slate-900 px-2.5 py-1 text-xs border border-slate-800">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-mono text-slate-300">
              {systemHealth?.device || "Detecting..."}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-lg bg-emerald-950/40 px-2.5 py-1 text-xs border border-emerald-800/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-emerald-300">
              {systemHealth?.status === "HEALTHY" ? "Local Engine Ready" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-800 bg-slate-900/60 px-2 py-1.5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as NavTab)}
              className={`flex items-center whitespace-nowrap space-x-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                isActive ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "text-slate-400"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
