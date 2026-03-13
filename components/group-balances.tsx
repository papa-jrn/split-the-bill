"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ArrowRight, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { Expense, GroupMember, Profile } from "@/lib/types";
import { getMemberDisplayName } from "@/lib/member-display";

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

interface GroupMemberWithProfile extends GroupMember {
  profiles?: Profile;
}

interface GroupBalancesProps {
  expenses: ExpenseWithDetails[];
  members: GroupMemberWithProfile[];
}

interface Balance {
  userId: string;
  name: string;
  balance: number; // positive = is owed, negative = owes
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
  // Initialize balances for all members
  const balances: Record<string, number> = {};
  members.forEach((m) => {
    balances[m.user_id] = 0;
  });

  // Process each expense
  expenses.forEach((expense) => {
    // Person who paid gets credit for the full amount
    balances[expense.paid_by] = (balances[expense.paid_by] || 0) + expense.amount_cents;

    // Each person in the split owes their share
    expense.expense_splits.forEach((split) => {
      balances[split.user_id] = (balances[split.user_id] || 0) - split.amount_cents;
    });
  });

  // Convert to array with names
  return members.map((member) => {
    const name = getMemberDisplayName(member.user_id, member.profiles);
    return {
      userId: member.user_id,
      name,
      balance: balances[member.user_id] || 0,
    };
  });
}

function calculateSettlements(balances: Balance[]): Settlement[] {
  // Separate people who owe money (debtors) from people who are owed (creditors)
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, amount: Math.abs(b.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  // Greedy algorithm to minimize transactions
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

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

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return settlements;
}

export function GroupBalances({ expenses, members }: GroupBalancesProps) {
  const balances = calculateBalances(expenses, members);
  const settlements = calculateSettlements(balances);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_cents, 0);

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
      {/* Summary Card */}
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
                      <Badge className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
                        <TrendingUp className="h-3 w-3" />
                        Gets back {formatCurrency(balance.balance)}
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
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

      {/* Settlements Card */}
      {settlements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Suggested Settlements</CardTitle>
            <CardDescription>
              The simplest way to settle up all debts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settlements.map((settlement, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-red-500/10 text-red-600">
                        {settlement.fromName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{settlement.fromName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">pays</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(settlement.amount)}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-medium">{settlement.toName}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-green-500/10 text-green-600">
                        {settlement.toName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {settlements.length === 0 && expenses.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
