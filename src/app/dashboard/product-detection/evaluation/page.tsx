"use client";

import React, { Suspense } from "react";
import { ModelEvaluationView } from "@/components/ModelEvaluationView";
import { Loader2 } from "lucide-react";

export default function EvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <ModelEvaluationView />
    </Suspense>
  );
}
