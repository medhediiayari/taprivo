import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Button } from "../components/Button";
import { Photo } from "../components/Photo";
import { QRDisplay } from "../components/QRDisplay";
import { StampGrid } from "../components/StampGrid";
import { useGeolocation } from "../hooks/useGeolocation";
import { ApiError, api, assetUrl } from "../lib/api";
import { fmtRelative } from "../lib/format";
import { pageVariants, spring } from "../lib/motion";

type CardDetail = {
  id: string;
  stamps_count: number;
  stamps_required: number;
  total_stamps_earned: number;
  merchant_id: string;
  merchant_name: string;
  address: string;
  reward_description: string;
  brand_accent: string;
  geofence_radius_m: number;
  logo_url: string | null;
};

type StampEvent = { id: string; method: "nfc" | "qr"; geo_verified: boolean; scanned_at: string };

export const CardDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [scanMode, setScanMode] = useState<"none" | "nfc" | "qr">("none");
  const [qrToken, setQrToken] = useState<{ token: string; expiresAt: number } | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const geo = useGeolocation();

  const { data } = useQuery({
    queryKey: ["card", id],
    queryFn: () => api<{ card: CardDetail; recent_stamps: StampEvent[] }>(`/cards/${id}`),
    enabled: !!id,
  });

  const generateQr = useMutation({
    mutationFn: () =>
      api<{ token: string; expiresAt: number }>("/qr/generate", {
        method: "POST",
        body: JSON.stringify({ merchant_id: data!.card.merchant_id }),
      }),
    onSuccess: (out) => {
      setQrToken(out);
      setScanMode("qr");
    },
  });

  const simulateNfc = useMutation({
    mutationFn: () =>
      api<{
        unlocked: boolean;
        card: { stamps_count: number };
      }>("/nfc/simulate", {
        method: "POST",
        body: JSON.stringify({ merchant_id: data!.card.merchant_id }),
      }),
    onSuccess: (out) => {
      if (out.unlocked) setJustUnlocked(true);
      qc.invalidateQueries({ queryKey: ["card", id] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
    },
  });

  if (!data) {
    return (
      <div className="px-4 pt-4">
        <div className="aspect-[16/10] rounded-[var(--radius-2xl)] bg-paper-2 shimmer relative overflow-hidden" />
      </div>
    );
  }

  const c = data.card;
  const remaining = Math.max(0, c.stamps_required - c.stamps_count);

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="pb-8">
      {/* === HERO PHOTO BAND with floating back button === */}
      <motion.section
        layoutId={`card-${c.id}`}
        className="relative"
        style={{ boxShadow: "var(--shadow-hero)" }}
      >
        <motion.div layoutId={`card-photo-${c.id}`}>
          <Photo
            src={assetUrl(c.logo_url)}
            alt={c.merchant_name}
            aspect="aspect-[4/3] md:aspect-[16/9]"
            overlay="strong"
            rounded=""
            fallbackColor={c.brand_accent}
            className="w-full"
          />
        </motion.div>

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 px-5 pt-6 flex items-center justify-between">
          <button
            onClick={() => nav(-1)}
            className="h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-sm"
            style={{ background: "rgba(244,235,217,0.85)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <Link
            to="/"
            className="text-[10px] uppercase tracking-[0.22em] font-mono text-paper/85 px-3 py-2 rounded-full backdrop-blur-sm"
            style={{ background: "rgba(4,52,44,0.45)" }}
          >
            Cartes
          </Link>
        </div>

        {/* Merchant name overlay */}
        <motion.div layoutId={`card-name-${c.id}`} className="absolute bottom-7 left-5 right-5 text-paper">
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">
            {c.address.split(",").slice(0, 2).join(" · ")}
          </p>
          <h2 className="font-display text-[40px] md:text-6xl tracking-tighter font-semibold leading-[0.95] mt-2">
            {c.merchant_name}
          </h2>
        </motion.div>
      </motion.section>

      {/* === Brand color band with HUGE stamp count === */}
      <section
        className="relative text-paper px-6 py-7 flex items-end justify-between gap-6"
        style={{ background: c.brand_accent }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-paper/65">
            {remaining === 0 ? "Carte complète" : "Vos tampons"}
          </p>
          <p className="mt-2 font-display text-[88px] md:text-[120px] font-semibold tracking-tighter leading-[0.8]">
            <AnimatedNumber value={c.stamps_count} />
            <span className="text-paper/45 text-5xl">/{c.stamps_required}</span>
          </p>
        </div>
        <div className="flex-1 max-w-[50%] pb-2">
          <StampGrid filled={c.stamps_count} total={c.stamps_required} accent="var(--color-soleil)" size="md" onDark />
        </div>
      </section>

      {/* === Reward strip === */}
      <section className="px-6 py-5 bg-paper-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-soleil)", color: "var(--color-ink)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="8" width="18" height="13" rx="1.5" />
              <path d="M3 12h18" />
              <path d="M12 8v13" />
              <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">
              Récompense
            </p>
            <p className="text-[14px] font-medium truncate">{c.reward_description}</p>
          </div>
        </div>
        <span className="text-[11px] text-muted font-mono uppercase tracking-wider whitespace-nowrap">
          {remaining === 0 ? "à débloquer" : `dans ${remaining}`}
        </span>
      </section>

      {/* === Add to Google Wallet === */}
      <section className="px-5 mt-4">
        <WalletButton cardId={c.id} />
      </section>

      {/* === Scan area === */}
      <section className="px-5 mt-6">
        <AnimatePresence mode="wait">
          {scanMode === "none" && (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={spring}
              className="grid grid-cols-2 gap-3"
            >
              <ScanCardButton
                title="NFC"
                hint="Approchez du badge"
                onClick={() => setScanMode("nfc")}
              />
              <ScanCardButton
                title="QR"
                hint="Montrez au comptoir"
                onClick={() => generateQr.mutate()}
                loading={generateQr.isPending}
                variant="terracotta"
              />
            </motion.div>
          )}

          {scanMode === "nfc" && (
            <motion.div
              key="nfc"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={spring}
              className="bg-ink text-paper rounded-[var(--radius-2xl)] p-8 flex flex-col items-center gap-6"
            >
              <PulsingRings />
              <div className="text-center">
                <p className="font-display text-2xl tracking-tight font-semibold">NFC actif</p>
                <p className="text-[13px] text-paper/70 mt-1.5 max-w-[28ch]">
                  Approchez votre téléphone du badge Taprivo
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="secondary" full onClick={() => setScanMode("none")}>
                  Annuler
                </Button>
                <Button
                  variant="terracotta"
                  full
                  onClick={() => simulateNfc.mutate()}
                  disabled={simulateNfc.isPending}
                >
                  {simulateNfc.isPending ? "…" : "Simuler"}
                </Button>
              </div>
            </motion.div>
          )}

          {scanMode === "qr" && qrToken && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={spring}
              className="bg-paper-2 rounded-[var(--radius-2xl)] p-8 flex flex-col items-center gap-6"
            >
              <QRDisplay
                payload={qrToken.token}
                expiresAt={qrToken.expiresAt}
                onExpire={() => setQrToken(null)}
              />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">
                  Position GPS
                </p>
                <p className="text-[13px] mt-1">
                  {geo.lat
                    ? "Confirmée"
                    : geo.error
                      ? "Indisponible"
                      : "En attente — appuyez pour activer"}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="secondary" full onClick={() => setScanMode("none")}>
                  Fermer
                </Button>
                <Button full onClick={() => generateQr.mutate()} disabled={generateQr.isPending}>
                  Regénérer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* === Recent stamps (compact, no eyebrow) === */}
      {data.recent_stamps.length > 0 && (
        <section className="px-6 mt-10">
          <h3 className="font-display text-xl tracking-tight font-semibold mb-4">
            Historique
          </h3>
          <ul className="divide-y hairline">
            {data.recent_stamps.map((e) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="py-3 flex items-center justify-between text-[13px]"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ background: "var(--color-paper-2)", color: "var(--color-ink-3)" }}
                  >
                    {e.method}
                  </span>
                  <span className="text-ink-3">{fmtRelative(e.scanned_at)}</span>
                </span>
                <span className="text-muted text-[12px]">
                  {e.geo_verified ? "GPS validé" : "Hors zone"}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {justUnlocked && (
          <RewardUnlockedOverlay
            merchant={c.merchant_name}
            description={c.reward_description}
            accent={c.brand_accent}
            onClose={() => setJustUnlocked(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function WalletButton({ cardId }: { cardId: string }) {
  const save = useMutation({
    mutationFn: () => api<{ saveUrl: string }>(`/wallet/google/${cardId}`, { method: "POST" }),
    onSuccess: (out) => window.open(out.saveUrl, "_blank", "noopener"),
  });
  const notConfigured = save.error instanceof ApiError && save.error.status === 503;
  return (
    <div>
      <Button variant="secondary" full onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "…" : "Ajouter à Google Wallet"}
      </Button>
      {save.isError && (
        <p className="text-[12px] text-muted mt-2 text-center">
          {notConfigured
            ? "Google Wallet n’est pas encore configuré sur ce serveur."
            : "Impossible de générer la carte Wallet pour le moment."}
        </p>
      )}
    </div>
  );
}

function ScanCardButton({
  title,
  hint,
  onClick,
  loading,
  variant = "default",
}: {
  title: string;
  hint: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "terracotta";
}) {
  const isTerracotta = variant === "terracotta";
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      disabled={loading}
      className={`rounded-[var(--radius-2xl)] p-6 text-left transition-colors disabled:opacity-60 ${isTerracotta ? "text-paper" : "bg-paper border hairline hover:bg-paper-2"}`}
      style={isTerracotta ? { background: "var(--color-terracotta-2)" } : undefined}
    >
      <p className="font-display text-3xl tracking-tighter font-semibold">{title}</p>
      <p className={`text-[12px] mt-2 leading-tight ${isTerracotta ? "text-paper/80" : "text-ink-3"}`}>
        {hint}
      </p>
    </motion.button>
  );
}

function PulsingRings() {
  return (
    <div className="relative h-32 w-32 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border border-paper/30"
          animate={{
            scale: [0.6, 1.4],
            opacity: [0.6, 0],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="relative h-16 w-16 rounded-full bg-paper text-ink flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 18 0" />
          <path d="M6 12a6 6 0 0 1 12 0" />
          <path d="M9 12a3 3 0 0 1 6 0" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function RewardUnlockedOverlay({
  merchant,
  description,
  accent,
  onClose,
}: {
  merchant: string;
  description: string;
  accent: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(4,52,44,0.65)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-2xl)] p-8 bg-paper text-center"
      >
        <div className="relative mx-auto h-32 w-32 flex items-center justify-center">
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(239,159,39,0.6) 0%, rgba(239,159,39,0) 65%)",
              }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.7, 1.3], opacity: [0.85, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.2 + i * 0.55, ease: "easeOut" }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
            className="relative h-20 w-20 rounded-full flex items-center justify-center text-paper"
            style={{ background: accent }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="8" width="18" height="13" rx="1.5" />
              <path d="M3 12h18" />
              <path d="M12 8v13" />
              <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
            </svg>
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 text-[10px] uppercase tracking-[0.22em] font-mono text-muted"
        >
          Récompense débloquée
        </motion.p>
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="font-display text-3xl tracking-tighter font-semibold mt-2"
        >
          {merchant}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="mt-2 text-ink-3 text-[14px]"
        >
          {description}, à votre prochaine visite.
        </motion.p>
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" full onClick={onClose}>
            Plus tard
          </Button>
          <Link to="/rewards" className="flex-1">
            <Button variant="terracotta" full>Voir le coupon</Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
