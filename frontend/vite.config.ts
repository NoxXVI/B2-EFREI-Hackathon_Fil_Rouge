import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    DEV: JSON.stringify(process.env.NODE_ENV === "development"),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    "process.env.TEST_NATIVE_PLATFORM": JSON.stringify("web"),
  },
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
  },
});
