import lingoCompiler from "lingo.dev/compiler";

/** @type {import('next').NextConfig} */
const config = {};

const withLingo = lingoCompiler.next({
    sourceRoot: "app",
    sourceLocale: "en",
    targetLocales: ["es", "fr", "de"],
    rsc: true,
    models: {
        "*:*": "google:gemini-2.5-flash",
    },
});

export default withLingo(config);


