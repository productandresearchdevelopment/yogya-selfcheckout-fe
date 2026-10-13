"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DatasetManagementView } from "@/components/DatasetManagementView";
import { Loader2 } from "lucide-react";

function DatasetContent() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || "all";
  const initialSku = searchParams.get("sku") || "all";

  return <DatasetManagementView initialRole={initialRole} initialSku={initialSku} />;
}

export default function DatasetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <DatasetContent />
    </Suspense>
  );
}
