import Image from "next/image";
import { UserRound } from "lucide-react";

/** A member's photo, or a person icon when there isn't one. */
export function MemberAvatar({ photoUrl, size = 44 }: { photoUrl: string | null; size?: number }) {
  if (photoUrl) return <Image src={photoUrl} alt="" width={size} height={size} />;
  return (
    <span className="portal-avatar" aria-hidden="true">
      <UserRound size={Math.round(size * 0.5)} strokeWidth={1.7} />
    </span>
  );
}
