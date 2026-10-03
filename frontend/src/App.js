// --- Top of src/App.js: the imports ---
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css'; 
import './components/ui.css';
import api from './api';
import { EmptyState } from './components/Feedback';

// Base layout
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';

// Import every page component (double-check that your file names match)
import StudentDashboard from './pages/StudentDashboard';
import LecturerDashboard from './pages/LecturerDashboard';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import StudentListPage from './pages/StudentListPage';
import ProjectOverview from './pages/ProjectOverview';
import ManageAnnouncements from './pages/ManageAnnouncements';
import SupervisorQuota from './pages/SupervisorQuota';
import UserManagement from './pages/UserManagement';
import TimetableScheduling from './pages/TimetableScheduling';
import MyAvailabilityPage from './pages/MyAvailabilityPage';
import PresentSchedulePage from './pages/PresentSchedulePage';
import Rubrics from './pages/Rubrics';
import RubricsEditor from './pages/RubricsEditor';
import Assessment from './pages/Assessment';
import AssessmentGrade from './pages/AssessmentGrade';
import CoursePerformanceReport from './pages/CoursePerformanceReport';

// [IMPORTANT] These lines have been added back in:
import TRFSubmissionPage from './pages/TRFSubmissionPage';
import TRFReviewPage from './pages/TRFReviewPage';
import GiveFeedback from './pages/GiveFeedback';
import MilestoneVerification from './pages/MilestoneVerification';
import StudentFeedback from './pages/StudentFeedback';
import StudentAnnouncements from './pages/StudentAnnouncements';
import ProfilePage from './pages/ProfilePage';

const Placeholder = ({ title }) => (
  <div className="main-content">
    <header>
      <h1>{title}</h1>
      <p className="ui-page-subtitle">Archived FYP documents from previous sessions.</p>
    </header>
    <div className="content-card">
      <EmptyState
        icon="🗄️"
        title="Nothing archived yet"
        message="This section is not in use in the current build. Document archiving will be enabled in a later release."
      />
    </div>
  </div>
);

// Everything inside the router lives here so App() can keep the <Router> itself.
function AuthenticatedApp() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState(localStorage.getItem('user_role') || '');

  const handleLogin = (role) => {
    // Open the new session on the dashboard. Without this the browser keeps the
    // URL of the previous account (e.g. a lecturer's /trf-review), so the next
    // role lands on a page that belongs to someone else's workspace.
    navigate('/dashboard', { replace: true });
    setUserRole(role);
    setViewMode(role); // On login the view mode defaults to the real role
    setIsLoggedIn(true);
  };

  const handleLogout = useCallback(() => {
    localStorage.clear(); 
    setIsLoggedIn(false);
    setUserRole('');
    // Drop the previous account's page too, otherwise it is restored on the
    // next sign-in instead of the dashboard.
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (isLoggedIn) {
        setViewMode(userRole);
    }
  }, [isLoggedIn, userRole]);
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (isLoggedIn) {
        try {
          const res = await api.get('/user/me/');
          setCurrentUser(res.data); // Store the user information in state
        } catch (error) {
          console.error("Failed to fetch user data", error);
          // If the request fails (an expired token, for example), a logout can be triggered
          handleLogout();
        }
      } else {
        setCurrentUser(null); // Not logged in, so clear the user information
      }
    };
    fetchCurrentUser();
    // handleLogout is stable (useCallback), so re-running is still driven by isLoggedIn alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // The dependency is isLoggedIn

  const renderDashboard = () => {
    switch (viewMode) { // Render according to viewMode
      case 'coordinator': return <CoordinatorDashboard user={currentUser} />; 
      case 'lecturer': return <LecturerDashboard />; // The lecturer dashboard needs no user prop
      // The administrator has no dashboard of its own: account maintenance is
      // its whole job, so the dashboard route hands straight over to the one
      // page it works on instead of showing an empty shell.
      case 'admin': return <Navigate to="/users" replace />;
      case 'student': default: return <StudentDashboard user={currentUser} />;
    }
  }
  
  return (
    <Routes>
      <Route path="/*" element={
        !isLoggedIn ? ( <LoginPage onLogin={handleLogin} /> ) : (
          <MainLayout 
            userRole={userRole} 
            viewMode={viewMode}
            setViewMode={setViewMode}
            onLogout={handleLogout}
          >
              <Routes>
                <Route path="/dashboard" element={renderDashboard()} />

                {/* Student view (any role may see it, depending on viewMode) */}
                {viewMode === 'student' && (
                    <>
                        <Route path="/submit-trf" element={<TRFSubmissionPage />} /> 
                        <Route path="/feedback" element={<StudentFeedback />} />
                        <Route path="/my-schedule" element={<PresentSchedulePage hideHeader={false} />} />
                    </>
                )}

                {/* Lecturer view (a coordinator sees it too once they switch) */}
                {viewMode === 'lecturer' && (
                    <>
                        <Route path="/trf-review" element={<TRFReviewPage isGlobal={false} />} />
                        <Route path="/all-submissions" element={<TRFReviewPage isGlobal={true} />} />
                        <Route path="/give-feedback/:id" element={<GiveFeedback />} />
                        <Route path="/assessment" element={<Assessment />} />
                        <Route path="/assessment-grade" element={<AssessmentGrade />} />
                        <Route path="/milestones" element={<MilestoneVerification />} />
                        <Route path="/my-availability" element={<MyAvailabilityPage />} />
                    </>
                )}

                {/* Coordinator-only view (reachable only when the real role is coordinator) */}
                {userRole === 'coordinator' && viewMode === 'coordinator' && (
                    <>
                        <Route path="/student-list" element={<StudentListPage />} />
                        <Route path="/project-overview" element={<ProjectOverview />} /> 
                        <Route path="/manage-announcements" element={<ManageAnnouncements />} />
                        <Route path="/supervisor-quota" element={<SupervisorQuota />} />
                        <Route path="/timetable-scheduling" element={<TimetableScheduling />} />
                        <Route path="/rubrics" element={<Rubrics />} />
                        <Route path="/rubrics-editor" element={<RubricsEditor />} />
                        <Route path="/course-report" element={<CoursePerformanceReport />} />
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/archive" element={<Placeholder title="Document Archive" />} />
                    </>
                )}

                {/* === 2. Genuinely public routes === */}
                {/* The administrator's whole workspace. One route on purpose:
                    the role exists to maintain accounts across every programme,
                    and nothing else has been opened to it yet. Every other path
                    falls through to the dashboard redirect at the bottom, which
                    lands back on /users, so there is no page an administrator can
                    reach by typing a URL either. */}
                {userRole === 'admin' && viewMode === 'admin' && (
                    <>
                        <Route path="/users" element={<UserManagement />} />
                    </>
                )}

                <Route path="/announcements" element={<StudentAnnouncements />} />
                <Route path="/present-schedule" element={<PresentSchedulePage />} />
                {/* Every role has an account page. The delete-account action on it
                    renders only for a coordinator, so no role guard is needed
                    here — the page is the same for everyone. */}
                <Route path="/profile" element={<ProfilePage />} />

                {/* === 3. Fallback strategy === */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AuthenticatedApp />
      </div>
    </Router>
  );
}

export default App;