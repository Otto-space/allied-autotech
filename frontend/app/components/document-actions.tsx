"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { fetchDocumentPdf, type StaffInvoicePdf } from "@/lib/api/document-download";
import { CopyControl } from "./copy-control";
import { Feedback } from "./feedback";
import "./document-actions.css";

export function DocumentActions({
  kind,
  id,
  disabled = false,
  staff,
}: {
  kind: "invoice" | "receipt";
  id: string;
  disabled?: boolean;
  staff?: StaffInvoicePdf & {
    verify: (signal: AbortSignal) => Promise<void>;
    onDenied: () => void;
    onBusyChange: (busy: boolean) => void;
  };
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const [share, setShare] = useState<{ file: File; url: string } | null>(null);
  const pending = useRef<AbortController | null>(null),
    active = useRef(true),
    lock = useRef(false);
  const links = useRef(new Set<string>());
  const shareButton = useRef<HTMLButtonElement>(null);
  const exportBusyChange = staff?.onBusyChange;
  useEffect(() => {
    active.current = true;
    function clear() {
      active.current = false;
      pending.current?.abort();
      setShare(null);
      setError(undefined);
      setMessage(undefined);
      for (const url of links.current) URL.revokeObjectURL(url);
      links.current.clear();
      exportBusyChange?.(false);
    }
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      clear();
      window.removeEventListener(SESSION_CHANGED, clear);
    };
  }, [id, kind, staff?.version, staff?.status, exportBusyChange]);
  function save(file: File) {
    const url = URL.createObjectURL(file);
    links.current.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      links.current.delete(url);
    }, 1000);
    setMessage("Download started. Check your browser’s downloads.");
  }
  async function prepare(mode: "download" | "share") {
    if (lock.current || disabled || !active.current) return;
    lock.current = true;
    setBusy(true);
    staff?.onBusyChange(true);
    setError(undefined);
    setMessage(undefined);
    const controller = new AbortController();
    pending.current = controller;
    try {
      await staff?.verify(controller.signal);
      const file = await fetchDocumentPdf(kind, id, controller.signal, staff);
      await staff?.verify(controller.signal);
      if (!active.current || controller.signal.aborted) return;
      if (mode === "download") save(file);
      else
        setShare({
          file,
          url: `${window.location.origin}${staff ? "/admin/invoices" : `/dashboard/${kind === "invoice" ? "invoices" : "payments"}`}/${encodeURIComponent(id)}`,
        });
    } catch (value) {
      if (staff && value instanceof ApiError && [401, 403].includes(value.status))
        staff.onDenied();
      if (active.current && !controller.signal.aborted)
        setError(
          value instanceof ApiError
            ? value.message
            : "We could not prepare this document. Refresh the record and try again.",
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        staff?.onBusyChange(false);
      }
    }
  }
  return (
    <div className="document-actions">
      <div className="actions">
        <button
          className="button secondary"
          disabled={disabled || busy}
          onClick={() => void prepare("download")}
        >
          <Download size={16} aria-hidden="true" />
          Download {kind}
        </button>
        <button
          ref={shareButton}
          className="button secondary"
          disabled={disabled || busy}
          onClick={() => void prepare("share")}
        >
          <Share2 size={16} aria-hidden="true" />
          Share {kind}
        </button>
      </div>
      {busy && <p role="status">Preparing your {kind}…</p>}
      <Feedback message={error} />
      <Feedback message={message} tone="info" />
      {share && (
        <DocumentShare
          kind={kind}
          file={share.file}
          url={share.url}
          staff={!!staff}
          onClose={() => {
            setShare(null);
            requestAnimationFrame(() => {
              if (active.current) shareButton.current?.focus();
            });
          }}
          onDownload={() => save(share.file)}
        />
      )}
    </div>
  );
}

function DocumentShare({
  kind,
  file,
  url,
  onClose,
  onDownload,
  staff = false,
}: {
  kind: "invoice" | "receipt";
  file: File;
  url: string;
  onClose: () => void;
  onDownload: () => void;
  staff?: boolean;
}) {
  const modal = useRef<HTMLDialogElement>(null),
    close = useRef<HTMLButtonElement>(null),
    active = useRef(true),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string>();
  const id = useId();
  useEffect(() => {
    active.current = true;
    const opener = document.activeElement,
      dialog = modal.current;
    dialog?.showModal();
    close.current?.focus();
    return () => {
      active.current = false;
      // Strict Mode replays connected effects. Closing that live modal would
      // enqueue onClose and immediately remove the reopened share dialog.
      queueMicrotask(() => {
        if (!dialog?.isConnected) {
          dialog?.close();
          if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        }
      });
    };
  }, []);
  let native = false;
  try {
    native =
      typeof navigator !== "undefined" &&
      !!navigator.share &&
      !!navigator.canShare?.({ files: [file] });
  } catch {
    // Restricted browser contexts can reject capability detection.
  }
  async function shareFile() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      await navigator.share({ files: [file], title: `Allied AutoTech ${kind}` });
      if (active.current) setMessage("Share action completed.");
    } catch (value) {
      if (active.current)
        setMessage(
          value instanceof DOMException && value.name === "AbortError"
            ? "Sharing cancelled."
            : "Sharing is unavailable here. Download the PDF or copy the account link below.",
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={modal}
      className="support-dialog document-share"
      aria-labelledby={`${id}-title`}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="document-share-heading">
        <h2 id={`${id}-title`}>Share {kind}</h2>
        <button
          ref={close}
          className="button secondary icon-button"
          onClick={onClose}
          aria-label="Close sharing"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p>The PDF contains private account information. Choose who receives it.</p>
      {native && (
        <button className="button" disabled={busy} onClick={() => void shareFile()}>
          <Share2 size={16} aria-hidden="true" />
          Share PDF
        </button>
      )}
      <button className="button secondary" disabled={busy} onClick={onDownload}>
        <Download size={16} aria-hidden="true" />
        Download PDF
      </button>
      <label htmlFor={`${id}-link`}>
        {staff ? "Private invoice link" : "Account link"}
      </label>
      <input id={`${id}-link`} readOnly value={url} />
      <CopyControl
        value={url}
        label={`Copy ${kind === "invoice" ? "invoice" : "payment"} link`}
        fieldId={`${id}-link`}
      />
      <p className="document-share-note">
        {staff
          ? "This private link requires current administrator access. It does not grant access to its recipient."
          : "The link requires sign-in to the account that owns this record."}
      </p>
      <Feedback message={message} tone="info" />
    </dialog>
  );
}
