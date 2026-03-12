"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";
import { parseCurrency } from "@/lib/types";
import type { GroupMember, Profile } from "@/lib/types";

interface GroupMemberWithProfile extends GroupMember {
  profiles: Profile;
}

interface AddExpenseDialogProps {
  groupId: string;
  members: GroupMemberWithProfile[];
  currentUserId: string;
}

export function AddExpenseDialog({
  groupId,
  members,
  currentUserId,
}: AddExpenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitAmong, setSplitAmong] = useState<string[]>(
    members.map((m) => m.user_id)
  );
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState("");

  const handleToggleMember = (userId: string) => {
    setSplitAmong((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    const amountCents = parseCurrency(amount);
    if (amountCents <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (splitAmong.length === 0) {
      setError("Select at least one person to split with");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();

    // Create the expense
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        group_id: groupId,
        description: description.trim(),
        amount_cents: amountCents,
        paid_by: paidBy,
        created_by: currentUserId,
        expense_date: expenseDate,
      })
      .select()
      .single();

    if (expenseError) {
      setError(expenseError.message);
      setLoading(false);
      return;
    }

    // Calculate split amounts (equal split)
    const splitCount = splitAmong.length;
    const baseAmount = Math.floor(amountCents / splitCount);
    const remainder = amountCents % splitCount;

    // Create expense splits
    const splits = splitAmong.map((userId, index) => ({
      expense_id: expense.id,
      user_id: userId,
      // Distribute remainder cents to first few people
      amount_cents: baseAmount + (index < remainder ? 1 : 0),
    }));

    const { error: splitsError } = await supabase
      .from("expense_splits")
      .insert(splits);

    if (splitsError) {
      // Rollback expense if splits fail
      await supabase.from("expenses").delete().eq("id", expense.id);
      setError(splitsError.message);
      setLoading(false);
      return;
    }

    setOpen(false);
    setDescription("");
    setAmount("");
    setPaidBy(currentUserId);
    setSplitAmong(members.map((m) => m.user_id));
    setExpenseDate(new Date().toISOString().split("T")[0]);
    router.refresh();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Reset form when opening
      setSplitAmong(members.map((m) => m.user_id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add an expense</DialogTitle>
            <DialogDescription>
              Record a new expense and split it among group members.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input
                id="description"
                placeholder="Dinner at the restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-7"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input
                id="date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="paidBy">Paid by</FieldLabel>
              <Select value={paidBy} onValueChange={setPaidBy} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => {
                    const name =
                      member.profiles.display_name ||
                      member.profiles.email.split("@")[0];
                    return (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {name}
                        {member.user_id === currentUserId && " (you)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Split among</FieldLabel>
              <div className="space-y-2 rounded-lg border p-3">
                {members.map((member) => {
                  const name =
                    member.profiles.display_name ||
                    member.profiles.email.split("@")[0];
                  const isChecked = splitAmong.includes(member.user_id);
                  return (
                    <label
                      key={member.user_id}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleMember(member.user_id)}
                        disabled={loading}
                      />
                      <span className="text-sm">
                        {name}
                        {member.user_id === currentUserId && " (you)"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {splitAmong.length > 0 &&
                  `Split equally: ${parseCurrency(amount) > 0 ? `$${(parseCurrency(amount) / splitAmong.length / 100).toFixed(2)} each` : ""}`}
              </p>
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2" />}
              Add Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
