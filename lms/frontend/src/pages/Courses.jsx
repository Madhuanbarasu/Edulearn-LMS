import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", code: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Edit Modal State
  const [editingCourse, setEditingCourse] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", code: "", description: "" });
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const myRes = await api.get("/courses");
      setCourses(myRes.data);

      if (user?.role === "student" || user?.role === "admin") {
        const allRes = await api.get("/courses/all");
        setAllCourses(allRes.data);
      }
    } catch (err) {
      setError("Failed to load courses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      await api.post("/courses", createForm);
      setCreateForm({ title: "", code: "", description: "" });
      setShowCreateForm(false);
      setSuccess("Course created successfully!");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create course.");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUpdating(true);
    try {
      await api.put(`/courses/${editingCourse._id}`, editForm);
      setEditingCourse(null);
      setSuccess("Course updated successfully!");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update course.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (courseId, courseTitle) => {
    if (!window.confirm(`Are you sure you want to delete the course "${courseTitle}"? Courses that already have assignments, quizzes, attendance or discussions cannot be deleted.`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.delete(`/courses/${courseId}`);
      setSuccess("Course deleted successfully.");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete course.");
    }
  };

  const handleEnroll = async (id) => {
    setError("");
    setSuccess("");
    try {
      await api.post(`/courses/${id}/enroll`);
      setSuccess("Enrolled successfully!");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not enroll in course.");
    }
  };

  const handleUnenroll = async (id, title) => {
    if (!window.confirm(`Are you sure you want to unenroll from "${title}"?`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.post(`/courses/${id}/unenroll`);
      setSuccess("Unenrolled successfully.");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not unenroll from course.");
    }
  };

  const enrolledIds = new Set(courses.map((c) => c._id));

  const filteredAvailableCourses = allCourses.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.faculty?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Courses</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.role === "faculty"
              ? "Create and manage your course curricula, materials, and student cohorts."
              : "Access your enrolled courses or discover new courses to join."}
          </p>
        </div>

        {user?.role === "faculty" && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
          >
            {showCreateForm ? "Close Form" : "+ Create Course"}
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700 font-bold">
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Faculty Create Course Drawer/Card */}
      {showCreateForm && user?.role === "faculty" && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-indigo-100 mb-8 animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Create a New Course</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Course Title *
                </label>
                <input
                  placeholder="e.g. Data Structures and Algorithms"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Course Code *
                </label>
                <input
                  placeholder="e.g. CS201 (Must be unique)"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows="3"
                placeholder="Overview of topics, prerequisites, and learning goals..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              >
                {creating ? "Publishing..." : "Publish Course"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Tabs / Lists */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading courses...</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section: My Courses */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {user?.role === "faculty" ? "Courses You Teach" : "Your Enrolled Courses"}
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {courses.length} {courses.length === 1 ? "Course" : "Courses"}
              </span>
            </div>

            {courses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((c) => (
                  <div
                    key={c._id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                          {c.code}
                        </span>
                        {user?.role === "student" && (
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Enrolled
                          </span>
                        )}
                        {user?.role === "faculty" && (
                          <span className="text-xs text-slate-500">
                            {c.studentCount ?? c.students?.length ?? 0} students
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                        {c.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                        {c.description || "No course description provided."}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Link
                        to={`/courses/${c._id}`}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition"
                      >
                        Open Course &rarr;
                      </Link>

                      {user?.role === "faculty" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCourse(c);
                              setEditForm({
                                title: c.title,
                                code: c.code,
                                description: c.description || "",
                              });
                            }}
                            className="p-1.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
                            title="Edit Course"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c._id, c.title)}
                            className="p-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="Delete Course"
                          >
                            🗑️
                          </button>
                        </div>
                      )}

                      {user?.role === "student" && (
                        <button
                          onClick={() => handleUnenroll(c._id, c.title)}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          Unenroll
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                <p className="text-sm font-medium">No courses found in your schedule.</p>
                <p className="text-xs text-slate-400 mt-1">
                  {user?.role === "faculty"
                    ? "Click '+ Create Course' above to publish your first course."
                    : "Browse available courses below and click 'Enroll' to start learning."}
                </p>
              </div>
            )}
          </div>

          {/* Section: Available Courses for Students */}
          {user?.role === "student" && (
            <div className="pt-6 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Explore Available Courses</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Find new subjects and expand your learning horizons.
                  </p>
                </div>
                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search by code, title, or faculty..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {filteredAvailableCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAvailableCourses.map((c) => {
                    const isEnrolled = enrolledIds.has(c._id);
                    return (
                      <div
                        key={c._id}
                        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                              {c.code}
                            </span>
                            {isEnrolled && (
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Enrolled
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mb-1">{c.title}</h3>
                          <p className="text-xs text-slate-500 mb-2">
                            Instructor: <span className="font-medium text-slate-700">{c.faculty?.name || "Faculty"}</span>
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {c.description || "No description available."}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                          {isEnrolled ? (
                            <Link
                              to={`/courses/${c._id}`}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition"
                            >
                              Go to Course &rarr;
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleEnroll(c._id)}
                              className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                            >
                              Enroll Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                  <p className="text-sm">No courses matching "{searchQuery}".</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Course Details</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Course Title *
                </label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Course Code *
                </label>
                <input
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
