import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function ForumTab({ courseId, user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [posting, setPosting] = useState(false);
  const [commentText, setCommentText] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/forum/course/${courseId}`);
      setPosts(res.data);
    } catch (err) {
      setError("Failed to load forum discussions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [courseId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Please provide both title and body for the post.");
      return;
    }
    setError("");
    setSuccess("");
    setPosting(true);
    try {
      await api.post("/forum", { ...form, course: courseId });
      setForm({ title: "", body: "" });
      setShowCreate(false);
      setSuccess("Discussion post published!");
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish post.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId, postTitle) => {
    if (!window.confirm(`Delete post "${postTitle}"?`)) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/forum/${postId}`);
      setSuccess("Post deleted.");
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete post.");
    }
  };

  const handleComment = async (postId) => {
    const text = (commentText[postId] || "").trim();
    if (!text) return;

    setError("");
    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      await api.post(`/forum/${postId}/comments`, { text });
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to post comment.");
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await api.delete(`/forum/${postId}/comments/${commentId}`);
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete comment.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Discussion Forum</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask questions, exchange ideas, and collaborate with peers and course instructors.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
        >
          {showCreate ? "Cancel" : "+ Start a Discussion"}
        </button>
      </div>

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

      {/* Create Post Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4 animate-in fade-in duration-150">
          <h3 className="text-base font-bold text-slate-900">Start a New Discussion Thread</h3>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Discussion Topic / Title *
            </label>
            <input
              placeholder="e.g. Clarification regarding Assignment 2 Question 3"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Message / Details *
            </label>
            <textarea
              rows="4"
              placeholder="Provide background, questions, or code snippets for discussion..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            >
              {posting ? "Posting..." : "Post Discussion"}
            </button>
          </div>
        </form>
      )}

      {/* Posts List */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading discussions...</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((p) => {
            const isAuthor = String(p.author?._id) === String(user?._id);
            const canDeletePost = isAuthor || user?.role === "faculty" || user?.role === "admin";

            return (
              <div
                key={p._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Post Header & Body */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{p.author?.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                          {p.author?.role}
                        </span>
                        <span>&bull;</span>
                        <span>{new Date(p.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {canDeletePost && (
                      <button
                        onClick={() => handleDeletePost(p._id, p.title)}
                        className="text-xs text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        title="Delete discussion"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {p.body}
                  </p>
                </div>

                {/* Comments Section */}
                <div className="bg-slate-50 border-t border-slate-200 p-6 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Responses ({p.comments?.length || 0})
                  </h4>

                  {p.comments?.length > 0 && (
                    <div className="space-y-2.5">
                      {p.comments.map((c) => {
                        const isCommentAuthor = String(c.author?._id) === String(user?._id);
                        const canDeleteComment =
                          isCommentAuthor || user?.role === "faculty" || user?.role === "admin";

                        return (
                          <div
                            key={c._id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start justify-between gap-3 shadow-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-900">{c.author?.name}</span>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  ({c.author?.role})
                                </span>
                                {c.createdAt && (
                                  <span className="text-[10px] text-slate-400">
                                    &bull; {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-800 leading-normal">{c.text}</p>
                            </div>

                            {canDeleteComment && (
                              <button
                                onClick={() => handleDeleteComment(p._id, c._id)}
                                className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                                title="Delete comment"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Comment Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      placeholder="Write a reply..."
                      value={commentText[p._id] || ""}
                      onChange={(e) =>
                        setCommentText((prev) => ({ ...prev, [p._id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleComment(p._id);
                        }
                      }}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      onClick={() => handleComment(p._id)}
                      disabled={submittingComment[p._id] || !commentText[p._id]?.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
                    >
                      {submittingComment[p._id] ? "Replying..." : "Reply"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <div className="text-3xl mb-2">💬</div>
          <p className="text-sm font-medium text-slate-600">No discussions initiated yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Be the first to start a conversation by clicking "+ Start a Discussion" above.
          </p>
        </div>
      )}
    </div>
  );
}
