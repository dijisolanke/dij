import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    // Dataset for CLI commands (e.g. `sanity dataset export`); the Studio itself has both.
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
  },
  // Hosted Studio: https://dijiofficial.sanity.studio (deploy with `npm run deploy`).
  studioHost: "dijiofficial",
  deployment: {
    appId: process.env.SANITY_APP_ID,
  },
});
