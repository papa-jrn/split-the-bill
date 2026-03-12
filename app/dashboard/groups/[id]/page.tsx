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

interface ExpenseWithDetails extends Expense {
  profiles: Profile;
  expense_splits: {
    id: string;
    expense_id: string;
    user_id: string;
    amount_cents: number;
    profiles: Profile;
  }[];
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

  // Fetch group details
  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !group) {
    notFound();
  }

  // Fetch group members with profiles
  const { data: members } = await supabase
    .from("group_members")
    .select(
      `
      *,
      profiles (*)
    `
    )
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  // Check if current user is a member or the creator
  const currentMember = members?.find((m) => m.user_id === user.id);
  const isCreator = group.created_by === user.id;
  
  if (!currentMember && !isCreator) {
    notFound();
  }

  const isAdmin = currentMember?.role === "admin" || isCreator;

  // Fetch expenses with paid_by profile and splits
  const { data: expenses } = await supabase
    .from("expenses")
    .select(
      `
      *,
      profiles!expenses_paid_by_fkey (*),
      expense_splits (
        *,
        profiles (*)
      )
    `
    )
    .eq("group_id", id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  // Fetch pending invites for this group (only if admin)
  let invites: { id: string; email: string; created_at: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("group_invites")
      .select("id, email, created_at")
      .eq("group_id", id);
    invites = data || [];
  }

  const typedMembers = (members || []) as GroupMemberWithProfile[];
  const typedExpenses = (expenses || []) as ExpenseWithDetails[];

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
