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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { UserPlus } from "lucide-react";

interface InviteMemberDialogProps {
  groupId: string;
  existingInvites: { id: string; email: string }[];
}

export function InviteMemberDialog({
  groupId,
  existingInvites,
}: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if already invited
    if (existingInvites.some((inv) => inv.email.toLowerCase() === trimmedEmail)) {
      setError("This email has already been invited");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setLoading(false);
      return;
    }

    // Check if user is already a member
    const { data: existingMembers } = await supabase
      .from("group_members")
      .select("user_id, profiles!inner(email)")
      .eq("group_id", groupId);

    const memberEmails = existingMembers?.map(
      (m) => (m.profiles as { email: string }).email.toLowerCase()
    ) || [];

    if (memberEmails.includes(trimmedEmail)) {
      setError("This user is already a member of the group");
      setLoading(false);
      return;
    }

    // Check if the user already exists in our system
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", trimmedEmail)
      .single();

    if (existingProfile) {
      // User exists, add them directly to the group
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: existingProfile.id,
          role: "member",
        });

      if (memberError) {
        setError(memberError.message);
        setLoading(false);
        return;
      }
    } else {
      // User doesn't exist, create an invite
      const { error: inviteError } = await supabase
        .from("group_invites")
        .insert({
          group_id: groupId,
          email: trimmedEmail,
          invited_by: user.id,
        });

      if (inviteError) {
        setError(inviteError.message);
        setLoading(false);
        return;
      }
    }

    setOpen(false);
    setEmail("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              Invite someone to join this group by their email address. If they
              already have an account, they will be added immediately.
              Otherwise, they will see an invitation when they sign up.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
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
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
