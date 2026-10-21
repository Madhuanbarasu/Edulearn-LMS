import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";

export default function QuizzesTab({ courseId, user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isFaculty = user?.role === "faculty" || user?.role === "admin";

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/quizzes/course/${courseId}`);
      setQuizzes(res.data);
    } catch (err) {
      setError("Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [courseId]);

  const handleDeleteQuiz = async (quizId, title) => {
    if (!window.confirm(`Delete quiz "${title}" and all student attempt records?`)) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/quizzes/${quizId}`);
      setSuccess("Quiz deleted successfully.");
      if (activeQuiz === quizId) setActiveQuiz(null);
      loadQuizzes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete quiz.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quizzes &amp; Tests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFaculty
              ? "Design auto-graded objective quizzes and inspect student performance distribution."
              : "Take online assessments and view instantaneous feedback and scores."}
          </p>
        </div>

        {isFaculty && (
          <button
            onClick={() => setCreating(!creating)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
          >
            {creating ? "Cancel" : "+ Create New Quiz"}
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

      {/* Quiz Creator Form */}
      {creating && isFaculty && (
        <QuizCreateForm
          courseId={courseId}
          onCreated={() => {
            setCreating(false);
            setSuccess("Quiz created successfully!");
            loadQuizzes();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Quizzes List */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading quizzes...</p>
        </div>
      ) : quizzes.length > 0 ? (
        <div className="space-y-4">
          {quizzes.map((q) => {
            const isExpanded = activeQuiz === q._id;
            return (
              <div
                key={q._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          {q.questions?.length || 0} Questions
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          ⏱️ {q.duration} Minutes
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{q.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Active: {new Date(q.startTime).toLocaleString()} &mdash; {new Date(q.endTime).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setActiveQuiz(isExpanded ? null : q._id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                          isExpanded
                            ? "bg-slate-100 text-slate-700"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                        }`}
                      >
                        {isExpanded
                          ? "Close"
                          : isFaculty
                          ? "View Submissions"
                          : "Start / View Result"}
                      </button>

                      {isFaculty && (
                        <button
                          onClick={() => handleDeleteQuiz(q._id, q.title)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs"
                          title="Delete quiz"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submissions or Taking Quiz View */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-6">
                    {user.role === "student" ? (
                      <StudentQuiz quizId={q._id} />
                    ) : (
                      <FacultyResults quizId={q._id} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <div className="text-3xl mb-2">🎯</div>
          <p className="text-sm font-medium text-slate-600">No quizzes scheduled for this course yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            {isFaculty ? "Click '+ Create New Quiz' above to draft questions." : "Check back later for tests."}
          </p>
        </div>
      )}
    </div>
  );
}

function QuizCreateForm({ courseId, onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(15);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [questions, setQuestions] = useState([
    { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0, marks: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const updateQuestion = (idx, field, value) => {
    const next = [...questions];
    next[idx][field] = value;
    setQuestions(next);
  };

  const updateOption = (qIdx, oIdx, value) => {
    const next = [...questions];
    next[qIdx].options[oIdx] = value;
    setQuestions(next);
  };

  const addOption = (qIdx) => {
    const next = [...questions];
    next[qIdx].options.push("");
    setQuestions(next);
  };

  const removeQuestion = (qIdx) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qIdx));
  };

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0, marks: 1 },
    ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim() || !startTime || !endTime) {
      setFormError("Please fill in title, start time, and end time.");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setFormError(`Question #${i + 1} is missing the question prompt.`);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        setFormError(`All options in Question #${i + 1} must be filled.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post("/quizzes", {
        course: courseId,
        title: title.trim(),
        duration: Number(duration),
        startTime,
        endTime,
        questions,
      });
      onCreated();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to create quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-5 animate-in fade-in duration-150">
      <h3 className="text-base font-bold text-slate-900">Create New Quiz</h3>

      {formError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {formError}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
          Quiz Title *
        </label>
        <input
          placeholder="e.g. Midterm Quiz: Database Modeling"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
            Duration (Minutes)
          </label>
          <input
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
            Start Time *
          </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
            End Time *
          </label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Dynamic Questions Builder */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Questions ({questions.length})
          </label>
          <button
            type="button"
            onClick={addQuestion}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            + Add Another Question
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Question {qIdx + 1}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Marks:</span>
                  <input
                    type="number"
                    min="1"
                    value={q.marks}
                    onChange={(e) => updateQuestion(qIdx, "marks", Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-slate-300 text-xs"
                  />
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <input
              placeholder="Enter question text..."
              value={q.questionText}
              onChange={(e) => updateQuestion(qIdx, "questionText", e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">
                Options (Select the radio of the correct answer):
              </span>
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-opt-${qIdx}`}
                    checked={q.correctOptionIndex === oIdx}
                    onChange={() => updateQuestion(qIdx, "correctOptionIndex", oIdx)}
                    className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                    title="Mark as correct answer"
                  />
                  <input
                    placeholder={`Option ${oIdx + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    required
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              ))}
              {q.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => addOption(qIdx)}
                  className="text-[11px] text-indigo-600 hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
        >
          {submitting ? "Publishing Quiz..." : "Publish Quiz"}
        </button>
      </div>
    </form>
  );
}

function StudentQuiz({ quizId }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [myAttempt, setMyAttempt] = useState(null);
  const [checked, setChecked] = useState(false); // have we looked for an existing attempt yet?
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(null); // seconds, from the server clock
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const answersRef = useRef([]);
  const autoSubmitted = useRef(false);

  // Step 1: only look for a finished attempt. Opening the quiz (which starts the server-side clock) is explicit.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const attemptRes = await api.get(`/quizzes/${quizId}/my-attempt`);
        if (!alive) return;
        setMyAttempt(attemptRes.data);
        if (attemptRes.data) {
          const quizRes = await api.get(`/quizzes/${quizId}/attempt`);
          if (alive) setQuiz(quizRes.data);
        }
      } catch (err) {
        if (alive) setError(err.response?.data?.message || "Failed to load quiz.");
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [quizId]);

  const startQuiz = async () => {
    setError("");
    try {
      const res = await api.get(`/quizzes/${quizId}/attempt`);
      setQuiz(res.data);
      const blank = new Array(res.data.questions.length).fill(-1);
      answersRef.current = blank;
      setAnswers(blank);
      setRemaining(res.data.remainingSeconds);
      setStarted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start the quiz.");
    }
  };

  // Countdown: the server is the authority; this is only a display plus an auto-submit convenience.
  useEffect(() => {
    if (!started || myAttempt || remaining === null) return undefined;
    const t = setInterval(() => setRemaining((r) => (r === null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(t);
  }, [started, myAttempt, remaining === null]);

  const doSubmit = async (auto = false) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post(`/quizzes/${quizId}/attempt`, { answers: answersRef.current });
      setMyAttempt(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (started && !myAttempt && remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      doSubmit(true);
    }
  }, [remaining, started, myAttempt]);

  const submitQuiz = async () => {
    const unanswered = answers.findIndex((a) => a === -1);
    if (unanswered !== -1) {
      if (!window.confirm(`Question ${unanswered + 1} has not been answered. Submit anyway?`)) return;
    }
    doSubmit(false);
  };

  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  if (!checked) {
    return <div className="text-xs text-slate-500 py-2">Checking your attempt...</div>;
  }

  if (!myAttempt && !started) {
    return (
      <div className="bg-white p-6 rounded-xl border border-indigo-100 text-center space-y-3">
        {error && <div className="text-xs text-rose-600" role="alert">{error}</div>}
        <p className="text-sm text-slate-700">
          Starting the quiz begins your timer. You can attempt it <strong>once</strong>, and answers must be submitted before time runs out.
        </p>
        <button onClick={startQuiz} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700">Start quiz</button>
      </div>
    );
  }

  if (error && !quiz) {
    return <div className="text-xs text-rose-600 py-2" role="alert">{error}</div>;
  }

  if (!quiz) {
    return <div className="text-xs text-slate-500 py-2">Loading assessment questions...</div>;
  }

  if (myAttempt) {
    const pct = myAttempt.totalMarks > 0 ? ((myAttempt.score / myAttempt.totalMarks) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full mx-auto flex items-center justify-center text-xl font-bold">
          🎯
        </div>
        <h4 className="text-base font-bold text-slate-900">Quiz Completed!</h4>
        <p className="text-xs text-slate-500">
          Submitted on {new Date(myAttempt.submittedAt).toLocaleString()}
        </p>

        <div className="inline-block px-6 py-3 rounded-2xl bg-indigo-50 border border-indigo-200">
          <div className="text-2xl font-extrabold text-indigo-700">
            {myAttempt.score} <span className="text-sm font-normal text-slate-500">/ {myAttempt.totalMarks} pts</span>
          </div>
          <div className="text-xs font-semibold text-indigo-600 mt-0.5">{pct}% Score</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex items-center justify-between text-xs text-indigo-900">
        <span>⏱️ Duration: <strong>{quiz.duration} mins</strong></span>
        <span>Questions: <strong>{quiz.questions?.length}</strong></span>
        {remaining !== null && (
          <span className={`font-mono font-bold ${remaining <= 60 ? "text-rose-600" : "text-slate-800"}`} role="timer" aria-live="off">
            Time left: {mmss(remaining)}{remaining <= 60 ? " (hurry!)" : ""}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {quiz.questions?.map((q, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">
                {idx + 1}. {q.questionText}
              </span>
              <span className="text-xs font-semibold text-slate-400">({q.marks} pts)</span>
            </div>

            <div className="space-y-2 pt-1">
              {q.options?.map((opt, oIdx) => (
                <label
                  key={oIdx}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs transition ${
                    answers[idx] === oIdx
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name={`quiz-q-${idx}`}
                    checked={answers[idx] === oIdx}
                    onChange={() => {
                      const next = [...answers];
                      next[idx] = oIdx;
                      answersRef.current = next;
                      setAnswers(next);
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={submitQuiz}
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
        >
          {submitting ? "Scoring Test..." : "Submit Quiz"}
        </button>
      </div>
    </div>
  );
}

function FacultyResults({ quizId }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/quizzes/${quizId}/results`)
      .then((res) => setResults(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) {
    return <div className="text-xs text-slate-500 py-3 text-center">Loading student score reports...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Student Attempts ({results.length})
        </h4>
      </div>

      {results.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Student Name</th>
                <th className="p-3">ID / Roll No</th>
                <th className="p-3">Score</th>
                <th className="p-3">Percentage</th>
                <th className="p-3">Submitted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => {
                const pct = r.totalMarks > 0 ? ((r.score / r.totalMarks) * 100).toFixed(1) : 0;
                return (
                  <tr key={r._id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">{r.student?.name}</td>
                    <td className="p-3 text-slate-500 font-mono">{r.student?.rollNumber || "N/A"}</td>
                    <td className="p-3 font-bold text-indigo-700">{r.score} / {r.totalMarks}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          Number(pct) >= 70
                            ? "bg-emerald-50 text-emerald-700"
                            : Number(pct) >= 40
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(r.submittedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
          No students have attempted this quiz yet.
        </div>
      )}
    </div>
  );
}
