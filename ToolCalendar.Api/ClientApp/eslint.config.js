// ESLint config (Flat config, ESLint v9+)
// Chuẩn: React best practices + accessibility + security

import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import noSecrets from "eslint-plugin-no-secrets";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "no-secrets": noSecrets,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        Event: "readonly",
        AbortController: "readonly",
        navigator: "readonly",
        confirm: "readonly",
        alert: "readonly",
        history: "readonly",
        location: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        Worker: "readonly",
        WebSocket: "readonly",
        crypto: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // ─── React Rules ─────────────────────────────────────────────────────────
      "react/react-in-jsx-scope": "off",           // Không cần import React (React 17+)
      "react/prop-types": "warn",                  // Cảnh báo nếu thiếu PropTypes
      "react/jsx-key": "error",                    // Bắt buộc có key trong list render
      "react/no-array-index-key": "warn",          // Hạn chế dùng index làm key
      "react/self-closing-comp": "warn",           // Ưu tiên self-closing tag

      // ─── React Hooks Rules ───────────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",       // Bắt buộc tuân thủ luật Hooks
      "react-hooks/exhaustive-deps": "warn",       // Cảnh báo thiếu deps trong useEffect

      // ─── Security Rules ──────────────────────────────────────────────────────
      "no-secrets/no-secrets": ["error", { tolerance: 4.2 }], // Chặn cứng mật khẩu/API key
      "no-eval": "error",                          // Cấm tuyệt đối dùng eval()
      "no-implied-eval": "error",                  // Cấm setTimeout('code string')
      "no-new-func": "error",                      // Cấm new Function()

      // ─── Code Quality Rules ───────────────────────────────────────────────────
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }], // Không để console.log trong code
      "no-debugger": "error",                      // Cấm để debugger trong code
      "no-alert": "warn",                          // Hạn chế dùng alert()
      "prefer-const": "error",                     // Ưu tiên const thay cho let
      "no-var": "error",                           // Cấm dùng var (dùng const/let)
      "eqeqeq": ["error", "always"],              // Bắt buộc dùng === thay ===
      "no-duplicate-imports": "error",             // Không duplicate import
      "no-return-await": "error",                  // Không return await trong async fn
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "../wwwroot/vite-assets/**",
      "scripts/**",
    ],
  },
];
