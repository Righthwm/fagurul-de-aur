import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fagurul de Aur — Admin",
    short_name: "FdA Admin",
    description: "Panoul de administrare al magazinului Fagurul de Aur",
    start_url: "/admin",
    display: "standalone",
    background_color: "#0D0A06",
    theme_color: "#0D0A06",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/admin-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
