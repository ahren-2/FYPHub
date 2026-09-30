// --- src/App.js 顶部导入部分 ---
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css'; 
import './components/ui.css';
import api from './api';
import { EmptyState } from './components/Feedback';

// 基础布局
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';

// 导入所有页面组件 (请核对你的文件名是否一致)
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

// 【重点补上这几行】：
import TRFSubmissionPage from './pages/TRFSubmissionPage';
import TRFReviewPage from './pages/TRFReviewPage';
import GiveFeedback from './pages/GiveFeedback';
import MilestoneVerification from './pages/MilestoneVerification';
import StudentFeedback from './pages/StudentFeedback';
import StudentAnnouncements from './pages/StudentAnnouncements';

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
    setViewMode(role); // 登录时，视图模式默认为真实角色
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
          setCurrentUser(res.data); // 将用户信息存储在 state 中
        } catch (error) {
          console.error("Failed to fetch user data", error);
          // 如果获取失败（例如 token 过期），可以触发登出
          handleLogout();
        }
      } else {
        setCurrentUser(null); // 如果未登录，清空用户信息
      }
    };
    fetchCurrentUser();
    // handleLogout is stable (useCallback), so re-running is still driven by isLoggedIn alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // 依赖项是 isLoggedIn

  const renderDashboard = () => {
    switch (viewMode) { // 根据 viewMode 渲染
      case 'coordinator': return <CoordinatorDashboard user={currentUser} />; 
      case 'lecturer': return <LecturerDashboard />; // 讲师 Dashboard 不需要 user prop
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

                {/* 学生视图 (所有角色都可能看到，取决于 viewMode) */}
                {viewMode === 'student' && (
                    <>
                        <Route path="/submit-trf" element={<TRFSubmissionPage />} /> 
                        <Route path="/feedback" element={<StudentFeedback />} />
                        <Route path="/my-schedule" element={<PresentSchedulePage hideHeader={false} />} />
                    </>
                )}

                {/* 讲师视图 (协调员切换后也能看到) */}
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

                {/* 协调员专属视图 (只有真实角色是协调员才能访问) */}
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

                {/* === 2. 真正意义上的公共路由 === */}
                <Route path="/announcements" element={<StudentAnnouncements />} />
                <Route path="/present-schedule" element={<PresentSchedulePage />} />

                {/* === 3. 兜底策略 === */}
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