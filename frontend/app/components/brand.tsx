export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="brand" aria-label="Allied AutoTech home">
      <span
        className={
          inverse ? "text-white transition-colors" : "text-brand-red transition-colors eyebrow"
        }
      >
        Allied AutoTech
      </span>
    </span>
  );
}
