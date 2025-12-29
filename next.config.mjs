import lingoCompiler from "lingo.dev/compiler";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Enable WebAssembly for physics engines / Three.js extensions
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default lingoCompiler.next({
  sourceRoot: "app",
  sourceLocale: "en",
  targetLocales: ["hi"],
  models: {
    "*:*": "google:gemini-2.5-flash",
  },
})(nextConfig);
