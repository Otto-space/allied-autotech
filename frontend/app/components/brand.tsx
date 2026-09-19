import { Wrench } from "lucide-react";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="brand" aria-label="Allied AutoTech home">
      <span className="brand-mark" aria-hidden="true">
        <Wrench size={18} />
      </span>
      <span
        className={
          inverse ? "text-white transition-colors" : "text-brand-red transition-colors"
        }
      >
        Allied AutoTech
      </span>
    </span>
  );
}
