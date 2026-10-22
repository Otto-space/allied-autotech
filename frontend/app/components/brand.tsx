import Image from "next/image";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand brand-logo${inverse ? " brand-logo--inverse" : ""}`}>
      <span className="brand-logo__primary" role="img" aria-label="Allied AutoTech" />
      <Image
        className="brand-logo__compact"
        src="/brand/allied-mark-red.png"
        alt="Allied AutoTech"
        width={367}
        height={317}
        unoptimized
        loading="eager"
      />
    </span>
  );
}
