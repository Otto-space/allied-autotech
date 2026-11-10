import Image from "next/image";
import type { ReactNode } from "react";

/** Catalogue introduction; editorial photography never stands in for inventory. */
export function CatalogueBanner({
  kind,
  title,
  description,
  breadcrumbs,
  children,
}: {
  kind: "shop" | "services" | "vehicles";
  title: ReactNode;
  description: string;
  breadcrumbs?: ReactNode;
  children?: ReactNode;
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
          {breadcrumbs}
          {kind === "services" && (
            <p className="catalogue-banner__eyebrow">Workshop services</p>
          )}
          <h1 id={`${kind}-catalogue-title`}>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
        {image && (
          <figure className="catalogue-banner__media">
            <Image
              src={image}
              alt={kind === "services" ? "Inside the Allied AutoTech workshop" : ""}
              fill
              sizes="100vw"
              preload
            />
          </figure>
        )}
        {kind === "shop" && (
          <p className="catalogue-banner__caption">Illustrative automotive essentials</p>
        )}
      </div>
    </section>
  );
}
