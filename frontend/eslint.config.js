import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // ThemeContext intentionally co-exports a hook alongside a component.
      "react-refresh/only-export-components": "off",
      // useHistoryStore intentionally keeps selector param and useCallback for future use.
      "@typescript-eslint/no-unused-vars": "off",
      // Allow explicit any where react-markdown types are loose.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
