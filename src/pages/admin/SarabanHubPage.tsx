import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, FileText } from "lucide-react";
import SarabanPage from "./SarabanPage";
import DocumentPage from "./DocumentPage";

export default function SarabanHubPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
      </div>
      <Tabs defaultValue="register" className="w-full">
        <TabsList>
          <TabsTrigger value="register" className="gap-2">
            <Inbox className="w-4 h-4" /> ทะเบียนรับ-ส่ง (e-Saraban)
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="w-4 h-4" /> หนังสือสารบรรณ (ไฟล์)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="register" className="mt-4">
          <SarabanPage />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
