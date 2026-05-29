import { motion } from "motion/react";
import { useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  /** Tailwind aspect class. Default: "aspect-[16/10]" */
  aspect?: string;
  /** If provided, overlays a colored band at the bottom (e.g. for legibility). */
  overlay?: "none" | "soft" | "strong";
  /** Fallback gradient color when no src or load error. */
  fallbackColor?: string;
  rounded?: string;
};

/**
 * Photo component with skeleton, error fallback, and optional gradient overlay.
 * Source URLs are typically picsum.photos with a descriptive seed; can also be a
 * real CDN URL when the merchant uploads their hero.
 */
export const Photo = ({
  src,
  alt,
  className = "",
  aspect = "aspect-[16/10]",
  overlay = "none",
  fallbackColor = "var(--color-paper-3)",
  rounded = "rounded-[var(--radius-xl)]",
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showPhoto = !!src && !errored;

  return (
    <div className={`relative overflow-hidden ${aspect} ${rounded} ${className}`}>
      {/* Fallback layer */}
      <div
        className="absolute inset-0"
        style={{ background: fallbackColor }}
      />

      {/* Skeleton while loading */}
      {showPhoto && !loaded && (
        <div className="absolute inset-0 shimmer bg-paper-2" />
      )}

      {showPhoto && (
        <motion.img
          src={src!}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.04 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {overlay !== "none" && (
        <div
          className={`absolute inset-0 pointer-events-none ${overlay === "strong" ? "photo-overlay-strong" : "photo-overlay"}`}
        />
      )}
    </div>
  );
};

/**
 * Build a deterministic picsum URL with a descriptive seed.
 * The seed only controls *which* random photo is returned — same seed = same image.
 * In production, replace these with real merchant-uploaded photos.
 */
export const picsum = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
