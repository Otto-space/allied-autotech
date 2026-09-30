"use client";
import Image from "next/image";
import { useState } from "react";
import { Package } from "lucide-react";
import {
  publicMediaHosts,
  isPublicMediaUrl,
  isManagedProductPreviewUrl,
} from "@/lib/media";
const allowed = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
export function PublicMedia({
  src,
  alt,
  priority = false,
  adminPreview = false,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  adminPreview?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const safe =
    !!src &&
    (isPublicMediaUrl(src, allowed) || (adminPreview && isManagedProductPreviewUrl(src)));
  return (
    <div className="product-media">
      {safe && src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes="(max-width: 700px) 100vw, 40vw"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="media-placeholder">
          <Package size={42} strokeWidth={1.3} />
          <span>Image unavailable</span>
        </div>
      )}
    </div>
  );
}
