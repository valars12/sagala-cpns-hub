import app from "./app";
import { env } from "./config/env";
import { seedDefaultDataIfNeeded } from "./utils/seed-defaults";

const port = env.PORT;
const shouldSeedOnBoot =
  process.env.SEED_ON_BOOT === "true" || env.NODE_ENV !== "production";

const startServer = async () => {
  try {
    if (shouldSeedOnBoot) {
      await seedDefaultDataIfNeeded();
    }

    app.listen(port, () => {
      console.log(`Sagala Bimbel API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
