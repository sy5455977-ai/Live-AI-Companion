import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

type CubismCore = { setParameterValueById: (id: string, value: number) => void };
const getCoreModel = (m: Live2DModel): CubismCore =>
  (m.internalModel as { coreModel: CubismCore }).coreModel;

Live2DModel.registerTicker(PIXI.Ticker);

const BG_COLOR = 0x0d0a1a;

interface Live2DCanvasProps {
  modelUrl: string;
  expression?: string | null;
  mouthValue?: number;
}

export function Live2DCanvas({ modelUrl, expression, mouthValue = 0 }: Live2DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    let destroyed = false;

    // Snapshot screen size at load — prevent keyboard-open glitch on mobile
    // Only resize when WIDTH changes, not height (keyboard causes height-only change)
    const initialW = window.innerWidth;
    const initialH = window.screen.height; // use screen height, not viewport height
    const W = initialW;
    const H = initialH;

    // Set canvas size explicitly — don't use resizeTo (avoids keyboard-open glitch)
    canvas.width = W * (window.devicePixelRatio || 1);
    canvas.height = H * (window.devicePixelRatio || 1);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    let app: PIXI.Application | null = null;
    try {
      app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundColor: BG_COLOR,
        backgroundAlpha: 1,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        width: W,
        height: H,
        // NO resizeTo — we handle it manually to avoid keyboard glitch
      });
    } catch {
      setError("WebGL is not supported. Please open in Chrome/Firefox/Safari.");
      setLoading(false);
      return;
    }
    appRef.current = app;

    const positionModel = (model: Live2DModel, w: number, h: number) => {
      if (destroyed) return;
      model.anchor.set(0.5, 0);
      model.x = w / 2;
      model.y = 0;
      // Fill height fully — model takes up full screen
      const scaleH = h / model.height;
      const scaleW = w / model.width;
      model.scale.set(Math.min(scaleH, scaleW * 1.1));
    };

    Live2DModel.from(modelUrl, { autoInteract: false })
      .then((model) => {
        if (destroyed) { model.destroy(); return; }
        modelRef.current = model;
        app!.stage.addChild(model as unknown as PIXI.DisplayObject);
        positionModel(model, W, H);

        // Only reposition on width change (ignore height-only keyboard open)
        let lastWidth = W;
        const onResize = () => {
          const newW = window.innerWidth;
          if (Math.abs(newW - lastWidth) > 30) {
            lastWidth = newW;
            const newH = window.screen.height;
            canvas.width = newW * (window.devicePixelRatio || 1);
            canvas.height = newH * (window.devicePixelRatio || 1);
            canvas.style.width = newW + "px";
            canvas.style.height = newH + "px";
            try { app!.renderer.resize(newW, newH); } catch {}
            positionModel(model, newW, newH);
          }
        };
        window.addEventListener("resize", onResize);

        // Try idle motion
        try { model.motion("", 0, 2); } catch {}

        // Blinking every 3-6s
        const blinkInterval = setInterval(() => {
          if (destroyed) { clearInterval(blinkInterval); return; }
          const m = modelRef.current;
          if (!m) return;
          let t = 0;
          const blinkTimer = setInterval(() => {
            t += 0.18;
            const v = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
            try {
              const c = getCoreModel(m);
              c.setParameterValueById("ParamEyeLOpen", Math.max(0, Math.min(1, v)));
              c.setParameterValueById("ParamEyeROpen", Math.max(0, Math.min(1, v)));
            } catch {}
            if (t >= 1) clearInterval(blinkTimer);
          }, 25);
        }, 3000 + Math.random() * 3000);

        // Breathing
        let breathT = 0;
        const breathTimer = setInterval(() => {
          if (destroyed) { clearInterval(breathTimer); return; }
          const m = modelRef.current;
          if (!m) return;
          breathT += 0.012;
          try { getCoreModel(m).setParameterValueById("ParamBreath", (Math.sin(breathT) + 1) / 2); } catch {}
        }, 30);

        // Subtle body sway
        let swayT = 0;
        const swayTimer = setInterval(() => {
          if (destroyed) { clearInterval(swayTimer); return; }
          const m = modelRef.current;
          if (!m) return;
          swayT += 0.008;
          try {
            const c = getCoreModel(m);
            c.setParameterValueById("ParamBodyAngleZ", Math.sin(swayT) * 2.5);
            c.setParameterValueById("ParamBodyAngleY", Math.sin(swayT * 0.7) * 1.5);
          } catch {}
        }, 30);

        // Head tilt
        let headT = 0;
        const headTimer = setInterval(() => {
          if (destroyed) { clearInterval(headTimer); return; }
          const m = modelRef.current;
          if (!m) return;
          headT += 0.006;
          try { getCoreModel(m).setParameterValueById("ParamAngleZ", Math.sin(headT * 1.3) * 4); } catch {}
        }, 30);

        setLoading(false);

        return () => {
          clearInterval(blinkInterval);
          clearInterval(breathTimer);
          clearInterval(swayTimer);
          clearInterval(headTimer);
          window.removeEventListener("resize", onResize);
        };
      })
      .catch((e) => {
        if (!destroyed) {
          setError("Model failed to load: " + String(e?.message ?? e));
          setLoading(false);
        }
      });

    // Pointer/touch tracking
    const handlePointer = (cx: number, cy: number) => {
      const m = modelRef.current;
      if (!m) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((cx - rect.left) / rect.width) * 2 - 1;
      const y = -((cy - rect.top) / rect.height) * 2 + 1;
      try {
        const c = getCoreModel(m);
        c.setParameterValueById("ParamAngleX", x * 28);
        c.setParameterValueById("ParamAngleY", y * 18);
        c.setParameterValueById("ParamEyeBallX", x * 0.7);
        c.setParameterValueById("ParamEyeBallY", y * 0.5);
        c.setParameterValueById("ParamBodyAngleX", x * 6);
      } catch {}
    };
    const onMouse = (e: MouseEvent) => handlePointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) handlePointer(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      destroyed = true;
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      try { app?.destroy(false, { children: true }); } catch {}
      appRef.current = null;
      modelRef.current = null;
    };
  }, [modelUrl]);

  // Expression — set by AI, reset to index 0 on null
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try {
      if (expression) {
        m.expression(expression);
      } else {
        m.expression(0);
      }
    } catch {
      try { m.expression(0); } catch {}
    }
  }, [expression]);

  // Lip sync
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { getCoreModel(m).setParameterValueById("ParamMouthOpenY", mouthValue); } catch {}
  }, [mouthValue]);

  if (error) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column",
        color: "rgba(255,255,255,0.4)", fontSize: "14px", gap: "12px",
        padding: "24px", textAlign: "center", background: `#${BG_COLOR.toString(16).padStart(6, "0")}`,
      }}>
        <div style={{ fontSize: "40px", opacity: 0.3 }}>✦</div>
        <div>Alexia is resting...</div>
        <div style={{ fontSize: "11px", opacity: 0.5 }}>{error}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "10px",
          color: "rgba(255,255,255,0.35)", fontSize: "13px",
          background: `#${BG_COLOR.toString(16).padStart(6, "0")}`,
        }}>
          <div style={{ fontSize: "22px", animation: "spin 2s linear infinite" }}>✦</div>
          <div>Loading Alexia...</div>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "block", position: "absolute", top: 0, left: 0 }} />
    </div>
  );
}
