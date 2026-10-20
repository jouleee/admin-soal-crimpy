import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GraduationCap size={18} />
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">
            Crimpy Soal &amp; Evaluasi
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/quiz"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-blue-600 font-medium transition-colors"
          >
            Portal Siswa
          </Link>
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs shadow-blue-600/20 transition-all"
          >
            Web Admin
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto w-full px-4 py-16 sm:py-24 flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight max-w-2xl leading-tight">
          Pengelolaan Soal &amp; Evaluasi Siswa
        </h1>
        <p className="mt-3 text-slate-500 text-sm sm:text-base max-w-lg leading-relaxed">
          Platform manajemen bab materi, bank soal pilihan ganda &amp; essay, serta portal ujian siswa terintegrasi Supabase.
        </p>

        {/* Dual Access Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 w-full max-w-2xl text-left">
          {/* Card 1: Admin Panel */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <span className="text-xs font-bold text-blue-600 block mb-1">Guru &amp; Pengelola</span>
              <h2 className="text-base font-bold text-slate-900">
                Panel Web Admin
              </h2>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Kelola bab materi pertemuan, susun bank soal pilihan ganda beserta kunci jawaban A–D, soal essay, dan kelola nilai siswa.
              </p>
            </div>

            <Link
              href="/admin"
              className="mt-6 inline-flex items-center justify-between px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs shadow-blue-600/20 transition-all"
            >
              <span>Masuk Admin</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Card 2: Student Quiz Portal */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div>
              <span className="text-xs font-bold text-emerald-600 block mb-1">Siswa Peserta</span>
              <h2 className="text-base font-bold text-slate-900">
                Portal Siswa
              </h2>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Siswa mengisi identitas (nama &amp; kelas), memilih pertemuan materi yang diujikan, dan langsung mengerjakan soal.
              </p>
            </div>

            <Link
              href="/quiz"
              className="mt-6 inline-flex items-center justify-between px-4 py-2 rounded-lg bg-white border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800 font-semibold text-xs transition-all"
            >
              <span>Mulai Ujian</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Minimal Feature Row with subtle color indicators */}
        <div className="mt-14 pt-8 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left w-full max-w-2xl text-xs">
          <div>
            <span className="font-semibold text-blue-600 block">Pertemuan</span>
            <span className="text-slate-500">Struktur materi rapi</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-600 block">Pilihan Ganda</span>
            <span className="text-slate-500">Opsi A–D &amp; kunci</span>
          </div>
          <div>
            <span className="font-semibold text-purple-600 block">Hasil &amp; Nilai</span>
            <span className="text-slate-500">Koreksi &amp; export CSV</span>
          </div>
          <div>
            <span className="font-semibold text-emerald-600 block">Database</span>
            <span className="text-slate-500">Supabase realtime</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 border-t border-slate-200">
        Crimpy Platform
      </footer>
    </div>
  );
}
