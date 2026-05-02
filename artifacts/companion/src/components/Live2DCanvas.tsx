import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

type CubismCore = { setParameterValueById: (id: string, value: number) => void };
const getCoreModel = (m: Live2DModel): CubismCore =>
  (m.internalModel as { coreModel: CubismCore }).coreModel;

Live2DModel.registerTicker(PIXI.Ticker);

// App background colour — must be solid so Live2D multiply-blend layers render correctly
// (transparent canvas causes multiply blend to output black: color × 0 = 0)
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

    let app: PIXI.Application | null = null;
    try {
      app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        // KEY FIX: solid background so Live2D multiply-blend layers have a real colour to
        // multiply against. Transparent (0,0,0,0) background makes colour × alpha = black.
        backgroundColor: BG_COLOR,
        backgroundAlpha: 1,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        resizeTo: container,
      });
    } catch {
      setError("WebGL is not supported. Please open in Chrome/Firefox/Safari.");
      setLoading(false);
      return;
    }
    appRef.current = app;

    const positionModel = (model: Live2DModel) => {
      if (!app || destroyed) return;
      const res = app.renderer.resolution || 1;
      const W = app.view.width / res;
      const H = app.view.height / res;
      model.anchor.set(0.5, 0.5);
      model.x = W / 2;
      model.y = H * 0.52;
      const scale = Math.min(W / model.width, H / model.height) * 0.92;
      model.scale.set(scale);
    };

    Live2DModel.from(modelUrl, { autoInteract: false })
      .then((model) => {
        if (destroyed) { model.destroy(); return; }
        modelRef.current = model;
        app!.stage.addChild(model as unknown as PIXI.DisplayObject);
        positionModel(model);

        const onResize = () => positionModel(model);
        app!.renderer.on("resize", onResize);

        // Play built-in idle motion
        try { model.motion("", 0, 2); } catch {}

        // Blinking every 3-5 s
        const blinkInterval = setInterval(() => {
          if (destroyed) { clearInterval(blinkInterval); return; }
          const m = modelRef.current;
          if (!m) return;
          let t = 0;
          const blinkTimer = setInterval(() => {
            t += 0.15;
            const v = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
            try {
              const c = getCoreModel(m);
              c.setParameterValueById("ParamEyeLOpen", Math.max(0, Math.min(1, v)));
              c.setParameterValueById("ParamEyeROpen", Math.max(0, Math.min(1, v)));
            } catch {}
            if (t >= 1) clearInterval(blinkTimer);
          }, 30);
        }, 3000 + Math.random() * 2000);

        // Breathing
        let breathT = 0;
        const breathTimer = setInterval(() => {
          if (destroyed) { clearInterval(breathTimer); return; }
          const m = modelRef.current;
          if (!m) return;
          breathT += 0.015;
          try {
            getCoreModel(m).setParameterValueById("ParamBreath", (Math.sin(breathT) + 1) / 2);
          } catch {}
        }, 30);

        setLoading(false);

        return () => {
          clearInterval(blinkInterval);
          clearInterval(breathTimer);
          app?.renderer.off("resize", onResize);
        };
      })
      .catch((e) => {
        if (!destroyed) {
          setError("Model failed to load: " + String(e?.message ?? e));
          setLoading(false);
        }
      });

    // Pointer tracking (mouse + touch)
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

  // Expression
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { expression ? m.expression(expression) : m.expression(""); } catch {}
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
        padding: "24px", textAlign: "center",
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
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
