import api, { API_ORIGIN } from "../api/axios";

/**
 * Stored files are private. This asks the API for a short-lived link (the server checks that the signed-in
 * user may read this file) and then downloads it. Resolves to an error message string on failure, else null.
 */
export async function openProtectedFile(fileUrl) {
  try {
    const name = String(fileUrl || "").replace(/^\/?uploads\//, "");
    const res = await api.get("/files/access", { params: { name } });
    const a = document.createElement("a");
    a.href = `${API_ORIGIN}${res.data.url}`;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return null;
  } catch (err) {
    return err.response?.data?.message || "Could not open this file.";
  }
}
