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
import SubjectGroupChartPage from "./pages/SubjectGroupChartPage";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import TranslationBubble from "./components/TranslationBubble";
import FullPageTranslator from "./components/FullPageTranslator";
import TranslatePackOverlay from "./components/TranslatePackOverlay";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MascotDashboard = lazy(() => import("./pages/MascotDashboard"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ObserverManagementPage = lazy(() => import("./pages/admin/ObserverManagementPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const NotificationDeliveryDashboard = lazy(() => import("./pages/admin/NotificationDeliveryDashboard"));
const TeacherCredentialsPage = lazy(() => import("./pages/admin/TeacherCredentialsPage"));
const PublicSDQPage = lazy(() => import("./pages/PublicSDQPage"));
const PublicAssetPage = lazy(() => import("./pages/PublicAssetPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const FindProfilePage = lazy(() => import("./pages/FindProfilePage"));
const InboxPage = lazy(() => import("./pages/InboxPage"));
const NewsDetailPage = lazy(() => import("./pages/NewsDetailPage"));
const PdpaPage = lazy(() => import("./pages/PdpaPage"));
const LiffLeavePage = lazy(() => import("./pages/liff/LiffLeavePage"));
const LiffGradesPage = lazy(() => import("./pages/liff/LiffGradesPage"));
const LiffAttendancePage = lazy(() => import("./pages/liff/LiffAttendancePage"));
const LiffTimelinePage = lazy(() => import("./pages/liff/LiffTimelinePage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const FitnessPage = lazy(() => import("./pages/FitnessPage"));
const FitnessPosterPage = lazy(() => import("./pages/FitnessPosterPage"));
const FitnessRewardsAdminPage = lazy(() => import("./pages/admin/FitnessRewardsAdminPage"));

// Academic
const SchedulePage = lazy(() => import("./pages/academic/SchedulePage"));
const LearningCenterPage = lazy(() => import("./pages/academic/LearningCenterPage"));
const TranscriptPage = lazy(() => import("./pages/academic/TranscriptPage"));
const CertificatePage = lazy(() => import("./pages/academic/CertificatePage"));
const Pp5Page = lazy(() => import("./pages/academic/Pp5Page"));
const Pp5AttendancePrintPage = lazy(() => import("./pages/academic/Pp5AttendancePrintPage"));
const Pp6Page = lazy(() => import("./pages/academic/Pp6Page"));
const Pp7Page = lazy(() => import("./pages/academic/Pp7Page"));
const AcademicManagementPage = lazy(() => import("./pages/academic/AcademicManagementPage"));
const AllStudentsPage = lazy(() => import("./pages/academic/AllStudentsPage"));
const YearEndPromotionPage = lazy(() => import("./pages/academic/YearEndPromotionPage"));
const AlumniPage = lazy(() => import("./pages/academic/AlumniPage"));
const AcademicCalendarPage = lazy(() => import("./pages/academic/AcademicCalendarPage"));
const Pp3Page = lazy(() => import("./pages/academic/Pp3Page"));
const Pp4Page = lazy(() => import("./pages/academic/Pp4Page"));
const Pp8Page = lazy(() => import("./pages/academic/Pp8Page"));
const IncompleteGradePage = lazy(() => import("./pages/academic/IncompleteGradePage"));
const TeacherMappingReviewPage = lazy(() => import("./pages/academic/TeacherMappingReviewPage"));
const SubjectScanPage = lazy(() => import("./pages/academic/SubjectScanPage"));
const TeachingReflectionPage = lazy(() => import("./pages/academic/TeachingReflectionPage"));
const TeachingReflectionDetailPage = lazy(() => import("./pages/academic/TeachingReflectionDetailPage"));
const TeachingReflectionSigSettingsPage = lazy(() => import("./pages/admin/TeachingReflectionSigSettingsPage"));

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
const LearningHubPage = lazy(() => import("./pages/learning/LearningHubPage"));
const LearningManagePage = lazy(() => import("./pages/learning/LearningManagePage"));
const PublicLearningPage = lazy(() => import("./pages/PublicLearningPage"));

// General Admin
const NewsPage = lazy(() => import("./pages/admin/NewsPage"));
const DocumentPage = lazy(() => import("./pages/admin/DocumentPage"));
const DocEditorPage = lazy(() => import("./pages/admin/DocEditorPage"));
const PdfTemplateDesignerPage = lazy(() => import("./pages/admin/PdfTemplateDesignerPage"));
const FormTemplateEditorPage = lazy(() => import("./pages/admin/FormTemplateEditorPage"));
const FormTemplateFillPage = lazy(() => import("./pages/admin/FormTemplateFillPage"));
const PdfDesignerEditorPage = lazy(() => import("./pages/admin/PdfDesignerEditorPage"));
const WorksheetsPage = lazy(() => import("./pages/admin/WorksheetsPage"));
const PublicWorksheetPage = lazy(() => import("./pages/PublicWorksheetPage"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));

const ActivitiesPage = lazy(() => import("./pages/activities/ActivitiesPage"));
const ActivityDetailPage = lazy(() => import("./pages/activities/ActivityDetailPage"));
const ActivityRegisterPage = lazy(() => import("./pages/activities/ActivityRegisterPage"));
const SportsDayPage = lazy(() => import("./pages/activities/SportsDayPage"));
const ClubsHubPage = lazy(() => import("./pages/clubs/ClubsHubPage"));
const ClubDetailPage = lazy(() => import("./pages/clubs/ClubDetailPage"));
const VaccinePage = lazy(() => import("./pages/admin/VaccinePage"));
const CmsPage = lazy(() => import("./pages/admin/CmsPage"));
const IdCardTemplatePage = lazy(() => import("./pages/admin/IdCardTemplatePage"));
const BulkIdCardPrintPage = lazy(() => import("./pages/admin/BulkIdCardPrintPage"));
const BulkQrPrintPage = lazy(() => import("./pages/admin/BulkQrPrintPage"));
const PrintCenterPage = lazy(() => import("./pages/admin/PrintCenterPage"));
const WebhookManagementPage = lazy(() => import("./pages/admin/WebhookManagementPage"));
// Legacy AI Voice (ElevenLabs/Xiaozhi) page removed.
const AIProvidersPage = lazy(() => import("./pages/admin/AIProvidersPage"));
const AIKeyPoolPage = lazy(() => import("./pages/admin/AIKeyPoolPage"));
const BackupExternalPage = lazy(() => import("./pages/admin/BackupExternalPage"));
const SecretsManagementPage = lazy(() => import("./pages/admin/SecretsManagementPage"));
const ApiKeysHubPage = lazy(() => import("./pages/admin/ApiKeysHubPage"));
const AiAnalyticsPage = lazy(() => import("./pages/admin/AiAnalyticsPage"));
const SystemUpdatePage = lazy(() => import("./pages/admin/SystemUpdatePage"));
const FieldVisibilityPage = lazy(() => import("./pages/admin/FieldVisibilityPage"));
const LineSettingsPage = lazy(() => import("./pages/admin/LineSettingsPage"));
const SocialFeedPage = lazy(() => import("./pages/admin/SocialFeedPage"));
const EFormPage = lazy(() => import("./pages/admin/EFormPage"));
// EFormInboxPage now embedded inside InboxPage
const SemesterSettingsPage = lazy(() => import("./pages/admin/SemesterSettingsPage"));
const AcademicPeriodSettingsPage = lazy(() => import("./pages/admin/AcademicPeriodSettingsPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));
const ModuleTogglesPage = lazy(() => import("./pages/admin/ModuleTogglesPage"));
const SchoolLocationPage = lazy(() => import("./pages/admin/SchoolLocationPage"));
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
const TimeClockDiagnosticsPage = lazy(() => import("./pages/hr/TimeClockDiagnosticsPage"));

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

// Spider Hub
const SpiderHubPage = lazy(() => import("./pages/SpiderHubPage"));

// District Feed (API + Export)
const DistrictFeedPage = lazy(() => import("./pages/admin/DistrictFeedPage"));
const TestScoresPage = lazy(() => import("./pages/admin/TestScoresPage"));
const SmscCenterPage = lazy(() => import("./pages/admin/SmscCenterPage"));
const ObecStandardsPage = lazy(() => import("./pages/admin/ObecStandardsPage"));
const AuditLogPage = lazy(() => import("./pages/admin/AuditLogPage"));
const AiImportPage = lazy(() => import("./pages/admin/AiImportPage"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const BulkOperationsPage = lazy(() => import("./pages/admin/BulkOperationsPage"));
const DepartmentManagementPage = lazy(() => import("./pages/admin/DepartmentManagementPage"));
const HomeworkPage = lazy(() => import("./pages/HomeworkPage"));
const HomeworkGradingPage = lazy(() => import("./pages/HomeworkGradingPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));

// ===== NEW MODULES =====
const TuitionInvoicesPage = lazy(() => import("./pages/finance/TuitionInvoicesPage"));
const ScholarshipsPage = lazy(() => import("./pages/finance/ScholarshipsPage"));
const CoopMembersPage = lazy(() => import("./pages/finance/CoopMembersPage"));
const LibraryBooksPage = lazy(() => import("./pages/library/LibraryBooksPage"));
const LibraryLoansPage = lazy(() => import("./pages/library/LibraryLoansPage"));
const CafeteriaMenusPage = lazy(() => import("./pages/cafeteria/CafeteriaMenusPage"));
const BusRoutesPage = lazy(() => import("./pages/bus/BusRoutesPage"));
const QuestionBankPage = lazy(() => import("./pages/academic/QuestionBankPage"));
const TutoringSessionsPage = lazy(() => import("./pages/academic/TutoringSessionsPage"));
const GuidanceRecordsPage = lazy(() => import("./pages/academic/GuidanceRecordsPage"));
const AlumniUniversityPage = lazy(() => import("./pages/academic/AlumniUniversityPage"));
const SarabanPage = lazy(() => import("./pages/admin/SarabanPage"));
const SarabanHubPage = lazy(() => import("./pages/admin/SarabanHubPage"));
const FormTemplatesManagerPage = lazy(() => import("./pages/admin/FormTemplatesManagerPage"));
const MouRecordsPage = lazy(() => import("./pages/admin/MouRecordsPage"));
const RoomBookingsPage = lazy(() => import("./pages/admin/RoomBookingsPage"));
const VehicleBookingsPage = lazy(() => import("./pages/admin/VehicleBookingsPage"));
const SarEvidencesPage = lazy(() => import("./pages/admin/SarEvidencesPage"));
const VisitorLogsPage = lazy(() => import("./pages/admin/VisitorLogsPage"));
const CctvCamerasPage = lazy(() => import("./pages/admin/CctvCamerasPage"));
const CctvLiveViewerPage = lazy(() => import("./pages/admin/CctvLiveViewerPage"));
const EarlyWarningPage = lazy(() => import("./pages/admin/EarlyWarningPage"));

import DepartmentRoute from "./components/DepartmentRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - faster refresh for realtime feel
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false, // realtime channel handles updates - reduces unnecessary refetch
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      retry: 1,
    },
  },
});

import SystemLoader from "./components/SystemLoader";
import ThemeApplier from "./components/ThemeApplier";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <ThemeApplier />
        <Toaster />
        <Sonner />
        <FullPageTranslator />
        <TranslatePackOverlay />
        {typeof window !== "undefined" && window.innerWidth >= 768 ? <TranslationBubble /> : null}
        <BrowserRouter>
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={<SystemLoader />}>
              <Routes>
              <Route path="/" element={<PublicLayout />} />
              <Route path="/page/:slug" element={<PublicLayout />} />
              <Route path="/org-chart" element={<PublicOrgChartPage />} />
              <Route path="/subject-groups" element={<SubjectGroupChartPage />} />
              <Route path="/sdq-assess/:studentId" element={<PublicSDQPage />} />
              <Route path="/asset/:id" element={<PublicAssetPage />} />
              <Route path="/p/:id" element={<PublicProfilePage />} />
              <Route path="/find" element={<FindProfilePage />} />
              <Route path="/pdpa" element={<PdpaPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/link-account" element={<LinkAccount />} />
              <Route path="/face-kiosk" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><FaceKioskPage /></ProtectedRoute>} />
              <Route path="/liff/leave" element={<LiffLeavePage />} />
              <Route path="/liff/grades" element={<LiffGradesPage />} />
              <Route path="/liff/attendance" element={<LiffAttendancePage />} />
              <Route path="/liff/timeline" element={<LiffTimelinePage />} />
              <Route path="/install" element={<InstallPage />} />
              <Route path="/learn/:slug" element={<PublicLearningPage />} />
              <Route path="/w/:code" element={<PublicWorksheetPage />} />
              <Route path="/public-form/:slug" element={<PublicFormPage />} />

              <Route path="/pdf-designer/:id" element={<ProtectedRoute allowedRoles={["admin", "director"]}><PdfDesignerEditorPage /></ProtectedRoute>} />
              <Route path="/form-template/:code" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><FormTemplateEditorPage /></ProtectedRoute>} />
              <Route path="/form-template/:code/fill" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><FormTemplateFillPage /></ProtectedRoute>} />
              
              
              
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><MascotDashboard /></ProtectedRoute>} />
                <Route path="classic" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><Dashboard /></ProtectedRoute>} />

                <Route path="profile" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><ProfilePage /></ProtectedRoute>} />
                <Route path="settings/notifications" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><NotificationSettingsPage /></ProtectedRoute>} />
                <Route path="admin/notifications" element={<ProtectedRoute allowedRoles={["admin", "director"]}><NotificationDeliveryDashboard /></ProtectedRoute>} />
                <Route path="admin/teacher-credentials" element={<ProtectedRoute allowedRoles={["admin"]}><TeacherCredentialsPage /></ProtectedRoute>} />
                <Route path="inbox" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><InboxPage /></ProtectedRoute>} />
                <Route path="news/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni", "parent"]}><NewsDetailPage /></ProtectedRoute>} />
                
                <Route path="users" element={<ProtectedRoute allowedRoles={["admin", "director"]}><UserManagement /></ProtectedRoute>} />
                <Route path="admin/observers" element={<ProtectedRoute allowedRoles={["admin"]}><ObserverManagementPage /></ProtectedRoute>} />
                {/* Academic */}
                <Route path="academic" element={<Navigate to="/dashboard/academic/management" replace />} />
                <Route path="academic/schedule" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["academic"]} bypassRoles={["student","alumni","parent","teacher"]}><SchedulePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/learning-center" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student"]}><LearningCenterPage /></ProtectedRoute>} />
                <Route path="admin/special-rooms" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SpecialRoomsPage /></ProtectedRoute>} />
                <Route path="academic/transcript" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><TranscriptPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/certificate" element={<ProtectedRoute allowedRoles={["admin", "director"]}><CertificatePage /></ProtectedRoute>} />
                <Route path="academic/pp5" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["academic"]} bypassRoles={["student","parent","teacher"]}><Pp5Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/pp5/attendance-print/:assignmentId" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><Pp5AttendancePrintPage /></ProtectedRoute>} />
                <Route path="academic/pp6" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><Pp6Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/pp7" element={<ProtectedRoute allowedRoles={["admin", "director"]}><Pp7Page /></ProtectedRoute>} />
                <Route path="academic/pp3" element={<ProtectedRoute allowedRoles={["admin", "director"]}><Pp3Page /></ProtectedRoute>} />
                <Route path="academic/pp4" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><Pp4Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/pp8" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><Pp8Page /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/incomplete-grades" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><IncompleteGradePage /></ProtectedRoute>} />
                <Route path="academic/teacher-mapping" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TeacherMappingReviewPage /></ProtectedRoute>} />
                <Route path="academic/subject-scan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><SubjectScanPage /></ProtectedRoute>} />
                <Route path="academic/teaching-reflections" element={<ProtectedRoute><TeachingReflectionPage /></ProtectedRoute>} />
                <Route path="academic/teaching-reflections/:id" element={<ProtectedRoute><TeachingReflectionDetailPage /></ProtectedRoute>} />
                <Route path="admin/teaching-reflection-signatures" element={<ProtectedRoute><TeachingReflectionSigSettingsPage /></ProtectedRoute>} />
                <Route path="academic/management" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><AcademicManagementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/all-students" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic","student_affairs"]} bypassRoles={["teacher"]}><AllStudentsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/year-end-promotion" element={<ProtectedRoute allowedRoles={["admin", "director"]}><YearEndPromotionPage /></ProtectedRoute>} />
                <Route path="academic/alumni" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["academic"]} bypassRoles={["teacher"]}><AlumniPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="academic/calendar" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><AcademicCalendarPage /></ProtectedRoute>} />
                <Route path="academic/learning" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><LearningManagePage /></ProtectedRoute>} />
                <Route path="learning" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><LearningHubPage /></ProtectedRoute>} />

                {/* Student Affairs */}
                <Route path="student" element={<Navigate to="/dashboard/student/attendance" replace />} />
                <Route path="student/attendance" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["student_affairs","academic"]} bypassRoles={["parent","student","teacher"]}><AttendancePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/face-scan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><FaceScanPage /></ProtectedRoute>} />
                <Route path="student/behavior" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><DepartmentRoute departments={["student_affairs"]} bypassRoles={["parent","student","teacher"]}><BehaviorPage /></DepartmentRoute></ProtectedRoute>} />

                <Route path="student/leave" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><StudentLeavePage /></ProtectedRoute>} />
                <Route path="student/screening" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs"]}><ScreeningPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/health-trend" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "parent"]}><DepartmentRoute departments={["student_affairs"]} bypassRoles={["parent"]}><HealthTrendPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/homeroom" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs","academic"]} bypassRoles={["teacher"]}><HomeroomPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/sdq" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["student_affairs"]}><SDQPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="student/home-visit" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HomeVisitPage /></ProtectedRoute>} />
                <Route path="fitness" element={<ProtectedRoute><FitnessPage /></ProtectedRoute>} />
                <Route path="student/fitness/poster" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><FitnessPosterPage /></ProtectedRoute>} />
                <Route path="admin/fitness-rewards" element={<ProtectedRoute allowedRoles={["admin", "director"]}><FitnessRewardsAdminPage /></ProtectedRoute>} />
                {/* General Admin */}
                <Route path="admin" element={<Navigate to="/dashboard" replace />} />
                <Route path="admin/news" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><NewsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/document" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DocumentPage /></ProtectedRoute>} />
                <Route path="admin/doc-editor" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DocEditorPage /></ProtectedRoute>} />
                <Route path="admin/pdf-designer" element={<ProtectedRoute allowedRoles={["admin", "director"]}><PdfTemplateDesignerPage /></ProtectedRoute>} />
                <Route path="admin/worksheets" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><WorksheetsPage /></ProtectedRoute>} />
                <Route path="activities" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><ActivitiesPage /></ProtectedRoute>} />
                <Route path="activities/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><ActivityDetailPage /></ProtectedRoute>} />
                <Route path="activities/:id/register" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><ActivityRegisterPage /></ProtectedRoute>} />
                <Route path="sports-day" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><SportsDayPage /></ProtectedRoute>} />
                <Route path="sports-day/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent", "alumni"]}><SportsDayPage /></ProtectedRoute>} />
                <Route path="clubs" element={<ProtectedRoute><ClubsHubPage /></ProtectedRoute>} />
                <Route path="clubs/:id" element={<ProtectedRoute><ClubDetailPage /></ProtectedRoute>} />




                <Route path="admin/emergency" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><EmergencyPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="emergency" element={<ProtectedRoute><EmergencyViewPage /></ProtectedRoute>} />
                <Route path="admin/vaccine" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><VaccinePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/cms" element={<ProtectedRoute allowedRoles={["admin", "director"]}><CmsPage /></ProtectedRoute>} />
                <Route path="admin/id-card" element={<ProtectedRoute allowedRoles={["admin", "director"]}><IdCardTemplatePage /></ProtectedRoute>} />
                <Route path="admin/print-center" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
                <Route path="admin/id-card/bulk-print" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
                <Route path="admin/qr/bulk-print" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><PrintCenterPage /></ProtectedRoute>} />
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
                <Route path="admin/field-visibility" element={<ProtectedRoute allowedRoles={["admin", "director"]}><FieldVisibilityPage /></ProtectedRoute>} />
                <Route path="admin/line-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><LineSettingsPage /></ProtectedRoute>} />
                <Route path="admin/social-feed" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SocialFeedPage /></ProtectedRoute>} />
                <Route path="admin/semester-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SemesterSettingsPage /></ProtectedRoute>} />
                <Route path="admin/academic-periods" element={<ProtectedRoute allowedRoles={["admin", "director"]}><AcademicPeriodSettingsPage /></ProtectedRoute>} />
                <Route path="admin/system-settings" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SystemSettingsPage /></ProtectedRoute>} />
                <Route path="admin/module-toggles" element={<ProtectedRoute allowedRoles={["admin", "director"]}><ModuleTogglesPage /></ProtectedRoute>} />
                <Route path="admin/school-location" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SchoolLocationPage /></ProtectedRoute>} />
                <Route path="admin/eform" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><EFormPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="eform-inbox" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><InboxPage /></ProtectedRoute>} />
                <Route path="admin/school-lunch" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><SchoolLunchPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/school-milk" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin"]}><SchoolMilkPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="admin/action-plan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["general_admin","academic","student_affairs","budget_planning","personnel"]}><ActionPlanPage /></DepartmentRoute></ProtectedRoute>} />
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
                {/* Spider Hub - admin only */}
                <Route path="hub" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SpiderHubPage /></ProtectedRoute>} />
                <Route path="admin/hub" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SpiderHubPage /></ProtectedRoute>} />
                {/* Hub Projects (special projects funded by central hub) */}
                <Route path="projects/hub" element={<Navigate to="/dashboard/finance/procurement?tab=projects" replace />} />
                <Route path="projects/hub/:id" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><HubProjectDetailPage /></ProtectedRoute>} />
                {/* Finance — ฝ่ายงบประมาณและแผน */}
                <Route path="finance" element={<Navigate to="/dashboard/finance/budget" replace />} />
                <Route path="finance/budget" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["budget_planning"]}><BudgetAccountingPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/procurement" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["budget_planning"]}><ProcurementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/assets" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["budget_planning"]}><AssetManagementPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/assets/reports" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["budget_planning"]}><AssetReportsPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="finance/subsidy" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["budget_planning"]}><SubsidyPage /></DepartmentRoute></ProtectedRoute>} />
                {/* HR — ฝ่ายบุคคล */}
                <Route path="hr" element={<Navigate to="/dashboard/hr/personnel" replace />} />
                <Route path="hr/personnel" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["personnel"]}><PersonnelPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/time-clock" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><TimeClockPage /></ProtectedRoute>} />
                <Route path="hr/time-clock/diagnostics" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TimeClockDiagnosticsPage /></ProtectedRoute>} />
                <Route path="hr/attendance-dashboard" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["personnel"]}><AttendanceDashboardPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/leave" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["personnel"]} bypassRoles={["teacher"]}><StaffLeavePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/evaluation" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["personnel"]} bypassRoles={["teacher"]}><EvaluationPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/salary" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DepartmentRoute departments={["personnel"]}><SalaryPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/id-plan" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["personnel"]} bypassRoles={["teacher"]}><IdPlanPage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/substitute" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["personnel"]} bypassRoles={["teacher"]}><SubstitutePage /></DepartmentRoute></ProtectedRoute>} />
                <Route path="hr/org-chart" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><OrgChartPage /></ProtectedRoute>} />
                {/* assessment merged into evaluation */}
                <Route path="hr/assessment" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><DepartmentRoute departments={["personnel"]} bypassRoles={["teacher"]}><EvaluationPage /></DepartmentRoute></ProtectedRoute>} />


                {/* District Feed (External integration) */}
                <Route path="admin/district-feed" element={<ProtectedRoute allowedRoles={["admin", "director"]}><DistrictFeedPage /></ProtectedRoute>} />
                <Route path="admin/test-scores" element={<ProtectedRoute allowedRoles={["admin", "director"]}><TestScoresPage /></ProtectedRoute>} />
                <Route path="admin/smsc" element={<ProtectedRoute allowedRoles={["admin", "director"]}><SmscCenterPage /></ProtectedRoute>} />
                <Route path="admin/obec-standards" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher"]}><ObecStandardsPage /></ProtectedRoute>} />
                <Route path="admin/audit-log" element={<ProtectedRoute allowedRoles={["admin","director"]}><AuditLogPage /></ProtectedRoute>} />
                <Route path="admin/analytics" element={<ProtectedRoute allowedRoles={["admin","director"]}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="admin/bulk-operations" element={<ProtectedRoute allowedRoles={["admin", "director"]}><BulkOperationsPage /></ProtectedRoute>} />
                <Route path="admin/departments" element={<ProtectedRoute allowedRoles={["admin","director"]}><DepartmentManagementPage /></ProtectedRoute>} />
                <Route path="admin/ai-import" element={<ProtectedRoute allowedRoles={["admin"]}><AiImportPage /></ProtectedRoute>} />

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
                <Route path="homework/:taskId/grading" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><HomeworkGradingPage /></ProtectedRoute>} />

                {/* Social feed + portfolio */}
                <Route path="feed" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><FeedPage /></ProtectedRoute>} />
                <Route path="portfolio" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "alumni"]}><PortfolioPage /></ProtectedRoute>} />
                <Route path="members" element={<ProtectedRoute allowedRoles={["admin", "director", "teacher", "student", "parent"]}><MembersPage /></ProtectedRoute>} />

                {/* ===== Finance (new) ===== */}
                <Route path="finance/tuition" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><TuitionInvoicesPage /></ProtectedRoute>} />
                <Route path="finance/scholarships" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><ScholarshipsPage /></ProtectedRoute>} />
                <Route path="finance/coop" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><CoopMembersPage /></ProtectedRoute>} />

                {/* ===== Daily Operations ===== */}
                <Route path="library" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><LibraryBooksPage /></ProtectedRoute>} />
                <Route path="library/loans" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><LibraryLoansPage /></ProtectedRoute>} />
                <Route path="cafeteria" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><CafeteriaMenusPage /></ProtectedRoute>} />
                <Route path="bus" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><BusRoutesPage /></ProtectedRoute>} />

                {/* ===== Academic+ ===== */}
                <Route path="academic/question-bank" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><QuestionBankPage /></ProtectedRoute>} />
                <Route path="academic/tutoring" element={<ProtectedRoute allowedRoles={["admin","director","teacher","student","parent"]}><TutoringSessionsPage /></ProtectedRoute>} />
                <Route path="academic/alumni-university" element={<ProtectedRoute allowedRoles={["admin","director","teacher","alumni"]}><AlumniUniversityPage /></ProtectedRoute>} />
                <Route path="student/guidance" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><GuidanceRecordsPage /></ProtectedRoute>} />

                {/* ===== General Admin (new) ===== */}
                <Route path="admin/saraban" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><SarabanHubPage /></ProtectedRoute>} />
                <Route path="admin/saraban-register" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><SarabanPage /></ProtectedRoute>} />
                <Route path="admin/form-templates" element={<ProtectedRoute allowedRoles={["admin","director"]}><FormTemplatesManagerPage /></ProtectedRoute>} />
                <Route path="admin/mou" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><MouRecordsPage /></ProtectedRoute>} />
                <Route path="admin/room-bookings" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><RoomBookingsPage /></ProtectedRoute>} />
                <Route path="admin/vehicle-bookings" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><VehicleBookingsPage /></ProtectedRoute>} />
                <Route path="admin/sar" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><SarEvidencesPage /></ProtectedRoute>} />

                {/* ===== Security & AI ===== */}
                <Route path="security/visitors" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><VisitorLogsPage /></ProtectedRoute>} />
                <Route path="security/cctv" element={<ProtectedRoute allowedRoles={["admin","director"]}><CctvCamerasPage /></ProtectedRoute>} />
                <Route path="security/cctv/live" element={<ProtectedRoute allowedRoles={["admin","director"]}><CctvLiveViewerPage /></ProtectedRoute>} />
                <Route path="security/early-warning" element={<ProtectedRoute allowedRoles={["admin","director","teacher"]}><EarlyWarningPage /></ProtectedRoute>} />

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
