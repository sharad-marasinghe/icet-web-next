import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iCET - Institute of Computer Engineering Technology",
    short_name: "iCET",
    description: "Software Engineering Courses in Sri Lanka",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#046bd2",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
