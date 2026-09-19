"use client";
import {
  prepareVehicleAsset,
  validateAssetFile,
  type AssetKind,
} from "@/lib/api/vehicle-assets";
import { FileUpload, type AssetSelection } from "./file-upload";
export type { AssetSelection } from "./file-upload";
export function VehicleAssetUpload({
  vehicleId,
  kind,
  label,
  disabled,
  onChange,
}: {
  vehicleId: string;
  kind: AssetKind;
  label: string;
  disabled: boolean;
  onChange: (selection: AssetSelection) => void;
}) {
  const pdf = kind === "HANDOVER" || kind === "CONDITION_REPORT";
  return (
    <FileUpload
      uploadId={`asset-${kind}`}
      label={label}
      disabled={disabled}
      onChange={onChange}
      hint={
        pdf
          ? "PDF, up to 20 MiB."
          : kind === "IMAGE"
            ? "JPEG, PNG or WebP, up to 10 MiB."
            : "PDF, JPEG, PNG or WebP, up to 20 MiB."
      }
      accept={
        pdf
          ? "application/pdf"
          : kind === "IMAGE"
            ? "image/jpeg,image/png,image/webp"
            : "application/pdf,image/jpeg,image/png,image/webp"
      }
      validate={(file) => validateAssetFile(file, kind)}
      prepare={(options) => prepareVehicleAsset({ ...options, vehicleId, kind })}
    />
  );
}
