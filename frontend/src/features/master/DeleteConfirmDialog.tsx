"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pending?: boolean;
  onConfirm: () => void;
};

/**
 * Generic destructive-action confirmation. Used by every master CRUD tab.
 * Pending state disables the confirm button so a slow API can't be double-fired.
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  pending = false,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              // Prevent the default close-on-click so we can let the mutation
              // settle; the parent controls open via onOpenChange.
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
