import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export default defineConfig(({ command, isPreview }) => {
  const profile = process.env.BUNKERCODE_PROFILE;
  if (profile !== "authoring" && profile !== "public")
    throw new Error(
      "BUNKERCODE_PROFILE must explicitly be authoring or public",
    );
  const authoring = profile === "authoring";
  if (!authoring && command === "serve" && !isPreview)
    throw new Error(
      "Public profile requires a production build and static hosting/preview",
    );
  return {
    define: { __BUNKERCODE_AUTHORING__: JSON.stringify(authoring) },
    publicDir: authoring ? "public" : false,
    resolve: {
      alias: [
        {
          find: /^@bunkercode\/content$/,
          replacement: fileURLToPath(
            new URL("../../packages/content/src/index.ts", import.meta.url),
          ),
        },
        {
          find: /^@bunkercode\/tactics-core$/,
          replacement: fileURLToPath(
            new URL(
              "../../packages/tactics-core/src/index.ts",
              import.meta.url,
            ),
          ),
        },
      ],
    },
    build: {
      manifest: true,
      outDir: authoring ? "dist" : "dist-public",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("/@codemirror/state/") ||
              id.includes("/@codemirror/view/")
            )
              return "code-editor-core";
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(!authoring
        ? [
            {
              name: "public-asset-boundary",
              generateBundle(_options, bundle) {
                for (const item of Object.values(bundle))
                  if (
                    item.type === "chunk" &&
                    Object.keys(item.modules).some((id) =>
                      /(?:\/courses\/(?:Studio|VisualEditor|NewLessonDialog|studio-api)|\/@tiptap\/)/.test(
                        id,
                      ),
                    )
                  )
                    throw new Error("Authoring code reached the public build");
                // Explicit generic assets only. Future public/ files are not automatically published.
                const assets = [
                  "favicon.png",
                  "favicon.svg",
                  "brand/bunker.png",
                  ...[
                    "nodejs",
                    "postgresql",
                    "javascript",
                    "linux",
                    "typescript",
                    "docker",
                    "nestjs",
                    "git",
                  ].map((id) => `technologies/${id}.svg`),
                  "technologies/LICENSE.md",
                  "technologies/javascript-MIT-LICENSE.txt",
                ];
                for (const fileName of assets)
                  this.emitFile({
                    type: "asset",
                    fileName,
                    source: readFileSync(
                      new URL(`./public/${fileName}`, import.meta.url),
                    ),
                  });
              },
            } satisfies Plugin,
          ]
        : []),
    ],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: process.env.BUNKERCODE_API_URL ?? "http://127.0.0.1:3001",
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
