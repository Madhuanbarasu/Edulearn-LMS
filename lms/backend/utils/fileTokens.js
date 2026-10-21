const jwt = require("jsonwebtoken");

const TTL_SECONDS = 120;
/** Short-lived, user-bound download token for a single stored file. */
const signFileToken = (userId, filename) =>
  jwt.sign({ purpose: "file", uid: String(userId), f: filename }, process.env.JWT_SECRET, { expiresIn: TTL_SECONDS, algorithm: "HS256" });

function verifyFileToken(token) {
  const d = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (d.purpose !== "file") throw new Error("wrong token purpose");
  return d;
}
module.exports = { signFileToken, verifyFileToken, TTL_SECONDS };
