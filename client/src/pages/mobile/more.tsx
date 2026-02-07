import { Link } from "wouter";
import { 
  ClipboardList, 
  Truck, 
  ShoppingCart, 
  FileText, 
  User, 
  ChevronRight,
  LogOut,
  FolderOpen,
  ClipboardCheck,
  Radio,
  ScanLine,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface MenuItemProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  href: string;
}

function MenuItem({ icon, iconBg, label, href }: MenuItemProps) {
  return (
    <Link href={href}>
      <button
        className="flex h-[66px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 text-left active:scale-[0.99]"
        data-testid={`menu-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-white">{label}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/40" />
      </button>
    </Link>
  );
}

export default function MobileMore() {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold">More</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-3">
        <Link href="/mobile/scan">
          <button
            className="flex h-[72px] w-full items-center gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 text-left active:scale-[0.99] mb-2"
            data-testid="menu-qr-scanner"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
              <ScanLine className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold text-white">QR Scanner</div>
              <div className="text-xs text-white/50">Scan panels and document bundles</div>
            </div>
            <ChevronRight className="h-5 w-5 text-blue-400/60" />
          </button>
        </Link>

        <MenuItem
          icon={<ListTodo className="h-5 w-5 text-blue-400" />}
          iconBg="bg-blue-500/20"
          label="Tasks"
          href="/mobile/tasks"
        />
        <MenuItem
          icon={<ClipboardList className="h-5 w-5 text-amber-400" />}
          iconBg="bg-amber-500/20"
          label="Panel Register"
          href="/mobile/panels"
        />
        <MenuItem
          icon={<Truck className="h-5 w-5 text-orange-400" />}
          iconBg="bg-orange-500/20"
          label="Logistics"
          href="/mobile/logistics"
        />
        <MenuItem
          icon={<ShoppingCart className="h-5 w-5 text-fuchsia-400" />}
          iconBg="bg-fuchsia-500/20"
          label="Purchase Orders"
          href="/mobile/purchase-orders"
        />
        <MenuItem
          icon={<FileText className="h-5 w-5 text-indigo-400" />}
          iconBg="bg-indigo-500/20"
          label="Weekly Report"
          href="/mobile/weekly-report"
        />
        <MenuItem
          icon={<FolderOpen className="h-5 w-5 text-cyan-400" />}
          iconBg="bg-cyan-500/20"
          label="Documents"
          href="/mobile/documents"
        />
        <MenuItem
          icon={<ClipboardCheck className="h-5 w-5 text-teal-400" />}
          iconBg="bg-teal-500/20"
          label="Checklists"
          href="/mobile/checklists"
        />
        <MenuItem
          icon={<Radio className="h-5 w-5 text-rose-400" />}
          iconBg="bg-rose-500/20"
          label="Broadcast"
          href="/mobile/broadcast"
        />
        
        <div className="pt-4 border-t border-white/10 mt-4">
          <MenuItem
            icon={<User className="h-5 w-5 text-slate-400" />}
            iconBg="bg-slate-500/20"
            label="Profile"
            href="/mobile/profile"
          />
        </div>
        
        <button
          onClick={() => logout()}
          className="flex h-[66px] w-full items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 text-left active:scale-[0.99] mt-4"
          data-testid="button-logout"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20">
            <LogOut className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-red-400">Log Out</div>
          </div>
        </button>
      </div>

      <MobileBottomNav />
    </div>
  );
}
