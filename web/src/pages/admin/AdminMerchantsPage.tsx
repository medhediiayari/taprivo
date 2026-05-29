import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { api } from "../../lib/api";
import { fmtDate, initials } from "../../lib/format";
import { pageVariants, spring, staggerChild, staggerParent } from "../../lib/motion";

type Merchant = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  lat: number;
  lng: number;
  stamps_required: number;
  reward_description: string;
  geofence_radius_m: number;
  brand_accent: string;
  nfc_enabled: boolean;
  status: "active" | "suspended";
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  cards_count: number;
  stamps_count: number;
  active_devices: number;
};

const PRESET_ACCENTS = ["#D85A30", "#0F6E56", "#04342C", "#EF9F27", "#B84720", "#0A5343"];

export const AdminMerchantsPage = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: () => api<{ merchants: Merchant[] }>("/admin/merchants"),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Merchant> }) =>
      api(`/admin/merchants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/admin/merchants/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  const create = useMutation({
    mutationFn: (payload: any) =>
      api<{ id: string; generated_password?: string }>("/admin/merchants", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Administration</p>
          <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">
            Restaurants.
          </h1>
          <p className="text-ink-3 text-[13px] mt-2">
            {data?.merchants.length ?? "—"} restaurants enregistrés.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Nouveau</Button>
      </header>

      <section className="px-6 mt-8">
        <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="flex flex-col gap-3">
          {data?.merchants.map((m) => (
            <motion.li key={m.id} variants={staggerChild} layout>
              <article
                className={`rounded-[var(--radius-lg)] border hairline p-5 transition-colors ${m.status === "suspended" ? "bg-terracotta-soft/40" : "bg-paper"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-paper font-display font-medium text-sm shrink-0"
                    style={{ background: m.brand_accent }}
                  >
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display text-[16px] tracking-tight font-medium leading-none">{m.name}</p>
                      {m.status === "suspended" && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-terracotta text-paper">
                          suspendu
                        </span>
                      )}
                      {!m.owner_email && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-paper-2 text-ink-3">
                          sans gérant
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted mt-1.5 truncate">{m.address ?? "Adresse non renseignée"}</p>
                    {m.owner_email && (
                      <p className="text-[11px] text-ink-3 mt-1 font-mono">{m.owner_email}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                  <Metric label="Cartes" value={m.cards_count} />
                  <Metric label="Tampons" value={m.stamps_count} />
                  <Metric label="Tampons req." value={m.stamps_required} />
                  <Metric label="Gadgets" value={m.active_devices} />
                  <Metric label="Rayon" value={`${m.geofence_radius_m}m`} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t hairline pt-3">
                  <span className="text-[11px] text-muted font-mono uppercase tracking-wider">
                    créé {fmtDate(m.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        update.mutate({
                          id: m.id,
                          payload: { status: m.status === "active" ? "suspended" : "active" },
                        })
                      }
                      className="text-[12px] text-ink-3 underline-offset-4 hover:underline"
                    >
                      {m.status === "active" ? "Suspendre" : "Réactiver"}
                    </button>
                    <button
                      onClick={() => setEditing(m)}
                      className="text-[12px] text-ink underline-offset-4 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer définitivement ${m.name} ?`)) del.mutate(m.id);
                      }}
                      className="text-[12px] text-terracotta underline-offset-4 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <AnimatePresence>
        {editing && (
          <EditMerchantSheet
            merchant={editing}
            onClose={() => setEditing(null)}
            onSave={(payload) => {
              update.mutate({ id: editing.id, payload });
              setEditing(null);
            }}
          />
        )}
        {creating && (
          <CreateMerchantSheet
            onClose={() => setCreating(false)}
            onSubmit={async (payload) => {
              const res = await create.mutateAsync(payload);
              setCreating(false);
              if (res.generated_password) {
                alert(`Compte gérant créé.\nMot de passe : ${res.generated_password}`);
              }
            }}
            submitting={create.isPending}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-paper-2 rounded-[var(--radius-sm)] p-2">
      <p className="text-[9px] uppercase tracking-[0.18em] font-mono text-muted">{label}</p>
      <p className="font-display text-[15px] font-medium font-tabular mt-1">{value}</p>
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-8"
      style={{ background: "rgba(10,10,10,0.55)" }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-paper rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] p-6 max-h-[88vh] overflow-y-auto"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Restaurant</p>
        <h2 className="font-display text-2xl tracking-tighter font-medium mt-2 leading-none">{title}</h2>
        <div className="mt-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function EditMerchantSheet({
  merchant,
  onClose,
  onSave,
}: {
  merchant: Merchant;
  onClose: () => void;
  onSave: (payload: Partial<Merchant>) => void;
}) {
  const [form, setForm] = useState<Partial<Merchant>>({
    name: merchant.name,
    address: merchant.address ?? "",
    stamps_required: merchant.stamps_required,
    reward_description: merchant.reward_description,
    geofence_radius_m: merchant.geofence_radius_m,
    brand_accent: merchant.brand_accent,
    nfc_enabled: merchant.nfc_enabled,
  });
  const upd = (k: keyof Merchant, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Sheet title={merchant.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label="Nom" value={form.name ?? ""} onChange={(v) => upd("name", v)} />
        <TextField label="Adresse" value={form.address ?? ""} onChange={(v) => upd("address", v)} />
        <NumberField label="Tampons requis" value={form.stamps_required ?? 10} onChange={(v) => upd("stamps_required", v)} min={3} max={20} />
        <TextField label="Description récompense" value={form.reward_description ?? ""} onChange={(v) => upd("reward_description", v)} />
        <NumberField label="Rayon géofence (m)" value={form.geofence_radius_m ?? 100} onChange={(v) => upd("geofence_radius_m", v)} min={20} max={500} step={10} />
        <AccentField value={form.brand_accent ?? "#D85A30"} onChange={(v) => upd("brand_accent", v)} />
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-[13px]">NFC activé</span>
          <Toggle value={!!form.nfc_enabled} onChange={(v) => upd("nfc_enabled", v)} />
        </label>
        <div className="flex gap-3 mt-3">
          <Button variant="secondary" full onClick={onClose}>Annuler</Button>
          <Button full onClick={() => onSave(form)}>Enregistrer</Button>
        </div>
      </div>
    </Sheet>
  );
}

function CreateMerchantSheet({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: any) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    lat: 36.8065,
    lng: 10.1815,
    stamps_required: 10,
    reward_description: "1 boisson offerte",
    geofence_radius_m: 100,
    brand_accent: "#D85A30",
    owner_email: "",
    create_owner: true,
  });
  const upd = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const autoSlug = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <Sheet title="Nouveau restaurant" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField
          label="Nom"
          value={form.name}
          onChange={(v) => {
            upd("name", v);
            if (!form.slug || form.slug === autoSlug(form.name)) upd("slug", autoSlug(v));
          }}
        />
        <TextField label="Slug" value={form.slug} onChange={(v) => upd("slug", v)} hint="Identifiant unique URL-friendly (a-z, 0-9, -)" />
        <TextField label="Adresse" value={form.address} onChange={(v) => upd("address", v)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Latitude" value={String(form.lat)} onChange={(v) => upd("lat", Number(v))} />
          <TextField label="Longitude" value={String(form.lng)} onChange={(v) => upd("lng", Number(v))} />
        </div>
        <NumberField label="Tampons requis" value={form.stamps_required} onChange={(v) => upd("stamps_required", v)} min={3} max={20} />
        <TextField label="Récompense" value={form.reward_description} onChange={(v) => upd("reward_description", v)} />
        <NumberField label="Rayon géofence (m)" value={form.geofence_radius_m} onChange={(v) => upd("geofence_radius_m", v)} min={20} max={500} step={10} />
        <AccentField value={form.brand_accent} onChange={(v) => upd("brand_accent", v)} />
        <TextField
          label="Email du gérant"
          value={form.owner_email}
          onChange={(v) => upd("owner_email", v)}
          hint="Optionnel — laissez vide pour un compte sans gérant"
        />
        {form.owner_email && (
          <label className="flex items-center justify-between gap-3 py-1">
            <span className="text-[12px] text-ink-3">Créer le compte s'il n'existe pas</span>
            <Toggle value={form.create_owner} onChange={(v) => upd("create_owner", v)} />
          </label>
        )}
        <div className="flex gap-3 mt-3">
          <Button variant="secondary" full onClick={onClose}>Annuler</Button>
          <Button
            full
            disabled={submitting || !form.name || !form.slug}
            onClick={() =>
              onSubmit({
                ...form,
                owner_email: form.owner_email || undefined,
              })
            }
          >
            {submitting ? "…" : "Créer"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none text-[14px]"
      />
      {hint && <span className="text-[11px] text-muted leading-snug">{hint}</span>}
    </label>
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

function AccentField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">Accent</span>
      <div className="flex items-center gap-2">
        {PRESET_ACCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="relative h-9 w-9 rounded-full"
            style={{ background: p }}
          >
            {value === p && (
              <motion.span
                layoutId="admin-color-ring"
                className="absolute -inset-1 rounded-full border border-ink"
                transition={spring}
              />
            )}
          </button>
        ))}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ml-auto w-24 h-9 px-2 rounded-[var(--radius-sm)] bg-paper border hairline font-mono text-[12px] uppercase"
        />
      </div>
    </label>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-ink" : "bg-hairline"}`}
    >
      <motion.span
        layout
        transition={spring}
        className={`absolute top-0.5 ${value ? "left-5" : "left-0.5"} h-5 w-5 rounded-full bg-paper`}
      />
    </button>
  );
}
