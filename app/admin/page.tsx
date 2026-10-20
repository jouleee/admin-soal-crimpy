"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { 
  ArrowRight, 
  RefreshCw,
  Plus
} from "lucide-react";
import { Meeting } from "@/types/database";

interface DashboardStats {
  totalMeetings: number;
  totalQuestions: number;
  totalEssayQuestions: number;
  totalStudents: number;
  totalAttempts: number;
  averageScore: number;
}

interface MeetingSummary extends Meeting {
  pgCount: number;
  essayCount: number;
  attemptCount: number;
}

interface RecentAttempt {
  id: number;
  score: number | null;
  submitted_at: string;
  students?: { name: string; class_name: string } | null;
  meetings?: { title: string; meeting_number: number } | null;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalMeetings: 0,
    totalQuestions: 0,
    totalEssayQuestions: 0,
    totalStudents: 0,
    totalAttempts: 0,
    averageScore: 0,
  });
  const [meetingsSummary, setMeetingsSummary] = useState<MeetingSummary[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);

  const supabase = createClient();

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [
        { count: meetingsCount, data: meetingsData },
        { count: questionsCount, data: questionsData },
        { count: essayCount, data: essayData },
        { count: studentsCount },
        { count: attemptsCount, data: attemptsData },
      ] = await Promise.all([
        supabase.from("meetings").select("id, meeting_number, title, created_at", { count: "exact" }).order("meeting_number", { ascending: true }),
        supabase.from("questions").select("id, meeting_id", { count: "exact" }),
        supabase.from("essay_questions").select("id, meeting_id", { count: "exact" }),
        supabase.from("students").select("id", { count: "exact" }),
        supabase.from("quiz_attempts").select("id, meeting_id, score, submitted_at, students(name, class_name), meetings(title, meeting_number)", { count: "exact" }).order("submitted_at", { ascending: false }).limit(6),
      ]);

      let avg = 0;
      if (attemptsData && attemptsData.length > 0) {
        const scores = attemptsData.filter((a) => a.score !== null).map((a) => Number(a.score));
        if (scores.length > 0) {
          avg = scores.reduce((acc, curr) => acc + curr, 0) / scores.length;
        }
      }

      setStats({
        totalMeetings: meetingsCount || 0,
        totalQuestions: questionsCount || 0,
        totalEssayQuestions: essayCount || 0,
        totalStudents: studentsCount || 0,
        totalAttempts: attemptsCount || 0,
        averageScore: Number(avg.toFixed(1)),
      });

      if (meetingsData) {
        const summary: MeetingSummary[] = meetingsData.map((m) => {
          const pg = (questionsData || []).filter((q) => q.meeting_id === m.id).length;
          const es = (essayData || []).filter((e) => e.meeting_id === m.id).length;
          const att = (attemptsData || []).filter((a) => a.meeting_id === m.id).length;
          return {
            ...m,
            pgCount: pg,
            essayCount: es,
            attemptCount: att,
          };
        });
        setMeetingsSummary(summary);
      }

      if (attemptsData) {
        setRecentAttempts(attemptsData as unknown as RecentAttempt[]);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan materi evaluasi dan hasil capaian siswa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
            title="Segarkan data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            href="/admin/questions"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
          >
            <Plus size={14} />
            <span>Kelola Soal</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row - Clean Neutral Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500">Total Pertemuan</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {loading ? "-" : stats.totalMeetings}
          </div>
          <Link href="/admin/meetings" className="text-[11px] text-slate-500 hover:text-blue-600 mt-2 inline-flex items-center gap-1 transition-colors">
            Kelola bab <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500">Rata-Rata Skor</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {loading ? "-" : stats.averageScore}
          </div>
          <Link href="/admin/results" className="text-[11px] text-slate-500 hover:text-blue-600 mt-2 inline-flex items-center gap-1 transition-colors">
            Rekap nilai siswa <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Meetings Section - Calm, Clean */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Daftar Pertemuan
          </h2>
          <Link href="/admin/meetings" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            Lihat semua
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {meetingsSummary.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <span className="text-xs font-medium text-slate-400">
                  Pertemuan {m.meeting_number}
                </span>
                <h3 className="font-semibold text-slate-900 text-sm mt-0.5 line-clamp-2">
                  {m.title}
                </h3>
                <div className="mt-2 text-xs text-slate-500">
                  {m.pgCount} PG • {m.essayCount} Essay
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <Link
                  href={`/admin/questions?meetingId=${m.id}`}
                  className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                >
                  Kelola Soal
                </Link>
                <div className="flex items-center gap-1.5 text-xs">
                  <Link
                    href={`/admin/essays?meetingId=${m.id}`}
                    className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    title="Jawaban Essay"
                  >
                    Essay
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link
                    href={`/admin/results?meetingId=${m.id}`}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    title="Rekap Nilai"
                  >
                    Nilai
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Pengerjaan Terbaru
          </h2>
          <Link href="/admin/results" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            Lihat semua
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {recentAttempts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Belum ada data pengerjaan kuis siswa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Siswa</th>
                    <th className="px-4 py-2.5">Kelas</th>
                    <th className="px-4 py-2.5">Pertemuan</th>
                    <th className="px-4 py-2.5 text-center">Nilai</th>
                    <th className="px-4 py-2.5 text-right">Waktu</th>
                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAttempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {attempt.students?.name || "Anonim"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {attempt.students?.class_name || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        P{attempt.meetings?.meeting_number}: {attempt.meetings?.title}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-900">
                        {attempt.score !== null ? Number(attempt.score).toFixed(0) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400">
                        {new Date(attempt.submitted_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/results?attemptId=${attempt.id}`}
                          className="text-slate-500 hover:text-blue-600 font-medium transition-colors"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
