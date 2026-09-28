import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-store";

export function ProfileMenu() {
  const { user, loading, signOut, configured } = useAuth();
  if (!configured) return null;

  if (loading) {
    return <div className="h-10 w-20 rounded-full bg-card/80 shadow-card" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild variant="secondary" className="h-10 rounded-full px-4 shadow-card">
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="h-10 rounded-full px-3 shadow-card"
          aria-label="Open profile menu"
        >
          <UserRound className="size-4" aria-hidden />
          <span className="hidden max-w-28 truncate sm:inline">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/">Kitchen</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="mr-2 size-4" aria-hidden /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
