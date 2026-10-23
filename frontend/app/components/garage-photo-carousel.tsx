"use client";

import { useState } from "react";
import Image from "next/image";
import { CarFront, ChevronLeft, ChevronRight } from "lucide-react";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import styles from "./garage-photo-carousel.module.css";

type Photo = CustomerVehicle["images"][number];

export function GaragePhotoCarousel({
  images,
  vehicleName,
  size = "card",
}: {
  images: readonly Photo[];
  vehicleName: string;
  size?: "card" | "feature";
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const preferred = images.findIndex((photo) => photo.isPrimary);
  const selected = images.findIndex((photo) => photo.id === selectedId);
  const index = selected >= 0 ? selected : Math.max(preferred, 0);
  const photo = images[index];
  const multiple = images.length > 1;

  function step(direction: -1 | 1) {
    const next = (index + direction + images.length) % images.length;
    setSelectedId(images[next]!.id);
  }

  return (
    <section
      className={`${styles.carousel} ${size === "feature" ? styles.feature : styles.card}`}
      aria-label={`${vehicleName} photo gallery`}
    >
      <div className={styles.stage}>
        {photo && failedId !== photo.id ? (
          <Image
            key={photo.id}
            unoptimized
            fill
            sizes={size === "feature" ? "(max-width: 800px) 100vw, 900px" : "240px"}
            src={photo.url}
            alt={photo.altText || `${vehicleName}, photo ${index + 1}`}
            className={styles.image}
            onError={() => setFailedId(photo.id)}
          />
        ) : (
          <div
            className={styles.placeholder}
            role="img"
            aria-label={photo ? "Photo unavailable" : "No vehicle photo yet"}
          >
            <CarFront size={size === "feature" ? 64 : 42} aria-hidden="true" />
            <span>{photo ? "Photo unavailable" : "No photos yet"}</span>
          </div>
        )}
        {photo && photo.isPrimary && <span className={styles.cover}>Cover photo</span>}
      </div>
      {photo && (
        <div className={styles.controls}>
          <span className={styles.count} aria-live="polite">
            Photo {index + 1} of {images.length}
          </span>
          {multiple && (
            <div className={styles.navigation}>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={`Previous photo of ${vehicleName}`}
              >
                <ChevronLeft size={21} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={`Next photo of ${vehicleName}`}
              >
                <ChevronRight size={21} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
      {size === "feature" && multiple && (
        <div className={styles.thumbnails} aria-label="Choose a vehicle photo">
          {images.map((image, photoIndex) => (
            <button
              type="button"
              key={image.id}
              className={photoIndex === index ? styles.activeThumbnail : undefined}
              aria-label={`Show photo ${photoIndex + 1} of ${images.length}`}
              aria-current={photoIndex === index ? "true" : undefined}
              onClick={() => setSelectedId(image.id)}
            >
              <Image
                unoptimized
                fill
                sizes="76px"
                src={image.url}
                alt=""
                className={styles.thumbnailImage}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
