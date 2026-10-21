import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { openProtectedFile } from "../utils/files";

export default function AssignmentsTab({ courseId, user }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", maxMarks: 100 });
  const [attachment, setAttachment] = useState(null);
  const [creating, setCreating] = useState(false);

  // Submissions state
  const [expanded, setExpanded] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [mySubs, setMySubs] = useState({});
  const [loadingSubs, setLoadingSubs] = useState(false);

  const isFaculty = user?.role === "faculty" || user?.role === "admin";

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assignments/course/${courseId}`);
      setAssignments(res.data);
    } catch (err) {
      setError("Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [courseId]);

  const loadSubmissions = async (assignmentId) => {
    setLoadingSubs(true);
    try {
      if (isFaculty) {
        const res = await api.get(`/assignments/${assignmentId}/submissions`);
        setSubmissions((s) => ({ ...s, [assignmentId]: res.data }));
      } else {
        const res = await api.get(`/assignments/${assignmentId}/my-submission`);
        setMySubs((s) => ({ ...s, [assignmentId]: res.data }));
      }
    } catch (err) {
      setError("Failed to load submissions.");
    } finally {
      setLoadingSubs(false);
    }
  };

  const toggleExpand = (a) => {
    const next = expanded === a._id ? null : a._id;
    setExpanded(next);
    if (next) loadSubmissions(a._id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) {
      setError("Please provide title and due date.");
      return;
    }
    setError("");
    setSuccess("");
    setCreating(true);

    const fd = new FormData();
    fd.append("course", courseId);
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("dueDate", form.dueDate);
    fd.append("maxMarks", form.maxMarks || 100);
    if (attachment) fd.append("file", attachment);

    try {
      await api.post("/assignments", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ title: "", description: "", dueDate: "", maxMarks: 100 });
      setAttachment(null);
      setShowCreate(false);
      setSuccess("Assignment published successfully!");
      loadAssignments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create assignment.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId, title) => {
    if (!window.confirm(`Delete assignment "${title}" and all its submissions?`)) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/assignments/${assignmentId}`);
      setSuccess("Assignment deleted.");
      loadAssignments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete assignment.");
    }
  };

  const handleSubmitAssignment = async (assignmentId, file, textAnswer) => {
    setError("");
    setSuccess("");
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (textAnswer) fd.append("textAnswer", textAnswer);

    try {
      await api.post(`/assignments/${assignmentId}/submit`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess("Assignment submitted successfully!");
      loadSubmissions(assignmentId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit assignment.");
    }
  };

  const handleGrade = async (submissionId, marksObtained, feedback, assignmentId) => {
    setError("");
    setSuccess("");
    try {
      await api.put(`/assignments/submissions/${submissionId}/grade`, { marksObtained, feedback });
      setSuccess("Grade saved successfully!");
      loadSubmissions(assignmentId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save grade.");
    }
  };

  const openFile = async (url) => {
    const problem = await openProtectedFile(url);
    if (problem) setError(problem);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assignments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFaculty
              ? "Create project prompts, track submissions, and evaluate student work."
              : "Review deadlines, upload your solutions, and view faculty marks."}
          </p>
        </div>

        {isFaculty && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
          >
            {showCreate ? "Cancel" : "+ New Assignment"}
          </button>
        )}
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

      {/* Create Assignment Form */}
      {showCreate && isFaculty && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in duration-150">
          <h3 className="text-base font-bold text-slate-900 mb-4">Create New Assignment</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Assignment Title *
              </label>
              <input
                placeholder="e.g. Problem Set 1: Graph Theory"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Description / Instructions
              </label>
              <textarea
                rows="3"
                placeholder="Provide detailed instructions, formatting guidelines, or problem prompts..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Due Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Maximum Marks
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.maxMarks}
                  onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Reference File (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachment(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                />
              </div>
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
                disabled={creating}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              >
                {creating ? "Publishing..." : "Publish Assignment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assignments List */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading assignments...</p>
        </div>
      ) : assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((a) => {
            const isExpanded = expanded === a._id;
            const isOverdue = new Date() > new Date(a.dueDate);
            const mySub = mySubs[a._id];

            return (
              <div
                key={a._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          Max: {a.maxMarks} pts
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            isOverdue
                              ? "bg-rose-50 text-rose-700"
                              : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {isOverdue ? "Overdue · " : ""}Due: {new Date(a.dueDate).toLocaleString()}
                        </span>

                        {!isFaculty && mySub && (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md capitalize ${
                              mySub.status === "graded"
                                ? "bg-emerald-50 text-emerald-700"
                                : mySub.status === "late"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {mySub.status}
                          </span>
                        )}
                        {!isFaculty && mySub && mySub.isLate && mySub.status === "graded" && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">Submitted late</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{a.title}</h3>
                      {a.description && (
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                          {a.description}
                        </p>
                      )}
                      {a.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() => openFile(a.attachmentUrl)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                        >
                          <span>📎 Download Attachment</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleExpand(a)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                          isExpanded
                            ? "bg-slate-100 text-slate-700"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                        }`}
                      >
                        {isExpanded
                          ? "Hide Details"
                          : isFaculty
                          ? "Submissions & Grading"
                          : "Submit / View Grade"}
                      </button>

                      {isFaculty && (
                        <button
                          onClick={() => handleDeleteAssignment(a._id, a.title)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs"
                          title="Delete assignment"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Submissions or Student Upload Panel */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-6">
                    {loadingSubs ? (
                      <p className="text-xs text-slate-500 text-center py-4">Loading submission data...</p>
                    ) : user.role === "student" ? (
                      <StudentSubmissionForm
                        assignment={a}
                        mySubmission={mySubs[a._id]}
                        onSubmit={(file, text) => handleSubmitAssignment(a._id, file, text)}
                        openFile={openFile}
                      />
                    ) : (
                      <FacultySubmissionsList
                        assignment={a}
                        submissions={submissions[a._id] || []}
                        onGrade={(subId, marks, fb) => handleGrade(subId, marks, fb, a._id)}
                        openFile={openFile}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <div className="text-3xl mb-2">📝</div>
          <p className="text-sm font-medium text-slate-600">No assignments posted for this course yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            {isFaculty ? "Click '+ New Assignment' above to create one." : "Check back later for upcoming assignments."}
          </p>
        </div>
      )}
    </div>
  );
}

function StudentSubmissionForm({ assignment, mySubmission, onSubmit, openFile }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !text.trim()) {
      alert("Please provide a file attachment or a written answer.");
      return;
    }
    setSubmitting(true);
    await onSubmit(file, text.trim());
    setSubmitting(false);
    setText("");
    setFile(null);
  };

  const isPastDue = new Date() > new Date(assignment.dueDate);
  const locked = mySubmission?.status === "graded";

  return (
    <div className="space-y-4">
      {mySubmission ? (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Your Submission</span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                mySubmission.status === "graded"
                  ? "bg-emerald-100 text-emerald-800"
                  : mySubmission.status === "late"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              Status: {mySubmission.status}
            </span>
          </div>
          {mySubmission.isLate && (
            <div className="text-xs font-semibold text-amber-700">⚠ This work was submitted after the due date and is marked late.</div>
          )}

          <div className="text-xs text-slate-500">
            Submitted at: {new Date(mySubmission.submittedAt).toLocaleString()}
          </div>

          {mySubmission.textAnswer && (
            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-700">
              <strong className="block text-slate-900 mb-1">Written Response:</strong>
              {mySubmission.textAnswer}
            </div>
          )}

          {mySubmission.fileUrl && (
            <div>
              <button
                type="button"
                onClick={() => openFile(mySubmission.fileUrl)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <span>📎 Download Your Submitted File</span>
              </button>
            </div>
          )}

          {mySubmission.status === "graded" && (
            <div className="mt-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="text-sm font-bold text-emerald-900">
                Grade: {mySubmission.marksObtained} / {assignment.maxMarks} pts
              </div>
              {mySubmission.feedback && (
                <p className="text-xs text-emerald-800 mt-1">
                  <strong>Instructor Feedback:</strong> {mySubmission.feedback}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
          You have not submitted this assignment yet.
        </div>
      )}

      {locked && (
        <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium" role="status">
          This submission has been graded and is now locked. Contact your instructor if you believe it needs to be reopened.
        </div>
      )}
      {!locked && isPastDue && (
        <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium" role="status">
          The due date has passed. Late submissions are accepted but will be marked as late.
        </div>
      )}

      {/* Submission Form */}
      {!locked && (
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {mySubmission ? "Resubmit / Update Your Solution" : "Submit Your Assignment"}
        </h4>
        <textarea
          rows="3"
          placeholder="Type or paste your text response here (optional if uploading a file)..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Upload Solution Document (Max 10MB)
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
        >
          {submitting ? "Uploading..." : mySubmission ? "Submit Revision" : "Submit Assignment"}
        </button>
      </form>
      )}
    </div>
  );
}

function FacultySubmissionsList({ assignment, submissions, onGrade, openFile }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Student Submissions ({submissions.length})
        </h4>
      </div>

      {submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((s) => (
            <GradeRow
              key={s._id}
              assignment={assignment}
              submission={s}
              onGrade={onGrade}
              openFile={openFile}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
          No student submissions received for this assignment yet.
        </div>
      )}
    </div>
  );
}

function GradeRow({ assignment, submission, onGrade, openFile }) {
  const [marks, setMarks] = useState(submission.marksObtained ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (marks === "") {
      alert("Please enter marks before saving.");
      return;
    }
    if (Number(marks) < 0 || Number(marks) > Number(assignment.maxMarks)) {
      alert(`Marks must be between 0 and ${assignment.maxMarks}.`);
      return;
    }
    setSaving(true);
    await onGrade(submission._id, Number(marks), feedback);
    setSaving(false);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-bold text-sm text-slate-900">
            {submission.student?.name}
          </span>
          <span className="text-xs text-slate-500 ml-2">
            ({submission.student?.rollNumber || submission.student?.email})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
              submission.status === "graded"
                ? "bg-emerald-50 text-emerald-700"
                : submission.status === "late"
                ? "bg-amber-50 text-amber-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {submission.status}
          </span>
          {submission.isLate && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">Late</span>}
          <span className="text-xs text-slate-400">
            {new Date(submission.submittedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Answers */}
      {submission.textAnswer && (
        <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700">
          <strong className="text-slate-900">Student Answer:</strong> {submission.textAnswer}
        </div>
      )}

      {submission.fileUrl && (
        <div>
          <button
            type="button"
            onClick={() => openFile(submission.fileUrl)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            <span>📥 View/Download Student File</span>
          </button>
        </div>
      )}

      {/* Grading Inputs */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max={assignment.maxMarks}
            placeholder="Score"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="w-20 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400">/ {assignment.maxMarks}</span>
        </div>

        <input
          placeholder="Instructor feedback..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Grade"}
        </button>
      </div>
    </div>
  );
}
