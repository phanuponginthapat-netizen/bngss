import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import LinkAccount from "./pages/LinkAccount";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicLayout from "./pages/Index";
import PublicOrgChartPage from "./pages/OrgChartPage";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import TranslationBubble from "./components/TranslationBubble";
import FullPageTranslator from "./components/FullPageTranslator";
import TranslatePackOverlay from "./components/TranslatePackOverlay";
import IdleScreensaver from "./components/IdleScreensaver";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));

const UserManagement = lazy(() => import("./pages/UserManagement"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const NotificationDeliveryDashboard = lazy(() => import("./pages/admin/NotificationDeliveryDashboard"));
const NotificationMatrixPage = lazy(() => import("./pages/admin/NotificationMatrixPage"));
const PermissionsHubPage = lazy(() => import("./pages/admin/PermissionsHubPage"));
const TeacherCredentialsPage = lazy(() => import("./pages/admin/TeacherCredentialsPage"));
const DutyTeachersPage = lazy(() => import("./pages/admin/DutyTeachersPage"));
const PublicSDQPage = lazy(() => import("./pages/PublicSDQPage"));
const PublicAssetPage = lazy(() => import("./pages/PublicAssetPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const FindProfilePage = lazy(() => import("./pages/FindProfilePage"));
const InboxPage = lazy(() => import("./pages/InboxPage"));
const NewsDetailPage = lazy(() => import("./pages/NewsDetailPage"));
const PdpaPage = lazy(() => import("./pages/PdpaPage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const LiffLeavePage = lazy(() => import("./pages/liff/LiffLeavePage"));
const LiffGradesPage = lazy(() => import("./pages/liff/LiffGradesPage"));
const LiffAttendancePage = lazy(() => import("./pages/liff/LiffAttendancePage"));
const LiffHomePage = lazy(() => import("./pages/liff/LiffHomePage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));

// Academic
const SchedulePage = lazy(() => import("./pages/academic/SchedulePage"));
const LearningCenterPage = lazy(() => import("./pages/academic/LearningCenterPage"));
const TranscriptPage = lazy(() => import("./pages/academic/TranscriptPage"));
const CertificatePage = lazy(() => import("./pages/academic/CertificatePage"));
const Pp5Page = lazy(() => import("./pages/academic/Pp5Page"));
const Pp6Page = lazy(() => import("./pages/academic/Pp6Page"));
const Pp7Page = lazy(() => import("./pages/academic/Pp7Page"));
const AcademicManagementPage = lazy(() => import("./pages/academic/AcademicManagementPage"));
const AllStudentsPage = lazy(() => import("./pages/academic/AllStudentsPage"));
const AlumniPage = lazy(() => import("./pages/academic/AlumniPage"));
const AcademicCalendarPage = lazy(() => import("./pages/academic/AcademicCalendarPage"));
const Pp3Page = lazy(() => import("./pages/academic/Pp3Page"));
const Pp4Page = lazy(() => import("./pages/academic/Pp4Page"));
const Pp8Page = lazy(() => import("./pages/academic/Pp8Page"));
const PpDocsHubPage = lazy(() => import("./pages/academic/PpDocsHubPage"));
const TeachingHubPage = lazy(() => import("./pages/academic/TeachingHubPage"));
const LessonPlansPage = lazy(() => import("./pages/academic/LessonPlansPage"));
const TeachingLogbookPage = lazy(() => import("./pages/academic/TeachingLogbookPage"));

// Exam OCR
const ExamListPage = lazy(() => import("./pages/exam/ExamListPage"));
const ExamNewPage = lazy(() => import("./pages/exam/ExamNewPage"));
const ExamDetailPage = lazy(() => import("./pages/exam/ExamDetailPage"));
const ExamAnswerSheetPage = lazy(() => import("./pages/exam/ExamAnswerSheetPage"));
const ExamPaperPrintPage = lazy(() => import("./pages/exam/ExamPaperPrintPage"));
const ExamScanPage = lazy(() => import("./pages/exam/ExamScanPage"));
const ExamResultsPage = lazy(() => import("./pages/exam/ExamResultsPage"));



// Student Affairs
const AttendancePage = lazy(() => import("./pages/student/AttendancePage"));
const BehaviorPage = lazy(() => import("./pages/student/BehaviorPage"));
const StudentLeavePage = lazy(() => import("./pages/student/StudentLeavePage"));
const ScreeningPage = lazy(() => import("./pages/student/ScreeningPage"));
const HealthTrendPage = lazy(() => import("./pages/student/HealthTrendPage"));
const HomeroomPage = lazy(() => import("./pages/student/HomeroomPage"));
const SDQPage = lazy(() => import("./pages/student/SDQPage"));
const HomeVisitPage = lazy(() => import("./pages/student/HomeVisitPage"));
const FaceScanPage = lazy(() => import("./pages/student/FaceScanPage"));
const FaceKioskPage = lazy(() => import("./pages/FaceKioskPage"));

// General Admin
const NewsPage = lazy(() => import("./pages/admin/NewsPage"));
const DocumentPage = lazy(() => import("./pages/admin/DocumentPage"));
const VaccinePage = lazy(() => import("./pages/admin/VaccinePage"));
const CmsPage = lazy(() => import("./pages/admin/CmsPage"));
const IdCardTemplatePage = lazy(() => import("./pages/admin/IdCardTemplatePage"));
const BulkIdCardPrintPage = lazy(() => import("./pages/admin/BulkIdCardPrintPage"));
const BulkQrPrintPage = lazy(() => import("./pages/admin/BulkQrPrintPage"));
const PrintCenterPage = lazy(() => import("./pages/admin/PrintCenterPage"));
const PrintTemplatesPage = lazy(() => import("./pages/admin/PrintTemplatesPage"));
const PrintPreviewPage = lazy(() => import("./pages/admin/PrintPreviewPage"));
const WebhookManagementPage = lazy(() => import("./pages/admin/WebhookManagementPage"));
// Legacy AI Voice (ElevenLabs/Xiaozhi) page removed.
const AIProvidersPage = lazy(() => import("./pages/admin/AIProvidersPage"));
const AIKeyPoolPage = lazy(() => import("./pages/admin/AIKeyPoolPage"));
const BackupExternalPage = lazy(() => import("./pages/admin/BackupExternalPage"));
const SecretsManagementPage = lazy(() => import("./pages/admin/SecretsManagementPage"));
const ApiKeysHubPage = lazy(() => import("./pages/admin/ApiKeysHubPage"));
const AiAnalyticsPage = lazy(() => import("./pages/admin/AiAnalyticsPage"));
const SystemUpdatePage = lazy(() => import("./pages/admin/SystemUpdatePage"));
const KioskSetupPage = lazy(() => import("./pages/admin/KioskSetupPage"));

const UpstreamSyncPage = lazy(() => import("./pages/admin/UpstreamSyncPage"));
const FieldVisibilityPage = lazy(() => import("./pages/admin/FieldVisibilityPage"));
const LineSettingsPage = lazy(() => import("./pages/admin/LineSettingsPage"));
const SocialFeedPage = lazy(() => import("./pages/admin/SocialFeedPage"));
const LineVaultPage = lazy(() => import("./pages/LineVaultPage"));
const MyDrivePage = lazy(() => import("./pages/MyDrivePage"));
const OfficeHomePage = lazy(() => import("./pages/office/OfficeHomePage"));
const DocsEditorPage = lazy(() => import("./pages/office/DocsEditorPage"));
const SheetsEditorPage = lazy(() => import("./pages/office/SheetsEditorPage"));
const SlidesEditorPage = lazy(() => import("./pages/office/SlidesEditorPage"));
const PdfToolsPage = lazy(() => import("./pages/office/PdfToolsPage"));
const EFormPage = lazy(() => import("./pages/admin/EFormPage"));
const EFormTemplatesPage = lazy(() => import("./pages/admin/EFormTemplatesPage"));
const DocumentTemplatesPage = lazy(() => import("./pages/admin/DocumentTemplatesPage"));
const TemplateEditorPage = lazy(() => import("./pages/admin/TemplateEditorPage"));
const FillTemplatePage = lazy(() => import("./pages/documents/FillTemplatePage"));
const MasterTemplatesPage = lazy(() => import("./pages/documents/MasterTemplatesPage"));
// EFormInboxPage now embedded inside InboxPage
const SemesterSettingsPage = lazy(() => import("./pages/admin/SemesterSettingsPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));
const DashboardShortcutsAdminPage = lazy(() => import("./pages/admin/DashboardShortcutsAdminPage"));
const BrowserShortcutsAdminPage = lazy(() => import("./pages/admin/BrowserShortcutsAdminPage"));
const BrowserPolicyPage = lazy(() => import("./pages/admin/BrowserPolicyPage"));
const ModuleTogglesPage = lazy(() => import("./pages/admin/ModuleTogglesPage"));
const SchoolLocationPage = lazy(() => import("./pages/admin/SchoolLocationPage"));
const SchoolSettingsPage = lazy(() => import("./pages/admin/SchoolSettingsPage"));
const EmergencyPage = lazy(() => import("./pages/admin/EmergencyPage"));
const EmergencyViewPage = lazy(() => import("./pages/EmergencyViewPage"));

// HR & Finance
const PersonnelPage = lazy(() => import("./pages/hr/PersonnelPage"));
const StaffLeavePage = lazy(() => import("./pages/hr/StaffLeavePage"));
const EvaluationPage = lazy(() => import("./pages/hr/EvaluationPage"));
const SubstitutePage = lazy(() => import("./pages/hr/SubstitutePage"));
const OrgChartPage = lazy(() => import("./pages/hr/OrgChartPage"));
const BudgetAccountingPage = lazy(() => import("./pages/hr/BudgetAccountingPage"));
const ProcurementPage = lazy(() => import("./pages/hr/ProcurementPage"));
const AssetManagementPage = lazy(() => import("./pages/hr/AssetManagementPage"));
const AssetReportsPage = lazy(() => import("./pages/hr/AssetReportsPage"));
const SubsidyPage = lazy(() => import("./pages/hr/SubsidyPage"));
const SalaryPage = lazy(() => import("./pages/hr/SalaryPage"));
const IdPlanPage = lazy(() => import("./pages/hr/IdPlanPage"));
const PersonnelAssessmentPage = lazy(() => import("./pages/hr/PersonnelAssessmentPage"));
const TimeClockPage = lazy(() => import("./pages/hr/TimeClockPage"));

const AttendanceDashboardPage = lazy(() => import("./pages/hr/AttendanceDashboardPage"));
const SchoolLunchPage = lazy(() => import("./pages/admin/SchoolLunchPage"));
const SchoolMilkPage = lazy(() => import("./pages/admin/SchoolMilkPage"));
const ActionPlanPage = lazy(() => import("./pages/admin/ActionPlanPage"));
const HubProjectsPage = lazy(() => import("./pages/projects/HubProjectsPage"));
const HubProjectDetailPage = lazy(() => import("./pages/projects/HubProjectDetailPage"));

// Garbage Bank
const GarbageDashboardPage = lazy(() => import("./pages/garbage/GarbageDashboardPage"));
const GarbageItemsPage = lazy(() => import("./pages/garbage/GarbageItemsPage"));
const GarbageCounterPage = lazy(() => import("./pages/garbage/GarbageCounterPage"));
const GarbageHistoryPage = lazy(() => import("./pages/garbage/GarbageHistoryPage"));
const GarbageReportsPage = lazy(() => import("./pages/garbage/GarbageReportsPage"));
const GarbageMyPage = lazy(() => import("./pages/garbage/GarbageMyPage"));
const GarbageAchievementsPage = lazy(() => import("./pages/garbage/GarbageAchievementsPage"));

// IoT
const IoTDashboardPage = lazy(() => import("./pages/iot/IoTDashboardPage"));
const IoTDevicesPage = lazy(() => import("./pages/iot/IoTDevicesPage"));

// ICT Loans
const IctDevicesPage = lazy(() => import("./pages/admin/IctDevicesPage"));
const IctCatalogPage = lazy(() => import("./pages/admin/IctCatalogPage"));
const IctLoanStationPage = lazy(() => import("./pages/admin/IctLoanStationPage"));
const IctLoanHistoryPage = lazy(() => import("./pages/admin/IctLoanHistoryPage"));
const IctLoanReportPage = lazy(() => import("./pages/admin/IctLoanReportPage"));
const SpecialRoomsPage = lazy(() => import("./pages/admin/SpecialRoomsPage"));


// Game Hub
const GamesStorePage = lazy(() => import("./pages/games/GamesStorePage"));
const GameDetailPage = lazy(() => import("./pages/games/GameDetailPage"));
const GameHubAdminPage = lazy(() => import("./pages/admin/GameHubAdminPage"));
const GameHubApiKeysPage = lazy(() => import("./pages/admin/GameHubApiKeysPage"));

// In-app Browser
const BrowserPage = lazy(() => import("./pages/BrowserPage"));
const BrowserLogsPage = lazy(() => import("./pages/admin/BrowserLogsPage"));
const ExtensionPage = lazy(() => import("./pages/ExtensionPage"));
const ClassroomMonitorPage = lazy(() => import("./pages/admin/ClassroomMonitorPage"));
const StudentAgentPage = lazy(() => import("./pages/monitor/StudentAgentPage"));

// District Feed (API + Export)
const DistrictFeedPage = lazy(() => import("./pages/admin/DistrictFeedPage"));
const TestScoresPage = lazy(() => import("./pages/admin/TestScoresPage"));
const SmscCenterPage = lazy(() => import("./pages/admin/SmscCenterPage"));
const ObecStandardsPage = lazy(() => import("./pages/admin/ObecStandardsPage"));
const AuditLogPage = lazy(() => import("./pages/admin/AuditLogPage"));
const AiImportPage = lazy(() => import("./pages/admin/AiImportPage"));

const BulkOperationsPage = lazy(() => import("./pages/admin/BulkOperationsPage"));
const DepartmentManagementPage = lazy(() => import("./pages/admin/DepartmentManagementPage"));
const HomeworkPage = lazy(() => import("./pages/HomeworkPage"));
const PadletListPage = lazy(() => import("./pages/padlet/PadletListPage"));
const PadletBoardPage = lazy(() => import("./pages/padlet/PadletBoardPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));

// Consolidated hubs (tabbed pages)
const DocumentsHubPage = lazy(() => import("./pages/hub/DocumentsHubPage"));
const CommunicationsHubPage = lazy(() => import("./pages/hub/CommunicationsHubPage"));
const GarbageHubPage = lazy(() => import("./pages/hub/GarbageHubPage"));
const GamesHubPage = lazy(() => import("./pages/hub/GamesHubPage"));
const HrHubPage = lazy(() => import("./pages/hub/HrHubPage"));
const FinanceHubPage = lazy(() => import("./pages/hub/FinanceHubPage"));
const StudentHealthHubPage = lazy(() => import("./pages/hub/StudentHealthHubPage"));
const AdminReportsHubPage = lazy(() => import("./pages/hub/AdminReportsHubPage"));


import DepartmentRoute from "./components/DepartmentRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute — keeps data feeling live without hammering the API
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      // Auto-refetch when the user returns to the tab. Needed because Realtime is
      // intentionally OFF for profiles/students/pdpa_consents (PII protection).
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      retry: 1,
    },
  },
});


import SystemLoader from "./components/SystemLoader";
import CmsBranding from "./components/CmsBranding";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <CmsBranding />
        <Toaster />
        <Sonner />
        <FullPageTranslator />
        <TranslatePackOverlay />
        <IdleScreensaver />
        {typeof window !== "undefined" && window.innerWidth >= 768 ? <TranslationBubble /> : null}
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<SystemLoader />}>
              <Routes>
              <Route path="/" element={<PublicLayout />} />
              <Route path="/page/:slug" element={<PublicLayout />} />
              <Route path="/org-chart" element={<PublicOrgChartPage />} />
              <Route path="/sdq-assess/:studentId" element={<PublicSDQPage />} />
              <Route path="/asset/:id" element={<PublicAssetPage />} />
              <Route path="/p/:id" element={<PublicProfilePage />} />
              <Route path="/find" element={<FindProfilePage />} />
              <Route path="/pdpa" element={<PdpaPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

              <Route path="/signup" element={<Signup />} />
              <Route path="/link-account" element={<LinkAccount />} />
              <Route path="/face-kiosk" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><FaceKioskPage /></ProtectedRoute>} />
              <Route path="/liff" element={<LiffHomePage />} />
              <Route path="/liff/leave" element={<LiffLeavePage />} />
              <Route path="/liff/grades" element={<LiffGradesPage />} />
              <Route path="/liff/attendance" element={<LiffAttendancePage />} />
              <Route path="/install" element={<InstallPage />} />
              
              
              
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><Dashboard /></ProtectedRoute>} />


                {/* Consolidated hubs — group related menus into tabbed pages */}
                <Route path="hub/documents" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DocumentsHubPage /></ProtectedRoute>} />
                <Route path="hub/communications" element={<ProtectedRoute allowedRoles={["admin", "director"]}><CommunicationsHubPage /></ProtectedRoute>} />
                <Route path="hub/garbage" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni"]}><GarbageHubPage /></ProtectedRoute>} />
                <Route path="hub/games" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><GamesHubPage /></ProtectedRoute>} />
                <Route path="hub/hr" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HrHubPage /></ProtectedRoute>} />
                <Route path="hub/finance" element={<ProtectedRoute allowedRoles={["admin", "director"]}><FinanceHubPage /></ProtectedRoute>} />
                <Route path="hub/student-health" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><StudentHealthHubPage /></ProtectedRoute>} />
                <Route path="hub/admin-reports" element={<ProtectedRoute allowedRoles={["admin", "director"]}><AdminReportsHubPage /></ProtectedRoute>} />
                


                <Route path="profile" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><ProfilePage /></ProtectedRoute>} />
                <Route path="settings/notifications" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><NotificationSettingsPage /></ProtectedRoute>} />
                <Route path="admin/notifications" element={<ProtectedRoute allowedRoles={["admin", "director"]}><NotificationDeliveryDashboard /></ProtectedRoute>} />
                <Route path="admin/notification-matrix" element={<ProtectedRoute allowedRoles={["admin", "director"]}><NotificationMatrixPage /></ProtectedRoute>} />
                <Route path="admin/permissions" element={<ProtectedRoute allowedRoles={["admin", "director"]}><PermissionsHubPage /></ProtectedRoute>} />
                <Route path="admin/teacher-credentials" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TeacherCredentialsPage /></ProtectedRoute>} />
                <Route path="admin/duty-teachers" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DutyTeachersPage /></ProtectedRoute>} />
                <Route path="line-vault" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><LineVaultPage /></ProtectedRoute>} />
                <Route path="my-drive" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><MyDrivePage /></ProtectedRoute>} />
                <Route path="inbox" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><InboxPage /></ProtectedRoute>} />
                <Route path="news/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><NewsDetailPage /></ProtectedRoute>} />
                
                <Route path="users" element={<ProtectedRoute allowedRoles={["admin", "director"]}><UserManagement /></ProtectedRoute>} />
                {/* Academic */}
                <Route path="academic" element={<Navigate to="/dashboard/academic/management" replace />} />
                <Route path="academic/schedule" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["academic"]} bypassRoles={["student","alumni","parent"]}><SchedulePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/learning-center" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><LearningCenterPage /></ProtectedRoute>} />
                <Route path="admin/special-rooms" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SpecialRoomsPage /></ProtectedRoute>} />
                <Route path="academic/transcript" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><TranscriptPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/certificate" element={<Navigate to="/dashboard/academic/pp-docs?tab=pp2" replace />} />
                <Route path="academic/pp5" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><Pp5Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/pp6" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><Pp6Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/pp7" element={<Navigate to="/dashboard/academic/pp-docs?tab=pp7" replace />} />
                <Route path="academic/pp3" element={<Navigate to="/dashboard/academic/pp-docs?tab=pp3" replace />} />
                <Route path="academic/pp4" element={<Navigate to="/dashboard/academic/pp-docs?tab=pp4" replace />} />
                <Route path="academic/pp8" element={<Navigate to="/dashboard/academic/pp-docs?tab=pp8" replace />} />
                <Route path="academic/pp-docs" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><PpDocsHubPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/management" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><AcademicManagementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/all-students" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic","student_affairs"]} bypassRoles={["teacher"]}><AllStudentsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/alumni" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]}><AlumniPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/calendar" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><AcademicCalendarPage /></ProtectedRoute>} />
                <Route path="academic/teaching-hub" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><TeachingHubPage /></ProtectedRoute>} />
                <Route path="academic/lesson-plans" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><LessonPlansPage /></ProtectedRoute>} />
                <Route path="academic/logbook" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><TeachingLogbookPage /></ProtectedRoute>} />

                {/* Student Affairs */}
                <Route path="student" element={<Navigate to="/dashboard/student/attendance" replace />} />
                <Route path="student/attendance" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["student_affairs","academic"]} bypassRoles={["parent","student"]}><AttendancePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/face-scan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><FaceScanPage /></ProtectedRoute>} />
                <Route path="student/behavior" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["student_affairs"]} bypassRoles={["parent","student"]}><BehaviorPage /></DepartmentRoute></ProtectedRoute>} />

                <Route path="student/leave" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><StudentLeavePage /></ProtectedRoute>} />
                <Route path="student/screening" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs"]}><ScreeningPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/health-trend" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "parent"]}><DepartmentRoute departments={["student_affairs"]} bypassRoles={["parent"]}><HealthTrendPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/homeroom" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs","academic"]}><HomeroomPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/sdq" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs"]}><SDQPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/home-visit" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HomeVisitPage /></ProtectedRoute>} />
                {/* General Admin */}
                <Route path="admin" element={<Navigate to="/dashboard" replace />} />
                <Route path="admin/news" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><NewsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/document" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><DocumentPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/emergency" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><EmergencyPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="emergency" element={<ProtectedRoute><EmergencyViewPage /></ProtectedRoute>} />
                <Route path="admin/vaccine" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><VaccinePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/cms" element={<ProtectedRoute allowedRoles={["admin", "director"]}><CmsPage /></ProtectedRoute>} />
                <Route path="admin/id-card" element={<ProtectedRoute allowedRoles={["admin", "director"]}><IdCardTemplatePage /></ProtectedRoute>} />
                <Route path="admin/print-center" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
                <Route path="admin/id-card/bulk-print" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
                <Route path="admin/qr/bulk-print" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
                <Route path="admin/print-templates" element={<Navigate to="/dashboard/admin/eform-templates" replace />} />
                <Route path="admin/print-preview" element={<Navigate to="/dashboard/admin/eform-templates" replace />} />
                <Route path="admin/webhooks" element={<ProtectedRoute allowedRoles={["admin", "director"]}><WebhookManagementPage /></ProtectedRoute>} />
                {/* Unified API & Secrets hub — old paths redirect via tab param */}
                <Route path="admin/api-keys" element={<ProtectedRoute allowedRoles={["admin", "director"]}><ApiKeysHubPage /></ProtectedRoute>} />
                <Route path="admin/ai-integrations" element={<Navigate to="/dashboard/admin/api-keys?tab=secrets" replace />} />
                <Route path="admin/ai-providers" element={<ProtectedRoute allowedRoles={["admin", "director"]}><Navigate to="/dashboard/admin/api-keys?tab=providers" replace /></ProtectedRoute>} />
                <Route path="admin/ai-key-pool" element={<ProtectedRoute allowedRoles={["admin", "director"]}><Navigate to="/dashboard/admin/api-keys?tab=pool" replace /></ProtectedRoute>} />
                <Route path="admin/backup-external" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BackupExternalPage /></ProtectedRoute>} />
                <Route path="admin/secrets" element={<ProtectedRoute allowedRoles={["admin", "director"]}><Navigate to="/dashboard/admin/api-keys?tab=secrets" replace /></ProtectedRoute>} />
                <Route path="admin/ai-analytics" element={<ProtectedRoute allowedRoles={["admin", "director"]}><AiAnalyticsPage /></ProtectedRoute>} />
                <Route path="admin/system-update" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SystemUpdatePage /></ProtectedRoute>} />
                <Route path="admin/kiosk-setup" element={<ProtectedRoute allowedRoles={["admin", "director"]}><KioskSetupPage /></ProtectedRoute>} />
                
                <Route path="admin/upstream-sync" element={<ProtectedRoute allowedRoles={["admin", "director"]}><UpstreamSyncPage /></ProtectedRoute>} />
                <Route path="admin/field-visibility" element={<ProtectedRoute allowedRoles={["admin", "director"]}><FieldVisibilityPage /></ProtectedRoute>} />
                <Route path="admin/line-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><LineSettingsPage /></ProtectedRoute>} />
                <Route path="admin/social-feed" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SocialFeedPage /></ProtectedRoute>} />
                <Route path="admin/semester-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SemesterSettingsPage /></ProtectedRoute>} />
                <Route path="admin/system-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SystemSettingsPage /></ProtectedRoute>} />
                <Route path="admin/dashboard-shortcuts" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DashboardShortcutsAdminPage /></ProtectedRoute>} />
                <Route path="admin/browser-shortcuts" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BrowserShortcutsAdminPage /></ProtectedRoute>} />
                <Route path="admin/browser-policy" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BrowserPolicyPage /></ProtectedRoute>} />
                <Route path="admin/module-toggles" element={<ProtectedRoute allowedRoles={["admin", "director"]}><ModuleTogglesPage /></ProtectedRoute>} />
                <Route path="admin/school-location" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SchoolLocationPage /></ProtectedRoute>} />
                <Route path="admin/school-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SchoolSettingsPage /></ProtectedRoute>} />
                <Route path="admin/eform" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><EFormPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/eform-templates" element={<ProtectedRoute allowedRoles={["admin", "director"]}><EFormTemplatesPage /></ProtectedRoute>} />
                <Route path="admin/document-templates" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DocumentTemplatesPage /></ProtectedRoute>} />
                <Route path="admin/document-templates/:id" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TemplateEditorPage /></ProtectedRoute>} />
                <Route path="documents/fill/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><FillTemplatePage /></ProtectedRoute>} />
                <Route path="documents/masters" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><MasterTemplatesPage /></ProtectedRoute>} />
                <Route path="eform-inbox" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><InboxPage /></ProtectedRoute>} />
                <Route path="admin/school-lunch" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><SchoolLunchPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/school-milk" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><SchoolMilkPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/action-plan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin","academic","student_affairs","finance_personnel"]}><ActionPlanPage /></DepartmentRoute></ProtectedRoute>} />
                {/* Garbage Bank */}
                <Route path="garbage" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><GarbageDashboardPage /></ProtectedRoute>} />
                <Route path="garbage/my" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "director"]}><GarbageMyPage /></ProtectedRoute>} />
                <Route path="garbage/items" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><GarbageItemsPage /></ProtectedRoute>} />
                <Route path="garbage/counter" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><GarbageCounterPage /></ProtectedRoute>} />
                <Route path="garbage/history" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><GarbageHistoryPage /></ProtectedRoute>} />
                <Route path="garbage/reports" element={<ProtectedRoute allowedRoles={["admin", "director"]}><GarbageReportsPage /></ProtectedRoute>} />
                <Route path="garbage/achievements" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><GarbageAchievementsPage /></ProtectedRoute>} />
                {/* IoT */}
                <Route path="iot" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><IoTDashboardPage /></ProtectedRoute>} />
                <Route path="iot/devices" element={<ProtectedRoute allowedRoles={["admin", "director"]}><IoTDevicesPage /></ProtectedRoute>} />
                {/* ICT Loans */}
                <Route path="admin/ict-devices" element={<ProtectedRoute allowedRoles={["admin", "director"]}><IctDevicesPage /></ProtectedRoute>} />
                <Route path="admin/ict-catalog" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><IctCatalogPage /></ProtectedRoute>} />
                <Route path="admin/ict-loans" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><DepartmentRoute departments={["general_admin"]}><IctLoanStationPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/ict-loan-history" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><DepartmentRoute departments={["general_admin"]}><IctLoanHistoryPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/ict-loan-report" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><IctLoanReportPage /></DepartmentRoute></ProtectedRoute>} />
                {/* Hub Projects (special projects funded by central hub) */}
                <Route path="projects/hub" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HubProjectsPage /></ProtectedRoute>} />
                <Route path="projects/hub/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HubProjectDetailPage /></ProtectedRoute>} />
                {/* Game Hub */}
                <Route path="games" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><GamesStorePage /></ProtectedRoute>} />
                <Route path="games/admin" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><GameHubAdminPage /></ProtectedRoute>} />
                <Route path="games/api-keys" element={<ProtectedRoute allowedRoles={["admin", "director"]}><GameHubApiKeysPage /></ProtectedRoute>} />
                <Route path="games/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><GameDetailPage /></ProtectedRoute>} />
                {/* In-app Browser */}
                <Route path="browser" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><BrowserPage /></ProtectedRoute>} />
                <Route path="browser/logs" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BrowserLogsPage /></ProtectedRoute>} />
                <Route path="browser/extension" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><ExtensionPage /></ProtectedRoute>} />
                {/* Classroom Monitor (NetSupport-style, WebRTC) */}
                <Route path="admin/monitor" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><ClassroomMonitorPage /></ProtectedRoute>} />
                <Route path="monitor/agent" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><StudentAgentPage /></ProtectedRoute>} />
                {/* Finance */}
                <Route path="finance" element={<Navigate to="/dashboard/finance/budget" replace />} />
                <Route path="finance/budget" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><BudgetAccountingPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/procurement" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><ProcurementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/assets" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><AssetManagementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/assets/reports" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><AssetReportsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/subsidy" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><SubsidyPage /></DepartmentRoute></ProtectedRoute>} />
                {/* HR */}
                <Route path="hr" element={<Navigate to="/dashboard/hr/personnel" replace />} />
                <Route path="hr/personnel" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><PersonnelPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/time-clock" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><TimeClockPage /></ProtectedRoute>} />
                <Route path="hr/attendance-dashboard" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><AttendanceDashboardPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/leave" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["finance_personnel"]} bypassRoles={["teacher"]}><StaffLeavePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/evaluation" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["finance_personnel"]} bypassRoles={["teacher"]}><EvaluationPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/salary" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["finance_personnel"]}><SalaryPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/id-plan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["finance_personnel"]} bypassRoles={["teacher"]}><IdPlanPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/substitute" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["finance_personnel"]} bypassRoles={["teacher"]}><SubstitutePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/org-chart" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><OrgChartPage /></ProtectedRoute>} />
                {/* assessment merged into evaluation */}
                <Route path="hr/assessment" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["finance_personnel"]} bypassRoles={["teacher"]}><EvaluationPage /></DepartmentRoute></ProtectedRoute>} />

                {/* District Feed (External integration) */}
                <Route path="admin/district-feed" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DistrictFeedPage /></ProtectedRoute>} />
                <Route path="admin/test-scores" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TestScoresPage /></ProtectedRoute>} />
                <Route path="admin/smsc" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SmscCenterPage /></ProtectedRoute>} />
                <Route path="admin/obec-standards" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><ObecStandardsPage /></ProtectedRoute>} />
                <Route path="admin/audit-log" element={<ProtectedRoute allowedRoles={["admin","director"]}><AuditLogPage /></ProtectedRoute>} />
                <Route path="admin/bulk-operations" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BulkOperationsPage /></ProtectedRoute>} />
                <Route path="admin/departments" element={<ProtectedRoute allowedRoles={["admin","director"]}><DepartmentManagementPage /></ProtectedRoute>} />
                <Route path="admin/ai-import" element={<ProtectedRoute allowedRoles={["admin", "director"]}><AiImportPage /></ProtectedRoute>} />

                {/* Exam OCR */}
                <Route path="exam" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamListPage /></ProtectedRoute>} />
                <Route path="exam/new" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamNewPage /></ProtectedRoute>} />
                <Route path="exam/:id" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamDetailPage /></ProtectedRoute>} />
                <Route path="exam/:id/answer-sheet" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamAnswerSheetPage /></ProtectedRoute>} />
                <Route path="exam/:id/paper" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamPaperPrintPage /></ProtectedRoute>} />
                <Route path="exam/:id/scan" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamScanPage /></ProtectedRoute>} />
                <Route path="exam/:id/results" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><ExamResultsPage /></ProtectedRoute>} />

                {/* Homework & AI Chat — available to teachers and students */}
                <Route path="homework" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><HomeworkPage /></ProtectedRoute>} />
                <Route path="padlet" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><PadletListPage /></ProtectedRoute>} />
                <Route path="padlet/:id" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><PadletBoardPage /></ProtectedRoute>} />

                {/* Social feed + portfolio */}
                <Route path="feed" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><FeedPage /></ProtectedRoute>} />
                <Route path="portfolio" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni"]}><PortfolioPage /></ProtectedRoute>} />
                <Route path="members" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><MembersPage /></ProtectedRoute>} />
                
              </Route>

              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
