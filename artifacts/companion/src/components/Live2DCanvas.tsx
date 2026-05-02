import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

Live2DModel.registerTicker(PIXI.Ticker);

interface Live2DCanvasProps {
  modelUrl: string;
  expression?: string | null;
  mouthValue?: number;
}

export function Live2DCanvas({ modelUrl, expression, mouthValue = 0 }: Live2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let destroyed = false;

    let app: PIXI.Application | null = null;
    try {
      app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvas.parentElement ?? canvas,
      });
    } catch (e) {
      setError("WebGL is not supported in this environment. Please use a modern browser.");
      setLoading(false);
      return;
    }
    appRef.current = app;

    Live2DModel.from(modelUrl)
      .then((model) => {
        if (destroyed) {
          model.destroy();
          return;
        }
        modelRef.current = model;
        app!.stage.addChild(model as unknown as PIXI.DisplayObject);

        const resize = () => {
          if (!app || destroyed) return;
          model.anchor.set(0.5, 0.5);
          model.x = app.view.width / 2;
          model.y = app.view.height / 2 + 40;
          const scale = Math.min(app.view.width / model.width, app.view.height / model.height) * 0.88;
          model.scale.set(scale);
        };
        resize();
        app!.renderer.on("resize", resize);
        setLoading(false);
      })
      .catch((e) => {
        if (!destroyed) {
          setError("Failed to load model: " + String(e?.message ?? e));
          setLoading(false);
        }
      });

    const handleMouseMove = (e: MouseEvent) => {
      const m = modelRef.current;
      if (!m) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      try {
        m.internalModel.coreModel.setParameterValueById("ParamAngleX", x * 28);
        m.internalModel.coreModel.setParameterValueById("ParamAngleY", y * 20);
        m.internalModel.coreModel.setParameterValueById("ParamEyeBallX", x * 0.8);
        m.internalModel.coreModel.setParameterValueById("ParamEyeBallY", y * 0.5);
        m.internalModel.coreModel.setParameterValueById("ParamBodyAngleX", x * 8);
      } catch {}
    };
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      destroyed = true;
      window.removeEventListener("mousemove", handleMouseMove);
      try {
        app?.destroy(false, { children: true });
      } catch {}
      appRef.current = null;
      modelRef.current = null;
    };
  }, [modelUrl]);

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try {
      if (expression) {
        m.expression(expression);
      } else {
        m.expression("");
      }
    } catch {}
  }, [expression]);

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try {
      m.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", mouthValue);
    } catch {}
  }, [mouthValue]);

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "rgba(255,255,255,0.4)",
          fontSize: "14px",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", opacity: 0.3 }}>✦</div>
        <div>Alexia is resting...</div>
        <div style={{ fontSize: "12px", opacity: 0.6 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: "14px",
            zIndex: 1,
          }}
        >
          Loading Alexia...
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
