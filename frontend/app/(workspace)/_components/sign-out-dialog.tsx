/**
 * @file components/sign-out-dialog.tsx
 * @description Confirmation dialog before logging out.
 */

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
import { IconLogout } from "@tabler/icons-react";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function SignOutDialog({
  open,
  onOpenChange,
  onConfirm,
}: SignOutDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconLogout className="h-5 w-5 text-destructive" />
            Se déconnecter
          </AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir vous déconnecter de prosendia ? Vos données
            resteront sauvegardées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9 text-sm">Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="h-9 text-sm bg-destructive hover:bg-destructive/90 text-white"
            onClick={onConfirm}
          >
            Se déconnecter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
