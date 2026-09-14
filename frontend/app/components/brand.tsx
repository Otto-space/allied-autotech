import { Wrench } from "lucide-react";
export function Brand() {
  return (
    <span className="brand" aria-label="Allied AutoTech home">
      <span className="brand-mark" aria-hidden="true">
        <Wrench size={18} />
      </span>
      <span>Allied AutoTech</span>
    </span>
  );
}
