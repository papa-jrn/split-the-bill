import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "@/components/expense-list";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { GroupMembers } from "@/components/group-members";
import { GroupBalances } from "@/components/group-balances";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { GroupArchiveToggle } from "@/components/group-archive-toggle";
import { GroupDeleteButton } from "@/components/group-delete-button";
import { GroupMessageBoard } from "@/components/group-message-board";
import { ArrowLeft } from "lucide-react";
import type { Group, GroupMember, Expense, GroupMessage, GroupPayment, Profile } from "@/lib/types";

interface GroupMemberWithProfile extends GroupMember {
  profiles?: Profile;
}

interface ExpenseSplitWithProfile {
  id: string;
  expense_id: string;
  user_id: string;
  amount_cents: number;
  profiles?: Profile;
}

interface ExpenseWithDetails extends Expense {
  profiles?: Profile;
  expense_splits: ExpenseSplitWithProfile[];
}

interface GroupMessageWithProfile extends GroupMessage {
  profiles?: Profile;
}

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !group) {
    notFound();
  }

  const { data: memberRows } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, role, joined_at")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const memberIds = (memberRows || []).map((member) => member.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .in("id", memberIds)
    : { data: [] as Profile[] };

  const profileMap = new Map((memberProfiles || []).map((profile) => [profile.id, profile]));
  const typedMembers = (memberRows || []).map((member) => ({
    ...member,
    profiles: profileMap.get(member.user_id),
  })) as GroupMemberWithProfile[];

  const currentMember = (memberRows || []).find((member) => member.user_id === user.id);
  const isCreator = group.created_by === user.id;

  if (!currentMember && !isCreator) {
    notFound();
  }

  const isAdmin = currentMember?.role === "admin" || isCreator;

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select(
      `
      id,
      group_id,
      description,
      amount_cents,
      paid_by,
      created_by,
      expense_date,
      created_at,
      expense_splits (
        id,
        expense_id,
        user_id,
        amount_cents
      )
    `
    )
    .eq("group_id", id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const expenseProfileIds = Array.from(
    new Set(
      (expenseRows || []).flatMap((expense) => [
        expense.paid_by,
        ...((expense.expense_splits || []).map((split) => split.user_id)),
      ])
    )
  );

  const { data: expenseProfiles } = expenseProfileIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .in("id", expenseProfileIds)
    : { data: [] as Profile[] };

  const expenseProfileMap = new Map((expenseProfiles || []).map((profile) => [profile.id, profile]));
  const typedExpenses = (expenseRows || []).map((expense) => ({
    ...expense,
    profiles: expenseProfileMap.get(expense.paid_by),
    expense_splits: (expense.expense_splits || []).map((split) => ({
      ...split,
      profiles: expenseProfileMap.get(split.user_id),
    })),
  })) as ExpenseWithDetails[];

  const { data: messageRows } = await supabase
    .from("group_messages")
    .select("id, group_id, user_id, body, created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: true });

  const messageProfileIds = Array.from(
    new Set((messageRows || []).map((message) => message.user_id))
  );
  const { data: messageProfiles } = messageProfileIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .in("id", messageProfileIds)
    : { data: [] as Profile[] };

  const messageProfileMap = new Map(
    (messageProfiles || []).map((profile) => [profile.id, profile])
  );
  const typedMessages = (messageRows || []).map((message) => ({
    ...message,
    profiles: messageProfileMap.get(message.user_id),
  })) as GroupMessageWithProfile[];

  const { data: paymentRows } = await supabase
    .from("group_payments")
    .select("id, group_id, from_user_id, to_user_id, amount_cents, status, created_by, created_at, paid_marked_at, confirmed_at")
    .eq("group_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const typedPayments = (paymentRows || []) as GroupPayment[];

  let invites: { id: string; email: string; created_at: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("group_invites")
      .select("id, email, created_at")
      .eq("group_id", id);
    invites = data || [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            {group.archived_at && (
              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <GroupArchiveToggle groupId={id} isArchived={Boolean(group.archived_at)} />
            <GroupDeleteButton groupId={id} groupName={group.name} />
          </div>
        )}
      </div>

      {group.archived_at && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          This group is archived. You can still review expenses, balances, and messages, but adding new expenses or recording settlements is disabled until you unarchive it.
        </div>
      )}

      <Tabs defaultValue="expenses" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {isAdmin && (
              <InviteMemberDialog groupId={id} existingInvites={invites} />
            )}
            <AddExpenseDialog
              groupId={id}
              members={typedMembers}
              currentUserId={user.id}
              disabled={Boolean(group.archived_at)}
            />
          </div>
        </div>

        <TabsContent value="expenses" className="space-y-4">
          <ExpenseList
            expenses={typedExpenses}
            members={typedMembers}
            currentUserId={user.id}
            groupId={id}
          />
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <GroupBalances
            expenses={typedExpenses}
            members={typedMembers}
            payments={typedPayments}
            groupId={id}
            currentUserId={user.id}
            isArchived={Boolean(group.archived_at)}
          />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <GroupMembers
            members={typedMembers}
            currentUserId={user.id}
            isAdmin={isAdmin}
            groupId={id}
            pendingInvites={invites}
          />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <GroupMessageBoard
            groupId={id}
            currentUserId={user.id}
            messages={typedMessages}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
