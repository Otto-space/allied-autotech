"use client";
import { useState } from "react";
import Image from "next/image";
import { ResponsivePublicImage } from "./responsive-public-image";
import { Wrench } from "lucide-react";
import styles from "./service-image.module.css";

export function ServicePhoto({
  url,
  alt,
  width,
  height,
  illustrative = false,
}: {
  url: string;
  alt: string;
  width: number;
  height: number;
  illustrative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className={`${styles.image} ${styles.fallback}`}
      role="img"
      aria-label="Service image unavailable"
    >
      <Wrench size={32} aria-hidden="true" />
    </div>
  ) : (
    <div className={styles.frame} style={{ aspectRatio: `${width} / ${height}` }}>
      {url.startsWith("/images/workshop/owner/") ? (
        <Image
          src={url}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 767px) 90vw, (max-width: 1023px) 44vw, 520px"
          className={styles.image}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <ResponsivePublicImage
          src={url}
          sizes="(max-width: 767px) 90vw, (max-width: 1023px) 44vw, 360px"
          alt={alt}
          width={width}
          height={height}
          className={styles.image}
          onError={() => setFailed(true)}
        />
      )}
      {illustrative && <span className={styles.caption}>Illustrative image</span>}
    </div>
  );
}
