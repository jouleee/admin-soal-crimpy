"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Meeting, EssayQuestion } from "@/types/database";
import { 
  Search, 
  Download, 
  RefreshCw,
  FileText,
  Layers,
  User
} from "lucide-react";

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

function EssaysContent() {
  const searchParams = useSearchParams();
  const initialMeetingId = searchParams.get("meetingId") || "all";

  const [essayAnswersList, setEssayAnswersList] = useState<EssayAnswerItem[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<EssayQuestion[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [meetingFilter, setMeetingFilter] = useState<string>(initialMeetingId);
  const [questionFilter, setQuestionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"byQuestion" | "byStudent">("byQuestion");

  const supabase = createClient();

  const fetchData = async () => {
    try {
      setLoading(true);

      const [
        { data: mData },
        { data: eqData },
        { data: eaData, error: eaErr }
      ] = await Promise.all([
        supabase.from("meetings").select("*").order("meeting_number", { ascending: true }),
        supabase.from("essay_questions").select("*").order("meeting_id", { ascending: true }),
        supabase
          .from("essay_answers")
          .select("id, attempt_id, essay_question_id, answer_text, created_at, essay_questions(id, question_text, meeting_id), quiz_attempts(id, meeting_id, submitted_at, students(id, name, class_name), meetings(id, meeting_number, title))")
          .order("created_at", { ascending: false }),
      ]);

      if (eaErr) throw eaErr;

      setMeetings(mData || []);
      setEssayQuestions(eqData || []);
      setEssayAnswersList((eaData || []) as unknown as EssayAnswerItem[]);
    } catch (err) {
      console.error("Error loading essay answers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Essay Questions for Dropdown
  const availableQuestions = useMemo(() => {
    if (meetingFilter === "all") {
      return essayQuestions;
    }
    return essayQuestions.filter((eq) => eq.meeting_id === parseInt(meetingFilter));
  }, [essayQuestions, meetingFilter]);

  // Filtered Essay Answers
  const filteredAnswers = useMemo(() => {
    return essayAnswersList.filter((ea) => {
      // Meeting filter
      if (meetingFilter !== "all") {
        const meetingId = ea.essay_questions?.meeting_id || ea.quiz_attempts?.meeting_id;
        if (meetingId !== parseInt(meetingFilter)) {
          return false;
        }
      }

      // Question filter
      if (questionFilter !== "all") {
        if (ea.essay_question_id !== parseInt(questionFilter)) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
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
  }, [essayAnswersList, meetingFilter, questionFilter, searchQuery]);

  // Grouped by Question
  const groupedByQuestion = useMemo(() => {
    const map = new Map<number, { question: { id: number; question_text: string; meeting_id: number }; answers: EssayAnswerItem[] }>();

    filteredAnswers.forEach((ea) => {
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
  }, [filteredAnswers]);

  // Grouped by Student
  const groupedByStudent = useMemo(() => {
    const map = new Map<number, { attempt: EssayAnswerItem["quiz_attempts"]; answers: EssayAnswerItem[] }>();

    filteredAnswers.forEach((ea) => {
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
  }, [filteredAnswers]);

  // Export CSV for Essay Answers
  const exportEssaysCSV = () => {
    if (filteredAnswers.length === 0) return;

    const headers = ["No", "Nama Siswa", "Kelas", "Pertemuan", "Pertanyaan Essay", "Jawaban Siswa", "Waktu Pengumpulan"];
    const rows = filteredAnswers.map((ea, index) => {
      const safeAnswer = ea.answer_text.replace(/"/g, '""');
      const safeQuestion = (ea.essay_questions?.question_text || "").replace(/"/g, '""');
      return [
        index + 1,
        `"${ea.quiz_attempts?.students?.name || "Anonim"}"`,
        `"${ea.quiz_attempts?.students?.class_name || "-"}"`,
        `"Pertemuan ${ea.quiz_attempts?.meetings?.meeting_number || "-"}: ${ea.quiz_attempts?.meetings?.title || "-"}"`,
        `"${safeQuestion}"`,
        `"${safeAnswer}"`,
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Hasil Jawaban Essay
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar lembar jawaban essay siswa untuk evaluasi dan analisis pemahaman
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
          <button
            onClick={exportEssaysCSV}
            disabled={filteredAnswers.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Total Jawaban Essay</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {loading ? "-" : essayAnswersList.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Siswa Menjawab</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {loading ? "-" : new Set(essayAnswersList.map((ea) => ea.attempt_id)).size}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Total Soal Essay</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {loading ? "-" : essayQuestions.length} Soal
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] font-medium text-slate-500">Sesuai Filter</span>
          <div className="text-xl font-bold text-blue-700 mt-0.5">
            {loading ? "-" : `${filteredAnswers.length} Jawaban`}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Search text */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari siswa, kelas, isi jawaban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400"
            />
          </div>

          {/* Filter Pertemuan */}
          <div>
            <select
              value={meetingFilter}
              onChange={(e) => {
                setMeetingFilter(e.target.value);
                setQuestionFilter("all");
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

          {/* Filter Soal Essay */}
          <div>
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-hidden focus:border-slate-400 cursor-pointer"
            >
              <option value="all">Semua Pertanyaan Essay</option>
              {availableQuestions.map((eq) => (
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
              onClick={() => setViewMode("byQuestion")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "byQuestion"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Kelompokkan per Pertanyaan
            </button>
            <button
              onClick={() => setViewMode("byStudent")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "byStudent"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Kelompokkan per Siswa
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
          Memuat jawaban essay...
        </div>
      ) : filteredAnswers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
          Tidak ada jawaban essay yang sesuai dengan filter pencarian.
        </div>
      ) : viewMode === "byQuestion" ? (
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

                  <div className="text-[11px] text-slate-400">
                    {group.answers.length} Soal Dijawab
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
  );
}

export default function EssaysPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 text-xs">
          Memuat hasil jawaban essay...
        </div>
      }
    >
      <EssaysContent />
    </Suspense>
  );
}
