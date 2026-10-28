"use client";
import { useEffect, useId, useRef } from "react";
import type { ProductImage } from "@/lib/api/product-extras-schemas";
import { PublicMedia } from "./public-media";

export function ProductImagePreview({
  image,
  productName,
  onClose,
}: {
  image: ProductImage;
  productName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      modal?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="product-photo-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>Image preview · {productName}</h2>
      <PublicMedia
        src={image.url}
        alt={image.altText || productName}
        adminPreview={image.source === "UPLOADED"}
      />
      <p>Saved image preview. Your open editor is preserved.</p>
      <button type="button" className="button secondary" onClick={onClose}>
        Close image preview
      </button>
    </dialog>
  );
}
