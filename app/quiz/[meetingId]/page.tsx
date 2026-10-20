"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Meeting, Question, Choice, EssayQuestion } from "@/types/database";
import { 
  Send, 
  ArrowLeft, 
  AlertTriangle
} from "lucide-react";

interface QuestionWithChoices extends Question {
  choices: Choice[];
}

export default function QuizRoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const meetingId = parseInt(params.meetingId as string);
  const studentName = searchParams.get("name") || "";
  const className = searchParams.get("className") || "";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [questions, setQuestions] = useState<QuestionWithChoices[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<EssayQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Student Answers State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});

  // Submission & Result state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    score: number;
    correctCount: number;
    totalPg: number;
    essayCount: number;
    attemptId: number;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!studentName || !className) {
      router.push("/quiz");
      return;
    }

    const loadQuizData = async () => {
      try {
        setLoading(true);

        const { data: mData, error: mErr } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", meetingId)
          .single();

        if (mErr) throw mErr;
        setMeeting(mData);

        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .select("*")
          .eq("meeting_id", meetingId)
          .order("question_order", { ascending: true });

        if (qErr) throw qErr;

        if (qData && qData.length > 0) {
          const qIds = qData.map((q) => q.id);
          const { data: cData, error: cError } = await supabase
            .from("choices")
            .select("*")
            .in("question_id", qIds)
            .order("choice_label", { ascending: true });

          if (cError) throw cError;

          const merged: QuestionWithChoices[] = qData.map((q) => ({
            ...q,
            choices: (cData || []).filter((c) => c.question_id === q.id),
          }));
          setQuestions(merged);
        }

        const { data: eqData, error: eqErr } = await supabase
          .from("essay_questions")
          .select("*")
          .eq("meeting_id", meetingId)
          .order("id", { ascending: true });

        if (eqErr) throw eqErr;
        setEssayQuestions(eqData || []);
      } catch (err) {
        console.error("Error loading quiz:", err);
      } finally {
        setLoading(false);
      }
    };

    if (meetingId) {
      loadQuizData();
    }
  }, [meetingId, studentName, className, router]);

  const handleSelectChoice = (questionId: number, choiceId: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  const handleEssayChange = (essayId: number, text: string) => {
    setEssayAnswers((prev) => ({
      ...prev,
      [essayId]: text,
    }));
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);

      let studentId: number;
      const { data: existingStudent, error: sFindErr } = await supabase
        .from("students")
        .select("id")
        .eq("name", studentName)
        .eq("class_name", className)
        .limit(1);

      if (sFindErr) throw sFindErr;

      if (existingStudent && existingStudent.length > 0) {
        studentId = existingStudent[0].id;
      } else {
        const { data: newStudent, error: sInsertErr } = await supabase
          .from("students")
          .insert([
            {
              name: studentName,
              class_name: className,
            },
          ])
          .select("id")
          .single();

        if (sInsertErr) throw sInsertErr;
        studentId = newStudent.id;
      }

      let correctCount = 0;
      const totalPg = questions.length;

      questions.forEach((q) => {
        const chosenId = selectedAnswers[q.id];
        const correctChoice = q.choices.find((c) => c.is_correct);
        if (correctChoice && chosenId === correctChoice.id) {
          correctCount++;
        }
      });

      const calculatedScore = totalPg > 0 ? (correctCount / totalPg) * 100 : 100;
      const roundedScore = Math.round(calculatedScore * 100) / 100;

      const { data: attempt, error: aErr } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            student_id: studentId,
            meeting_id: meetingId,
            score: roundedScore,
            submitted_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (aErr) throw aErr;

      const answerRows = Object.entries(selectedAnswers).map(([qId, cId]) => ({
        attempt_id: attempt.id,
        question_id: parseInt(qId),
        choice_id: cId,
      }));

      if (answerRows.length > 0) {
        const { error: ansErr } = await supabase.from("answers").insert(answerRows);
        if (ansErr) throw ansErr;
      }

      const essayRows = Object.entries(essayAnswers).map(([eqId, text]) => ({
        attempt_id: attempt.id,
        essay_question_id: parseInt(eqId),
        answer_text: text || "(Tidak dijawab)",
      }));

      essayQuestions.forEach((eq) => {
        if (!essayAnswers[eq.id]) {
          essayRows.push({
            attempt_id: attempt.id,
            essay_question_id: eq.id,
            answer_text: "(Tidak dijawab)",
          });
        }
      });

      if (essayRows.length > 0) {
        const { error: eaErr } = await supabase.from("essay_answers").insert(essayRows);
        if (eaErr) throw eaErr;
      }

      setFinalResult({
        score: roundedScore,
        correctCount,
        totalPg,
        essayCount: essayQuestions.length,
        attemptId: attempt.id,
      });

      setConfirmModalOpen(false);
      setQuizFinished(true);
    } catch (err: unknown) {
      console.error("Error submitting quiz:", err);
      setSubmitError(err instanceof Error ? err.message : "Gagal mengirimkan jawaban.");
    } finally {
      setSubmitting(false);
    }
  };

  const answeredPgCount = Object.keys(selectedAnswers).length;
  const answeredEssayCount = Object.values(essayAnswers).filter((t) => t.trim().length > 0).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-500 flex flex-col items-center justify-center p-4 text-xs">
        Memuat lembar soal...
      </div>
    );
  }

  // FINISHED SCREEN
  if (quizFinished && finalResult) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
        <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <Link href="/quiz" className="font-bold text-slate-900 text-sm">
            Crimpy Quiz
          </Link>
          <span className="text-xs text-emerald-600 font-semibold">Selesai</span>
        </header>

        <main className="max-w-md mx-auto w-full px-4 py-12">
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
            <h1 className="text-xl font-bold text-slate-900">
              Jawaban Berhasil Dikirim
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {studentName} ({className})
            </p>

            <div className="my-6 p-6 rounded-lg bg-emerald-50/50 border border-emerald-100">
              <span className="text-xs font-medium text-emerald-800 block mb-1">
                Skor Nilai Pilihan Ganda
              </span>
              <div className="text-4xl font-extrabold text-emerald-600">
                {finalResult.score}
              </div>
              <p className="text-xs text-emerald-700 mt-2 font-medium">
                Benar {finalResult.correctCount} dari {finalResult.totalPg} soal PG
              </p>
            </div>

            {finalResult.essayCount > 0 && (
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                {finalResult.essayCount} jawaban essay tersimpan untuk ditinjau guru.
              </p>
            )}

            <div className="space-y-2">
              <Link
                href="/quiz"
                className="block w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs shadow-blue-600/20 transition-all"
              >
                Kembali ke Halaman Kuis
              </Link>
              <Link
                href="/admin/results"
                className="block w-full py-2 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
              >
                Lihat Panel Hasil Admin
              </Link>
            </div>
          </div>
        </main>

        <footer className="p-4 text-center text-xs text-slate-400">
          Crimpy Platform
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between pb-24 font-sans">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 px-4 sm:px-8 py-3 bg-white/95 backdrop-blur-xs border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/quiz"
            className="p-1 rounded text-slate-400 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <span className="text-[10px] text-blue-600 font-bold block">
              Pertemuan {meeting?.meeting_number}
            </span>
            <h1 className="font-semibold text-xs sm:text-sm text-slate-900 truncate max-w-[200px] sm:max-w-md">
              {meeting?.title}
            </h1>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{studentName}</span>
          <span className="text-slate-400 ml-1">({className})</span>
        </div>
      </header>

      {/* Main Question Sheet */}
      <main className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6 flex-1">
        {/* SECTION 1: PILIHAN GANDA */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                Pilihan Ganda ({questions.length} Soal)
              </h2>
            </div>

            {questions.map((q) => {
              const selectedChoiceId = selectedAnswers[q.id];

              return (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-3">
                    <span className="font-bold text-blue-600 text-xs mt-0.5">
                      {q.question_order}.
                    </span>
                    <p className="text-slate-900 text-xs font-semibold leading-relaxed">
                      {q.question_text}
                    </p>
                  </div>

                  {/* Choice Options with tasteful blue selection */}
                  <div className="space-y-2 mt-3">
                    {q.choices.map((choice) => {
                      const isChosen = selectedChoiceId === choice.id;

                      return (
                        <div
                          key={choice.id}
                          onClick={() => handleSelectChoice(q.id, choice.id)}
                          className={`px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-all flex items-center gap-2.5 text-xs ${
                            isChosen
                              ? "bg-blue-50/80 border-blue-500 text-blue-950 font-medium shadow-2xs"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className={`font-bold ${isChosen ? "text-blue-600" : "text-slate-600"}`}>
                            {choice.choice_label}.
                          </span>
                          <span className="flex-1">{choice.choice_text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SECTION 2: ESSAY */}
        {essayQuestions.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="pb-2 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                Soal Essay ({essayQuestions.length} Soal)
              </h2>
            </div>

            {essayQuestions.map((eq, index) => (
              <div
                key={eq.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-2 mb-3">
                  <span className="font-bold text-blue-600 text-xs mt-0.5">
                    {index + 1}.
                  </span>
                  <p className="text-slate-900 text-xs font-semibold leading-relaxed">
                    {eq.question_text}
                  </p>
                </div>

                <textarea
                  rows={3}
                  value={essayAnswers[eq.id] || ""}
                  onChange={(e) => handleEssayChange(eq.id, e.target.value)}
                  placeholder="Ketikkan jawaban Anda di sini..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-blue-500 leading-relaxed"
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-4 sm:px-8 py-3 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Terjawab: <span className="font-semibold text-blue-600">{answeredPgCount}</span>/{questions.length} PG,{" "}
            <span className="font-semibold text-purple-600">{answeredEssayCount}</span>/{essayQuestions.length} Essay
          </div>

          <button
            onClick={() => setConfirmModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Send size={13} />
            <span>Kirim Jawaban</span>
          </button>
        </div>
      </div>

      {/* MODAL KONFIRMASI SUBMIT */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 shadow-lg">
            <h3 className="text-sm font-bold text-slate-900">
              Kirimkan Lembar Jawaban?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Anda telah menjawab {answeredPgCount} dari {questions.length} soal PG dan {answeredEssayCount} dari {essayQuestions.length} soal essay.
            </p>

            {answeredPgCount < questions.length && (
              <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                <span>Masih ada soal PG yang belum dijawab.</span>
              </div>
            )}

            {submitError && (
              <p className="mt-2 text-rose-600 text-xs">{submitError}</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 disabled:opacity-50"
              >
                {submitting ? "Mengirim..." : "Kirim Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
