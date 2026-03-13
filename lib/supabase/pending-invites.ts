import type { User } from "@supabase/supabase-js";


export async function acceptPendingInvitesForUser(
  supabase: any,
  user: User
) {
  if (!user.email) {
    return;
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const { data: invites, error: invitesError } = await supabase
    .from("group_invites")
    .select("id, group_id, email")
    .ilike("email", normalizedEmail);

  if (invitesError || !invites || invites.length === 0) {
    return;
  }

  const memberships = invites.map((invite: { group_id: string }) => ({
    group_id: invite.group_id,
    user_id: user.id,
    role: "member",
  }));

  await supabase.from("group_members").upsert(memberships, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  await supabase.from("group_invites").delete().ilike("email", normalizedEmail);
}
