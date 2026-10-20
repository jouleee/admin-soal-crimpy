"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Meeting, Question, Choice, EssayQuestion } from "@/types/database";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  AlertTriangle
} from "lucide-react";

interface QuestionWithChoices extends Question {
  choices: Choice[];
}

function QuestionsContent() {
  const searchParams = useSearchParams();
  const initialMeetingId = searchParams.get("meetingId");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pg" | "essay">("pg");
  
  const [questions, setQuestions] = useState<QuestionWithChoices[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<EssayQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PG Modal State
  const [pgModalOpen, setPgModalOpen] = useState(false);
  const [editingPgId, setEditingPgId] = useState<number | null>(null);
  const [pgQuestionText, setPgQuestionText] = useState("");
  const [pgQuestionOrder, setPgQuestionOrder] = useState<number>(1);
  const [choicesForm, setChoicesForm] = useState<{
    id?: number;
    label: "A" | "B" | "C" | "D";
    text: string;
    isCorrect: boolean;
  }[]>([
    { label: "A", text: "", isCorrect: true },
    { label: "B", text: "", isCorrect: false },
    { label: "C", text: "", isCorrect: false },
    { label: "D", text: "", isCorrect: false },
  ]);

  // Essay Modal State
  const [essayModalOpen, setEssayModalOpen] = useState(false);
  const [editingEssayId, setEditingEssayId] = useState<number | null>(null);
  const [essayText, setEssayText] = useState("");

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ type: "pg" | "essay"; id: number; title: string } | null>(null);

  const supabase = createClient();

  // 1. Fetch meetings list on load
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .order("meeting_number", { ascending: true });

        if (error) throw error;
        setMeetings(data || []);

        if (data && data.length > 0) {
          if (initialMeetingId) {
            const found = data.find((m) => m.id === parseInt(initialMeetingId));
            setSelectedMeetingId(found ? found.id : data[0].id);
          } else {
            setSelectedMeetingId(data[0].id);
          }
        }
      } catch (err: unknown) {
        console.error("Error loading meetings:", err);
      }
    };

    fetchMeetings();
  }, [initialMeetingId]);

  // 2. Fetch questions when selectedMeetingId or activeTab changes
  const fetchQuestionsData = async (meetingId: number) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      if (activeTab === "pg") {
        const { data: qData, error: qError } = await supabase
          .from("questions")
          .select("*")
          .eq("meeting_id", meetingId)
          .order("question_order", { ascending: true });

        if (qError) throw qError;

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
        } else {
          setQuestions([]);
        }
      } else {
        const { data: eData, error: eError } = await supabase
          .from("essay_questions")
          .select("*")
          .eq("meeting_id", meetingId)
          .order("id", { ascending: true });

        if (eError) throw eError;
        setEssayQuestions(eData || []);
      }
    } catch (err: unknown) {
      console.error("Error loading questions:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat soal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMeetingId) {
      fetchQuestionsData(selectedMeetingId);
    }
  }, [selectedMeetingId, activeTab]);

  const handleOpenAddPg = () => {
    setEditingPgId(null);
    setPgQuestionText("");
    const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.question_order)) + 1 : 1;
    setPgQuestionOrder(nextOrder);
    setChoicesForm([
      { label: "A", text: "", isCorrect: true },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ]);
    setErrorMessage(null);
    setPgModalOpen(true);
  };

  const handleOpenEditPg = (q: QuestionWithChoices) => {
    setEditingPgId(q.id);
    setPgQuestionText(q.question_text);
    setPgQuestionOrder(q.question_order);

    const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
    const populated = labels.map((lbl) => {
      const match = q.choices.find((c) => c.choice_label === lbl);
      return {
        id: match?.id,
        label: lbl,
        text: match ? match.choice_text : "",
        isCorrect: match ? match.is_correct : lbl === "A",
      };
    });

    setChoicesForm(populated);
    setErrorMessage(null);
    setPgModalOpen(true);
  };

  const handleSavePg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) return;

    if (!pgQuestionText.trim()) {
      setErrorMessage("Pertanyaan soal tidak boleh kosong.");
      return;
    }

    for (const c of choicesForm) {
      if (!c.text.trim()) {
        setErrorMessage(`Teks pilihan ${c.label} tidak boleh kosong.`);
        return;
      }
    }

    const hasCorrect = choicesForm.some((c) => c.isCorrect);
    if (!hasCorrect) {
      setErrorMessage("Harus memilih salah satu pilihan sebagai kunci jawaban.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      if (editingPgId) {
        const { error: qErr } = await supabase
          .from("questions")
          .update({
            question_text: pgQuestionText.trim(),
            question_order: pgQuestionOrder,
          })
          .eq("id", editingPgId);

        if (qErr) throw qErr;

        for (const c of choicesForm) {
          if (c.id) {
            const { error: cErr } = await supabase
              .from("choices")
              .update({
                choice_text: c.text.trim(),
                is_correct: c.isCorrect,
              })
              .eq("id", c.id);
            if (cErr) throw cErr;
          } else {
            const { error: cErr } = await supabase.from("choices").insert([
              {
                question_id: editingPgId,
                choice_label: c.label,
                choice_text: c.text.trim(),
                is_correct: c.isCorrect,
              },
            ]);
            if (cErr) throw cErr;
          }
        }
      } else {
        const { data: newQ, error: qErr } = await supabase
          .from("questions")
          .insert([
            {
              meeting_id: selectedMeetingId,
              question_text: pgQuestionText.trim(),
              question_order: pgQuestionOrder,
            },
          ])
          .select("id")
          .single();

        if (qErr) throw qErr;

        const choicesToInsert = choicesForm.map((c) => ({
          question_id: newQ.id,
          choice_label: c.label,
          choice_text: c.text.trim(),
          is_correct: c.isCorrect,
        }));

        const { error: cErr } = await supabase.from("choices").insert(choicesToInsert);
        if (cErr) throw cErr;
      }

      setPgModalOpen(false);
      fetchQuestionsData(selectedMeetingId);
    } catch (err: unknown) {
      console.error("Error saving PG question:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan soal.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddEssay = () => {
    setEditingEssayId(null);
    setEssayText("");
    setErrorMessage(null);
    setEssayModalOpen(true);
  };

  const handleOpenEditEssay = (e: EssayQuestion) => {
    setEditingEssayId(e.id);
    setEssayText(e.question_text);
    setErrorMessage(null);
    setEssayModalOpen(true);
  };

  const handleSaveEssay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) return;

    if (!essayText.trim()) {
      setErrorMessage("Teks soal essay tidak boleh kosong.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      if (editingEssayId) {
        const { error } = await supabase
          .from("essay_questions")
          .update({
            question_text: essayText.trim(),
          })
          .eq("id", editingEssayId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("essay_questions").insert([
          {
            meeting_id: selectedMeetingId,
            question_text: essayText.trim(),
          },
        ]);

        if (error) throw error;
      }

      setEssayModalOpen(false);
      fetchQuestionsData(selectedMeetingId);
    } catch (err: unknown) {
      console.error("Error saving essay:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan soal essay.");
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget || !selectedMeetingId) return;

    try {
      setSaving(true);
      if (deleteTarget.type === "pg") {
        const { error } = await supabase.from("questions").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("essay_questions").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      }

      setDeleteTarget(null);
      fetchQuestionsData(selectedMeetingId);
    } catch (err: unknown) {
      console.error("Error deleting question:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus soal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Meeting Selector & Add Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Bank Soal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelolaan pertanyaan dan opsi jawaban per pertemuan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMeetingId ?? ""}
            onChange={(e) => setSelectedMeetingId(parseInt(e.target.value))}
            className="bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-slate-400 cursor-pointer"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                Pertemuan {m.meeting_number}: {m.title.length > 25 ? m.title.substring(0, 25) + "..." : m.title}
              </option>
            ))}
          </select>

          {activeTab === "pg" ? (
            <button
              onClick={handleOpenAddPg}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah PG</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddEssay}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Essay</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs">
        <button
          onClick={() => setActiveTab("pg")}
          className={`pb-2.5 font-medium transition-colors ${
            activeTab === "pg"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Pilihan Ganda ({questions.length})
        </button>

        <button
          onClick={() => setActiveTab("essay")}
          className={`pb-2.5 font-medium transition-colors ${
            activeTab === "essay"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Essay ({essayQuestions.length})
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* CONTENT: TAB PG */}
      {activeTab === "pg" && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Memuat data soal...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Belum ada soal pilihan ganda di pertemuan ini.
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-4 transition-colors hover:border-slate-300"
              >
                {/* Header Soal */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {q.question_order}.
                    </span>
                    <p className="text-slate-900 text-xs font-medium leading-relaxed">
                      {q.question_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditPg(q)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "pg",
                          id: q.id,
                          title: `Soal #${q.question_order}`,
                        })
                      }
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                      title="Hapus"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Choices List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                  {q.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className={`px-3 py-2 rounded-lg flex items-center justify-between gap-2 border ${
                        choice.is_correct
                          ? "bg-slate-50 border-emerald-300 text-slate-900 font-medium"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="truncate">
                        <strong className="mr-1.5">{choice.choice_label}.</strong>
                        {choice.choice_text}
                      </span>
                      {choice.is_correct && (
                        <Check size={13} className="text-emerald-600 shrink-0 font-bold" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONTENT: TAB ESSAY */}
      {activeTab === "essay" && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Memuat soal essay...
            </div>
          ) : essayQuestions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Belum ada soal essay di pertemuan ini.
            </div>
          ) : (
            essayQuestions.map((eq, index) => (
              <div
                key={eq.id}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {index + 1}.
                    </span>
                    <p className="text-slate-900 text-xs font-medium leading-relaxed">
                      {eq.question_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditEssay(eq)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "essay",
                          id: eq.id,
                          title: `Essay #${index + 1}`,
                        })
                      }
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                      title="Hapus"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT PG */}
      {pgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingPgId ? "Edit Soal Pilihan Ganda" : "Tambah Soal Pilihan Ganda"}
              </h3>
              <button
                onClick={() => setPgModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePg} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Urut
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={pgQuestionOrder}
                  onChange={(e) => setPgQuestionOrder(parseInt(e.target.value) || 1)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Pertanyaan
                </label>
                <textarea
                  required
                  rows={3}
                  value={pgQuestionText}
                  onChange={(e) => setPgQuestionText(e.target.value)}
                  placeholder="Ketik teks pertanyaan..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-medium text-slate-700">
                    Pilihan Jawaban
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Pilih radio untuk kunci jawaban
                  </span>
                </div>

                <div className="space-y-2">
                  {choicesForm.map((choice, idx) => (
                    <div key={choice.label} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct_choice"
                        checked={choice.isCorrect}
                        onChange={() => {
                          setChoicesForm((prev) =>
                            prev.map((c, i) => ({
                              ...c,
                              isCorrect: i === idx,
                            }))
                          );
                        }}
                        className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
                      />
                      <span className="w-5 font-bold text-slate-700">{choice.label}.</span>
                      <input
                        type="text"
                        required
                        value={choice.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChoicesForm((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, text: val } : c))
                          );
                        }}
                        placeholder={`Teks pilihan ${choice.label}`}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <p className="text-rose-600 text-xs">{errorMessage}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPgModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT ESSAY */}
      {essayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingEssayId ? "Edit Soal Essay" : "Tambah Soal Essay"}
              </h3>
              <button
                onClick={() => setEssayModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEssay} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Pertanyaan Essay
                </label>
                <textarea
                  required
                  rows={4}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  placeholder="Ketikkan teks pertanyaan essay..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {errorMessage && (
                <p className="text-rose-600 text-xs">{errorMessage}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEssayModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-4 shadow-lg">
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Soal Ini?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {deleteTarget.title} akan dihapus secara permanen.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50"
              >
                {saving ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 text-xs">
          Memuat data bank soal...
        </div>
      }
    >
      <QuestionsContent />
    </Suspense>
  );
}
