import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

type Props = {
  payload: string;
  /** When omitted, the code is permanent (no countdown ring). */
  expiresAt?: number;
  onExpire?: () => void;
};

export const QRDisplay = ({ payload, expiresAt, onExpire }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      margin: 0,
      width: 240,
      color: { dark: "#04342C", light: "#F4EBD9" },
    });
  }, [payload]);

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(s);
      if (s === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSeconds = 60;
  const progress = remaining / totalSeconds;
  const c = 2 * Math.PI * 20;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="rounded-[var(--radius-lg)] bg-paper p-5 border hairline"
        >
          <canvas ref={canvasRef} className="block" />
        </motion.div>

        {/* Circular countdown ring — only for time-limited codes */}
        {expiresAt && (
          <>
            <svg
              className="absolute -top-3 -right-3 -rotate-90"
              width="48"
              height="48"
              viewBox="0 0 48 48"
            >
              <circle cx="24" cy="24" r="20" fill="var(--color-paper)" stroke="var(--color-hairline)" strokeWidth="2" />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={c}
                animate={{ strokeDashoffset: c * (1 - progress) }}
                transition={{ duration: 0.25, ease: "linear" }}
              />
            </svg>
            <div className="absolute -top-3 -right-3 h-12 w-12 flex items-center justify-center text-[11px] font-mono font-medium font-tabular">
              {remaining}
            </div>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={!expiresAt ? "static" : remaining < 10 ? "low" : "ok"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-[12px] uppercase tracking-[0.18em] font-mono text-muted"
        >
          {expiresAt && remaining === 0 ? "Expiré — regénérez" : "Présentez ce code au comptoir"}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};
