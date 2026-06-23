import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [tailwind()],
  output: "static",
  redirects: {
    '/maia_plagas': '/maiaplagas',
    '/convertidor': '/calculadora',
    '/food': '/inocuidad-calidad',
    '/sanidad': '/saneamiento'
  }
});
