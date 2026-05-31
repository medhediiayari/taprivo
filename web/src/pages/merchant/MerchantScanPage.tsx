import { useMutation } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import { ApiError, api } from "../../lib/api";
import { pageVariants, spring } from "../../lib/motion";

type StampResult = {
  card: { id: string; stamps_count: number; stamps_required: number; total_stamps_earned: number };
  reward?: { id: string; coupon_code: string; expires_at: string };
  unlocked: boolean;
};

type Outcome =
  | { kind: "success"; result: StampResult }
  | { kind: "error"; message: string };

const READER_ID = "merchant-qr-reader";

const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError) {
    const code = (err.payload as { error?: string } | null)?.error;
    const distance = (err.payload as { distance?: number } | null)?.distance;
    switch (code) {
      case "token_expired_or_used":
        return "QR expiré ou déjà utilisé. Demandez au client d'en regénérer un.";
      case "geofence_failed":
        return `Hors zone du commerce${distance != null ? ` (~${distance} m)` : ""}.`;
      case "merchant_not_found":
        return "Commerce introuvable.";
      case "bad_input":
        return "QR non reconnu.";
      default:
        return "Échec de la validation. Réessayez.";
    }
  }
  return "Échec de la validation. Réessayez.";
};

export const MerchantScanPage = () => {
  const geo = useGeolocation({ auto: true });
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const validate = useMutation({
    mutationFn: (token: string) => {
      const { lat, lng } = geoRef.current;
      if (lat == null || lng == null) throw new ApiError(0, { error: "no_geo" }, "no_geo");
      return api<StampResult>("/qr/validate", {
        method: "POST",
        body: JSON.stringify({ token, scan_lat: lat, scan_lng: lng }),
      });
    },
    onSuccess: (result) => setOutcome({ kind: "success", result }),
    onError: (err) => {
      const noGeo = err instanceof ApiError && (err.payload as { error?: string } | null)?.error === "no_geo";
      setOutcome({
        kind: "error",
        message: noGeo ? "Position GPS requise — autorisez la localisation." : errorMessage(err),
      });
    },
  });

  // Start the camera scanner once, stop it on unmount.
  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          // Decode one token at a time: ignore further frames while validating
          // or while a result is on screen.
          if (busyRef.current) return;
          busyRef.current = true;
          validate.mutate(decoded);
        },
        () => {},
      )
      .catch((e: unknown) => {
        if (!cancelled) {
          setCameraError(
            e instanceof Error && /NotAllowedError|Permission/i.test(e.message)
              ? "Caméra refusée — autorisez l'accès dans le navigateur."
              : "Caméra indisponible. Utilisez HTTPS ou localhost.",
          );
        }
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && s.isScanning) s.stop().catch(() => {});
      scannerRef.current = null;
    };
    // validate.mutate identity is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanNext = () => {
    setOutcome(null);
    busyRef.current = false;
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="pb-8">
      <header className="px-6 pt-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Encaisser</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
          Scanner le QR client
        </h1>
        <p className="text-[13px] text-ink-3 mt-2">
          Demandez au client d'afficher son QR Taprivo, puis cadrez-le.
        </p>
      </header>

      <section className="px-5 mt-8">
        <div className="relative mx-auto max-w-md aspect-square rounded-[var(--radius-2xl)] overflow-hidden bg-ink">
          {/* html5-qrcode injects the <video> into this element */}
          <div id={READER_ID} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-paper/85 text-[13px]">
              {cameraError}
            </div>
          )}

          {/* Framing reticle */}
          {!cameraError && !outcome && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-60 w-60 rounded-2xl border-2 border-paper/70" />
            </div>
          )}

          <AnimatePresence>
            {outcome && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
                style={{ background: "rgba(4,52,44,0.82)" }}
              >
                <ResultBadge outcome={outcome} />
                <Button variant="terracotta" onClick={scanNext}>
                  Scanner un autre
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* GPS status */}
        <div className="mx-auto max-w-md mt-4 flex items-center justify-between text-[12px]">
          <span className="text-muted font-mono uppercase tracking-wider">Position GPS</span>
          <span className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: geo.lat != null ? "var(--color-olive)" : "var(--color-terracotta-2)" }}
            />
            {geo.lat != null ? "Confirmée" : geo.loading ? "En attente…" : "Indisponible"}
          </span>
        </div>
        {geo.error && (
          <p className="mx-auto max-w-md mt-2 text-[12px] text-muted text-center">
            Autorisez la localisation pour valider les scans.{" "}
            <button onClick={geo.request} className="underline">
              Réessayer
            </button>
          </p>
        )}

        {validate.isPending && (
          <p className="mx-auto max-w-md mt-4 text-center text-[13px] text-ink-3">Validation…</p>
        )}
      </section>
    </motion.div>
  );
};

function ResultBadge({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "error") {
    return (
      <div className="text-paper">
        <div className="mx-auto h-16 w-16 rounded-full bg-terracotta-2/90 flex items-center justify-center" style={{ background: "var(--color-terracotta-2)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <p className="mt-4 text-[15px] max-w-[26ch] mx-auto">{outcome.message}</p>
      </div>
    );
  }
  const { result } = outcome;
  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={spring}
      className="text-paper"
    >
      <div
        className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-soleil)", color: "var(--color-ink)" }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      {result.unlocked && result.reward ? (
        <>
          <p className="mt-4 text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">
            Récompense débloquée
          </p>
          <p className="mt-1 font-display text-3xl tracking-tight font-semibold">
            {result.reward.coupon_code}
          </p>
          <p className="mt-1 text-[13px] text-paper/80">Carte remise à zéro.</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">
            Tampon ajouté
          </p>
          <p className="mt-1 font-display text-4xl tracking-tighter font-semibold">
            {result.card.stamps_count}
            <span className="text-paper/45 text-2xl">/{result.card.stamps_required}</span>
          </p>
        </>
      )}
    </motion.div>
  );
}
