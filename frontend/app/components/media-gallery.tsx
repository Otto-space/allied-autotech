"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PublicMedia } from "./public-media";

type GalleryImage = {
  id: string;
  url: string;
  altText?: string | null;
  isPrimary: boolean;
};
export function MediaGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [selected, setSelected] = useState(images.findIndex((image) => image.isPrimary));
  const index = selected >= 0 && selected < images.length ? selected : 0;
  const current = images[index];
  function move(offset: number) {
    setSelected((index + offset + images.length) % images.length);
  }
  return (
    <section className="media-gallery" aria-label={`${title} images`}>
      <PublicMedia
        key={current?.id ?? "empty"}
        src={current?.url}
        alt={current?.altText || title}
        priority
      />
      {images.length > 1 && (
        <>
          <div className="media-gallery__controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous image"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span role="status" aria-live="polite">
              Image {index + 1} of {images.length}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Next image"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="media-gallery__thumbnails">
            {images.map((image, position) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Show image ${position + 1}: ${image.altText || title}`}
                aria-pressed={index === position}
                onClick={() => setSelected(position)}
              >
                <PublicMedia src={image.url} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
