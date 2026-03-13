import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface InviteRequestBody {
  email?: string;
  groupId?: string;
}

function getAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl.replace(/\/$/, "") : `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return new URL(request.url).origin;
}

async function sendInviteEmail({
  to,
  inviterName,
  groupName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  groupName: string;
  inviteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Email invites are not configured. Missing RESEND_API_KEY or INVITE_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${inviterName} invited you to join ${groupName} on Split the Bills`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">You're invited to Split the Bills</h2>
          <p><strong>${inviterName}</strong> invited you to join <strong>${groupName}</strong>.</p>
          <p>Create your account with <strong>${to}</strong> to accept the invitation automatically.</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px;">Accept invite</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        </div>
      `,
      text: `${inviterName} invited you to join ${groupName} on Split the Bills. Sign up with ${to} to accept the invitation automatically: ${inviteUrl}`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to send invite email.");
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json()) as InviteRequestBody;
  const trimmedEmail = body.email?.trim().toLowerCase();
  const groupId = body.groupId?.trim();

  if (!trimmedEmail || !groupId) {
    return NextResponse.json({ error: "Email and group ID are required." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", groupId)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const { data: existingMembers } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  const memberIds = (existingMembers || []).map((member) => member.user_id);
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", memberIds);

    const memberEmails = (memberProfiles || []).map((profile) => profile.email.toLowerCase());
    if (memberEmails.includes(trimmedEmail)) {
      return NextResponse.json({ error: "This user is already a member of the group." }, { status: 409 });
    }
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", trimmedEmail)
    .single();

  if (existingProfile) {
    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: existingProfile.id,
      role: "member",
    });

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 });
    }

    return NextResponse.json({ mode: "added" });
  }

  const { error: inviteError } = await supabase.from("group_invites").insert({
    group_id: groupId,
    email: trimmedEmail,
    invited_by: user.id,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();

  const inviterName = inviterProfile?.display_name || inviterProfile?.email?.split("@")[0] || user.email?.split("@")[0] || "Someone";
  const appUrl = getAppUrl(request);
  const inviteUrl = `${appUrl}/auth/sign-up?email=${encodeURIComponent(trimmedEmail)}`;

  try {
    await sendInviteEmail({
      to: trimmedEmail,
      inviterName,
      groupName: group.name,
      inviteUrl,
    });
  } catch (error) {
    console.error("Failed to send invite email", error);
    await supabase
      .from("group_invites")
      .delete()
      .eq("group_id", groupId)
      .eq("email", trimmedEmail);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send invite email.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ mode: "invited" });
}
