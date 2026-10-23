const dns = require("dns");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

if (process.env.DNS_SERVERS) {
  dns.setServers(
    process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean)
  );
}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
  });

  const Admin = mongoose.model(
    "Admin",
    new mongoose.Schema(
      { email: String, passwordHash: String, name: String },
      { timestamps: true, strict: false }
    )
  );

  const hash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD,
    Number(process.env.BCRYPT_SALT_ROUNDS || 12)
  );

  const result = await Admin.updateOne(
    { email: process.env.ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        passwordHash: hash,
        name: process.env.ADMIN_NAME,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    },
    { upsert: true }
  );

  console.log(
    `Admin ${result.upsertedCount ? "created" : "updated"} — matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
