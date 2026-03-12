"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface Invite {
  id: string;
  group_id: string;
  email: string;
  groups: {
    id: string;
    name: string;
  };
}

interface PendingInvitesProps {
  invites: Invite[];
  userId: string;
}

export function PendingInvites({ invites, userId }: PendingInvitesProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAccept = async (invite: Invite) => {
    setLoadingId(invite.id);
    const supabase = createClient();

    // Add user to the group
    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: invite.group_id,
      user_id: userId,
      role: "member",
    });

    if (memberError) {
      console.error("Error joining group:", memberError);
      setLoadingId(null);
      return;
    }

    // Delete the invite
    await supabase.from("group_invites").delete().eq("id", invite.id);

    setLoadingId(null);
    router.refresh();
  };

  const handleDecline = async (inviteId: string) => {
    setLoadingId(inviteId);
    const supabase = createClient();

    await supabase.from("group_invites").delete().eq("id", inviteId);

    setLoadingId(null);
    router.refresh();
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Pending Invitations</CardTitle>
        <CardDescription>
          You have been invited to join the following groups.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3"
          >
            <div>
              <p className="font-medium">{invite.groups.name}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(invite.id)}
                disabled={loadingId === invite.id}
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => handleAccept(invite)}
                disabled={loadingId === invite.id}
              >
                {loadingId === invite.id && <Spinner className="mr-2" />}
                Accept
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
