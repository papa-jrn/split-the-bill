import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "@/components/expense-list";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { GroupMembers } from "@/components/group-members";
import { GroupBalances } from "@/components/group-balances";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { ArrowLeft } from "lucide-react";
import type { Group, GroupMember, Expense, Profile } from "@/lib/types";

interface GroupMemberWithProfile extends GroupMember {
  profiles: Profile;
}

interface ExpenseSplitWithProfile {
  id: string;
  expense_id: string;
  user_id: string;
  amount_cents: number;
  profiles: Profile;
}

interface ExpenseWithDetails extends Expense {
  profiles: Profile;
  expense_splits: ExpenseSplitWithProfile[];
}

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
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
  const typedMembers = (memberRows || [])
    .map((member) => {
      const profile = profileMap.get(member.user_id);
      return profile ? ({ ...member, profiles: profile } as GroupMemberWithProfile) : null;
    })
    .filter((member): member is GroupMemberWithProfile => member !== null);

  const currentMember = typedMembers.find((member) => member.user_id === user.id);
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
  const typedExpenses = (expenseRows || [])
    .map((expense) => {
      const paidByProfile = expenseProfileMap.get(expense.paid_by);
      if (!paidByProfile) {
        return null;
      }

      const splits = (expense.expense_splits || [])
        .map((split) => {
          const profile = expenseProfileMap.get(split.user_id);
          return profile ? ({ ...split, profiles: profile } as ExpenseSplitWithProfile) : null;
        })
        .filter((split): split is ExpenseSplitWithProfile => split !== null);

      return {
        ...expense,
        profiles: paidByProfile,
        expense_splits: splits,
      } as ExpenseWithDetails;
    })
    .filter((expense): expense is ExpenseWithDetails => expense !== null);

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
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="expenses" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {isAdmin && (
              <InviteMemberDialog groupId={id} existingInvites={invites} />
            )}
            <AddExpenseDialog
              groupId={id}
              members={typedMembers}
              currentUserId={user.id}
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
          <GroupBalances expenses={typedExpenses} members={typedMembers} />
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
      </Tabs>
    </div>
  );
}
