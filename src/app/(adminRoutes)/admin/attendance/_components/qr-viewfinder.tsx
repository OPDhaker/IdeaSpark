"use client";

import { CameraOff, RotateCcw } from "lucide-react";
import type QrScanner from "qr-scanner";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type CameraState = "starting" | "live" | "denied" | "unavailable" | "insecure";

/** The same pass held in frame decodes many times a second. */
const REPEAT_WINDOW_MS = 3000;

/**
 * Back-camera QR viewfinder. The camera keeps running while `paused`; decodes
 * are dropped instead, so closing the sheet goes straight back to scanning
 * without waiting on the camera to restart.
 */
export function QrViewfinder({
  paused,
  onScan,
}: {
  paused: boolean;
  onScan: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const lastRef = useRef({ code: "", at: 0 });
  const [state, setState] = useState<CameraState>("starting");
  const [attempt, setAttempt] = useState(0);

  pausedRef.current = paused;
  onScanRef.current = onScan;

  useEffect(() => {
    // Resuming after the sheet closes should accept the same pass again.
    if (!paused) lastRef.current = { code: "", at: 0 };
  }, [paused]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // getUserMedia only exists on secure origins (https, or localhost).
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setState("insecure");
      return;
    }

    let cancelled = false;
    setState("starting");

    (async () => {
      const { default: Scanner } = await import("qr-scanner");
      if (cancelled) return;

      const scanner = new Scanner(
        video,
        (result) => {
          if (pausedRef.current) return;
          const code = result.data.trim();
          if (!code) return;
          const now = Date.now();
          const last = lastRef.current;
          if (code === last.code && now - last.at < REPEAT_WINDOW_MS) return;
          lastRef.current = { code, at: now };
          navigator.vibrate?.(40);
          onScanRef.current(code);
        },
        {
          preferredCamera: "environment",
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
        },
      );
      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (!cancelled) setState("live");
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof DOMException ? cause.name : "";
        setState(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "unavailable",
        );
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground">
      <video
        ref={videoRef}
        muted
        playsInline
        className="size-full object-cover"
      />

      {state === "live" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[14%] rounded-xl"
        >
          {/* Corner brackets, not a full box: the pass is the subject. */}
          <span className="absolute top-0 left-0 size-10 rounded-tl-xl border-background border-t-4 border-l-4" />
          <span className="absolute top-0 right-0 size-10 rounded-tr-xl border-background border-t-4 border-r-4" />
          <span className="absolute bottom-0 left-0 size-10 rounded-bl-xl border-background border-b-4 border-l-4" />
          <span className="absolute right-0 bottom-0 size-10 rounded-br-xl border-background border-r-4 border-b-4" />
        </div>
      ) : null}

      {paused && state === "live" ? (
        <div className="absolute inset-0 bg-foreground/60" aria-hidden />
      ) : null}

      {state !== "live" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-background">
          {state === "starting" ? (
            <>
              <Spinner className="size-6" />
              <p className="text-sm">Starting camera…</p>
            </>
          ) : (
            <>
              <CameraOff aria-hidden className="size-8" />
              <p className="max-w-[16rem] text-sm">
                {state === "denied"
                  ? "Camera access was blocked. Allow it in your browser's site settings, then retry."
                  : state === "insecure"
                    ? "The camera only works over https. Open this page on the live site."
                    : "No camera found. Enter the code below instead."}
              </p>
              {state === "denied" || state === "unavailable" ? (
                <Button size="sm" variant="secondary" onClick={retry}>
                  <RotateCcw aria-hidden />
                  Retry
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
