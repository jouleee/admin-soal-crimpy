"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Meeting } from "@/types/database";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";

interface MeetingInfo extends Meeting {
  pgCount: number;
  essayCount: number;
}

export default function StudentQuizEntryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        setLoading(true);
        const [{ data: mData }, { data: qData }, { data: eqData }] = await Promise.all([
          supabase.from("meetings").select("*").order("meeting_number", { ascending: true }),
          supabase.from("questions").select("meeting_id"),
          supabase.from("essay_questions").select("meeting_id"),
        ]);

        const mapped: MeetingInfo[] = (mData || []).map((m) => ({
          ...m,
          pgCount: (qData || []).filter((q) => q.meeting_id === m.id).length,
          essayCount: (eqData || []).filter((e) => e.meeting_id === m.id).length,
        }));

        setMeetings(mapped);
        if (mapped.length > 0) {
          setSelectedMeetingId(mapped[0].id);
        }
      } catch (err) {
        console.error("Error loading meetings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMeetings();
  }, []);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Silakan isi nama lengkap.");
      return;
    }
    if (!className.trim()) {
      setError("Silakan isi kelas.");
      return;
    }
    if (!selectedMeetingId) {
      setError("Pilih pertemuan yang ingin dikerjakan.");
      return;
    }

    const query = new URLSearchParams({
      name: name.trim(),
      className: className.trim(),
    }).toString();

    router.push(`/quiz/${selectedMeetingId}?${query}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GraduationCap size={16} />
          </div>
          <Link href="/" className="font-bold text-slate-900 text-sm tracking-tight">
            Crimpy Quiz
          </Link>
        </div>
        <Link
          href="/admin"
          className="text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Panel Admin
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto w-full px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="mb-5">
            <h1 className="text-lg font-bold text-slate-900">
              Mulai Pengerjaan Kuis
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan identitas siswa untuk memulai lembar soal
            </p>
          </div>

          <form onSubmit={handleStart} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Lengkap Siswa
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Joel Alexander"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Kelas
              </label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Contoh: XI TKJ 1"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Pertemuan
              </label>

              {loading ? (
                <div className="p-3 text-center text-slate-400">
                  Memuat data pertemuan...
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {meetings.map((m) => {
                    const isSelected = selectedMeetingId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMeetingId(m.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-500 text-blue-950 shadow-2xs"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">
                            P{m.meeting_number}: {m.title}
                          </div>
                          <div className={`text-[11px] ${isSelected ? "text-blue-700" : "text-slate-400"}`}>
                            {m.pgCount} PG • {m.essayCount} Essay
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <p className="text-rose-600 text-xs">{error}</p>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Mulai Kuis</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-slate-400">
        Crimpy Platform
      </footer>
    </div>
  );
}
