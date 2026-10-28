import { Suspense } from "react";
import { WorkPartsFitment } from "@/app/components/work-parts-fitment";
import "../services/services.css";

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading parts fitment...</p>}>
      <WorkPartsFitment />
    </Suspense>
  );
}
