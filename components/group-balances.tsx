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
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { Expense, GroupMember, GroupPayment, Profile } from "@/lib/types";
import { getMemberDisplayName } from "@/lib/member-display";

interface ExpenseWithDetails extends Expense {
  profiles?: Profile;
  expense_splits: {
    id: string;
    expense_id: string;
    user_id: string;
    amount_cents: number;
    profiles?: Profile;
  }[];
}

interface GroupMemberWithProfile extends GroupMember {
  profiles?: Profile;
}

interface GroupBalancesProps {
  expenses: ExpenseWithDetails[];
  members: GroupMemberWithProfile[];
  payments: GroupPayment[];
  groupId: string;
  currentUserId: string;
  isArchived?: boolean;
}

interface Balance {
  userId: string;
  name: string;
  balance: number;
}

interface Settlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

function calculateBalances(
  expenses: ExpenseWithDetails[],
  members: GroupMemberWithProfile[]
): Balance[] {
  const balances: Record<string, number> = {};
  members.forEach((member) => {
    balances[member.user_id] = 0;
  });

  expenses.forEach((expense) => {
    balances[expense.paid_by] = (balances[expense.paid_by] || 0) + expense.amount_cents;
    expense.expense_splits.forEach((split) => {
      balances[split.user_id] = (balances[split.user_id] || 0) - split.amount_cents;
    });
  });

  return members.map((member) => ({
    userId: member.user_id,
    name: getMemberDisplayName(member.user_id, member.profiles),
    balance: balances[member.user_id] || 0,
  }));
}

function calculateSettlements(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => balance.balance < 0)
    .map((balance) => ({ ...balance, amount: Math.abs(balance.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((balance) => balance.balance > 0)
    .map((balance) => ({ ...balance, amount: balance.balance }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      settlements.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return settlements;
}

function getSettlementKey(settlement: Settlement) {
  return `${settlement.from}-${settlement.to}-${settlement.amount}`;
}

export function GroupBalances({
  expenses,
  members,
  payments,
  groupId,
  currentUserId,
  isArchived = false,
}: GroupBalancesProps) {
  const router = useRouter();
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const balances = calculateBalances(expenses, members);
  const settlements = calculateSettlements(balances);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);

  const findPendingPayment = (settlement: Settlement) =>
    payments.find(
      (payment) =>
        payment.status === "pending" &&
        payment.from_user_id === settlement.from &&
        payment.to_user_id === settlement.to &&
        payment.amount_cents === settlement.amount
    );

  const createSettlementExpense = async (settlement: Settlement) => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        group_id: groupId,
        description: `Settlement: ${settlement.fromName} paid ${settlement.toName}`,
        amount_cents: settlement.amount,
        paid_by: settlement.from,
        created_by: currentUserId,
        expense_date: today,
      })
      .select()
      .single();

    if (expenseError) {
      return { error: expenseError.message };
    }

    const { error: splitError } = await supabase.from("expense_splits").insert({
      expense_id: expense.id,
      user_id: settlement.to,
      amount_cents: settlement.amount,
    });

    if (splitError) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: splitError.message };
    }

    return { error: null as string | null };
  };

  const handleMarkPaid = async (settlement: Settlement) => {
    const settlementKey = getSettlementKey(settlement);
    setActionKey(settlementKey);
    setError("");

    const supabase = createClient();
    const { error: paymentError } = await supabase.from("group_payments").insert({
      group_id: groupId,
      from_user_id: settlement.from,
      to_user_id: settlement.to,
      amount_cents: settlement.amount,
      status: "pending",
      created_by: currentUserId,
    });

    if (paymentError) {
      setError(paymentError.code === "23505" ? "This payment is already waiting for confirmation." : paymentError.message);
      setActionKey(null);
      return;
    }

    setActionKey(null);
    router.refresh();
  };

  const handleConfirmPayment = async (settlement: Settlement, paymentId: string) => {
    const settlementKey = getSettlementKey(settlement);
    setActionKey(settlementKey);
    setError("");

    const settlementResult = await createSettlementExpense(settlement);
    if (settlementResult.error) {
      setError(settlementResult.error);
      setActionKey(null);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("group_payments")
      .update({ status: "completed", confirmed_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (updateError) {
      setError(updateError.message);
      setActionKey(null);
      return;
    }

    setActionKey(null);
    router.refresh();
  };

  if (expenses.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No balances yet</EmptyTitle>
        <EmptyDescription>
          Add expenses to see who owes what.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Summary</CardTitle>
          <CardDescription>
            Total expenses: {formatCurrency(totalExpenses)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {balances.map((balance) => {
              const initials = balance.name.slice(0, 2).toUpperCase();
              const isPositive = balance.balance > 0;
              const isZero = balance.balance === 0;

              return (
                <div
                  key={balance.userId}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-muted">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{balance.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isZero ? (
                      <Badge variant="secondary" className="gap-1">
                        <Scale className="h-3 w-3" />
                        Settled
                      </Badge>
                    ) : isPositive ? (
                      <Badge className="gap-1 border-green-500/20 bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        <TrendingUp className="h-3 w-3" />
                        Gets back {formatCurrency(balance.balance)}
                      </Badge>
                    ) : (
                      <Badge className="gap-1 border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20">
                        <TrendingDown className="h-3 w-3" />
                        Owes {formatCurrency(Math.abs(balance.balance))}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {settlements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Suggested Payments</CardTitle>
            <CardDescription>
              These are the minimum payments needed to settle all balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settlements.map((settlement) => {
                const settlementKey = getSettlementKey(settlement);
                const isActing = actionKey === settlementKey;
                const pendingPayment = findPendingPayment(settlement);
                const isDebtor = currentUserId === settlement.from;
                const isRecipient = currentUserId === settlement.to;

                return (
                  <div
                    key={settlementKey}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm sm:text-base">
                        <span className="font-medium">{settlement.fromName}</span>
                        <span className="text-muted-foreground">should pay</span>
                        <span className="font-medium">{settlement.toName}</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(settlement.amount)}
                        </span>
                      </div>
                      {pendingPayment ? (
                        isRecipient ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleConfirmPayment(settlement, pendingPayment.id)}
                            disabled={isActing || isArchived}
                          >
                            {isActing && <Spinner className="mr-2" />}
                            Confirm payment
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="gap-1 self-start sm:self-auto">
                            <Clock3 className="h-3 w-3" />
                            {isDebtor ? "Marked paid" : `Waiting for ${settlement.toName} to confirm`}
                          </Badge>
                        )
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleMarkPaid(settlement)}
                          disabled={isActing || isArchived || !isDebtor}
                        >
                          {isActing && <Spinner className="mr-2" />}
                          {isDebtor ? "Mark as paid" : `Waiting for ${settlement.fromName}`}
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-red-500/10 text-red-600">
                            {settlement.fromName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{settlement.fromName}</span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-green-500/10 text-green-600">
                            {settlement.toName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{settlement.toName}</span>
                      </div>
                    </div>
                    {pendingPayment && (
                      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {isRecipient
                          ? `${settlement.fromName} marked this payment as sent. Confirm it once the money arrives.`
                          : `${settlement.fromName} marked this payment as sent and it is waiting on ${settlement.toName} to confirm.`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isArchived && (
              <p className="mt-4 text-sm text-muted-foreground">
                This group is archived, so suggested payments are view-only until the group is unarchived.
              </p>
            )}
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {settlements.length === 0 && expenses.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Scale className="mb-4 mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="font-semibold">All settled up!</h3>
            <p className="text-sm text-muted-foreground">
              Everyone is even. No payments needed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
