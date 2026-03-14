"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, ArchiveX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";

interface GroupArchiveToggleProps {
  groupId: string;
  isArchived: boolean;
}

export function GroupArchiveToggle({
  groupId,
  isArchived,
}: GroupArchiveToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("groups")
      .update({ archived_at: isArchived ? null : new Date().toISOString() })
      .eq("id", groupId);

    if (!error) {
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={loading}>
          {loading ? (
            <Spinner className="mr-2" />
          ) : isArchived ? (
            <ArchiveRestore className="mr-2 h-4 w-4" />
          ) : (
            <ArchiveX className="mr-2 h-4 w-4" />
          )}
          {isArchived ? "Unarchive" : "Archive"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? "Bring this group back?" : "Archive this group?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? "Unarchived groups return to your active dashboard so you can add new expenses and settlements again."
              : "Archived groups move to Past Groups. Members can still view history, but no one can add new expenses or settlements while the group is archived."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle}>
            {isArchived ? "Unarchive group" : "Archive group"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
