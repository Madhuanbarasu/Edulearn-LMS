require("dotenv").config();

// Optional DNS override (kept from the original project: helps some networks resolve Atlas SRV records).
// Unset = original behaviour (Google/Cloudflare). Set DNS_SERVERS="" to disable, or to a custom list.
const dnsServers = process.env.DNS_SERVERS === undefined ? "8.8.8.8,1.1.1.1" : process.env.DNS_SERVERS;
if (dnsServers.trim()) require("node:dns").setServers(dnsServers.split(",").map((s) => s.trim()));

const { validateEnv } = require("./config/env");
const problems = validateEnv();
if (problems.length) {
  console.error("Configuration problems (see .env.example):\n - " + problems.join("\n - "));
  process.exit(1);
}

const connectDB = require("./config/db");
const app = require("./app");

connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
