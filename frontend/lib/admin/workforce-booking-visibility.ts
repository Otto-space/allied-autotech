/** Keep the mounted booking workspace stable during non-destructive revalidation. */
export function showWorkforceBookingRecord({
  loading,
  scopeChanged,
  version,
  minimumVersion,
}: {
  loading: boolean;
  scopeChanged: boolean;
  version: number | undefined;
  minimumVersion: number;
}): boolean {
  return !loading && !scopeChanged && version !== undefined && version >= minimumVersion;
}
