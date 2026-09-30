"use client";
import { useState } from "react";
import Image from "next/image";
import { Wrench } from "lucide-react";
import styles from "./service-image.module.css";

export function ServicePhoto({
  url,
  alt,
  width,
  height,
}: {
  url: string;
  alt: string;
  width: number;
  height: number;
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
    <Image
      unoptimized
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={styles.image}
      onError={() => setFailed(true)}
    />
  );
}
