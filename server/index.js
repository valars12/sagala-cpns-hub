const fs = require("node:fs");
const path = require("node:path");

const entryFile = path.join(__dirname, "dist", "index.js");

if (!fs.existsSync(entryFile)) {
  console.error(
    "[Sagala Bimbel] Build file tidak ditemukan: dist/index.js. Jalankan `npm run build`."
  );
  process.exit(1);
}

require(entryFile);
