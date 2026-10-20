"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Meeting, EssayQuestion } from "@/types/database";
import { 
  Search, 
  Trash2, 
  Download, 
  X, 
  Check, 
  X as XIcon,
  RefreshCw,
  FileText,
  Award,
  Layers,
  User,
  SlidersHorizontal
} from "lucide-react";

interface AttemptRow {
  id: number;
  student_id: number;
  meeting_id: number;
  score: number | null;
  submitted_at: string;
  students?: { id: number; name: string; class_name: string } | null;
  meetings?: { id: number; title: string; meeting_number: number } | null;
  essay_answers?: { id: number }[];
}

interface EssayAnswerItem {
  id: number;
  attempt_id: number;
  essay_question_id: number;
  answer_text: string;
  created_at: string;
  essay_questions?: {
    id: number;
    meeting_id: number;
    question_text: string;
  } | null;
  quiz_attempts?: {
    id: number;
    meeting_id: number;
    score: number | null;
    submitted_at: string;
    students?: {
      id: number;
      name: string;
      class_name: string;
    } | null;
    meetings?: {
      id: number;
      meeting_number: number;
      title: string;
    } | null;
  } | null;
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
  essayAnswers: {
    essay_question_id: number;
    question_text: string;
    answer_text: string;
  }[];
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialTab = searchParams.get("tab") === "essay" ? "essay" : "attempts";
  const initialMeetingId = searchParams.get("meetingId") || "all";
  const initialAttemptId = searchParams.get("attemptId");

  // Tab State: "attempts" (Rekap Nilai) | "essay" (Koreksi Jawaban Essay)
  const [activeTab, setActiveTab] = useState<"attempts" | "essay">(initialTab);

  // General Data
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [essayAnswersList, setEssayAnswersList] = useState<EssayAnswerItem[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<EssayQuestion[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Attempts Tab
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState<string>(initialMeetingId);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters for Essay Tab
  const [essayMeetingFilter, setEssayMeetingFilter] = useState<string>(initialMeetingId);
  const [essayQuestionFilter, setEssayQuestionFilter] = useState<string>("all");
  const [essaySearchQuery, setEssaySearchQuery] = useState("");
  const [essayViewMode, setEssayViewMode] = useState<"byQuestion" | "byStudent">("byQuestion");

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalSubTab, setModalSubTab] = useState<"pg" | "essay">("pg");
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

      const [
        { data: mData },
        { data: aData, error: aErr },
        { data: eqData },
        { data: eaData, error: eaErr }
      ] = await Promise.all([
        supabase.from("meetings").select("*").order("meeting_number", { ascending: true }),
        supabase
          .from("quiz_attempts")
          .select("id, student_id, meeting_id, score, submitted_at, students(id, name, class_name), meetings(id, title, meeting_number), essay_answers(id)")
          .order("submitted_at", { ascending: false }),
        supabase.from("essay_questions").select("*").order("meeting_id", { ascending: true }),
        supabase
          .from("essay_answers")
          .select("id, attempt_id, essay_question_id, answer_text, created_at, essay_questions(id, question_text, meeting_id), quiz_attempts(id, meeting_id, score, submitted_at, students(id, name, class_name), meetings(id, meeting_number, title))")
          .order("created_at", { ascending: false }),
      ]);

      if (aErr) throw aErr;
      if (eaErr) throw eaErr;

      setMeetings(mData || []);
      const formattedAttempts = (aData || []) as unknown as AttemptRow[];
      setAttempts(formattedAttempts);
      setEssayQuestions(eqData || []);
      setEssayAnswersList((eaData || []) as unknown as EssayAnswerItem[]);

      if (initialAttemptId) {
        const found = formattedAttempts.find((a) => a.id === parseInt(initialAttemptId));
        if (found) {
          openDetailModal(found, "pg");
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

  // Update tab in url query without full reload
  const handleTabChange = (tab: "attempts" | "essay") => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "essay") {
      params.set("tab", "essay");
    } else {
      params.delete("tab");
    }
    router.replace(`/admin/results?${params.toString()}`);
  };

  // Filtered Attempts for Tab 1
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

  // Filtered Essay Questions for Dropdown
  const availableEssayQuestions = useMemo(() => {
    if (essayMeetingFilter === "all") {
      return essayQuestions;
    }
    return essayQuestions.filter((eq) => eq.meeting_id === parseInt(essayMeetingFilter));
  }, [essayQuestions, essayMeetingFilter]);

  // Filtered Essay Answers for Tab 2
  const filteredEssayAnswers = useMemo(() => {
    return essayAnswersList.filter((ea) => {
      // Meeting filter
      if (essayMeetingFilter !== "all") {
        const meetingId = ea.essay_questions?.meeting_id || ea.quiz_attempts?.meeting_id;
        if (meetingId !== parseInt(essayMeetingFilter)) {
          return false;
        }
      }

      // Question filter
      if (essayQuestionFilter !== "all") {
        if (ea.essay_question_id !== parseInt(essayQuestionFilter)) {
          return false;
        }
      }

      // Search query (Student name, class, answer text, question text)
      if (essaySearchQuery.trim() !== "") {
        const q = essaySearchQuery.toLowerCase();
        const studentName = ea.quiz_attempts?.students?.name.toLowerCase() || "";
        const className = ea.quiz_attempts?.students?.class_name.toLowerCase() || "";
        const answerText = ea.answer_text.toLowerCase();
        const questionText = ea.essay_questions?.question_text.toLowerCase() || "";
        return (
          studentName.includes(q) ||
          className.includes(q) ||
          answerText.includes(q) ||
          questionText.includes(q)
        );
      }

      return true;
    });
  }, [essayAnswersList, essayMeetingFilter, essayQuestionFilter, essaySearchQuery]);

  // Grouped by Question
  const groupedByQuestion = useMemo(() => {
    const map = new Map<number, { question: { id: number; question_text: string; meeting_id: number }; answers: EssayAnswerItem[] }>();

    filteredEssayAnswers.forEach((ea) => {
      const qId = ea.essay_question_id;
      if (!map.has(qId)) {
        map.set(qId, {
          question: {
            id: qId,
            question_text: ea.essay_questions?.question_text || `Soal Essay #${qId}`,
            meeting_id: ea.essay_questions?.meeting_id || 1,
          },
          answers: [],
        });
      }
      map.get(qId)!.answers.push(ea);
    });

    return Array.from(map.values());
  }, [filteredEssayAnswers]);

  // Grouped by Student / Attempt
  const groupedByStudent = useMemo(() => {
    const map = new Map<number, { attempt: EssayAnswerItem["quiz_attempts"]; answers: EssayAnswerItem[] }>();

    filteredEssayAnswers.forEach((ea) => {
      const aId = ea.attempt_id;
      if (!map.has(aId)) {
        map.set(aId, {
          attempt: ea.quiz_attempts,
          answers: [],
        });
      }
      map.get(aId)!.answers.push(ea);
    });

    return Array.from(map.values());
  }, [filteredEssayAnswers]);

  // Open Modal
  const openDetailModal = async (attempt: AttemptRow, defaultSubTab: "pg" | "essay" = "pg") => {
    try {
      setDetailModalOpen(true);
      setModalSubTab(defaultSubTab);
      setDetailLoading(true);
      setScoreSuccessMsg(null);
      setEditingScore(attempt.score !== null ? String(attempt.score) : "0");

      const [
        { data: questionsData },
        { data: choicesData },
        { data: answersData },
        { data: essayQData },
        { data: essayAData }
      ] = await Promise.all([
        supabase.from("questions").select("*").eq("meeting_id", attempt.meeting_id).order("question_order", { ascending: true }),
        supabase.from("choices").select("*"),
        supabase.from("answers").select("*").eq("attempt_id", attempt.id),
        supabase.from("essay_questions").select("*").eq("meeting_id", attempt.meeting_id).order("id", { ascending: true }),
        supabase.from("essay_answers").select("*").eq("attempt_id", attempt.id),
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

      const essayAnswers = (essayQData || []).map((eq) => {
        const studentEssayAns = (essayAData || []).find((ea) => ea.essay_question_id === eq.id);
        return {
          essay_question_id: eq.id,
          question_text: eq.question_text,
          answer_text: studentEssayAns?.answer_text || "(Tidak dijawab)",
        };
      });

      setAttemptDetail({
        attempt,
        pgAnswers,
        essayAnswers,
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
      setEssayAnswersList((prev) =>
        prev.map((item) =>
          item.attempt_id === attemptDetail.attempt.id
            ? {
                ...item,
                quiz_attempts: item.quiz_attempts
                  ? { ...item.quiz_attempts, score: isNaN(newScore) ? null : newScore }
                  : null,
              }
            : item
        )
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
      setEssayAnswersList((prev) => prev.filter((ea) => ea.attempt_id !== id));
      setDeleteConfirmId(null);
      if (detailModalOpen && attemptDetail?.attempt.id === id) {
        setDetailModalOpen(false);
      }
    } catch (err) {
      console.error("Error deleting attempt:", err);
    }
  };

  // Export CSV for Attempts (Tab 1)
  const exportAttemptsCSV = () => {
    if (filteredAttempts.length === 0) return;

    const headers = ["No", "Nama Siswa", "Kelas", "Pertemuan", "Jawaban Essay", "Skor", "Waktu Pengumpulan"];
    const rows = filteredAttempts.map((a, index) => [
      index + 1,
      `"${a.students?.name || "Anonim"}"`,
      `"${a.students?.class_name || "-"}"`,
      `"Pertemuan ${a.meetings?.meeting_number}: ${a.meetings?.title || "-"}"`,
      a.essay_answers?.length || 0,
      a.score !== null ? a.score : "Belum Dinilai",
      `"${new Date(a.submitted_at).toLocaleString("id-ID")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Nilai_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV for Essay Answers (Tab 2)
  const exportEssaysCSV = () => {
    if (filteredEssayAnswers.length === 0) return;

    const headers = ["No", "Nama Siswa", "Kelas", "Pertemuan", "Pertanyaan Essay", "Jawaban Siswa", "Nilai Total", "Waktu"];
    const rows = filteredEssayAnswers.map((ea, index) => {
      const safeAnswer = ea.answer_text.replace(/"/g, '""');
      const safeQuestion = (ea.essay_questions?.question_text || "").replace(/"/g, '""');
      return [
        index + 1,
        `"${ea.quiz_attempts?.students?.name || "Anonim"}"`,
        `"${ea.quiz_attempts?.students?.class_name || "-"}"`,
        `"Pertemuan ${ea.quiz_attempts?.meetings?.meeting_number || "-"}: ${ea.quiz_attempts?.meetings?.title || "-"}"`,
        `"${safeQuestion}"`,
        `"${safeAnswer}"`,
        ea.quiz_attempts?.score !== null ? ea.quiz_attempts?.score : "-",
        `"${new Date(ea.created_at).toLocaleString("id-ID")}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Jawaban_Essay_Siswa_${new Date().toISOString().slice(0, 10)}.csv`);
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
            Hasil & Koreksi Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekap capaian kuis pilihan ganda dan tinjauan lembar jawaban essay siswa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Segarkan data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {activeTab === "attempts" ? (
            <button
              onClick={exportAttemptsCSV}
              disabled={filteredAttempts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download size={13} />
              <span>Export Rekap CSV</span>
            </button>
          ) : (
            <button
              onClick={exportEssaysCSV}
              disabled={filteredEssayAnswers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download size={13} />
              <span>Export Essay CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => handleTabChange("attempts")}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "attempts"
              ? "border-blue-600 text-blue-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award size={15} className={activeTab === "attempts" ? "text-blue-600" : "text-slate-400"} />
          <span>Rekap Nilai Siswa</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {attempts.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("essay")}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "essay"
              ? "border-blue-600 text-blue-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={15} className={activeTab === "essay" ? "text-blue-600" : "text-slate-400"} />
          <span>Koreksi & Jawaban Essay</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
            {essayAnswersList.length} Jawaban
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: REKAP NILAI SISWA
          ======================================================== */}
      {activeTab === "attempts" && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama siswa atau kelas..."
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
                Memuat hasil pengerjaan kuis...
              </div>
            ) : filteredAttempts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada data hasil kuis yang cocok dengan filter.
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
                      <th className="px-4 py-3 text-center">Jawaban Essay</th>
                      <th className="px-4 py-3 text-center">Skor Total</th>
                      <th className="px-4 py-3">Waktu</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttempts.map((attempt, index) => {
                      const essayCount = attempt.essay_answers?.length || 0;
                      return (
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
                          <td className="px-4 py-3 text-center">
                            {essayCount > 0 ? (
                              <button
                                onClick={() => openDetailModal(attempt, "essay")}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-medium transition-colors cursor-pointer"
                                title="Lihat jawaban essay siswa ini"
                              >
                                <FileText size={11} />
                                <span>{essayCount} Jawaban</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {attempt.score !== null ? Number(attempt.score).toFixed(0) : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {new Date(attempt.submitted_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openDetailModal(attempt, "pg")}
                                className="font-medium text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(attempt.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                                title="Hapus submission"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: KOREKSI & JAWABAN ESSAY SISWA
          ======================================================== */}
      {activeTab === "essay" && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-500">Total Jawaban Essay</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {essayAnswersList.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-500">Siswa Menjawab</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {new Set(essayAnswersList.map((ea) => ea.attempt_id)).size}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-500">Pertemuan Terlibat</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {meetings.length} Bab
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-500">Sesuai Filter</span>
              <div className="text-xl font-bold text-blue-700 mt-0.5">
                {filteredEssayAnswers.length} Jawaban
              </div>
            </div>
          </div>

          {/* Filter Bar for Essay */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Search text */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari siswa, kelas, isi jawaban..."
                  value={essaySearchQuery}
                  onChange={(e) => setEssaySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400"
                />
              </div>

              {/* Filter Pertemuan */}
              <div>
                <select
                  value={essayMeetingFilter}
                  onChange={(e) => {
                    setEssayMeetingFilter(e.target.value);
                    setEssayQuestionFilter("all"); // reset specific question when meeting changes
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-hidden focus:border-slate-400 cursor-pointer"
                >
                  <option value="all">Semua Pertemuan</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      P{m.meeting_number}: {m.title.length > 25 ? m.title.substring(0, 25) + "..." : m.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Specific Essay Question */}
              <div>
                <select
                  value={essayQuestionFilter}
                  onChange={(e) => setEssayQuestionFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-hidden focus:border-slate-400 cursor-pointer"
                >
                  <option value="all">Semua Pertanyaan Essay</option>
                  {availableEssayQuestions.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      P{eq.meeting_id} - {eq.question_text.length > 30 ? eq.question_text.substring(0, 30) + "..." : eq.question_text}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Mode Tampilan:</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setEssayViewMode("byQuestion")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    essayViewMode === "byQuestion"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Kelompokkan per Pertanyaan
                </button>
                <button
                  onClick={() => setEssayViewMode("byStudent")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    essayViewMode === "byStudent"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Kelompokkan per Siswa
                </button>
              </div>
            </div>
          </div>

          {/* List of Essay Answers */}
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Memuat jawaban essay...
            </div>
          ) : filteredEssayAnswers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Tidak ada jawaban essay yang sesuai dengan filter pencarian.
            </div>
          ) : essayViewMode === "byQuestion" ? (
            /* ================= MODE: GROUP BY QUESTION ================= */
            <div className="space-y-4">
              {groupedByQuestion.map((group) => {
                const meeting = meetings.find((m) => m.id === group.question.meeting_id);
                return (
                  <div key={group.question.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {/* Question Header */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700">
                          <Layers size={11} />
                          <span>Pertemuan {meeting?.meeting_number || group.question.meeting_id}</span>
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {group.answers.length} Siswa Menjawab
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {group.question.question_text}
                      </h3>
                    </div>

                    {/* Answers list for this question */}
                    <div className="divide-y divide-slate-100">
                      {group.answers.map((ans) => {
                        const student = ans.quiz_attempts?.students;
                        const attempt = ans.quiz_attempts;
                        return (
                          <div key={ans.id} className="p-4 hover:bg-slate-50/30 transition-colors">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold">
                                  {student?.name?.charAt(0) || "S"}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 text-xs">
                                    {student?.name || "Anonim"}
                                    <span className="text-slate-400 font-normal ml-2">
                                      {student?.class_name || "-"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Dikumpulkan: {new Date(ans.created_at).toLocaleString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500">
                                  Skor Total: <strong className="text-slate-900">{attempt?.score !== null ? Number(attempt?.score).toFixed(0) : "-"}</strong>
                                </span>
                                {attempt && (
                                  <button
                                    onClick={() => {
                                      const foundAttempt = attempts.find((a) => a.id === attempt.id);
                                      if (foundAttempt) {
                                        openDetailModal(foundAttempt, "essay");
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    Koreksi Lembar
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Answer text card */}
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                              {ans.answer_text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= MODE: GROUP BY STUDENT ================= */
            <div className="space-y-4">
              {groupedByStudent.map((group, gIdx) => {
                const student = group.attempt?.students;
                const meeting = group.attempt?.meetings;
                return (
                  <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {/* Student Header */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {student?.name?.charAt(0) || "S"}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">
                            {student?.name || "Anonim"}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {student?.class_name || "-"} • Pertemuan {meeting?.meeting_number}: {meeting?.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-600">
                          Skor Total: <strong className="text-slate-900 text-sm">{group.attempt?.score !== null ? Number(group.attempt?.score).toFixed(0) : "-"}</strong>
                        </div>
                        {group.attempt && (
                          <button
                            onClick={() => {
                              const foundAttempt = attempts.find((a) => a.id === group.attempt?.id);
                              if (foundAttempt) {
                                openDetailModal(foundAttempt, "essay");
                              }
                            }}
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Buka Lembar Penuh
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Essay Answers by this Student */}
                    <div className="p-4 space-y-3">
                      {group.answers.map((ea, idx) => (
                        <div key={ea.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                          <div className="font-semibold text-slate-800 text-xs mb-1.5">
                            {idx + 1}. {ea.essay_questions?.question_text}
                          </div>
                          <div className="p-2.5 rounded bg-white border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {ea.answer_text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          DETAIL MODAL (LEMBAR JAWABAN SISWA)
          ======================================================== */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Lembar Jawaban Siswa
                </h3>
                <p className="text-xs text-slate-500">
                  {attemptDetail?.attempt.students?.name} • {attemptDetail?.attempt.students?.class_name} • P{attemptDetail?.attempt.meetings?.meeting_number}: {attemptDetail?.attempt.meetings?.title}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Sub-Tabs (PG vs Essay) */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
              <button
                onClick={() => setModalSubTab("pg")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  modalSubTab === "pg"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Pilihan Ganda ({attemptDetail?.pgAnswers.length || 0})
              </button>
              <button
                onClick={() => setModalSubTab("essay")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  modalSubTab === "essay"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText size={12} />
                <span>Jawaban Essay ({attemptDetail?.essayAnswers.length || 0})</span>
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Memuat rincian lembar jawaban...
              </div>
            ) : attemptDetail ? (
              <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
                {/* Score adjustment bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">
                      Penilaian & Skor Akhir Siswa
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Skor awal terhitung otomatis dari PG. Silakan sesuaikan setelah mengevaluasi essay.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={editingScore}
                      onChange={(e) => setEditingScore(e.target.value)}
                      className="w-20 px-2 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center text-xs"
                    />
                    <button
                      onClick={handleUpdateScore}
                      disabled={savingScore}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {savingScore ? "Menyimpan..." : "Simpan Nilai"}
                    </button>
                  </div>
                </div>

                {scoreSuccessMsg && (
                  <div className="p-2 text-center rounded bg-emerald-50 text-emerald-700 font-medium text-xs border border-emerald-200">
                    {scoreSuccessMsg}
                  </div>
                )}

                {/* Sub Tab Content: Pilihan Ganda */}
                {modalSubTab === "pg" && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">
                      Rincian Pilihan Ganda
                    </h4>

                    {attemptDetail.pgAnswers.length === 0 ? (
                      <p className="text-slate-400 italic">Tidak ada jawaban PG pada pertemuan ini.</p>
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
                )}

                {/* Sub Tab Content: Jawaban Essay */}
                {modalSubTab === "essay" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800">
                        Hasil Pengerjaan Essay Siswa
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Total {attemptDetail.essayAnswers.length} Soal Essay
                      </span>
                    </div>

                    {attemptDetail.essayAnswers.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-lg">
                        Tidak ada soal essay pada pertemuan ini.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {attemptDetail.essayAnswers.map((ea, idx) => (
                          <div key={ea.essay_question_id} className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2">
                            <div className="font-semibold text-slate-900 flex items-start gap-1.5 leading-snug">
                              <span className="text-blue-600 font-bold shrink-0">{idx + 1}.</span>
                              <span>{ea.question_text}</span>
                            </div>
                            
                            <div>
                              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                                Jawaban Siswa:
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed font-sans text-xs">
                                {ea.answer_text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
              Hapus Hasil Pengerjaan Ini?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Data submission kuis dan semua jawaban essay siswa akan dihapus secara permanen.
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
          Memuat data hasil dan essay siswa...
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
