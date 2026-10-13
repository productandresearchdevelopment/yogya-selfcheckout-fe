"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface WebcamImageCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  onClose?: () => void;
  skuCodePrefix?: string;
}

export const WebcamImageCapture: React.FC<WebcamImageCaptureProps> = ({
  onCapture,
  onClose,
  skuCodePrefix = "SKU",
}) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop media stream tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Enumerate video devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn("Could not enumerate video devices:", e);
    }
  }, [selectedDeviceId]);

  // Start webcam stream
  const startCamera = useCallback(async (deviceId?: string) => {
    setError(null);
    setIsLoading(true);

    // Stop existing stream if any
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Webcam access is not supported by your browser or environment.");
      setIsLoading(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment",
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.warn("Autoplay was blocked:", err);
          });
        };
      }

      setIsActive(true);
      await enumerateDevices();
    } catch (err: any) {
      let msg = "Failed to access webcam.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Please allow camera access in your browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No camera device found on this system.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Camera is currently in use by another application.";
      } else if (err.message) {
        msg = `Camera error: ${err.message}`;
      }
      setError(msg);
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [stopStream, enumerateDevices]);

  // Capture frame to File
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw current video frame onto canvas
    ctx.drawImage(video, 0, 0, w, h);

    // Flash visual feedback
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 150);

    // Convert canvas to JPEG blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const count = capturedCount + 1;
        setCapturedCount(count);

        const safePrefix = skuCodePrefix.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "SKU";
        const filename = `${safePrefix}_webcam_ref_${Date.now()}_${count}.jpg`;
        const file = new File([blob], filename, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);

        onCapture(file, previewUrl);
      },
      "image/jpeg",
      0.92
    );
  }, [capturedCount, skuCodePrefix, onCapture]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
      {/* Hidden canvas for snapshotting */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Controls */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Camera className="h-4 w-4 text-cyan-400" />
          <span className="font-semibold text-white">Live Camera Capture</span>
          {capturedCount > 0 && (
            <span className="rounded bg-cyan-950 border border-cyan-800 text-cyan-300 px-2 py-0.5 text-[10px] font-mono">
              {capturedCount} Photo{capturedCount > 1 ? "s" : ""} Taken
            </span>
          )}
        </div>

        {devices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Camera Video Viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-slate-800 flex items-center justify-center">
        {/* Flash effect overlay */}
        {flashEffect && <div className="absolute inset-0 bg-white z-20 pointer-events-none animate-pulse" />}

        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain ${isActive ? "block" : "hidden"}`}
        />

        {/* Overlay guides */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/4 h-3/4 border-2 border-dashed border-cyan-500/40 rounded-2xl flex items-center justify-center">
              <span className="text-[10px] text-cyan-400/60 font-mono bg-black/40 px-2 py-0.5 rounded">
                Center Product Inside Frame
              </span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
            <span className="text-xs">Initializing webcam feed...</span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-rose-300">
            <AlertCircle className="h-6 w-6 text-rose-400" />
            <p className="text-xs max-w-sm">{error}</p>
            <button
              type="button"
              onClick={() => startCamera(selectedDeviceId)}
              className="mt-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-white"
            >
              Retry Camera Connection
            </button>
          </div>
        )}

        {/* Stopped state */}
        {!isLoading && !error && !isActive && (
          <div className="flex flex-col items-center justify-center space-y-2 text-slate-500">
            <CameraOff className="h-8 w-8 text-slate-600" />
            <p className="text-xs">Camera stream is stopped.</p>
            <button
              type="button"
              onClick={() => startCamera(selectedDeviceId)}
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Start Camera
            </button>
          </div>
        )}
      </div>

      {/* Camera Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>Capture multiple angles (front, back, angled, different lighting)</span>
        </div>

        <div className="flex items-center space-x-2">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={stopStream}
                className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                <CameraOff className="h-3.5 w-3.5" />
                <span>Pause Camera</span>
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:opacity-95 active:scale-95 transition-all"
              >
                <Camera className="h-4 w-4" />
                <span>Capture Photo</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => startCamera(selectedDeviceId)}
              className="flex items-center space-x-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <Camera className="h-4 w-4" />
              <span>Resume Camera</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
