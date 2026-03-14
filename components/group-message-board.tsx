"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getMemberDisplayName } from "@/lib/member-display";
import type { GroupMessage, Profile } from "@/lib/types";

interface GroupMessageWithProfile extends GroupMessage {
  profiles?: Profile;
}

interface GroupMessageBoardProps {
  groupId: string;
  currentUserId: string;
  messages: GroupMessageWithProfile[];
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GroupMessageBoard({
  groupId,
  currentUserId,
  messages,
}: GroupMessageBoardProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Message cannot be empty");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("group_messages").insert({
      group_id: groupId,
      user_id: currentUserId,
      body: trimmedBody,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setBody("");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Post a message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="message-body">Message</FieldLabel>
                <Textarea
                  id="message-body"
                  placeholder="Coordinate plans, ask who can cover dinner, or remind someone to settle up."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  disabled={loading}
                  rows={4}
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading && <Spinner className="mr-2" />}
                  Post message
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {messages.length === 0 ? (
        <Empty>
          <EmptyTitle>No messages yet</EmptyTitle>
          <EmptyDescription>
            Start the conversation with a quick update for the group.
          </EmptyDescription>
        </Empty>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.map((message) => {
                const name = getMemberDisplayName(message.user_id, message.profiles);
                const initials = name.slice(0, 2).toUpperCase();
                const isCurrentUser = message.user_id === currentUserId;

                return (
                  <div key={message.id} className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-medium">
                            {name}
                            {isCurrentUser && (
                              <span className="ml-1 text-sm text-muted-foreground">(you)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatMessageTime(message.created_at)}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {message.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
