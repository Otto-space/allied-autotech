"use client";
import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import { Package } from "lucide-react";
import {
  publicMediaHosts,
  isPublicMediaUrl,
  isManagedProductPreviewUrl,
  isStockPreviewUrl,
} from "@/lib/media";
const allowed = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
export function PublicMedia({
  src,
  alt,
  priority = false,
  loading,
  adminPreview = false,
  stockPreview = false,
  fallbackIcon,
  sizes = "(max-width: 700px) 100vw, 40vw",
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  adminPreview?: boolean;
  stockPreview?: boolean;
  fallbackIcon?: ReactNode;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const safe =
    !!src &&
    (isPublicMediaUrl(src, allowed) ||
      (adminPreview && isManagedProductPreviewUrl(src)) ||
      (stockPreview && isStockPreviewUrl(src)));
  // These API streams reject extra query parameters. Keep Next's deployment ID
  // on framework assets, while retaining the exact authenticated/public media URL.
  const apiSrc = src?.startsWith("/api/v1/") ? src : undefined;
  return (
    <div className="product-media">
      {safe && src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          overrideSrc={apiSrc}
          priority={priority}
          loading={loading}
          sizes={sizes}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="media-placeholder">
          <span aria-hidden="true">
            {fallbackIcon ?? <Package size={42} strokeWidth={1.3} />}
          </span>
          <span>Image unavailable</span>
        </div>
      )}
    </div>
  );
}
