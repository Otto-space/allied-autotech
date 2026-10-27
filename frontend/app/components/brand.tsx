import Image from "next/image";

export function Brand({
  inverse = false,
  monochrome = false,
}: {
  inverse?: boolean;
  monochrome?: boolean;
}) {
  return (
    <span
      className={`brand brand-logo${inverse ? " brand-logo--inverse" : ""}`}
      role="img"
      aria-label="Allied AutoTech"
    >
      <Image
        className="brand-logo__mark"
        src={`/brand/r2/mark-${inverse ? "white" : monochrome ? "black" : "red"}.png`}
        alt=""
        width={397}
        height={349}
        unoptimized
        loading="eager"
      />
      <span className="brand-logo__wordmark" aria-hidden="true">
        <span className="brand-logo__name">Allied</span>
        <span className="brand-logo__descriptor">AutoTech</span>
      </span>
    </span>
  );
}
