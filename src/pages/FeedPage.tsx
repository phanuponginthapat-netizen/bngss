import { Newspaper } from "lucide-react";
import WallFeed from "@/components/social/WallFeed";

export default function FeedPage() {
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Newspaper className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">ฟีดโรงเรียน</h1>
          <p className="text-sm text-muted-foreground">แบ่งปันกิจกรรม ผลงาน และข่าวสารระหว่างครู บุคลากร นักเรียน และผู้ปกครอง</p>
        </div>
      </div>
      <WallFeed />
    </div>
  );
}
