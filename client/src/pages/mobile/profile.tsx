import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, LogOut, User, Mail, Shield } from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

export default function MobileProfilePage() {
  const { user, logout } = useAuth();

  const getInitials = (name: string | null | undefined, email: string | undefined) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || "U";
  };

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrator",
    MANAGER: "Manager",
    USER: "Team Member",
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Profile">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-profile-title">Profile</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-6">
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-2xl font-bold">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-white" data-testid="text-profile-name">
            {user?.name || "No name set"}
          </h2>
          <p className="text-sm text-white/60">{user?.email}</p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-white/50">Full Name</label>
                <p className="text-sm text-white">{user?.name || "Not set"}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20">
                <Mail className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-white/50">Email</label>
                <p className="text-sm text-white">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Shield className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-white/50">Role</label>
                <p className="text-sm text-white">{roleLabel[user?.role || "USER"] || user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Button
            onClick={() => logout()}
            variant="destructive"
            className="w-full"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
