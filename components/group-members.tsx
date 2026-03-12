"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2, Clock } from "lucide-react";
import type { GroupMember, Profile } from "@/lib/types";

interface GroupMemberWithProfile extends GroupMember {
  profiles: Profile;
}

interface GroupMembersProps {
  members: GroupMemberWithProfile[];
  currentUserId: string;
  isAdmin: boolean;
  groupId: string;
  pendingInvites: { id: string; email: string; created_at: string }[];
}

export function GroupMembers({
  members,
  currentUserId,
  isAdmin,
  groupId,
  pendingInvites,
}: GroupMembersProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    setLoadingId(memberId);
    const supabase = createClient();

    await supabase.from("group_members").delete().eq("id", memberId);

    setLoadingId(null);
    router.refresh();
  };

  const handleCancelInvite = async (inviteId: string) => {
    setLoadingId(inviteId);
    const supabase = createClient();

    await supabase.from("group_invites").delete().eq("id", inviteId);

    setLoadingId(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Members</CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? "member" : "members"} in this
          group
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => {
          const name =
            member.profiles.display_name ||
            member.profiles.email.split("@")[0];
          const initials = name.slice(0, 2).toUpperCase();
          const isCurrentUser = member.user_id === currentUserId;

          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {name}
                    {isCurrentUser && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.profiles.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.role === "admin" && <Badge>Admin</Badge>}
                {isAdmin && !isCurrentUser && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={loadingId === member.id}
                  >
                    {loadingId === member.id ? (
                      <Spinner />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {pendingInvites.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-sm font-medium text-muted-foreground">
                Pending Invitations
              </p>
            </div>
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">
                      {invite.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Invitation pending
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelInvite(invite.id)}
                    disabled={loadingId === invite.id}
                  >
                    {loadingId === invite.id ? <Spinner /> : "Cancel"}
                  </Button>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
