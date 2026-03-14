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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { HandCoins, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import { getMemberDisplayName } from "@/lib/member-display";
import type { Expense, GroupMember, Profile } from "@/lib/types";

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
  profiles: Profile;
}

interface ExpenseListProps {
  expenses: ExpenseWithDetails[];
  members: GroupMemberWithProfile[];
  currentUserId: string;
  groupId: string;
}

export function ExpenseList({
  expenses,
  members,
  currentUserId,
  groupId,
}: ExpenseListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId);
    const supabase = createClient();

    await supabase.from("expenses").delete().eq("id", expenseId);

    setDeletingId(null);
    router.refresh();
  };

  if (expenses.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No expenses yet</EmptyTitle>
        <EmptyDescription>
          Add your first expense to start tracking who owes what.
        </EmptyDescription>
      </Empty>
    );
  }

  // Group expenses by date
  const expensesByDate = expenses.reduce(
    (acc, expense) => {
      const date = expense.expense_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(expense);
      return acc;
    },
    {} as Record<string, ExpenseWithDetails[]>
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(expensesByDate).map(([date, dateExpenses]) => (
        <div key={date} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-2">
            {formatDate(date)}
          </h3>
          {dateExpenses.map((expense) => {
            const paidByName = getMemberDisplayName(expense.paid_by, expense.profiles);
            const paidByInitials = paidByName.slice(0, 2).toUpperCase();
            const isPaidByCurrentUser = expense.paid_by === currentUserId;
            const canDelete = expense.created_by === currentUserId;
            const isSettlement = expense.description.startsWith("Settlement:");

            const splitNames = expense.expense_splits
              .map((split) => {
                const name = getMemberDisplayName(split.user_id, split.profiles);
                return split.user_id === currentUserId ? "you" : name;
              })
              .join(", ");

            return (
              <Card
                key={expense.id}
                className={isSettlement ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20" : undefined}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={isSettlement ? "bg-emerald-100 text-emerald-700 text-sm dark:bg-emerald-900/60 dark:text-emerald-200" : "bg-primary/10 text-primary text-sm"}
                      >
                        {isSettlement ? <HandCoins className="h-4 w-4" /> : paidByInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{expense.description}</p>
                            {isSettlement && (
                              <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                                Settlement
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {isSettlement
                              ? `${isPaidByCurrentUser ? "You" : paidByName} recorded a settlement for ${formatCurrency(expense.amount_cents)}`
                              : `${isPaidByCurrentUser ? "You" : paidByName} paid ${formatCurrency(expense.amount_cents)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  disabled={deletingId === expense.id}
                                >
                                  {deletingId === expense.id ? (
                                    <Spinner />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete expense?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete &quot;
                                    {expense.description}&quot; and update all
                                    balances. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(expense.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={isSettlement ? "outline" : "secondary"} className="text-xs">
                          Split {expense.expense_splits.length} {expense.expense_splits.length === 1 ? "way" : "ways"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {isSettlement ? `Settled with ${splitNames}` : `with ${splitNames}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
