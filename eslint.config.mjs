// @ts-check
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "test/**", "out/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@stylistic": stylistic,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // Unused vars
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn",

      // Complexity limits
      complexity: ["error", 10],
      "max-lines": ["error", { max: 260, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "max-statements-per-line": ["error", { max: 1 }],

      // Line length (ignore strings, template literals, URLs, regex)
      "max-len": ["error", {
        code: 100,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreUrls: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
      }],

      // 2-space indentation
      "@stylistic/indent": ["error", 2, { SwitchCase: 1 }],
    },
  },
];
