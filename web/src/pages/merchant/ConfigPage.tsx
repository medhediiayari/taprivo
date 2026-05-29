import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { api } from "../../lib/api";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type MerchantConfig = {
  id: string;
  name: string;
  address: string;
  stamps_required: number;
  reward_description: string;
  geofence_radius_m: number;
  brand_accent: string;
  brand_color_bg: string;
  brand_color_fg: string;
  nfc_enabled: boolean;
};

export const ConfigPage = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["merchant-me"],
    queryFn: () => api<MerchantConfig>("/merchants/me"),
  });

  const [form, setForm] = useState<Partial<MerchantConfig>>({});
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Partial<MerchantConfig>) =>
      api("/merchants/me", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-me"] }),
  });

  const upd = <K extends keyof MerchantConfig>(k: K, v: MerchantConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (!data) {
    return <div className="px-6 pt-12 h-64 rounded-[var(--radius-xl)] bg-paper-2 shimmer relative overflow-hidden" />;
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Configuration</p>
        <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">
          Votre carte.
        </h1>
      </header>

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        className="px-6 mt-10 flex flex-col gap-8"
      >
        <Section title="Tampons" variants={staggerChild}>
          <NumberField
            label="Tampons requis"
            value={form.stamps_required ?? 10}
            onChange={(v) => upd("stamps_required", v)}
            min={3}
            max={20}
          />
          <TextField
            label="Récompense"
            value={form.reward_description ?? ""}
            onChange={(v) => upd("reward_description", v)}
          />
        </Section>

        <Section title="Géofence" variants={staggerChild}>
          <NumberField
            label="Rayon (mètres)"
            value={form.geofence_radius_m ?? 100}
            onChange={(v) => upd("geofence_radius_m", v)}
            min={20}
            max={500}
            step={10}
          />
          <div className="text-[12px] text-muted leading-relaxed">
            Les scans sont validés uniquement si le client se trouve à moins de{" "}
            <span className="text-ink font-medium">{form.geofence_radius_m ?? 100} m</span> de votre adresse.
          </div>
        </Section>

        <Section title="Marque" variants={staggerChild}>
          <ColorField
            label="Couleur accent"
            value={form.brand_accent ?? "#D85A30"}
            onChange={(v) => upd("brand_accent", v)}
          />
          <BrandPreview
            name={data.name}
            accent={form.brand_accent ?? "#D85A30"}
            reward={form.reward_description ?? ""}
            stamps={form.stamps_required ?? 10}
          />
        </Section>

        <motion.div variants={staggerChild} className="pb-4">
          <Button
            size="lg"
            full
            onClick={() => save.mutate(form)}
            disabled={save.isPending}
          >
            {save.isPending ? "Enregistrement…" : save.isSuccess ? "Enregistré" : "Enregistrer"}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

function Section({
  title,
  children,
  variants,
}: {
  title: string;
  children: React.ReactNode;
  variants?: any;
}) {
  return (
    <motion.section variants={variants} className="border-t hairline pt-6">
      <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted mb-5">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </motion.section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-ink"
        />
        <span className="font-mono text-[14px] font-tabular w-12 text-right">{value}</span>
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none text-[14px]"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const presets = ["#D85A30", "#0F6E56", "#04342C", "#EF9F27", "#B84720", "#0A5343"];
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className="relative h-9 w-9 rounded-full transition-transform hover:scale-110"
              style={{ background: p }}
            >
              {value === p && (
                <motion.span
                  layoutId="color-ring"
                  className="absolute -inset-1 rounded-full border border-ink"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ml-auto w-28 h-9 px-3 rounded-[var(--radius-sm)] bg-paper border hairline font-mono text-[12px] uppercase"
        />
      </div>
    </label>
  );
}

function BrandPreview({
  name,
  accent,
  reward,
  stamps,
}: {
  name: string;
  accent: string;
  reward: string;
  stamps: number;
}) {
  return (
    <motion.div
      layout
      className="rounded-[var(--radius-xl)] overflow-hidden border hairline p-5"
      style={{ background: "var(--color-paper-2)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted mb-3">Aperçu</p>
      <div className="rounded-[var(--radius-lg)] bg-paper p-5 border hairline">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ background: accent }}
            className="h-10 w-10 rounded-full flex items-center justify-center text-paper font-display font-medium text-xs"
          >
            {name.slice(0, 2).toUpperCase()}
          </motion.div>
          <p className="font-display text-[15px] tracking-tight font-medium">{name}</p>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted">Tampons</p>
            <p className="font-display text-2xl font-medium font-tabular leading-none mt-1">
              0/<span className="text-muted">{stamps}</span>
            </p>
          </div>
          <p className="text-[11px] text-ink-3 max-w-[50%] text-right">{reward}</p>
        </div>
      </div>
    </motion.div>
  );
}
