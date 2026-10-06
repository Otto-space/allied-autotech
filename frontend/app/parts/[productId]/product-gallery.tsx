"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Package, ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { isPublicMediaUrl, publicMediaHosts } from "@/lib/media";

type Photo = { id: string; url: string; altText?: string | null; isPrimary: boolean };
const hosts = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);

function ProductPhoto({
  photo,
  title,
  small = false,
  priority = false,
}: {
  photo?: Photo;
  title: string;
  small?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="pd-photo">
      {photo && !failed ? (
        <Image
          src={photo.url}
          alt={small ? "" : photo.altText || title}
          fill
          unoptimized
          priority={priority}
          sizes={small ? "100px" : "(max-width: 899px) 100vw, 65vw"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="pd-photo-empty">
          <Package size={small ? 24 : 40} strokeWidth={1.3} aria-hidden="true" />
          {!small && (
            <>
              <strong>
                {photo ? "This photo is unavailable" : "Photos not available"}
              </strong>
              <span>Ask our team for more information about this product.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ProductGallery({ images, title }: { images: Photo[]; title: string }) {
  const photos = images.filter((photo) => isPublicMediaUrl(photo.url, hosts));
  const [selected, setSelected] = useState(
    Math.max(
      0,
      photos.findIndex((photo) => photo.isPrimary),
    ),
  );
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = selected < photos.length ? selected : 0;
  const current = photos[index];
  function move(offset: number) {
    if (photos.length > 1) setSelected((index + offset + photos.length) % photos.length);
  }
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const trigger = expand.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);
  const controls = (expanded: boolean) => (
    <div className="pd-gallery-controls">
      {photos.length > 1 && (
        <button
          className="icon-button"
          type="button"
          aria-label="Previous photo"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      )}
      <span role="status" aria-live="polite">
        Photo {index + 1} of {photos.length}
      </span>
      {photos.length > 1 && (
        <button
          className="icon-button"
          type="button"
          aria-label="Next photo"
          onClick={() => move(1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}
      {!expanded && (
        <button
          ref={expand}
          type="button"
          className="pd-expand"
          onClick={() => setOpen(true)}
        >
          <Expand size={17} aria-hidden="true" /> View photos
        </button>
      )}
    </div>
  );
  const thumbnails = () =>
    photos.length > 1 && (
      <div className="pd-thumbnails" aria-label="Choose a photo">
        {photos.map((photo, i) => (
          <button
            type="button"
            key={photo.id}
            aria-label={`Show photo ${i + 1}: ${photo.altText || title}`}
            aria-pressed={i === index}
            onClick={() => setSelected(i)}
          >
            <ProductPhoto photo={photo} title={title} small />
          </button>
        ))}
      </div>
    );
  return (
    <section
      className="pd-gallery"
      aria-label={`${title} photos`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          setSelected(event.key === "Home" ? 0 : Math.max(0, photos.length - 1));
        }
      }}
    >
      <div
        onTouchStart={(event) => {
          const p = event.touches[0];
          touch.current = { x: p.clientX, y: p.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          const end = event.changedTouches[0];
          if (
            start &&
            Math.abs(end.clientX - start.x) > 60 &&
            Math.abs(end.clientY - start.y) < 40
          )
            move(end.clientX < start.x ? 1 : -1);
        }}
      >
        <ProductPhoto
          key={current?.id || "empty"}
          photo={current}
          title={title}
          priority
        />
      </div>
      {!!photos.length && controls(false)}
      {thumbnails()}
      <dialog
        className="pd-lightbox"
        ref={dialog}
        aria-labelledby="pd-photo-title"
        onCancel={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="pd-lightbox-heading">
          <h2 id="pd-photo-title">Product photos</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close photos"
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {open && (
          <>
            <ProductPhoto key={current?.id || "empty"} photo={current} title={title} />
            {controls(true)}
            {thumbnails()}
          </>
        )}
      </dialog>
    </section>
  );
}
