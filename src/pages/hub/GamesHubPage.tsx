import { lazy } from "react";
import { Gamepad2, Settings, KeyRound } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const GamesStorePage = lazy(() => import("@/pages/games/GamesStorePage"));
const GameHubAdminPage = lazy(() => import("@/pages/admin/GameHubAdminPage"));
const GameHubApiKeysPage = lazy(() => import("@/pages/admin/GameHubApiKeysPage"));

export default function GamesHubPage() {
  return (
    <TabHubPage
      title="ศูนย์เกมการเรียนรู้"
      subtitle="คลังเกม · จัดการเกม · รหัส API — รวมในหน้าเดียว"
      icon={Gamepad2}
      tabs={[
        { key: "store", label: "คลังเกม", icon: Gamepad2, Component: GamesStorePage },
        { key: "admin", label: "จัดการเกม", icon: Settings, Component: GameHubAdminPage },
        { key: "api-keys", label: "รหัส API", icon: KeyRound, Component: GameHubApiKeysPage },
      ]}
    />
  );
}
