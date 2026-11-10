import WallFeed from "@/components/social/WallFeed";

export default function MyPostsTab({ userId }: { userId: string }) {
  return <WallFeed profileUserId={userId} />;
}