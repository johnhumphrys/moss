import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "dist-electron", "coverage", "node_modules"]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["electron/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node
    }
  }
);
