import { featuredServices } from "./featured-services";

export type ServicePhotograph = {
  url: string;
  altText: string | null;
  width: number;
  height: number;
  illustrative?: boolean;
};
type Service = { name: string; image: ServicePhotograph | null };

/** Approved editorial photographs are display assets, never invented media records. */
export function servicePhotograph(
  service: Service,
  context: "card" | "detail" = "detail",
): ServicePhotograph | null {
  const name = service.name.trim().toLowerCase();
  // The placement register reserves the portrait changer for its full equipment
  // view; the supplied landscape action photograph fits horizontal tyre cards.
  if (context === "card" && name === "tyre change") {
    return {
      url: "/images/workshop/owner/tyre-care-at-work.webp",
      altText: "Allied technician working beside tyre-changing equipment",
      width: 1600,
      height: 1067,
    };
  }
  if (service.image) return service.image;
  const approved = featuredServices.find((item) => item.name.toLowerCase() === name);
  if (!approved) return null;
  const illustrative = approved.key === "oil-service";
  return {
    url: `/images/workshop/owner/${approved.image}.webp`,
    altText: approved.alt,
    width: illustrative ? 800 : 1600,
    height: illustrative ? 600 : 1067,
    illustrative,
  };
}
