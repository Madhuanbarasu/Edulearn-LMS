import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import AssignmentsTab from "../components/AssignmentsTab";
import QuizzesTab from "../components/QuizzesTab";
import AttendanceTab from "../components/AttendanceTab";
import ForumTab from "../components/ForumTab";
import AnalyticsTab from "../components/AnalyticsTab";
import MaterialsTab from "../components/MaterialsTab";

const TABS = [
  { id: "Materials", label: "Materials", icon: "📁" },
  { id: "Assignments", label: "Assignments", icon: "📝" },
  { id: "Quizzes", label: "Quizzes", icon: "🎯" },
  { id: "Attendance", label: "Attendance", icon: "📅" },
  { id: "Forum", label: "Discussions", icon: "💬" },
  { id: "Analytics", label: "Analytics", icon: "📊" },
];

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [tab, setTab] = useState("Materials");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCourse = async () => {
    try {
      const res = await api.get(`/courses/${id}`);
      setCourse(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load course details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-500">Loading course curriculum...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-rose-600 font-semibold mb-3">{error || "Course not found."}</p>
          <Link
            to="/courses"
            className="inline-block px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            &larr; Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
        <Link to="/courses" className="hover:text-indigo-600 font-medium transition">
          Courses
        </Link>
        <span>&rsaquo;</span>
        <span className="font-semibold text-slate-800 uppercase font-mono">{course.code}</span>
      </div>

      {/* Course Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 uppercase">
              {course.code}
            </span>
            <span className="text-xs text-slate-500">
              Instructor: <strong className="text-slate-800">{course.faculty?.name || "Faculty"}</strong> ({course.faculty?.email})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {course.title}
          </h1>
          {course.description && (
            <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 self-start md:self-auto">
          <div className="text-center px-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Students</div>
            <div className="text-2xl font-extrabold text-slate-900">{course.studentCount ?? course.students?.length ?? 0}</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center px-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Materials</div>
            <div className="text-2xl font-extrabold text-indigo-600">{course.materials?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm mb-8 flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="animate-in fade-in duration-150">
        {tab === "Materials" && (
          <MaterialsTab course={course} user={user} setCourse={setCourse} onReload={loadCourse} />
        )}
        {tab === "Assignments" && <AssignmentsTab courseId={id} user={user} />}
        {tab === "Quizzes" && <QuizzesTab courseId={id} user={user} />}
        {tab === "Attendance" && <AttendanceTab course={course} user={user} />}
        {tab === "Forum" && <ForumTab courseId={id} user={user} />}
        {tab === "Analytics" && <AnalyticsTab course={course} user={user} />}
      </div>
    </div>
  );
}
