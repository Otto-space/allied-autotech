"use client";
import { useEffect, useRef, useState } from "react";
import { publicImageSrcSet } from "@/lib/public-image-variants";

/** Native srcset is intentional: Next's persistent image cache cannot honour unpublication. */
export function ResponsivePublicImage({
  src,
  alt,
  sizes,
  width,
  height,
  className,
  priority = false,
  loading,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  onError: () => void;
}) {
  const [original, setOriginal] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const srcSet = !original ? publicImageSrcSet(src, width) : undefined;
  useEffect(() => {
    let active = true;
    // An SSR image can fail before React attaches onError. Reconcile that
    // completed request after hydration; do not eagerly fetch lazy galleries.
    if (
      image.current?.complete &&
      image.current.currentSrc &&
      image.current.naturalWidth === 0
    ) {
      queueMicrotask(() => {
        if (active) {
          if (srcSet) setOriginal(true);
          else onError();
        }
      });
    }
    return () => {
      active = false;
    };
  }, [src, srcSet, onError]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- publication-aware, bounded responsive derivatives
    <img
      ref={image}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? "eager" : (loading ?? "lazy")}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={() => {
        if (srcSet) setOriginal(true);
        else onError();
      }}
    />
  );
}
