import React, { useState } from "react";
import api from "../api/axios";
import { openProtectedFile } from "../utils/files";

export default function MaterialsTab({ course, user, setCourse, onReload }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isFaculty =
    user?.role === "faculty" && String(course.faculty?._id || course.faculty) === String(user._id);
  const isAdmin = user?.role === "admin";
  const canManage = isFaculty || isAdmin;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the material.");
      return;
    }
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB maximum limit.");
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("file", file);

    try {
      const res = await api.post(`/courses/${course._id}/materials`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCourse(res.data);
      setTitle("");
      setFile(null);
      // Reset file input element
      const fileInput = document.getElementById("material-file-input");
      if (fileInput) fileInput.value = "";
      setSuccess("Material uploaded successfully!");
      if (onReload) onReload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload material.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId, materialTitle) => {
    if (!window.confirm(`Delete material "${materialTitle}"?`)) return;
    setError("");
    setSuccess("");
    try {
      const res = await api.delete(`/courses/${course._id}/materials/${materialId}`);
      setCourse(res.data);
      setSuccess("Material deleted.");
      if (onReload) onReload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete material.");
    }
  };

  const openFile = async (url) => {
    setError("");
    const problem = await openProtectedFile(url);
    if (problem) setError(problem);
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-500 font-bold">&times;</button>
        </div>
      )}

      {/* Upload Form for Course Faculty */}
      {canManage && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-1">Upload New Course Material</h3>
          <p className="text-xs text-slate-500 mb-4">
            Supported formats: PDF, DOCX, PPTX, TXT, ZIP, Images. Max file size: 10MB.
          </p>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Material Title *
                </label>
                <input
                  placeholder="e.g. Week 1 - Lecture Slides & Notes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Choose Document / File *
                </label>
                <input
                  id="material-file-input"
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  "Upload Material"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Materials List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Curriculum Documents &amp; Files</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {course.materials?.length || 0} files
          </span>
        </div>

        {course.materials?.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {course.materials.map((m, idx) => (
              <div
                key={m._id || idx}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg flex-shrink-0">
                    📄
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-slate-900 truncate">{m.title}</h4>
                    <p className="text-xs text-slate-400">
                      Uploaded {m.uploadedAt ? new Date(m.uploadedAt).toLocaleDateString() : "recently"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openFile(m.fileUrl)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition inline-flex items-center gap-1.5"
                  >
                    <span>Download / View</span>
                    <span>&darr;</span>
                  </button>

                  {canManage && (
                    <button
                      onClick={() => handleDeleteMaterial(m._id, m.title)}
                      className="p-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                      title="Delete material"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-medium text-slate-500">No course materials uploaded yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              {canManage
                ? "Use the upload form above to add lecture slides, notes, or readings."
                : "Your instructor has not posted any materials for this course yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
