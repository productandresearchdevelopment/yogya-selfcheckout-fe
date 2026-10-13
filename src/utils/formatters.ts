// Utility functions for formatting and string manipulations

export function formatScore(score: number | null | undefined, precision = 3): string {
  if (score === null || score === undefined) return "N/A";
  return score.toFixed(precision);
}

export function formatPercentage(val: number | null | undefined, precision = 1): string {
  if (val === null || val === undefined) return "N/A";
  return `${(val * 100).toFixed(precision)}%`;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
