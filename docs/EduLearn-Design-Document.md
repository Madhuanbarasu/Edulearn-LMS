# EduLearn LMS --- Design Document

**Status:** Draft design direction for implementation\
**Primary rule:** Improve the existing UI incrementally. Do not replace
working pages with a generic dashboard template.

## 1. Design goals

-   Professional, trustworthy college ERP/LMS appearance.
-   Consistent components across student, faculty, and admin roles.
-   Clear hierarchy for deadlines, submissions, attendance, and academic
    status.
-   Responsive behavior for desktop, tablet, and mobile.
-   Accessible controls, readable contrast, visible focus states, and
    clear form errors.
-   Persistent light/dark theme preference.

## 2. Visual direction

Use a clean academic product aesthetic: calm neutral surfaces, one
primary brand color, limited accent colors for statuses, consistent card
borders/radii, restrained shadows, and strong typography hierarchy.
Avoid excessive gradients, oversized decorative icons, random colours,
and unrelated card styles.

Before implementing broad visual changes, inspect the existing
application and preserve its recognizable navigation and working
interaction patterns. Reuse existing CSS conventions where practical.

## 3. Application shell

-   Top navigation or responsive header with EduLearn identity, current
    page context, role-aware links, profile/settings, theme toggle, and
    logout.
-   Desktop: compact sidebar or consistent horizontal navigation,
    depending on current page structure.
-   Mobile: collapsible navigation with keyboard-accessible controls.
-   Main content uses consistent max-width, spacing, headings, and
    section rhythm.
-   Display a clear page title and concise context line.

## 4. Shared components

Build/reuse consistent patterns for: - Buttons: primary, secondary,
danger, and disabled/loading states. - Inputs: label, hint, validation
error, required indicator. - Select/autocomplete controls for academic
options. - Cards, data tables, badges, tabs, dialogs, alerts, empty
states, loading skeletons, and pagination where needed. - Status styles:
pending, approved, disabled, present, absent, late, submitted, overdue,
graded. - Confirmation dialogs for sensitive/destructive actions. -
Toast/inline feedback for success and errors.

## 5. Role dashboards

### Student dashboard

Prioritize upcoming and overdue work. Suggested order: 1. Greeting and
academic context. 2. Overdue assignments and upcoming deadlines/tests.
3. Enrolled courses. 4. Recent materials and announcements/discussions.
5. Attendance summary and released grades/progress.

Never display fake/demo data if API data is available. Provide a useful
empty state for students with no courses or tasks.

### Faculty dashboard

Suggested order: 1. Teaching overview and assigned courses/classes. 2.
Upcoming assignment/quiz deadlines. 3. Submissions awaiting grading. 4.
Attendance shortcuts and recent course activity. 5. Course performance
summaries.

Show only classes/courses assigned to the logged-in faculty member.

### Admin dashboard --- planned

Suggested sections: 1. Overview counts and recent activity. 2. Pending
faculty approvals. 3. User/account management. 4. Academic options
(department/year/study year/section). 5. Faculty-to-course/class
allocation. 6. Student enrollment management. 7. Reports and audit logs.

Do not expose admin navigation or operations to non-admin roles. UI
hiding must be backed by server-side authorization.

## 6. Core page behavior

-   Courses: clear course identity, faculty, enrollment context, and
    available tabs.
-   Materials: show file type/name and access status; accessible
    download actions.
-   Assignments: highlight due date and overdue state; show
    submission/grade/feedback state.
-   Quizzes: show availability and remaining time accurately; server
    controls validity.
-   Attendance: date/session context, clear Present/Late/Absent states,
    save feedback, history scoped to authorized users.
-   Discussions: readable thread hierarchy and clear ownership/action
    controls.
-   Analytics: charts/tables with labels, empty states, and appropriate
    role-based data access.
-   Profile/settings: editable fields separated from security settings;
    password change requires current password.

## 7. Forms and validation

-   Validate on both frontend and backend.
-   Use inline messages next to fields and a concise summary for
    form-level errors.
-   Registration: email format, duplicate-email response, strong
    password hints, role-specific fields, department suggestions,
    academic year/study year/section options.
-   Never offer public admin self-registration.
-   Pending faculty should receive a clear pending-approval message
    instead of entering the normal dashboard.

## 8. Responsive and accessibility requirements

-   No horizontal page overflow at common mobile widths.
-   Tables adapt via responsive columns or contained horizontal
    scrolling.
-   Inputs/buttons have usable touch targets.
-   All actions can be reached by keyboard; focus is visible.
-   Use semantic headings, labels, button text, and accessible status
    messaging.
-   Do not communicate status by colour alone.

## 9. Theme behavior

-   Provide light and dark modes.
-   Persist preference using a safe client-side preference mechanism.
-   Ensure text, borders, controls, dialogs, and charts remain legible
    in both themes.
-   Avoid flash of the wrong theme where practical.

## 10. Design acceptance checklist

-   Existing core pages and tabs remain present.
-   Layout works at desktop, tablet, and mobile sizes.
-   Shared controls use consistent spacing and typography.
-   Loading, error, success, and empty states are implemented.
-   Deadlines and overdue work are visually easy to identify.
-   Theme preference persists.
-   Keyboard focus and form labels are visible.
-   Role-specific data is not exposed by UI or API.
-   No fake/demo data replaces working API-backed features.
