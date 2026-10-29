// Render supplies the canonical HTTPS URL; local Docker can set ORIGIN explicitly.
if (!process.env.ORIGIN && process.env.RENDER_EXTERNAL_URL) {
  process.env.ORIGIN = process.env.RENDER_EXTERNAL_URL;
}
await import("../build/index.js");
