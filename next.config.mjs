import lingoCompiler from "lingo.dev/compiler";

/** @type {import('next').NextConfig} */
const config = {};

const withLingo = lingoCompiler.next({
    sourceRoot: "app",
    sourceLocale: "en",
    targetLocales: ["es", "fr", "de", "hi", "ja", "ko", "pt", "ru", "zh", "ar", "bn", "id", "it", "th", "vi"],
    rsc: true,
    models: {
        "*:*": "google:gemini-2.5-flash",
    },
});

export default withLingo(config);


