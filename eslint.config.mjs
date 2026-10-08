import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".bunkercode/**",
      ".bunkerlab/**",
      ".backendlab/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/backend/**/*.cjs", "content/**/*.cjs"],
    languageOptions: {
      globals: {
        require: "readonly",
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["content/**/starter.ts"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { args: "none" }] },
  },
);
