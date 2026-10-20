"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Meeting } from "@/types/database";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  RefreshCw
} from "lucide-react";

interface MeetingWithCounts extends Meeting {
  pgCount?: number;
  essayCount?: number;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  
  const [meetingNumber, setMeetingNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const { data: meetingsData, error: mError } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_number", { ascending: true });

      if (mError) throw mError;

      const [{ data: pgData }, { data: essayData }] = await Promise.all([
        supabase.from("questions").select("meeting_id"),
        supabase.from("essay_questions").select("meeting_id"),
      ]);

      const enriched = (meetingsData || []).map((m) => ({
        ...m,
        pgCount: (pgData || []).filter((q) => q.meeting_id === m.id).length,
        essayCount: (essayData || []).filter((e) => e.meeting_id === m.id).length,
      }));

      setMeetings(enriched);

      if (enriched.length > 0 && !editingMeeting) {
        const maxNum = Math.max(...enriched.map((m) => m.meeting_number));
        setMeetingNumber(maxNum + 1);
      }
    } catch (err: unknown) {
      console.error("Error fetching meetings:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat data pertemuan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const openAddModal = () => {
    setEditingMeeting(null);
    const nextNum = meetings.length > 0 ? Math.max(...meetings.map((m) => m.meeting_number)) + 1 : 1;
    setMeetingNumber(nextNum);
    setTitle("");
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setMeetingNumber(meeting.meeting_number);
    setTitle(meeting.title);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Judul materi pertemuan tidak boleh kosong.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      if (editingMeeting) {
        const { error } = await supabase
          .from("meetings")
          .update({
            meeting_number: meetingNumber,
            title: title.trim(),
          })
          .eq("id", editingMeeting.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("meetings").insert([
          {
            meeting_number: meetingNumber,
            title: title.trim(),
          },
        ]);

        if (error) throw error;
      }

      setModalOpen(false);
      fetchMeetings();
    } catch (err: unknown) {
      console.error("Error saving meeting:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setSaving(true);
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;

      setDeleteConfirmId(null);
      fetchMeetings();
    } catch (err: unknown) {
      console.error("Error deleting meeting:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus pertemuan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Pertemuan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar bab materi kurikulum evaluasi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMeetings}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Segarkan data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Pertemuan</span>
          </button>
        </div>
      </div>

      {/* Alert Error */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Meetings Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Memuat daftar pertemuan...
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada pertemuan. Klik tombol &quot;Tambah Pertemuan&quot; untuk membuat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3 w-16">No</th>
                  <th className="px-4 py-3">Judul Pertemuan</th>
                  <th className="px-4 py-3">Soal</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-blue-600">
                      P{meeting.meeting_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {meeting.title}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {meeting.pgCount ?? 0} PG • {meeting.essayCount ?? 0} Essay
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(meeting.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/questions?meetingId=${meeting.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-700 mr-2"
                        >
                          Bank Soal
                        </Link>
                        <button
                          onClick={() => openEditModal(meeting)}
                          className="p-1 text-slate-400 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(meeting.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
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

      {/* Modal Tambah / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingMeeting ? "Edit Pertemuan" : "Tambah Pertemuan"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Pertemuan
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={meetingNumber}
                  onChange={(e) => setMeetingNumber(parseInt(e.target.value) || 1)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Judul Materi
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Kabel Cross-Over"
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {errorMessage && (
                <p className="text-rose-600 text-xs">{errorMessage}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs shadow-blue-600/20 disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-4 shadow-lg">
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Pertemuan?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Semua soal dan hasil kuis di pertemuan ini akan ikut terhapus.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs shadow-rose-600/20 disabled:opacity-50"
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
