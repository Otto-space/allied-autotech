import Image from "next/image";
import type { ReactNode } from "react";

/** Compact task introduction; stock photography never stands in for a listing. */
export function CatalogueBanner({
  kind,
  title,
  description,
}: {
  kind: "shop" | "services" | "vehicles";
  title: ReactNode;
  description: string;
}) {
  const image =
    kind === "shop"
      ? "/images/allied-autotech/parts-editorial.webp"
      : kind === "services"
        ? "/images/workshop/workshop-hero-01.jpg"
        : undefined;
  return (
    <section
      className={`catalogue-banner catalogue-banner--${kind}`}
      aria-labelledby={`${kind}-catalogue-title`}
    >
      <div className="public-wrap catalogue-banner__inner">
        <div className="catalogue-banner__copy">
          <h1 id={`${kind}-catalogue-title`}>{title}</h1>
          <p>{description}</p>
        </div>
        {image && (
          <figure className="catalogue-banner__media">
            <Image
              src={image}
              alt={kind === "services" ? "Inside the Allied AutoTech workshop" : ""}
              fill
              sizes="(max-width: 700px) 90vw, 36vw"
            />
            {kind === "shop" && (
              <figcaption>Automotive essentials — editorial image</figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
