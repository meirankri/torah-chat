import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const ignoreWellKnown = (): Plugin => ({
  name: "ignore-well-known",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/.well-known/")) {
        res.statusCode = 404;
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [
    ignoreWellKnown(),
    cloudflare({ viteEnvironment: { name: "ssr" }, persistState: true }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
