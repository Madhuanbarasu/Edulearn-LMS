const notFound = (req, res) => res.status(404).json({ message: "Route not found" });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "File size exceeds 10MB limit" });
    return res.status(400).json({ message: "Invalid file upload" });
  }
  if (err.status === 400 && err.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ message: "Request body too large" });
  if (err.isUploadError) return res.status(400).json({ message: err.message });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid identifier" });
  if (err.name === "ValidationError") return res.status(400).json({ message: "Invalid data supplied" });
  // Never leak stack traces or internals.
  console.error("Server Error:", err.name || "Error");
  res.status(500).json({ message: "Something went wrong on the server" });
};

module.exports = { notFound, errorHandler };
