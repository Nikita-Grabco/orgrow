import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";

/** Cierre de sesión, compartido por la barra lateral y la cabecera móvil. */
export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={() => void signOut()}
      className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
    >
      <LogOut />
    </Button>
  );
}
