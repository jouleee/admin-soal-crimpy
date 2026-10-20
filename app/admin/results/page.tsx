"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Meeting } from "@/types/database";
import { 
  Search, 
  Trash2, 
  Download, 
  X, 
  Check, 
  X as XIcon,
  RefreshCw,
  Award
} from "lucide-react";

interface AttemptRow {
  id: number;
  student_id: number;
  meeting_id: number;
  score: number | null;
  submitted_at: string;
  students?: { id: number; name: string; class_name: string } | null;
  meetings?: { id: number; title: string; meeting_number: number } | null;
}

interface AttemptDetail {
  attempt: AttemptRow;
  pgAnswers: {
    question_id: number;
    question_order: number;
    question_text: string;
    student_choice_id: number;
    student_choice_label: string;
    student_choice_text: string;
    correct_choice_label: string;
    correct_choice_text: string;
    is_correct: boolean;
  }[];
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const initialMeetingId = searchParams.get("meetingId") || "all";
  const initialAttemptId = searchParams.get("attemptId");

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState<string>(initialMeetingId);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [editingScore, setEditingScore] = useState<string>("");
  const [savingScore, setSavingScore] = useState(false);
  const [scoreSuccessMsg, setScoreSuccessMsg] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const supabase = createClient();

  const fetchData = async () => {
    try {
      setLoading(true);

      const [{ data: mData }, { data: aData, error: aErr }] = await Promise.all([
        supabase.from("meetings").select("*").order("meeting_number", { ascending: true }),
        supabase
          .from("quiz_attempts")
          .select("id, student_id, meeting_id, score, submitted_at, students(id, name, class_name), meetings(id, title, meeting_number)")
          .order("submitted_at", { ascending: false }),
      ]);

      if (aErr) throw aErr;

      setMeetings(mData || []);
      const formatted = (aData || []) as unknown as AttemptRow[];
      setAttempts(formatted);

      if (initialAttemptId) {
        const found = formatted.find((a) => a.id === parseInt(initialAttemptId));
        if (found) {
          openDetailModal(found);
        }
      }
    } catch (err) {
      console.error("Error loading results:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      if (selectedMeetingFilter !== "all" && attempt.meeting_id !== parseInt(selectedMeetingFilter)) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const studentName = attempt.students?.name.toLowerCase() || "";
        const className = attempt.students?.class_name.toLowerCase() || "";
        return studentName.includes(q) || className.includes(q);
      }
      return true;
    });
  }, [attempts, selectedMeetingFilter, searchQuery]);

  const openDetailModal = async (attempt: AttemptRow) => {
    try {
      setDetailModalOpen(true);
      setDetailLoading(true);
      setScoreSuccessMsg(null);
      setEditingScore(attempt.score !== null ? String(attempt.score) : "0");

      const [{ data: questionsData }, { data: choicesData }, { data: answersData }] =
        await Promise.all([
          supabase.from("questions").select("*").eq("meeting_id", attempt.meeting_id).order("question_order", { ascending: true }),
          supabase.from("choices").select("*"),
          supabase.from("answers").select("*").eq("attempt_id", attempt.id),
        ]);

      const pgAnswers = (questionsData || []).map((q) => {
        const studentAns = (answersData || []).find((a) => a.question_id === q.id);
        const studentChoice = (choicesData || []).find((c) => c.id === studentAns?.choice_id);
        const correctChoice = (choicesData || []).find((c) => c.question_id === q.id && c.is_correct);

        return {
          question_id: q.id,
          question_order: q.question_order,
          question_text: q.question_text,
          student_choice_id: studentChoice?.id || 0,
          student_choice_label: studentChoice?.choice_label || "-",
          student_choice_text: studentChoice?.choice_text || "Tidak dijawab",
          correct_choice_label: correctChoice?.choice_label || "-",
          correct_choice_text: correctChoice?.choice_text || "-",
          is_correct: studentChoice ? studentChoice.is_correct : false,
        };
      });

      setAttemptDetail({
        attempt,
        pgAnswers,
      });
    } catch (err) {
      console.error("Error loading attempt detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateScore = async () => {
    if (!attemptDetail) return;
    try {
      setSavingScore(true);
      setScoreSuccessMsg(null);
      const newScore = parseFloat(editingScore);

      const { error } = await supabase
        .from("quiz_attempts")
        .update({ score: isNaN(newScore) ? null : newScore })
        .eq("id", attemptDetail.attempt.id);

      if (error) throw error;

      setScoreSuccessMsg("Nilai tersimpan!");
      setAttempts((prev) =>
        prev.map((a) => (a.id === attemptDetail.attempt.id ? { ...a, score: isNaN(newScore) ? null : newScore } : a))
      );
      setAttemptDetail((prev) =>
        prev ? { ...prev, attempt: { ...prev.attempt, score: isNaN(newScore) ? null : newScore } } : null
      );
    } catch (err) {
      console.error("Error updating score:", err);
    } finally {
      setSavingScore(false);
    }
  };

  const handleDeleteAttempt = async (id: number) => {
    try {
      const { error } = await supabase.from("quiz_attempts").delete().eq("id", id);
      if (error) throw error;

      setAttempts((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
      if (detailModalOpen && attemptDetail?.attempt.id === id) {
        setDetailModalOpen(false);
      }
    } catch (err) {
      console.error("Error deleting attempt:", err);
    }
  };

  const exportToCSV = () => {
    if (filteredAttempts.length === 0) return;

    const headers = ["No", "Nama Siswa", "Kelas", "Pertemuan", "Skor PG", "Waktu Pengumpulan"];
    const rows = filteredAttempts.map((a, index) => [
      index + 1,
      `"${a.students?.name || "Anonim"}"`,
      `"${a.students?.class_name || "-"}"`,
      `"Pertemuan ${a.meetings?.meeting_number}: ${a.meetings?.title || "-"}"`,
      a.score !== null ? a.score : "Belum Dinilai",
      `"${new Date(a.submitted_at).toLocaleString("id-ID")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Nilai_PG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Hasil Siswa (Nilai PG)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar submission dan perolehan skor kuis pilihan ganda siswa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Segarkan data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={filteredAttempts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari siswa atau kelas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={selectedMeetingFilter}
            onChange={(e) => setSelectedMeetingFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:outline-hidden focus:border-slate-400 cursor-pointer"
          >
            <option value="all">Semua Pertemuan</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                P{m.meeting_number}: {m.title.length > 20 ? m.title.substring(0, 20) + "..." : m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Memuat hasil kuis...
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Tidak ada data hasil kuis yang cocok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3 w-10">No</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Pertemuan</th>
                  <th className="px-4 py-3 text-center">Skor PG</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttempts.map((attempt, index) => (
                  <tr key={attempt.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {attempt.students?.name || "Anonim"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {attempt.students?.class_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      P{attempt.meetings?.meeting_number}: {attempt.meetings?.title}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {attempt.score !== null ? Number(attempt.score).toFixed(0) : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(attempt.submitted_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailModal(attempt)}
                          className="font-medium text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(attempt.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL (LEMBAR JAWABAN PG) */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl my-8 overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rincian Jawaban Pilihan Ganda
                </h3>
                <p className="text-xs text-slate-500">
                  {attemptDetail?.attempt.students?.name} • {attemptDetail?.attempt.students?.class_name} • P{attemptDetail?.attempt.meetings?.meeting_number}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Memuat rincian...
              </div>
            ) : attemptDetail ? (
              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Score adjustment row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-800">
                    Skor Pilihan Ganda
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={editingScore}
                      onChange={(e) => setEditingScore(e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center text-xs"
                    />
                    <button
                      onClick={handleUpdateScore}
                      disabled={savingScore}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {savingScore ? "Menyimpan..." : "Update"}
                    </button>
                    {scoreSuccessMsg && (
                      <span className="text-emerald-600 font-medium">{scoreSuccessMsg}</span>
                    )}
                  </div>
                </div>

                {/* PG Answers List */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800">
                    Daftar Soal & Jawaban
                  </h4>

                  {attemptDetail.pgAnswers.length === 0 ? (
                    <p className="text-slate-400 italic">Tidak ada jawaban PG.</p>
                  ) : (
                    <div className="space-y-2">
                      {attemptDetail.pgAnswers.map((item) => (
                        <div
                          key={item.question_id}
                          className={`p-3 rounded-lg border ${
                            item.is_correct
                              ? "border-slate-200 bg-white"
                              : "border-rose-200 bg-rose-50/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-slate-900">
                              {item.question_order}. {item.question_text}
                            </span>
                            {item.is_correct ? (
                              <span className="text-emerald-600 shrink-0 font-medium flex items-center gap-1">
                                <Check size={13} /> Benar
                              </span>
                            ) : (
                              <span className="text-rose-600 shrink-0 font-medium flex items-center gap-1">
                                <XIcon size={13} /> Salah
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div>Jawaban Siswa: <strong>[{item.student_choice_label}]</strong> {item.student_choice_text}</div>
                            {!item.is_correct && (
                              <div className="text-slate-900">Kunci Benar: <strong>[{item.correct_choice_label}]</strong> {item.correct_choice_text}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-4 shadow-lg">
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Hasil Ini?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Data pengerjaan siswa akan dihapus secara permanen.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteAttempt(deleteConfirmId)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs shadow-rose-600/20 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 text-xs">
          Memuat hasil evaluasi...
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
