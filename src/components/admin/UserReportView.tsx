"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import {
  aimags,
  genders,
  labelOf,
  loveLanguages,
  mbtiTypes,
  temperaments,
  type Option,
} from "@/data/profileOptions";
import { taskStatusLabels, taskStatuses } from "@/data/taskOptions";
import {
  ageOf,
  fullNameOf,
  getUserReport,
  type ActivityCount,
  type UserReport,
} from "@/lib/userDirectory";
import { roleLabels, statusLabels } from "@/lib/users";

const dateFormat = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dash = (value: string | null | undefined) => (value ? value : "—");

/** Огноо ба тухайн өдрөөс хойших хугацаа: "2019-05-12 (6 жил)" */
function dateWithYears(value: string) {
  if (!value) return "—";
  const years = ageOf(value);
  return years === null ? value : `${value} (${years} жил)`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface break-inside-avoid p-5">
      <h2 className="mb-4 border-b border-gray-100 pb-2 text-theme-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-white/10 dark:text-gray-300">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Шошго — утга хос мөрүүд */
function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="mt-0.5 break-words text-theme-sm text-gray-900 dark:text-white/90">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Оноотой сонголтууд (темперамент, хайрын хэл) — хамгийн өндрөөс нь эрэмбэлсэн мөр */
function ScoreBars({
  options,
  scores,
}: {
  options: Option[];
  scores: Record<string, number>;
}) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="text-theme-sm text-gray-400">Бөглөөгүй</p>;
  }

  const max = Math.max(...entries.map(([, score]) => score), 1);

  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([key, score]) => (
        <li key={key}>
          <div className="flex justify-between gap-2 text-theme-xs">
            <span className="text-gray-700 dark:text-gray-300">
              {labelOf(options, key)}
            </span>
            <span className="tabular-nums text-gray-500">{score}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${(score / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="text-theme-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const lastHint = (item: ActivityCount) =>
  item.last ? `Сүүлд ${dateFormat.format(item.last)}` : undefined;

/**
 * Нэг хэрэглэгчийн дэлгэрэнгүй тайлан (зөвхөн админ).
 * Хэвлэхэд хажуугийн цэс, толгой, товчлуурууд нуугдана.
 */
export default function UserReportView() {
  const params = useParams<{ uid: string }>();
  const uid = decodeURIComponent(params.uid ?? "");

  const [report, setReport] = useState<UserReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getUserReport(uid)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        console.error("Хэрэглэгчийн тайланг ачаалж чадсангүй:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Тайланг ачаалахад алдаа гарлаа.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const back = (
    <Link
      href="/users/directory"
      className="inline-flex items-center gap-1.5 text-theme-sm font-medium text-gray-600 hover:text-gray-900 print:hidden dark:text-gray-400 dark:hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
      Жагсаалт руу
    </Link>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
      </div>
    );
  }

  const { user, children, activity } = report;
  const name = fullNameOf(user) ?? "Нэр оруулаагүй";
  const age = ageOf(user.birth_date);
  const taskTotal = Object.values(activity.tasks).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Printer className="h-4 w-4" strokeWidth={1.8} />
          Хэвлэх / PDF
        </button>
      </div>

      {/* Толгой */}
      <div className="surface flex flex-wrap items-center gap-4 p-5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-navy-900 text-white">
          {user.photo_url ? (
            <Image
              src={user.photo_url}
              alt={name}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-semibold uppercase">
              {(user.first_name || user.last_name || "?")[0]}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{name}</h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {[user.email, user.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-theme-xs text-gray-400">
            {roleLabels[user.role]} · {statusLabels[user.status]}
            {user.createdAt && ` · Бүртгүүлсэн ${dateFormat.format(user.createdAt)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Чуулган">
          <Fields
            rows={[
              [
                "Аймаг",
                user.aimags.length
                  ? user.aimags.map((value) => labelOf(aimags, value)).join(", ")
                  : "—",
              ],
              ["Дуудлага", user.callings.length ? user.callings.join(", ") : "—"],
              ["Усан баптисм", dateWithYears(user.water_baptism_date)],
              ["Ариун Сүнсний баптисм", dateWithYears(user.holy_spirit_baptism_date)],
              ["Албан тушаал", dash(user.position)],
              ["Мэдэгдэл илгээх эрх", user.can_notify ? "Тийм" : "Үгүй"],
            ]}
          />
        </Section>

        <Section title="Хувийн мэдээлэл">
          <Fields
            rows={[
              [
                "Төрсөн өдөр",
                user.birth_date ? `${user.birth_date}${age !== null ? ` (${age} нас)` : ""}` : "—",
              ],
              ["Хүйс", user.gender ? labelOf(genders, user.gender) : "—"],
              ["Үндэс угсаа", dash(user.ethnicity)],
              ["Төрсөн газар", dash(user.birthplace)],
              ["Ажил мэргэжил", dash(user.occupation)],
              [
                "Тээврийн хэрэгсэл",
                user.has_car ? `Тийм${user.car_plate ? ` · ${user.car_plate}` : ""}` : "Үгүй",
              ],
            ]}
          />
        </Section>

        <Section title="Зан төлөв">
          <div className="flex flex-col gap-5">
            <Fields
              rows={[["MBTI", user.mbti ? labelOf(mbtiTypes, user.mbti) : "—"]]}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-theme-xs text-gray-500 dark:text-gray-400">Темперамент</p>
                <ScoreBars options={temperaments} scores={user.temperaments} />
              </div>
              <div>
                <p className="mb-2 text-theme-xs text-gray-500 dark:text-gray-400">Хайрын хэл</p>
                <ScoreBars options={loveLanguages} scores={user.love_languages} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Гэр бүл">
          <Fields
            rows={[
              ["Эхнэр / Нөхөр", dash(user.spouse_name)],
              [
                "Түүний төрсөн өдөр",
                user.spouse_birth_date
                  ? `${user.spouse_birth_date}${
                      ageOf(user.spouse_birth_date) !== null
                        ? ` (${ageOf(user.spouse_birth_date)} нас)`
                        : ""
                    }`
                  : "—",
              ],
            ]}
          />

          <p className="mb-2 mt-5 text-theme-xs text-gray-500 dark:text-gray-400">
            Хүүхэд ({children.length})
          </p>
          {children.length === 0 ? (
            <p className="text-theme-sm text-gray-400">Бүртгээгүй</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-white/5 dark:border-white/10">
              {children.map((child, index) => {
                const childAge = ageOf(child.birthDate);
                return (
                  <li key={index} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-theme-sm">
                    <span className="text-gray-900 dark:text-white/90">
                      {child.name || "Нэргүй"}
                    </span>
                    <span className="text-theme-xs text-gray-500">
                      {[
                        child.gender ? labelOf(genders, child.gender) : "",
                        child.birthDate,
                        childAge !== null ? `${childAge} нас` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Үйл ажиллагаа">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ActivityTile
            label="Оноосон даалгавар"
            value={taskTotal}
            hint={
              taskTotal
                ? taskStatuses
                    .filter((status) => activity.tasks[status])
                    .map((status) => `${taskStatusLabels[status]} ${activity.tasks[status]}`)
                    .join(" · ")
                : undefined
            }
          />
          <ActivityTile
            label="Хуваарийн ээлж"
            value={`${activity.shifts.done} / ${activity.shifts.total}`}
            hint={
              activity.shifts.total
                ? [
                    activity.shifts.upcoming ? `${activity.shifts.upcoming} удахгүй` : "",
                    activity.shifts.missed ? `${activity.shifts.missed} хийгдээгүй` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Бүгд гүйцэтгэсэн"
                : undefined
            }
          />
          <ActivityTile
            label="Харуулын эргэлт"
            value={activity.guardVisits.count}
            hint={lastHint(activity.guardVisits)}
          />
          <ActivityTile
            label="Хандивын хайрцаг"
            value={activity.donationVisits.count}
            hint={lastHint(activity.donationVisits)}
          />
          <ActivityTile
            label="Эд хөрөнгийн тооллого"
            value={activity.assetChecks.count}
            hint={lastHint(activity.assetChecks)}
          />
          <ActivityTile
            label="Халамж олгосон"
            value={activity.welfareAids.count}
            hint={lastHint(activity.welfareAids)}
          />
        </div>
      </Section>
    </div>
  );
}
