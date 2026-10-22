import Image from "next/image";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand brand-logo${inverse ? " brand-logo--inverse" : ""}`}>
      <Image
        className="brand-logo__primary"
        src="/brand/allied-primary-dark.png"
        alt="Allied AutoTech"
        width={746}
        height={253}
        unoptimized
        loading="eager"
      />
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
