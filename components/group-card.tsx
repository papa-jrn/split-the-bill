import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Group, GroupMember } from "@/lib/types";

interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

interface GroupCardProps {
  group: GroupWithMembers;
  currentUserId: string;
}

export function GroupCard({ group, currentUserId }: GroupCardProps) {
  const memberCount = group.group_members.length;
  const currentMember = group.group_members.find(
    (m) => m.user_id === currentUserId
  );
  const isAdmin = currentMember?.role === "admin";

  return (
    <Link href={`/dashboard/groups/${group.id}`}>
      <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl line-clamp-1">{group.name}</CardTitle>
            {isAdmin && (
              <Badge variant="secondary" className="shrink-0">
                Admin
              </Badge>
            )}
          </div>
          {group.description && (
            <CardDescription className="line-clamp-2">
              {group.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {group.group_members.slice(0, 4).map((member, index) => {
                const profile = member.profiles as { display_name?: string; email?: string } | undefined;
                const name = profile?.display_name || profile?.email?.split("@")[0] || "?";
                return (
                  <Avatar
                    key={member.id}
                    className="h-8 w-8 border-2 border-background"
                    style={{ zIndex: 4 - index }}
                  >
                    <AvatarFallback className="text-xs bg-muted">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {memberCount > 4 && (
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-muted">
                    +{memberCount - 4}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
