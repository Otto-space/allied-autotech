import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Allied AutoTech",
    short_name: "Allied",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#06181f",
    icons: [
      {
        src: "/brand/allied-favicon-v1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
