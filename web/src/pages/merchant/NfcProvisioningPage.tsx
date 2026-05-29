import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { api } from "../../lib/api";
import { fmtRelative } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Device = {
  id: string;
  uid: string;
  device_type: "sticker" | "totem" | "card" | "bracelet";
  label: string | null;
  status: "active" | "revoked";
  provisioned_at: string;
  last_used_at: string | null;
};

const TYPE_LABEL: Record<Device["device_type"], string> = {
  sticker: "Sticker",
  totem: "Totem",
  card: "Carte",
  bracelet: "Bracelet",
};

export const NfcProvisioningPage = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["nfc-devices"],
    queryFn: () => api<{ devices: Device[] }>("/merchants/me/nfc"),
  });
  const [open, setOpen] = useState(false);

  const provision = useMutation({
    mutationFn: (payload: { device_type: Device["device_type"]; label?: string }) =>
      api<Device>("/merchants/me/nfc/provision", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nfc-devices"] });
      setOpen(false);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/merchants/me/nfc/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nfc-devices"] }),
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Gadgets</p>
          <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">
            NFC.
          </h1>
        </div>
        <Button onClick={() => setOpen(true)}>+ Provisionner</Button>
      </header>

      <section className="px-6 mt-10">
        <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="flex flex-col gap-3">
          {data?.devices.map((d) => (
            <motion.li key={d.id} variants={staggerChild} layout>
              <article
                className={`p-5 rounded-[var(--radius-lg)] border hairline flex items-center gap-4 ${d.status === "revoked" ? "opacity-50" : "bg-paper"}`}
              >
                <div className="h-12 w-12 rounded-full bg-paper-2 border hairline flex items-center justify-center text-ink-3">
                  <DeviceGlyph type={d.device_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[15px] tracking-tight font-medium leading-none">
                    {d.label ?? TYPE_LABEL[d.device_type]}
                  </p>
                  <p className="text-[11px] text-muted font-mono uppercase tracking-wider mt-1.5">
                    {TYPE_LABEL[d.device_type]} · {d.uid}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted">
                    {d.last_used_at ? fmtRelative(d.last_used_at) : "jamais utilisé"}
                  </p>
                  {d.status === "active" ? (
                    <button
                      onClick={() => revoke.mutate(d.id)}
                      className="text-[12px] text-terracotta underline-offset-4 hover:underline mt-1"
                    >
                      Révoquer
                    </button>
                  ) : (
                    <span className="text-[12px] text-muted mt-1 block">Révoqué</span>
                  )}
                </div>
              </article>
            </motion.li>
          ))}
        </motion.ul>

        {data?.devices.length === 0 && (
          <div className="py-12 text-center border hairline rounded-[var(--radius-xl)]">
            <p className="font-display text-xl tracking-tight">Aucun gadget pour l'instant.</p>
            <p className="text-ink-3 text-[13px] mt-1.5">
              Provisionnez un sticker, totem, carte ou bracelet pour démarrer.
            </p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {open && (
          <ProvisionSheet
            onClose={() => setOpen(false)}
            onSubmit={(payload) => provision.mutate(payload)}
            submitting={provision.isPending}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function ProvisionSheet({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (p: { device_type: Device["device_type"]; label?: string }) => void;
  submitting: boolean;
}) {
  const [type, setType] = useState<Device["device_type"]>("totem");
  const [label, setLabel] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4"
      style={{ background: "rgba(10,10,10,0.55)" }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-paper rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] p-7"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Nouveau gadget</p>
        <h2 className="font-display text-2xl tracking-tighter font-medium mt-2 leading-none">
          Type d'appareil
        </h2>

        <div className="grid grid-cols-2 gap-2 mt-6">
          {(["totem", "sticker", "card", "bracelet"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`relative h-20 rounded-[var(--radius-md)] border hairline flex flex-col items-center justify-center gap-1 transition-colors ${type === t ? "bg-ink text-paper border-transparent" : "bg-paper hover:bg-paper-2"}`}
            >
              <DeviceGlyph type={t} />
              <span className="text-[12px]">{TYPE_LABEL[t]}</span>
              {type === t && (
                <motion.span
                  layoutId="type-pill"
                  className="absolute inset-0 rounded-[var(--radius-md)] border-2 border-ink pointer-events-none"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-2 mt-6">
          <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">Libellé</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. Caisse principale"
            className="h-11 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none text-[14px]"
          />
        </label>

        <div className="flex gap-3 mt-7">
          <Button variant="secondary" full onClick={onClose}>
            Annuler
          </Button>
          <Button
            full
            disabled={submitting}
            onClick={() => onSubmit({ device_type: type, label: label || undefined })}
          >
            {submitting ? "…" : "Provisionner"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeviceGlyph({ type }: { type: Device["device_type"] }) {
  if (type === "sticker") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (type === "totem") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <circle cx="12" cy="10" r="2" />
        <path d="M8 18h8" />
      </svg>
    );
  }
  if (type === "card") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 11h18" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
