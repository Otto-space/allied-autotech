"use client";

import { useState } from "react";
import "./campaign-artwork.css";

export type CampaignArtworkId = "built-on-trust" | "precision-autocare" | "right-work";

/** Complete approved compositions; surrounding HTML supplies claims and actions. */
export function CampaignArtwork({
  artwork,
  alt,
  sizes = "(max-width: 767px) calc(100vw - 40px), 400px",
  priority = false,
}: {
  artwork: CampaignArtworkId;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="campaign-artwork" data-artwork={artwork}>
      {failed ? (
        <p className="campaign-artwork__fallback">{alt}</p>
      ) : (
        // Responsive derivatives are already optimised; avoid double compression.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={(node) => {
            // A failed eager request can finish before React attaches onError.
            if (node?.complete && node.naturalWidth === 0) setFailed(true);
          }}
          src={`/brand/r2/${artwork}-800.webp`}
          srcSet={[480, 800, 1080]
            .map((width) => `/brand/r2/${artwork}-${width}.webp ${width}w`)
            .join(", ")}
          sizes={sizes}
          width={1080}
          height={1350}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
