"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ZoomIn, X } from "lucide-react";
import styles from "./equipment-photo.module.css";

export function EquipmentPhoto({
  slug,
  name,
  description,
  sizes,
}: {
  slug: string;
  name: string;
  description: string;
  sizes: string;
}) {
  const [open, setOpen] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLAnchorElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const src = `/images/equipment/${slug}.jpg`;

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const opener = trigger.current;
    const overflow = document.body.style.overflow;
    modal?.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      modal?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <a
        ref={trigger}
        href={src}
        className={`equipment-image ${styles.trigger}`}
        aria-label={`View photo of ${name}`}
        aria-haspopup="dialog"
        onClick={(event) => {
          // The original image remains reachable without JavaScript or via a new tab.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          setPreviewFailed(false);
          setOpen(true);
        }}
      >
        {thumbnailFailed ? (
          <span className={styles.thumbnailError}>Photo unavailable</span>
        ) : (
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            onError={() => setThumbnailFailed(true)}
          />
        )}
        <span className={styles.hint} aria-hidden="true">
          <ZoomIn size={14} /> View
        </span>
      </a>
      {open && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <div className={styles.header}>
            <h2 id={titleId}>{name}</h2>
            <button
              ref={closeButton}
              className={styles.close}
              type="button"
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden="true" /> Close photo
            </button>
          </div>
          <div className={styles.preview}>
            {previewFailed ? (
              <div className={styles.failure} role="status">
                <p>This photo could not load.</p>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => {
                    setAttempt((value) => value + 1);
                    setPreviewFailed(false);
                    closeButton.current?.focus();
                  }}
                >
                  Retry photo
                </button>
              </div>
            ) : (
              <Image
                key={attempt}
                src={src}
                alt={name}
                fill
                sizes="(max-width: 940px) calc(100vw - 72px), 860px"
                loading="eager"
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
          <p className={styles.description} id={descriptionId}>
            {description}
          </p>
        </dialog>
      )}
    </>
  );
}
