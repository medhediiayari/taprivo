import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { api, apiUpload, assetUrl } from "../../lib/api";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";
import { extractPalette } from "../../lib/palette";

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
  logo_url: string | null;
  nfc_enabled: boolean;
};

export const ConfigPage = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["merchant-me"],
    queryFn: () => api<MerchantConfig>("/merchants/me"),
  });

  const [form, setForm] = useState<Partial<MerchantConfig>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoObjUrl, setLogoObjUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  // Revoke the temporary object URL when it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (logoObjUrl) URL.revokeObjectURL(logoObjUrl);
    };
  }, [logoObjUrl]);

  const save = useMutation({
    mutationFn: async (payload: Partial<MerchantConfig>) => {
      // 1. Persist the settings + colours.
      await api("/merchants/me", {
        method: "PATCH",
        body: JSON.stringify({
          stamps_required: payload.stamps_required,
          reward_description: payload.reward_description,
          geofence_radius_m: payload.geofence_radius_m,
          brand_color_bg: payload.brand_color_bg,
          brand_color_fg: payload.brand_color_fg,
          brand_accent: payload.brand_accent,
        }),
      });
      // 2. If a new logo was chosen, upload it (colours re-sent so they're
      //    persisted atomically with the image).
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        if (payload.brand_color_bg) fd.append("brand_color_bg", payload.brand_color_bg);
        if (payload.brand_color_fg) fd.append("brand_color_fg", payload.brand_color_fg);
        if (payload.brand_accent) fd.append("brand_accent", payload.brand_accent);
        await apiUpload("/merchants/me/logo", fd);
      }
    },
    onSuccess: () => {
      setLogoFile(null);
      qc.invalidateQueries({ queryKey: ["merchant-me"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  const upd = <K extends keyof MerchantConfig>(k: K, v: MerchantConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onLogoPicked = async (file: File) => {
    setLogoFile(file);
    if (logoObjUrl) URL.revokeObjectURL(logoObjUrl);
    setLogoObjUrl(URL.createObjectURL(file));
    // Derive the card palette from the logo's dominant colours.
    const palette = await extractPalette(file);
    setForm((f) => ({
      ...f,
      brand_color_bg: palette.bg,
      brand_color_fg: palette.fg,
      brand_accent: palette.accent,
    }));
  };

  if (!data) {
    return <div className="px-6 pt-12 h-64 rounded-[var(--radius-xl)] bg-paper-2 shimmer relative overflow-hidden" />;
  }

  const previewLogo = logoObjUrl ?? assetUrl(data.logo_url);

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
          <label className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">
              Logo de la carte
            </span>
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-[var(--radius-md)] overflow-hidden border hairline shrink-0 bg-paper-2 flex items-center justify-center"
              >
                {previewLogo ? (
                  <img src={previewLogo} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted font-mono">vide</span>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLogoPicked(f);
                }}
              />
              <Button variant="ghost" onClick={() => fileInput.current?.click()}>
                {logoFile ? "Changer l’image" : "Choisir une image"}
              </Button>
            </div>
            <span className="text-[11px] text-muted">
              Les couleurs de la carte sont générées automatiquement à partir du logo (PNG, JPG ou WebP — 2 Mo max).
            </span>
          </label>

          <ColorField
            label="Fond de la carte"
            value={form.brand_color_bg ?? "#04342C"}
            onChange={(v) => upd("brand_color_bg", v)}
            presets={["#04342C", "#3A2417", "#0C3A2C", "#161616", "#1B2A4A", "#3B0D1F"]}
          />
          <ColorField
            label="Couleur accent"
            value={form.brand_accent ?? "#D85A30"}
            onChange={(v) => upd("brand_accent", v)}
            presets={["#D85A30", "#1E9E73", "#D98A3D", "#EF9F27", "#B84720", "#0A5343"]}
          />
          <ColorField
            label="Texte"
            value={form.brand_color_fg ?? "#F4EBD9"}
            onChange={(v) => upd("brand_color_fg", v)}
            presets={["#F4EBD9", "#F6ECD9", "#F2EFE9", "#1A1A1A"]}
          />

          <BrandPreview
            name={data.name}
            bg={form.brand_color_bg ?? "#04342C"}
            fg={form.brand_color_fg ?? "#F4EBD9"}
            accent={form.brand_accent ?? "#D85A30"}
            reward={form.reward_description ?? ""}
            stamps={form.stamps_required ?? 10}
            logo={previewLogo}
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
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className="relative h-9 w-9 rounded-full transition-transform hover:scale-110 border hairline"
              style={{ background: p }}
            >
              {value.toUpperCase() === p.toUpperCase() && (
                <span className="absolute -inset-1 rounded-full border border-ink" />
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
  bg,
  fg,
  accent,
  reward,
  stamps,
  logo,
}: {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  reward: string;
  stamps: number;
  logo?: string;
}) {
  return (
    <motion.div
      layout
      className="rounded-[var(--radius-xl)] overflow-hidden border hairline p-5"
      style={{ background: "var(--color-paper-2)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted mb-3">Aperçu</p>
      <motion.div
        animate={{ backgroundColor: bg }}
        className="rounded-[var(--radius-lg)] overflow-hidden"
        style={{ background: bg }}
      >
        {logo && (
          <div className="relative h-28 w-full">
            <img src={logo} alt={name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bg}, transparent)` }} />
          </div>
        )}
        <div className="p-5">
          <p className="font-display text-[17px] tracking-tight font-medium" style={{ color: fg }}>
            {name}
          </p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-mono" style={{ color: fg, opacity: 0.7 }}>
                Tampons
              </p>
              <p
                className="font-display text-2xl font-medium font-tabular leading-none mt-1"
                style={{ color: fg }}
              >
                0/<span style={{ opacity: 0.6 }}>{stamps}</span>
              </p>
            </div>
            <p className="text-[11px] max-w-[50%] text-right" style={{ color: fg, opacity: 0.85 }}>
              {reward}
            </p>
          </div>
          <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: `${fg}22` }}>
            <div className="h-full w-1/3 rounded-full" style={{ background: accent }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
