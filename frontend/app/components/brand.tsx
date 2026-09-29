export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`brand brand-wordmark${inverse ? " brand-wordmark--inverse" : ""}`}
      aria-label="Allied AutoTech"
    >
      <span className="brand-wordmark__name">
        Allied
        <span className="brand-wordmark__accent" aria-hidden="true">
          .
        </span>
      </span>
      <span className="brand-wordmark__descriptor">AUTOTECH</span>
    </span>
  );
}
