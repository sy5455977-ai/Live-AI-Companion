import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

type CubismCore = { setParameterValueById: (id: string, value: number) => void };
const getCoreModel = (m: Live2DModel): CubismCore =>
  (m.internalModel as { coreModel: CubismCore }).coreModel;

Live2DModel.registerTicker(PIXI.Ticker);

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
    let destroyed = false;

    let app: PIXI.Application | null = null;
    try {
      app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        // transparent:true uses non-premultiplied alpha — fixes black texture/multiply blend issue
        transparent: true,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        resizeTo: containerRef.current,
      });
    } catch (e) {
      setError("WebGL is not supported. Please open this in a modern browser.");
      setLoading(false);
      return;
    }
    appRef.current = app;

    const positionModel = (model: Live2DModel) => {
      if (!app || destroyed) return;
      const W = app.view.width / (app.renderer.resolution || 1);
      const H = app.view.height / (app.renderer.resolution || 1);
      model.anchor.set(0.5, 0.5);
      model.x = W / 2;
      // Show more of the upper body — shift up slightly
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

        // Resize handler
        const onResize = () => positionModel(model);
        app!.renderer.on("resize", onResize);

        // Play idle motion
        try {
          model.motion("", 0, 2 /* IDLE priority */);
        } catch {}

        // Idle blinking loop
        const blinkInterval = setInterval(() => {
          if (destroyed) { clearInterval(blinkInterval); return; }
          const m = modelRef.current;
          if (!m) return;
          let t = 0;
          const blinkTimer = setInterval(() => {
            t += 0.15;
            const v = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
            try {
              getCoreModel(m).setParameterValueById("ParamEyeLOpen", Math.max(0, Math.min(1, v)));
              getCoreModel(m).setParameterValueById("ParamEyeROpen", Math.max(0, Math.min(1, v)));
            } catch {}
            if (t >= 1) clearInterval(blinkTimer);
          }, 30);
        }, 3000 + Math.random() * 2000);

        // Idle breathing loop
        let breathT = 0;
        const breathTimer = setInterval(() => {
          if (destroyed) { clearInterval(breathTimer); return; }
          const m = modelRef.current;
          if (!m) return;
          breathT += 0.015;
          const breathVal = (Math.sin(breathT) + 1) / 2;
          try {
            getCoreModel(m).setParameterValueById("ParamBreath", breathVal);
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
          setError("Failed to load model: " + String(e?.message ?? e));
          setLoading(false);
        }
      });

    // Mouse / touch tracking
    const handlePointerMove = (clientX: number, clientY: number) => {
      const m = modelRef.current;
      if (!m) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      try {
        const core = getCoreModel(m);
        core.setParameterValueById("ParamAngleX", x * 28);
        core.setParameterValueById("ParamAngleY", y * 18);
        core.setParameterValueById("ParamEyeBallX", x * 0.7);
        core.setParameterValueById("ParamEyeBallY", y * 0.5);
        core.setParameterValueById("ParamBodyAngleX", x * 6);
      } catch {}
    };
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      destroyed = true;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      try { app?.destroy(false, { children: true }); } catch {}
      appRef.current = null;
      modelRef.current = null;
    };
  }, [modelUrl]);

  // Expression changes
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try {
      if (expression) { m.expression(expression); }
      else { m.expression(""); }
    } catch {}
  }, [expression]);

  // Lip sync
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try {
      getCoreModel(m).setParameterValueById("ParamMouthOpenY", mouthValue);
    } catch {}
  }, [mouthValue]);

  if (error) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column",
        color: "rgba(255,255,255,0.4)", fontSize: "14px", gap: "12px",
        padding: "24px", textAlign: "center",
      }}>
        <div style={{ fontSize: "48px", opacity: 0.3 }}>✦</div>
        <div>Alexia is resting...</div>
        <div style={{ fontSize: "12px", opacity: 0.5 }}>{error}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.4)", fontSize: "14px", zIndex: 1,
          flexDirection: "column", gap: "8px",
        }}>
          <div style={{ fontSize: "24px", animation: "spin 1.5s linear infinite" }}>✦</div>
          <div>Loading Alexia...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
