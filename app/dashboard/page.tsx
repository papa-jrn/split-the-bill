import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import { GroupCard } from "@/components/group-card";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { PendingInvites } from "@/components/pending-invites";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import type { Group, GroupMember } from "@/lib/types";

interface GroupWithMembers extends Group {
  group_members: GroupMember[];
}

export default async function DashboardPage() {
  noStore();
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
        group_id,
        user_id,
        role,
        joined_at
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
  const activeGroups = typedGroups.filter((group) => !group.archived_at);
  const archivedGroups = typedGroups.filter((group) => group.archived_at);

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
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Active Groups</h2>
              <p className="text-sm text-muted-foreground">
                Current groups where you can keep adding expenses and settlements.
              </p>
            </div>
            {activeGroups.length === 0 ? (
              <Empty>
                <EmptyTitle>No active groups</EmptyTitle>
                <EmptyDescription>
                  Archive history is available below. Create a new group or unarchive an old one to get started again.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeGroups.map((group) => (
                  <GroupCard key={group.id} group={group} currentUserId={user!.id} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Past Groups</h2>
              <p className="text-sm text-muted-foreground">
                Archived groups stay here for reference, receipts, and prior settlements.
              </p>
            </div>
            {archivedGroups.length === 0 ? (
              <Empty>
                <EmptyTitle>No past groups</EmptyTitle>
                <EmptyDescription>
                  Archived groups will appear here when you move them out of your active list.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedGroups.map((group) => (
                  <GroupCard key={group.id} group={group} currentUserId={user!.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
