"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, SESSION_CHANGED } from "@/lib/api/client";
import type { PreparedUpload, UploadOptions } from "@/lib/api/signed-upload";
import { UploadError } from "@/lib/api/signed-upload";
import { notify } from "@/lib/notifications";
import { useAssetStorageHosts } from "./asset-storage-context";
import { Feedback } from "./feedback";

export type AssetSelection = { name: string; prepared?: PreparedUpload } | null;
export function FileUpload({
  uploadId,
  label,
  hint,
  accept,
  disabled,
  onChange,
  validate,
  prepare,
}: {
  uploadId: string;
  label: string;
  hint: string;
  accept: string;
  disabled: boolean;
  onChange: (selection: AssetSelection) => void;
  validate: (file: File) => unknown;
  prepare: (options: UploadOptions) => Promise<PreparedUpload>;
}) {
  const hosts = useAssetStorageHosts();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const discard = () => {
      pending.current?.abort();
      setFile(null);
      setUploaded(false);
      setError(undefined);
      setProgress(undefined);
      onChange(null);
      if (input.current) input.current.value = "";
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [onChange]);
  function select(next: File | null) {
    pending.current?.abort();
    setFile(next);
    setUploaded(false);
    setError(undefined);
    setProgress(undefined);
    onChange(next ? { name: next.name } : null);
    if (next) {
      try {
        validate(next);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Choose a supported file.");
      }
    }
  }
  async function upload() {
    if (!file || disabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setProgress(undefined);
    setUploaded(false);
    onChange({ name: file.name });
    try {
      const prepared = await prepare({
        file,
        hosts,
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (!controller.signal.aborted) {
        setUploaded(true);
        notify("File uploaded. Save the form to attach it to the record.", {
          tone: "info",
        });
        onChange({ name: file.name, prepared });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof ApiError || error instanceof UploadError
            ? error.message
            : "The upload could not be completed.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="detail-section field asset-upload">
      <label htmlFor={uploadId}>{label}</label>
      <p id={`${uploadId}-hint`} className="field-hint">
        {hint} Uploading prepares the file; it is attached only when you confirm the
        record.
      </p>
      {!hosts.length && (
        <p className="notice">
          Document uploads are unavailable. Contact customer care or an administrator.
        </p>
      )}
      <input
        ref={input}
        id={uploadId}
        type="file"
        accept={accept}
        disabled={disabled || busy || !hosts.length}
        aria-describedby={`${uploadId}-hint`}
        onChange={(event) => select(event.target.files?.[0] ?? null)}
      />
      <Feedback message={error} />
      {busy && (
        <div role="status">
          <p>
            {progress === undefined
              ? "Preparing secure upload…"
              : `Uploading: ${progress}%`}
          </p>
          <progress aria-label="Document upload progress" value={progress} max={100} />
        </div>
      )}
      {uploaded && (
        <p role="status">File uploaded. Ready to attach when you confirm the record.</p>
      )}
      <div className="actions">
        {file && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled || busy || !hosts.length}
            onClick={() => void upload()}
          >
            {uploaded ? "Upload selected file again" : "Upload selected file"}
          </button>
        )}
        {busy && (
          <button
            type="button"
            className="button secondary"
            onClick={() => pending.current?.abort()}
          >
            Cancel upload
          </button>
        )}
        {file && !busy && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              select(null);
              if (input.current) {
                input.current.value = "";
                input.current.focus();
              }
            }}
          >
            Remove selected file
          </button>
        )}
      </div>
    </div>
  );
}
