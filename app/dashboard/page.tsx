import { createClient } from "@/lib/supabase/server";
import { GroupCard } from "@/components/group-card";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { PendingInvites } from "@/components/pending-invites";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import type { Group, GroupMember } from "@/lib/types";

interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch groups the user belongs to with member counts
  const { data: groups } = await supabase
    .from("groups")
    .select(
      `
      *,
      group_members (
        id,
        user_id,
        role,
        profiles (
          id,
          display_name,
          email
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  // Fetch pending invites for this user
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user!.id)
    .single();

  const { data: invites } = await supabase
    .from("group_invites")
    .select(
      `
      *,
      groups (
        id,
        name
      )
    `
    )
    .eq("email", profile?.email || "");

  const typedGroups = (groups || []) as GroupWithMembers[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Groups</h1>
          <p className="text-muted-foreground">
            Manage your expense groups and split bills with friends.
          </p>
        </div>
        <CreateGroupDialog />
      </div>

      {invites && invites.length > 0 && (
        <PendingInvites invites={invites} userId={user!.id} />
      )}

      {typedGroups.length === 0 ? (
        <Empty>
          <EmptyTitle>No groups yet</EmptyTitle>
          <EmptyDescription>
            Create your first group to start splitting expenses with friends.
          </EmptyDescription>
          <div className="mt-4">
            <CreateGroupDialog />
          </div>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {typedGroups.map((group) => (
            <GroupCard key={group.id} group={group} currentUserId={user!.id} />
          ))}
        </div>
      )}
    </div>
  );
}
