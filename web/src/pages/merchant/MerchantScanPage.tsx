import { useMutation } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ApiError, api } from "../../lib/api";
import { pageVariants, spring } from "../../lib/motion";

type ValidateResponse = {
  reward_available: boolean;
  unlocked?: boolean;
  customer_name?: string | null;
  card?: { stamps_count: number; stamps_required: number };
  reward?: { id: string; coupon_code: string; reward_description: string };
};

type Outcome =
  | { kind: "stamp"; count: number; total: number }
  | { kind: "reward"; rewardId: string; description: string; code: string; customer?: string | null }
  | { kind: "redeemed"; description: string }
  | { kind: "error"; message: string };

const READER_ID = "merchant-qr-reader";

const errorMessage = (err: unknown, fallback = "Échec. Réessayez."): string => {
  if (err instanceof ApiError) {
    switch ((err.payload as { error?: string } | null)?.error) {
      case "token_expired_or_used":
        return "QR invalide. Demandez au client de rouvrir sa carte.";
      case "not_your_merchant":
        return "Cette carte appartient à un autre commerce.";
      case "already_redeemed":
        return "Ce cadeau a déjà été utilisé.";
      case "expired":
        return "Ce cadeau a expiré.";
      case "bad_input":
        return "QR non reconnu.";
    }
  }
  return fallback;
};

export const MerchantScanPage = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [manual, setManual] = useState("");

  const validate = useMutation({
    mutationFn: (token: string) =>
      api<ValidateResponse>("/qr/validate", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (data) => {
      if (data.reward_available && data.reward) {
        setOutcome({
          kind: "reward",
          rewardId: data.reward.id,
          description: data.reward.reward_description,
          code: data.reward.coupon_code,
          customer: data.customer_name,
        });
      } else if (data.unlocked && data.reward) {
        setOutcome({
          kind: "reward",
          rewardId: data.reward.id,
          description: data.reward.reward_description,
          code: data.reward.coupon_code,
        });
      } else if (data.card) {
        setOutcome({ kind: "stamp", count: data.card.stamps_count, total: data.card.stamps_required });
      }
    },
    onError: (err) => setOutcome({ kind: "error", message: errorMessage(err) }),
  });

  const redeem = useMutation({
    mutationFn: (rewardId: string) =>
      api<{ reward_description: string }>("/rewards/redeem", {
        method: "POST",
        body: JSON.stringify({ reward_id: rewardId }),
      }),
    onSuccess: (out) => setOutcome({ kind: "redeemed", description: out.reward_description }),
    onError: (err) => setOutcome({ kind: "error", message: errorMessage(err, "Échec de la validation du cadeau.") }),
  });

  // Start the camera scanner once, stop it on unmount.
  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;
    const config = { fps: 10, qrbox: { width: 240, height: 240 } };
    const onScan = (decoded: string) => {
      if (busyRef.current) return; // one code at a time
      busyRef.current = true;
      validate.mutate(decoded);
    };

    const insecure =
      !window.isSecureContext &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname);

    const fail = (e: unknown) => {
      if (cancelled) return;
      const s = e instanceof Error ? `${e.name} ${e.message}` : String(e);
      if (insecure) {
        setCameraError("Caméra disponible uniquement en HTTPS ou sur localhost.");
      } else if (/NotAllowedError|Permission|denied/i.test(s)) {
        setCameraError("Caméra refusée — autorisez l'accès dans le navigateur.");
      } else if (/NotFoundError|NotReadable|Overconstrained|device not found|no camera/i.test(s)) {
        setCameraError("Aucune caméra détectée. Branchez une webcam ou utilisez un téléphone.");
      } else {
        setCameraError("Impossible de démarrer la caméra.");
      }
    };

    (async () => {
      if (insecure) return fail(new Error("insecure"));
      // Prefer the rear camera, but fall back to any available one — desktops
      // only have a front-facing webcam, so a hard "environment" constraint fails.
      let target: MediaTrackConstraints | string = { facingMode: "environment" };
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cams && cams.length > 0) {
          const rear = cams.find((c) => /back|rear|environment|arrière/i.test(c.label));
          target = (rear ?? cams[cams.length - 1]).id;
        }
      } catch {
        // enumeration failed (often a permission prompt) — let start() report it
      }
      if (cancelled) return;
      try {
        await scanner.start(target, config, onScan, () => {});
      } catch (e) {
        fail(e);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && s.isScanning) s.stop().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanNext = () => {
    setOutcome(null);
    busyRef.current = false;
  };

  // Manual / hardware-scanner entry (USB QR guns type the code + Enter). Lets
  // a counter without a webcam still validate by pasting the card code.
  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    busyRef.current = true;
    setManual("");
    validate.mutate(v);
  };

  const busy = validate.isPending || redeem.isPending;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="pb-8">
      <header className="px-6 pt-12 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Encaisser</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
            Scanner le client
          </h1>
          <p className="text-[13px] text-ink-3 mt-2">
            Tampon ou cadeau : un seul QR. Cadrez la carte du client.
          </p>
        </div>
        <a
          href="/merchant/history"
          className="text-[11px] uppercase tracking-[0.18em] font-mono text-ink-3 px-3 py-2 rounded-full bg-paper-2 whitespace-nowrap"
        >
          Historique
        </a>
      </header>

      <section className="px-5 mt-8">
        <div className="relative mx-auto max-w-md aspect-square rounded-[var(--radius-2xl)] overflow-hidden bg-ink">
          <div id={READER_ID} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-paper/85 text-[13px]">
              {cameraError}
            </div>
          )}

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
                style={{ background: "rgba(4,52,44,0.86)" }}
              >
                <ResultBadge outcome={outcome} />
                <div className="flex gap-3">
                  {outcome.kind === "reward" ? (
                    <>
                      <Button variant="secondary" onClick={scanNext}>
                        Plus tard
                      </Button>
                      <Button
                        variant="terracotta"
                        onClick={() => redeem.mutate(outcome.rewardId)}
                        disabled={redeem.isPending}
                      >
                        {redeem.isPending ? "…" : "Valider le cadeau"}
                      </Button>
                    </>
                  ) : (
                    <Button variant="terracotta" onClick={scanNext}>
                      Scanner un autre
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {busy && !outcome && (
          <p className="mx-auto max-w-md mt-4 text-center text-[13px] text-ink-3">Validation…</p>
        )}

        <form onSubmit={submitManual} className="mx-auto max-w-md mt-5 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoFocus={!!cameraError}
            placeholder="Coller / saisir le code de la carte"
            className="flex-1 rounded-full border hairline bg-paper px-4 h-11 text-[14px] outline-none focus:border-ink"
          />
          <Button type="submit" variant="terracotta" disabled={!manual.trim()}>
            Valider
          </Button>
        </form>
        <p className="mx-auto max-w-md mt-2 text-center text-[12px] text-muted">
          Pas de caméra ? Utilisez une douchette QR USB, ou collez le code (l'identifiant de la carte du client).
        </p>
      </section>
    </motion.div>
  );
};

function ResultBadge({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "error") {
    return (
      <div className="text-paper">
        <Circle bg="var(--color-terracotta-2)">
          <path d="M18 6 6 18M6 6l12 12" />
        </Circle>
        <p className="mt-4 text-[15px] max-w-[26ch] mx-auto">{outcome.message}</p>
      </div>
    );
  }

  if (outcome.kind === "reward") {
    return (
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={spring} className="text-paper">
        <Circle bg="var(--color-soleil)" color="var(--color-ink)">
          <rect x="3" y="8" width="18" height="13" rx="1.5" />
          <path d="M3 12h18M12 8v13" />
          <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
        </Circle>
        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">
          Ce client a un cadeau
        </p>
        <p className="mt-1 font-display text-2xl tracking-tight font-semibold max-w-[24ch] mx-auto leading-tight">
          {outcome.description}
        </p>
        <p className="mt-2 text-[13px] font-mono tracking-[0.2em] text-paper/70">{outcome.code}</p>
        {outcome.customer && <p className="mt-1 text-[12px] text-paper/60">{outcome.customer}</p>}
      </motion.div>
    );
  }

  if (outcome.kind === "redeemed") {
    return (
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={spring} className="text-paper">
        <Circle bg="var(--color-soleil)" color="var(--color-ink)">
          <path d="M20 6 9 17l-5-5" />
        </Circle>
        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">Cadeau remis</p>
        <p className="mt-1 font-display text-2xl tracking-tight font-semibold max-w-[24ch] mx-auto leading-tight">
          {outcome.description}
        </p>
        <p className="mt-2 text-[13px] text-paper/80">Carte remise à zéro.</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={spring} className="text-paper">
      <Circle bg="var(--color-soleil)" color="var(--color-ink)">
        <path d="M20 6 9 17l-5-5" />
      </Circle>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">Tampon ajouté</p>
      <p className="mt-1 font-display text-4xl tracking-tighter font-semibold">
        {outcome.count}
        <span className="text-paper/45 text-2xl">/{outcome.total}</span>
      </p>
    </motion.div>
  );
}

function Circle({ bg, color, children }: { bg: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ background: bg, color }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}
