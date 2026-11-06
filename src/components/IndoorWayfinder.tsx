"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as SC from "@/data/han-scale";
import type { Lang, Place } from "@/data/types";
import { Badge, Button, Icon, Input } from "@/ds";
import { floorLabel } from "@/lib/shop";
import { sx } from "@/lib/sx";

interface IndoorWayfinderProps {
  place: Place;
  floor: number;
  targetDoor: string | null;
  targetTitle: string;
  corridor?: string;
  lang: Lang;
  defaultCameraMode?: boolean;
}

interface WayStep {
  id: string;
  turn: "up" | "right" | "left" | "arrive";
  title: string;
  detail: string;
  meters: number;
  expectedHeadingDelta: number; // 0 = straight, +90 = right, -90 = left
  doorSequence: string[];
  sideHint: string;
}

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function IndoorWayfinder({
  place,
  floor,
  targetDoor,
  targetTitle,
  corridor = "Orta",
  lang,
  defaultCameraMode = false,
}: IndoorWayfinderProps) {
  const [mode, setMode] = useState<"hud" | "camera">(defaultCameraMode ? "camera" : "hud");
  const [currentDoorInput, setCurrentDoorInput] = useState<string>("");
  const [anchorDoor, setAnchorDoor] = useState<string | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<"stairs_left" | "stairs_mid" | "stairs_right" | "door">("stairs_mid");
  const [stepIdx, setStepIdx] = useState<number>(0);

  // Pedometer & WakeLock state
  const [stepsWalked, setStepsWalked] = useState<number>(0);
  const [pedometerOn, setPedometerOn] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const lastStepTs = useRef<number>(0);

  // Camera & Orientation state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [baseHeading, setBaseHeading] = useState<number | null>(null);

  const flLbl = floorLabel(floor, lang, place);
  const acc = SC.accessOf(place);
  const targetNum = useMemo(() => {
    const n = parseInt(String(targetDoor || "220").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 220;
  }, [targetDoor]);

  // Nearby doors on the same place & floor from SC.RECORDS or generated sequence
  const floorDoors = useMemo(() => {
    const recs = SC.RECORDS.filter((r) => r.place === place.id && r.floor === floor);
    const nums = Array.from(
      new Set(
        recs
          .map((r) => parseInt(String(r.door).replace(/\D/g, ""), 10))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ).sort((a, b) => a - b);

    if (!nums.includes(targetNum)) {
      nums.push(targetNum);
      nums.sort((a, b) => a - b);
    }
    if (nums.length < 6) {
      const base = Math.max(1, targetNum - 8);
      for (let d = base; d <= targetNum + 4; d += 2) {
        if (!nums.includes(d)) nums.push(d);
      }
      nums.sort((a, b) => a - b);
    }
    return nums;
  }, [place.id, floor, targetNum]);

  // Calculate starting door number based on anchor selection
  const startNum = useMemo(() => {
    if (anchorPoint === "door" && anchorDoor) {
      const parsed = parseInt(anchorDoor.replace(/\D/g, ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    if (anchorPoint === "stairs_left") return floorDoors[0] || Math.max(1, targetNum - 12);
    if (anchorPoint === "stairs_right") return floorDoors[floorDoors.length - 1] || targetNum + 10;
    // stairs_mid
    const mid = floorDoors[Math.floor(floorDoors.length / 2)] || Math.max(1, targetNum - 6);
    return mid === targetNum ? Math.max(1, targetNum - 6) : mid;
  }, [anchorPoint, anchorDoor, floorDoors, targetNum]);

  // Door sequence between startNum and targetNum
  const doorSequence = useMemo(() => {
    const asc = targetNum >= startNum;
    const seq: string[] = [];
    const diff = Math.abs(targetNum - startNum);
    const step = Math.max(1, Math.round(diff / 4));
    if (diff === 0) {
      return [String(targetNum)];
    }
    for (let i = 0; i <= 4; i++) {
      const val = asc ? Math.min(targetNum, startNum + i * step) : Math.max(targetNum, startNum - i * step);
      const s = String(val);
      if (!seq.includes(s)) seq.push(s);
    }
    if (seq[seq.length - 1] !== String(targetNum)) seq.push(String(targetNum));
    return seq;
  }, [startNum, targetNum]);

  // Build dynamic 3-step indoor turn-by-turn instructions
  const waySteps: WayStep[] = useMemo(() => {
    const asc = targetNum >= startNum;
    const diffDoors = Math.max(1, Math.abs(targetNum - startNum));
    const estMeters = Math.max(6, Math.min(65, diffDoors * 2));
    const isEven = targetNum % 2 === 0;
    const sideTr = isEven ? "SAĞ kolunuzda (çift numaralar)" : "SOL kolunuzda (tek numaralar)";
    const firstTurn: "right" | "left" | "up" =
      anchorPoint === "stairs_left"
        ? "right"
        : anchorPoint === "stairs_right"
          ? "left"
          : asc
            ? "right"
            : "left";

    const anchorLabel =
      anchorPoint === "door" && anchorDoor
        ? `Kapı No ${anchorDoor} önünden`
        : anchorPoint === "stairs_left"
          ? "Sol Merdiven / Asansör ağzından"
          : anchorPoint === "stairs_right"
            ? "Sağ Merdiven ağzından"
            : "Orta Merdiven / Ana Koridor ağzından";

    return [
      {
        id: "step_align",
        turn: firstTurn,
        title:
          firstTurn === "right"
            ? pk({ tr: "↪️ SAĞA DÖN · Koridora Girin", en: "↪️ TURN RIGHT · Enter Corridor" }, lang)
            : pk({ tr: "↩️ SOLA DÖN · Koridora Girin", en: "↩️ TURN LEFT · Enter Corridor" }, lang),
        detail: `${anchorLabel} ${flLbl} ${corridor} Koridor hattına ${firstTurn === "right" ? "sağa" : "sola"} dönün. Kapı numaraları ${asc ? "ARTARAK" : "AZALARAK"} (${doorSequence.join(" → ")}) ilerleyecek.`,
        meters: Math.max(4, Math.round(estMeters * 0.35)),
        expectedHeadingDelta: firstTurn === "right" ? 90 : -90,
        doorSequence,
        sideHint: `Hedef kapı ${sideTr} kalacak`,
      },
      {
        id: "step_walk",
        turn: "up",
        title: pk(
          {
            tr: `⬆️ DÜZ İLERLE · Kapı ${doorSequence[0]} → ${targetDoor || targetNum} Yönü`,
            en: `⬆️ WALK STRAIGHT · Door ${doorSequence[0]} → ${targetDoor || targetNum}`,
          },
          lang,
        ),
        detail: `Koridor boyunca düz yürüyün. Tabelalarda ${doorSequence.slice(0, -1).join(" → ")} kapılarını geçin; kapı numaraları ${asc ? "büyüdükçe" : "küçüldükçe"} doğru yöndesiniz.`,
        meters: Math.max(4, Math.round(estMeters * 0.65)),
        expectedHeadingDelta: 0,
        doorSequence,
        sideHint: `Yaklaşık ${Math.max(5, Math.round(estMeters / 0.7))} adım · ${sideTr}`,
      },
      {
        id: "step_arrive",
        turn: "arrive",
        title: pk(
          {
            tr: `🏁 HEDEF KAPIDASINIZ · Kapı No: ${targetDoor || targetNum}`,
            en: `🏁 ARRIVED · Door No: ${targetDoor || targetNum}`,
          },
          lang,
        ),
        detail: `${targetTitle} (${place.name} · ${flLbl} · Kapı No: ${targetDoor || targetNum}) tam önünüzde, ${sideTr}.`,
        meters: 0,
        expectedHeadingDelta: 0,
        doorSequence,
        sideHint: sideTr,
      },
    ];
  }, [targetNum, startNum, anchorPoint, anchorDoor, flLbl, corridor, doorSequence, lang, targetDoor, targetTitle, place.name]);

  const activeStep = waySteps[Math.min(stepIdx, waySteps.length - 1)];
  const totalMeters = waySteps.reduce((accM, s) => accM + s.meters, 0);
  const walkedMeters = Math.min(totalMeters, Math.round(stepsWalked * 0.7));
  const remainingMeters = Math.max(0, activeStep.meters - Math.round(stepsWalked * 0.35));

  // Speak step + haptic feedback
  const announceStep = useCallback(
    (step: WayStep) => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(step.turn === "arrive" ? [180, 90, 220] : 160);
        } catch {
          /* ignore */
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(`${step.title.replace(/[^\w\sÇĞİÖŞÜçğıöşü.,:-]/g, "")}. ${step.detail}`);
          utter.lang = lang === "tr" ? "tr-TR" : "en-US";
          window.speechSynthesis.speak(utter);
        } catch {
          /* ignore */
        }
      }
    },
    [lang],
  );

  // Screen Wake Lock (prevent screen from dimming in dark stone corridors)
  useEffect(() => {
    let lock: { release?: () => Promise<void> } | null = null;
    const reqWakeLock = async () => {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lock = await (navigator as any).wakeLock.request("screen");
          setWakeLockActive(true);
        } catch {
          setWakeLockActive(false);
        }
      }
    };
    reqWakeLock();
    return () => {
      if (lock && typeof lock.release === "function") {
        lock.release().catch(() => {});
      }
    };
  }, []);

  // Pedometer (DeviceMotionEvent step counter)
  useEffect(() => {
    if (!pedometerOn || typeof window === "undefined") return;
    const onMotion = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const now = Date.now();
      if (mag > 13.2 && now - lastStepTs.current > 380) {
        lastStepTs.current = now;
        setStepsWalked((prev) => {
          const next = prev + 1;
          if (next === 8 && stepIdx === 0) {
            setStepIdx(1);
          } else if (next === 22 && stepIdx === 1) {
            setStepIdx(2);
          }
          return next;
        });
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [pedometerOn, stepIdx]);

  // Camera AR Mode & DeviceOrientation
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraAndSensors = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Bu cihazda veya tarayıcıda kamera erişimi desteklenmiyor. Koridor HUD modu aktif.");
      setMode("hud");
      return;
    }
    try {
      // Request iOS DeviceOrientation permission if needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DOE = (window as any).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        try {
          await DOE.requestPermission();
        } catch {
          /* continue even if orientation permission skipped */
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        "Kamera izni verilmedi veya arka kamera açılamadı. Kamerasız Koridor & Kapı Dizisi HUD rehberiyle devam edebilirsiniz.",
      );
      setCameraActive(false);
      setMode("hud");
    }
  }, []);

  useEffect(() => {
    if (mode === "camera") {
      startCameraAndSensors();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCameraAndSensors, stopCamera]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.alpha === "number") {
        setHeading(Math.round(e.alpha));
        setBaseHeading((prev) => (prev === null ? Math.round(e.alpha!) : prev));
      }
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  const handleRecalibrateDoor = (doorStr: string) => {
    const clean = doorStr.trim();
    if (!clean) return;
    setAnchorPoint("door");
    setAnchorDoor(clean);
    setStepsWalked(0);
    const num = parseInt(clean.replace(/\D/g, ""), 10);
    if (num === targetNum) {
      setStepIdx(2);
    } else {
      setStepIdx(1);
    }
  };

  // Relative angle for AR HUD arrow
  const relativeTurnDeg = useMemo(() => {
    if (activeStep.turn === "arrive") return 0;
    const targetDelta = activeStep.expectedHeadingDelta;
    if (heading === null || baseHeading === null) return targetDelta;
    const userTurned = ((baseHeading - heading + 540) % 360) - 180;
    return Math.max(-90, Math.min(90, targetDelta - userTurned));
  }, [activeStep, heading, baseHeading]);

  return (
    <div
      style={sx(
        "border-radius:16px;border:2px solid var(--color-primary);background:var(--surface-card);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.08);width:100%;max-width:100%;min-width:0;box-sizing:border-box",
      )}
    >
      {/* Top Mode Switcher Bar */}
      <div
        style={sx(
          "padding:10px 14px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0",
        )}
      >
        <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0")}>
          <Icon name="compass" size={17} />
          <span style={sx("font-size:13.5px;font-weight:800;letter-spacing:-.01em")}>
            {pk(
              {
                tr: "Han İçi Sağa / Sola Dön & Kapı Rehberi",
                en: "Indoor Turn-by-Turn & Door Wayfinder",
              },
              lang,
            )}
          </span>
          {wakeLockActive && (
            <span
              style={sx(
                "font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.18);color:#fff",
              )}
            >
              ⚡ Ekran Açık
            </span>
          )}
        </div>

        {/* Segmented Mode Switcher: Mod A (HUD) vs Mod B (Kamera AR) */}
        <div
          style={sx(
            "display:inline-flex;padding:3px;border-radius:10px;background:rgba(0,0,0,.22);gap:4px;max-width:100%;flex-wrap:wrap",
          )}
        >
          <button
            type="button"
            onClick={() => setMode("hud")}
            style={sx(
              "height:30px;padding:0 10px;border-radius:7px;border:none;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" +
                (mode === "hud"
                  ? "background:#fff;color:var(--color-primary)"
                  : "background:transparent;color:#fff"),
            )}
          >
            <Icon name="route" size={13} />
            {pk({ tr: "Koridor HUD", en: "Corridor HUD" }, lang)}
          </button>
          <button
            type="button"
            onClick={() => setMode("camera")}
            style={sx(
              "height:30px;padding:0 10px;border-radius:7px;border:none;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" +
                (mode === "camera"
                  ? "background:var(--color-accent);color:#fff"
                  : "background:transparent;color:#fff"),
            )}
          >
            <Icon name="camera" size={13} />
            {pk({ tr: "📷 Kamera AR", en: "📷 Camera AR" }, lang)}
          </button>
        </div>
      </div>

      {cameraError && (
        <div
          style={sx(
            "padding:10px 14px;background:var(--color-warning-soft);color:var(--color-warning-accent);font-size:12.5px;font-weight:700;border-bottom:1px solid var(--border-default)",
          )}
        >
          {cameraError}
        </div>
      )}

      {/* MODE B: Live Rear Camera AR Viewport */}
      {mode === "camera" && (
        <div style={sx("position:relative;width:100%;height:clamp(230px,46dvh,340px);background:#090d16;overflow:hidden")}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={sx("width:100%;height:100%;object-fit:cover;opacity:.88")}
          />

          {/* Floating AR Turn Arrow & HUD Overlay */}
          <div
            style={sx(
              "position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:10px 12px;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,transparent 35%,transparent 60%,rgba(0,0,0,.78) 100%)",
            )}
          >
            {/* Top AR Status Bar */}
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;pointer-events:auto")}>
              <span
                style={sx(
                  "padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font-size:11.5px;font-weight:800;backdrop-filter:blur(6px)",
                )}
              >
                🎯 {place.name} · {flLbl} · Kapı {targetDoor || targetNum}
              </span>
              <button
                type="button"
                onClick={() => setBaseHeading(heading ?? 0)}
                style={sx(
                  "padding:4px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.65);color:#fff;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer",
                )}
              >
                🧭 Yönü Sıfırla
              </button>
            </div>

            {/* Center 3D-Style Floating Turn Arrow */}
            <div style={sx("display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px")}>
              <div
                style={sx(
                  `width:74px;height:74px;border-radius:999px;background:${
                    activeStep.turn === "arrive"
                      ? "rgba(22,163,74,.9)"
                      : "rgba(217,119,6,.9)"
                  };border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);transform:perspective(300px) rotateX(18deg) rotateZ(${relativeTurnDeg}deg);transition:transform .25s ease`,
                )}
              >
                <Icon
                  name={
                    activeStep.turn === "arrive"
                      ? "check"
                      : activeStep.turn === "right"
                        ? "turn-right"
                        : activeStep.turn === "left"
                          ? "turn-left"
                          : "turn-up"
                  }
                  size={36}
                />
              </div>
              <div
                style={sx(
                  "padding:5px 12px;border-radius:10px;background:rgba(0,0,0,.75);color:#fff;font-size:13.5px;font-weight:800;text-align:center;backdrop-filter:blur(6px);max-width:96%",
                )}
              >
                {activeStep.title}
              </div>
            </div>

            {/* Bottom AR Door Sequence Strip */}
            <div
              style={sx(
                "padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.75);color:#fff;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;pointer-events:auto",
              )}
            >
              <div style={sx("font-size:11.5px;font-weight:700")}>
                Kapı: {doorSequence.map((d) => (d === String(targetDoor || targetNum) ? `[🎯 ${d}]` : d)).join(" ➔ ")}
              </div>
              <div style={sx("font-size:11px;font-weight:800;color:#fbbf24")}>
                {activeStep.sideHint}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE A & SHARED: High-Contrast Corridor HUD + Door Sequence + Instant Door Recalibration */}
      <div style={sx("padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0;max-width:100%")}>
        {/* 1. Anchor & Instant "What Door Is In Front Of Me?" Calibration Bar */}
        <div
          style={sx(
            "padding:12px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-strong);display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%",
          )}
        >
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0")}>
            <span style={sx("font-size:12px;font-weight:800;color:var(--text-heading);display:inline-flex;align-items:center;gap:6px;min-width:0")}>
              <Icon name="locate" size={15} />
              {pk(
                {
                  tr: "Şu An Neredesiniz? (Merdiven veya Önünüzdeki Kapı No):",
                  en: "Where Are You Now? (Pick Stairs or Current Door No):",
                },
                lang,
              )}
            </span>
            <Badge color="primary" variant="light">
              {acc.lift ? "Asansör + Merdiven" : "Merdiven"} · {flLbl}
            </Badge>
          </div>

          <div style={sx("display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0")}>
            {(
              [
                ["stairs_left", pk({ tr: "🪜 Sol Merdiven", en: "🪜 Left Stairs" }, lang)],
                ["stairs_mid", pk({ tr: "🛗 Orta Merdiven", en: "🛗 Center Stairs" }, lang)],
                ["stairs_right", pk({ tr: "🪜 Sağ Merdiven", en: "🪜 Right Stairs" }, lang)],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAnchorPoint(id);
                  setAnchorDoor(null);
                  setStepIdx(0);
                  setStepsWalked(0);
                }}
                style={sx(
                  "height:34px;padding:0 10px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;border:1px solid " +
                    (anchorPoint === id
                      ? "var(--color-primary);background:var(--color-primary);color:#fff"
                      : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {lbl}
              </button>
            ))}

            {/* Instant Door Number Recalibration Input */}
            <div style={sx("display:flex;align-items:center;gap:6px;flex:1 1 200px;min-width:0;max-width:100%")}>
              <div style={sx("flex:1;min-width:0")}>
                <Input
                  size="sm"
                  inputMode="numeric"
                  value={currentDoorInput}
                  onChange={(e) => setCurrentDoorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRecalibrateDoor(currentDoorInput);
                  }}
                  placeholder={pk({ tr: "Önümdeki Kapı No (Örn: 214)", en: "Current Door No (e.g. 214)" }, lang)}
                />
              </div>
              <Button
                size="sm"
                color="accent"
                variant="solid"
                onClick={() => handleRecalibrateDoor(currentDoorInput)}
              >
                {pk({ tr: "Konumla", en: "Set" }, lang)}
              </Button>
            </div>
          </div>

          {/* Quick Nearby Door Chips */}
          <div style={sx("display:flex;align-items:center;gap:6px;overflow-x:auto;padding-bottom:2px;min-width:0;max-width:100%")} data-han-nav="1">
            <span style={sx("font-size:11px;font-weight:700;color:var(--text-muted);white-space:nowrap;flex:none")}>
              {pk({ tr: "Yakındaki Kapılar:", en: "Nearby Doors:" }, lang)}
            </span>
            {floorDoors.slice(0, 10).map((d) => {
              const s = String(d);
              const isSelected = anchorPoint === "door" && anchorDoor === s;
              const isTarget = d === targetNum;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setCurrentDoorInput(s);
                    handleRecalibrateDoor(s);
                  }}
                  style={sx(
                    "flex:none;height:26px;padding:0 9px;border-radius:999px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid " +
                      (isTarget
                        ? "var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent)"
                        : isSelected
                          ? "var(--color-primary);background:var(--color-primary);color:#fff"
                          : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                  )}
                >
                  {isTarget ? `🎯 Kapı ${s}` : `Kapı ${s}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Large High-Contrast Active Turn Card */}
        <div
          style={sx(
            "padding:14px;border-radius:14px;border:2px solid " +
              (activeStep.turn === "arrive" ? "var(--color-success)" : "var(--color-primary)") +
              ";background:" +
              (activeStep.turn === "arrive" ? "var(--color-success-soft)" : "var(--color-primary-soft)") +
              ";display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;min-width:0;max-width:100%",
          )}
        >
          <div style={sx("display:flex;align-items:flex-start;gap:12px;flex:1 1 220px;min-width:0")}>
            <div
              style={sx(
                "width:48px;height:48px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;background:" +
                  (activeStep.turn === "arrive" ? "var(--color-success)" : "var(--color-primary)") +
                  ";color:#fff",
              )}
            >
              <Icon
                name={
                  activeStep.turn === "arrive"
                    ? "check"
                    : activeStep.turn === "right"
                      ? "turn-right"
                      : activeStep.turn === "left"
                        ? "turn-left"
                        : "turn-up"
                }
                size={26}
              />
            </div>
            <div style={sx("flex:1;min-width:0")}>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                <span style={sx("font-size:11px;font-weight:800;text-transform:uppercase;color:var(--color-primary)")}>
                  ADIM {stepIdx + 1} / {waySteps.length}
                </span>
                <span style={sx("font-size:11px;font-weight:700;color:var(--text-muted)")}>
                  · {activeStep.sideHint}
                </span>
              </div>
              <div style={sx("font-size:17px;font-weight:800;color:var(--text-heading);margin-top:2px;line-height:1.25")}>
                {activeStep.title}
              </div>
              <div style={sx("font-size:13px;color:var(--text-body);margin-top:4px;line-height:1.45")}>
                {activeStep.detail}
              </div>
            </div>
          </div>

          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;width:100%;padding-top:8px;border-top:1px solid rgba(0,0,0,.07)")}>
            {activeStep.meters > 0 ? (
              <div style={sx("display:flex;align-items:baseline;gap:6px")}>
                <span style={sx("font-size:18px;font-weight:800;color:var(--color-primary);font-variant-numeric:tabular-nums")}>
                  ~{remainingMeters} m
                </span>
                <span style={sx("font-size:11.5px;font-weight:700;color:var(--text-muted)")}>
                  (~{Math.max(1, Math.round(remainingMeters / 0.7))} adım)
                </span>
              </div>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              color="primary"
              variant="solid"
              iconStart="volume"
              onClick={() => announceStep(activeStep)}
            >
              {pk({ tr: "Sesli Oku", en: "Speak" }, lang)}
            </Button>
          </div>
        </div>

        {/* 3. Visual Door Number Sequence Progression Bar */}
        <div
          style={sx(
            "padding:12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface-card);display:flex;flex-direction:column;gap:8px;min-width:0;max-width:100%",
          )}
        >
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0")}>
            <span style={sx("font-size:11px;font-weight:800;text-transform:uppercase;color:var(--text-muted)")}>
              {pk(
                {
                  tr: "Koridor Kapı Dizisi (Tabelaları Takip Edin)",
                  en: "Corridor Door Sequence (Follow Signs)",
                },
                lang,
              )}
            </span>
            <span style={sx("font-size:11.5px;font-weight:700;color:var(--color-primary)")}>
              {targetNum >= startNum ? "📈 Numaralar Artar" : "📉 Numaralar Azalır"}
            </span>
          </div>

          <div style={sx("display:flex;align-items:center;gap:6px;overflow-x:auto;padding:4px 0;min-width:0;max-width:100%")} data-han-nav="1">
            {doorSequence.map((d, i) => {
              const isLast = i === doorSequence.length - 1;
              const isStart = i === 0;
              return (
                <div key={d + "_" + i} style={sx("display:inline-flex;align-items:center;gap:6px;flex:none")}>
                  <div
                    style={sx(
                      "padding:5px 10px;border-radius:8px;font-size:12px;font-weight:800;white-space:nowrap;border:1px solid " +
                        (isLast
                          ? "var(--color-accent);background:var(--color-accent);color:#fff"
                          : isStart
                            ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary)"
                            : "var(--border-strong);background:var(--surface-muted);color:var(--text-heading)"),
                    )}
                  >
                    {isLast ? `🎯 Kapı ${d}` : `Kapı ${d}`}
                  </div>
                  {!isLast && <span style={sx("font-weight:800;color:var(--text-muted)")}>➔</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Step Navigation & Pedometer Controls */}
        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
            <Button
              size="sm"
              color="secondary"
              variant="outline"
              disabled={stepIdx === 0}
              onClick={() => {
                const prev = Math.max(0, stepIdx - 1);
                setStepIdx(prev);
                announceStep(waySteps[prev]);
              }}
            >
              {pk({ tr: "◀ Önceki Adım", en: "◀ Prev Step" }, lang)}
            </Button>
            <Button
              size="sm"
              color="primary"
              variant="solid"
              disabled={stepIdx >= waySteps.length - 1}
              onClick={() => {
                const next = Math.min(waySteps.length - 1, stepIdx + 1);
                setStepIdx(next);
                announceStep(waySteps[next]);
              }}
            >
              {pk({ tr: "Sonraki Adım ▶", en: "Next Step ▶" }, lang)}
            </Button>
          </div>

          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <button
              type="button"
              onClick={() => setPedometerOn((v) => !v)}
              style={sx(
                "height:34px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;border:1px solid " +
                  (pedometerOn
                    ? "var(--color-success);background:var(--color-success-soft);color:var(--color-success)"
                    : "var(--border-strong);background:var(--surface-muted);color:var(--text-body)"),
              )}
            >
              👣 {pedometerOn ? `Adımsayar Açık (${stepsWalked} adım · ~${walkedMeters}m)` : "Adımsayarı Başlat"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
