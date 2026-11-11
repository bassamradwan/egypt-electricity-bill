import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repository-name>.
// The deploy workflow sets BASE_PATH; locally it is empty, so the site runs at http://localhost:3000.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // A fully static site (plain HTML, CSS and JS in out/): no server is needed to host it.
  output: "export",
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
