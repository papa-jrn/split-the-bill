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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";
import { parseCurrency } from "@/lib/types";
import type { GroupMember, Profile } from "@/lib/types";
import { getMemberDisplayName } from "@/lib/member-display";

interface GroupMemberWithProfile extends GroupMember {
  profiles?: Profile;
}

type SplitMode = "equal" | "exact";

interface AddExpenseDialogProps {
  groupId: string;
  members: GroupMemberWithProfile[];
  currentUserId: string;
}

function getInitialExactSplits(members: GroupMemberWithProfile[]) {
  return Object.fromEntries(members.map((member) => [member.user_id, ""]));
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
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [splitAmong, setSplitAmong] = useState<string[]>(
    members.map((m) => m.user_id)
  );
  const [exactSplits, setExactSplits] = useState<Record<string, string>>(
    getInitialExactSplits(members)
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

  const handleExactSplitChange = (userId: string, value: string) => {
    setExactSplits((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  const fillExactSplitsFromEqual = (amountValue: string) => {
    const amountCents = parseCurrency(amountValue);
    const selectedMembers = splitAmong.length > 0 ? splitAmong : members.map((member) => member.user_id);

    if (amountCents <= 0 || selectedMembers.length === 0) {
      setExactSplits(getInitialExactSplits(members));
      return;
    }

    const baseAmount = Math.floor(amountCents / selectedMembers.length);
    const remainder = amountCents % selectedMembers.length;

    const nextSplits = getInitialExactSplits(members);
    selectedMembers.forEach((userId, index) => {
      const cents = baseAmount + (index < remainder ? 1 : 0);
      nextSplits[userId] = (cents / 100).toFixed(2);
    });

    setExactSplits(nextSplits);
  };

  const handleSplitModeChange = (value: string) => {
    const nextMode = value as SplitMode;
    setSplitMode(nextMode);
    if (nextMode === "exact") {
      fillExactSplitsFromEqual(amount);
    }
  };

  const exactSplitEntries = members
    .map((member) => ({
      user_id: member.user_id,
      amount_cents: parseCurrency(exactSplits[member.user_id] || ""),
    }))
    .filter((entry) => entry.amount_cents > 0);

  const exactSplitTotal = exactSplitEntries.reduce(
    (sum, entry) => sum + entry.amount_cents,
    0
  );

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

    let splits: { user_id: string; amount_cents: number }[] = [];

    if (splitMode === "equal") {
      if (splitAmong.length === 0) {
        setError("Select at least one person to split with");
        return;
      }

      const splitCount = splitAmong.length;
      const baseAmount = Math.floor(amountCents / splitCount);
      const remainder = amountCents % splitCount;

      splits = splitAmong.map((userId, index) => ({
        user_id: userId,
        amount_cents: baseAmount + (index < remainder ? 1 : 0),
      }));
    } else {
      if (exactSplitEntries.length === 0) {
        setError("Enter at least one split amount");
        return;
      }

      if (exactSplitTotal !== amountCents) {
        setError("Exact split amounts must add up to the total expense");
        return;
      }

      splits = exactSplitEntries;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();

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

    const { error: splitsError } = await supabase
      .from("expense_splits")
      .insert(
        splits.map((split) => ({
          expense_id: expense.id,
          user_id: split.user_id,
          amount_cents: split.amount_cents,
        }))
      );

    if (splitsError) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      setError(splitsError.message);
      setLoading(false);
      return;
    }

    setOpen(false);
    setDescription("");
    setAmount("");
    setPaidBy(currentUserId);
    setSplitMode("equal");
    setSplitAmong(members.map((m) => m.user_id));
    setExactSplits(getInitialExactSplits(members));
    setExpenseDate(new Date().toISOString().split("T")[0]);
    router.refresh();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSplitMode("equal");
      setSplitAmong(members.map((m) => m.user_id));
      setExactSplits(getInitialExactSplits(members));
      setError("");
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
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden p-0 sm:max-h-[90vh]">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col sm:max-h-[90vh]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Add an expense</DialogTitle>
            <DialogDescription>
              Record a new expense and choose how to split it across the group.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
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
                    const name = getMemberDisplayName(member.user_id, member.profiles);
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
              <FieldLabel>Split mode</FieldLabel>
              <RadioGroup
                value={splitMode}
                onValueChange={handleSplitModeChange}
                className="gap-3"
              >
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                  <RadioGroupItem value="equal" />
                  <div>
                    <p className="text-sm font-medium">Equal</p>
                    <p className="text-xs text-muted-foreground">
                      Split evenly among the selected members.
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                  <RadioGroupItem value="exact" />
                  <div>
                    <p className="text-sm font-medium">Exact</p>
                    <p className="text-xs text-muted-foreground">
                      Enter a specific amount for each person.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </Field>
            {splitMode === "equal" ? (
              <Field>
                <FieldLabel>Split among</FieldLabel>
                <div className="space-y-2 rounded-lg border p-3">
                  {members.map((member) => {
                    const name = getMemberDisplayName(member.user_id, member.profiles);
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {splitAmong.length > 0 && parseCurrency(amount) > 0
                    ? `Split equally: $${(parseCurrency(amount) / splitAmong.length / 100).toFixed(2)} each`
                    : "Choose at least one member to split this expense with."}
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Exact amounts</FieldLabel>
                <div className="space-y-3 rounded-lg border p-3">
                  {members.map((member) => {
                    const name = getMemberDisplayName(member.user_id, member.profiles);
                    return (
                      <div key={member.user_id} className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            {name}
                            {member.user_id === currentUserId && " (you)"}
                          </span>
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="pl-7"
                              placeholder="0.00"
                              value={exactSplits[member.user_id] || ""}
                              onChange={(e) =>
                                handleExactSplitChange(member.user_id, e.target.value)
                              }
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total assigned: ${(exactSplitTotal / 100).toFixed(2)} / ${(parseCurrency(amount) / 100).toFixed(2)}
                </p>
              </Field>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            </FieldGroup>
          </div>
          <DialogFooter className="border-t px-6 py-4">
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
