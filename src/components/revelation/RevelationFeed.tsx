"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ImageViewer from "@/components/common/ImageViewer";
import RevelationCard from "@/components/revelation/RevelationCard";
import RevelationComposer from "@/components/revelation/RevelationComposer";
import { REVELATION_KINDS, type RevelationKind } from "@/data/revelationOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  createRevelation,
  deleteRevelation,
  listRevelations,
  updateRevelation,
  type Revelation,
} from "@/lib/revelations";

/** Илчлэл ирсэн өдрөөр, дараа нь нийтэлсэн цагаар — API-тай ижил дараалал */
const byRevealed = (a: Revelation, b: Revelation) =>
  b.revealedOn.localeCompare(a.revealedOn) || b.createdAt.getTime() - a.createdAt.getTime();

type RevelationFeedProps = {
  /** profileOptions.aimags доторх түлхүүр */
  aimag: string;
  /** Илчлэл (анхдагч) эсвэл «Тушаал»-ын таб — тус бүр өөрийн бүртгэлтэй */
  kind?: RevelationKind;
};

/**
 * Аймгийн «Илчлэл» самбар — Facebook-ийн нийтлэл шиг.
 *
 * Аймгийн гишүүн бүр бичнэ, өөрийнхөө нийтлэлийг засаж устгана. Админ
 * аль ч нийтлэлийг устгана (бусдын бичсэнийг засахгүй — үг нь тэднийх).
 */
export default function RevelationFeed({ aimag, kind = "revelation" }: RevelationFeedProps) {
  const labels = REVELATION_KINDS[kind];
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [items, setItems] = useState<Revelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await listRevelations(aimag, kind));
    } catch (err) {
      console.error("Илчлэл ачаалж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [aimag, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (input: {
    body: string;
    receivedBy: string;
    revealedOn: string;
    files: File[];
  }) => {
    if (!user?.uid) throw new Error("Нэвтэрсэн байх шаардлагатай.");

    const created = await createRevelation(user.uid, aimag, input, kind);
    setItems((prev) => [created, ...prev].sort(byRevealed));
    return true;
  };

  const saveEdit = async (
    revelation: Revelation,
    input: {
      body: string;
      receivedBy: string;
      revealedOn: string;
      keep: Revelation["images"];
      files: File[];
    }
  ) => {
    if (!user?.uid) throw new Error("Нэвтэрсэн байх шаардлагатай.");

    const updated = await updateRevelation(user.uid, revelation, input);
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)).sort(byRevealed)
    );
    setEditingId(null);
    return true;
  };

  const remove = async (revelation: Revelation) => {
    if (!window.confirm("Энэ нийтлэлийг устгах уу?")) return;

    try {
      await deleteRevelation(revelation);
      setItems((prev) => prev.filter((item) => item.id !== revelation.id));
    } catch (err) {
      console.error("Илчлэл устгахад алдаа гарлаа:", err);
      window.alert(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="surface p-4">
        <RevelationComposer
          submitLabel="Нийтлэх"
          placeholder={labels.placeholder}
          sourceLabel={labels.source}
          onSubmit={publish}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-theme-sm font-medium text-gray-500 dark:text-gray-400">
          Нийтлэлүүд
        </p>
        <button
          type="button"
          onClick={load}
          aria-label="Шинэчлэх"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {loading && items.length === 0 && (
        <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="surface px-4 py-10 text-center text-theme-sm text-gray-400">
          Одоогоор илчлэл алга. Эхний нийтлэлээ дээрх хэсэгт бичээрэй.
        </p>
      )}

      {items.map((revelation) => {
        const own = !!user?.uid && revelation.authorUid === user.uid;

        return editingId === revelation.id ? (
          <div key={revelation.id} className="surface p-4">
            <RevelationComposer
              placeholder={labels.placeholder}
              sourceLabel={labels.source}
              initialBody={revelation.body}
              initialReceivedBy={revelation.receivedBy}
              initialRevealedOn={revelation.revealedOn}
              initialImages={revelation.images}
              submitLabel="Хадгалах"
              onCancel={() => setEditingId(null)}
              onSubmit={(input) => saveEdit(revelation, input)}
            />
          </div>
        ) : (
          <RevelationCard
            key={revelation.id}
            revelation={revelation}
            canEdit={own}
            canDelete={own || isAdmin}
            onEdit={() => setEditingId(revelation.id)}
            onDelete={() => remove(revelation)}
            onOpenImage={setViewerSrc}
          />
        );
      })}

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  );
}
