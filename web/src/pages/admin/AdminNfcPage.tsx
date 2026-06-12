import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ApiError, api } from "../../lib/api";
import { fmtRelative } from "../../lib/format";
import { pageVariants } from "../../lib/motion";

// --- Minimal Web NFC typings (Chrome Android only; not in TS dom lib) ---
type NdefRecord = { recordType: string; data?: DataView; encoding?: string };
type NdefReadingEvent = { serialNumber: string; message: { records: NdefRecord[] } };
type NdefReader = {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: unknown, options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((e: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};
const getNdefReader = (): (new () => NdefReader) | null =>
  (window as unknown as { NDEFReader?: new () => NdefReader }).NDEFReader ?? null;

type Merchant = { id: string; name: string };
type Device = {
  id: string;
  uid: string;
  device_type: string;
  label: string | null;
  status: "active" | "revoked";
  provisioned_at: string;
  last_used_at: string | null;
};

type ReadTag = { serial: string; records: string[] };

const normalizeSerial = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const decodeRecord = (r: NdefRecord): string => {
  if (!r.data) return r.recordType;
  try {
    return `${r.recordType}: ${new TextDecoder(r.encoding ?? "utf-8").decode(r.data)}`;
  } catch {
    return r.recordType;
  }
};

export const AdminNfcPage = () => {
  const qc = useQueryClient();
  const supported = getNdefReader() !== null;

  const [merchantId, setMerchantId] = useState("");
  const [tag, setTag] = useState<ReadTag | null>(null);
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [deviceType, setDeviceType] = useState("sticker");
  const [label, setLabel] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const { data: merchants } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: () => api<{ merchants: Merchant[] }>("/admin/merchants"),
  });

  const { data: devices } = useQuery({
    queryKey: ["admin-nfc", merchantId],
    queryFn: () => api<{ devices: Device[] }>(`/admin/merchants/${merchantId}/nfc`),
    enabled: !!merchantId,
  });

  const assign = useMutation({
    mutationFn: () =>
      api<Device>(`/admin/merchants/${merchantId}/nfc/provision`, {
        method: "POST",
        body: JSON.stringify({
          device_type: deviceType,
          label: label.trim() || undefined,
          uid: tag!.serial,
        }),
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin-nfc", merchantId] });
      setMessage({ kind: "ok", text: `Tag ${d.uid} assigné au restaurant.` });
    },
    onError: (err) =>
      setMessage({
        kind: "err",
        text:
          err instanceof ApiError && (err.payload as { error?: string } | null)?.error === "uid_taken"
            ? "Ce tag est déjà assigné (à ce restaurant ou un autre)."
            : "Échec de l'assignation.",
      }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/admin/nfc/${id}`, { method: "PATCH", body: JSON.stringify({ status: "revoked" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-nfc", merchantId] }),
  });

  const readTag = async () => {
    const Reader = getNdefReader();
    if (!Reader) return;
    setMessage(null);
    setTag(null);
    setReading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const reader = new Reader();
      reader.onreading = (e) => {
        ctrl.abort();
        setReading(false);
        setTag({ serial: normalizeSerial(e.serialNumber), records: e.message.records.map(decodeRecord) });
      };
      reader.onreadingerror = () => {
        ctrl.abort();
        setReading(false);
        setMessage({ kind: "err", text: "Tag illisible. Réessayez." });
      };
      await reader.scan({ signal: ctrl.signal });
    } catch {
      setReading(false);
      setMessage({ kind: "err", text: "Lecture NFC refusée ou indisponible." });
    }
  };

  // Writes the restaurant identifier onto the physical tag so any phone
  // tapping it can resolve which restaurant it belongs to.
  const writeTag = async (uid: string) => {
    const Reader = getNdefReader();
    if (!Reader) return;
    setMessage(null);
    setWriting(true);
    try {
      await new Reader().write({ records: [{ recordType: "text", data: `taprivo:${uid}` }] });
      setMessage({ kind: "ok", text: `« taprivo:${uid} » écrit sur le tag. Il est prêt à être livré.` });
    } catch {
      setMessage({ kind: "err", text: "Écriture échouée — gardez le tag contre le téléphone et réessayez." });
    } finally {
      setWriting(false);
    }
  };

  const assignedDevice = tag ? devices?.devices.find((d) => d.uid === tag.serial) : undefined;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="px-6 lg:px-10 pt-10 pb-10 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Gadgets</p>
      <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">Tags NFC</h1>
      <p className="text-[13px] text-ink-3 mt-2">
        Lisez un tag vierge, assignez-le à un restaurant, puis écrivez son identifiant dessus avant de le livrer.
      </p>

      {!supported && (
        <div className="mt-6 rounded-[var(--radius-lg)] border hairline bg-soleil-soft p-4 text-[13px] text-ink">
          Le NFC web n'est disponible que sur <strong>Chrome pour Android</strong> (en HTTPS). Ouvrez cette page
          sur un téléphone Android pour lire et écrire les tags.
        </div>
      )}

      {/* Step 1: restaurant */}
      <section className="mt-8 rounded-[var(--radius-lg)] border hairline bg-paper p-5">
        <h2 className="font-display text-lg tracking-tight font-medium">1. Restaurant</h2>
        <select
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          className="mt-3 w-full h-11 rounded-[var(--radius-md)] border hairline bg-paper px-3 text-[14px] outline-none focus:border-ink"
        >
          <option value="">Choisir un restaurant…</option>
          {merchants?.merchants.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </section>

      {/* Step 2: read */}
      <section className="mt-4 rounded-[var(--radius-lg)] border hairline bg-paper p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg tracking-tight font-medium">2. Lire le tag</h2>
          <Button onClick={readTag} disabled={!supported || reading}>
            {reading ? "Approchez le tag…" : "Lire un tag"}
          </Button>
        </div>
        {tag && (
          <div className="mt-4 text-[13px]">
            <p>
              <span className="text-muted font-mono uppercase text-[11px] tracking-wider">Série</span>{" "}
              <span className="font-mono">{tag.serial}</span>
            </p>
            {tag.records.length > 0 && (
              <p className="mt-1 text-ink-3">Contenu : {tag.records.join(" · ")}</p>
            )}
            {assignedDevice && (
              <p className="mt-1 text-olive">Déjà assigné à ce restaurant ({assignedDevice.label ?? assignedDevice.device_type}).</p>
            )}
          </div>
        )}
      </section>

      {/* Step 3: assign + write */}
      <section className="mt-4 rounded-[var(--radius-lg)] border hairline bg-paper p-5">
        <h2 className="font-display text-lg tracking-tight font-medium">3. Assigner & écrire</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="h-11 rounded-[var(--radius-md)] border hairline bg-paper px-3 text-[14px] outline-none focus:border-ink"
          >
            <option value="sticker">Sticker</option>
            <option value="totem">Totem</option>
            <option value="card">Carte</option>
            <option value="bracelet">Bracelet</option>
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (ex. Totem caisse)"
            className="flex-1 min-w-40 h-11 rounded-[var(--radius-md)] border hairline bg-paper px-3 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => assign.mutate()}
            disabled={!merchantId || !tag || !!assignedDevice || assign.isPending}
          >
            {assign.isPending ? "…" : "Assigner au restaurant"}
          </Button>
          <Button
            variant="terracotta"
            onClick={() => writeTag((assignedDevice ?? assign.data)?.uid ?? tag!.serial)}
            disabled={!supported || !tag || writing}
          >
            {writing ? "Approchez le tag…" : "Écrire l'identifiant sur le tag"}
          </Button>
        </div>
        {message && (
          <p className={`mt-3 text-[13px] ${message.kind === "ok" ? "text-olive" : "text-terracotta"}`}>
            {message.text}
          </p>
        )}
      </section>

      {/* Device list */}
      {merchantId && (
        <section className="mt-4 rounded-[var(--radius-lg)] border hairline bg-paper p-5">
          <h2 className="font-display text-lg tracking-tight font-medium mb-3">Tags de ce restaurant</h2>
          {devices?.devices.length === 0 && <p className="text-[13px] text-ink-3">Aucun tag pour l'instant.</p>}
          <ul className="divide-y hairline">
            {devices?.devices.map((d) => (
              <li key={d.id} className="py-3 flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0">
                  <span className={d.status === "revoked" ? "line-through text-muted" : "text-ink"}>
                    {d.label ?? d.device_type}
                  </span>
                  <span className="block font-mono text-[11px] text-muted uppercase">
                    {d.device_type} · {d.uid}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                    {d.last_used_at ? fmtRelative(d.last_used_at) : "jamais utilisé"}
                  </span>
                  {d.status === "active" ? (
                    <Button size="sm" variant="secondary" onClick={() => revoke.mutate(d.id)}>
                      Révoquer
                    </Button>
                  ) : (
                    <span className="text-[11px] font-mono uppercase text-terracotta">Révoqué</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </motion.div>
  );
};
