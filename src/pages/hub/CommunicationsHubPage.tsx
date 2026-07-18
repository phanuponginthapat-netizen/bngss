import { lazy } from "react";
import { MessageSquare, Database, Share2 } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const WebhookManagementPage = lazy(() => import("@/pages/admin/WebhookManagementPage"));
const LineSettingsPage = lazy(() => import("@/pages/admin/LineSettingsPage"));
const SocialFeedPage = lazy(() => import("@/pages/admin/SocialFeedPage"));
const DistrictFeedPage = lazy(() => import("@/pages/admin/DistrictFeedPage"));

export default function CommunicationsHubPage() {
  return (
    <TabHubPage
      title="ช่องทางการแจ้งเตือน"
      subtitle="Google Chat · LINE OA · Social Wall · District Feed API — จัดการที่เดียว"
      icon={Share2}
      tabs={[
        { key: "webhooks", label: "Webhooks (Google Chat/LINE)", icon: MessageSquare, Component: WebhookManagementPage },
        { key: "line", label: "บัญชี LINE OA", icon: MessageSquare, Component: LineSettingsPage },
        { key: "social", label: "Social Wall (Facebook)", icon: MessageSquare, Component: SocialFeedPage },
        { key: "district", label: "District Feed API", icon: Database, Component: DistrictFeedPage },
      ]}
    />
  );
}
