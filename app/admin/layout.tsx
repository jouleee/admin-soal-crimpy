"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  Layers, 
  HelpCircle, 
  Award, 
  FileText,
  ExternalLink,
  Menu,
  X,
  GraduationCap
} from "lucide-react";
import { useState, Suspense } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  isResults?: boolean;
  isEssay?: boolean;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Pertemuan", href: "/admin/meetings", icon: Layers },
  { name: "Bank Soal", href: "/admin/questions", icon: HelpCircle },
  { name: "Hasil Siswa", href: "/admin/results", icon: Award, isResults: true },
  { name: "Jawaban Essay", href: "/admin/results?tab=essay", icon: FileText, isEssay: true },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const isActive = (item: NavItem) => {
    if (item.isEssay) {
      return pathname === "/admin/results" && currentTab === "essay";
    }
    if (item.isResults) {
      return pathname === "/admin/results" && currentTab !== "essay";
    }
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
      {navigation.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              active
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Icon size={16} className={active ? "text-blue-600" : "text-slate-400"} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GraduationCap size={16} />
          </div>
          <span className="font-bold text-slate-900 text-sm">Crimpy Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-full md:h-screen w-56 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 hidden md:flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap size={16} />
          </div>
          <Link href="/admin" className="font-bold text-slate-900 text-sm tracking-tight">
            Crimpy Admin
          </Link>
        </div>

        {/* Navigation Items in Suspense for searchParams */}
        <Suspense
          fallback={
            <div className="flex-1 px-2.5 py-4 space-y-1">
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          }
        >
          <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
        </Suspense>

        {/* Bottom Link to Student Portal */}
        <div className="p-3 border-t border-slate-100">
          <Link
            href="/quiz"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <span>Simulasi Siswa</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
