"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  HardDriveDownload,
  RefreshCw,
} from "lucide-react";

import Button from "@/components/ui/button/Button";
import DriveConnect from "./DriveConnect";
import {
  createCronToken,
  listBackups,
  removeCronToken,
  runBackup,
  setRetentionDays,
  type BackupFile,
  type BackupSettings,
} from "@/lib/backups";

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDate = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "—";

/** Сүүлийн хуулбар хэр хуучирсныг хүнд ойлгомжтой хэлбэрээр */
function freshness(lastAt: string | null): {
  label: string;
  ok: boolean;
} {
  if (!lastAt) return { label: "Хуулбар байхгүй", ok: false };

  const hours = (Date.now() - new Date(lastAt).getTime()) / 3_600_000;

  if (hours < 26) return { label: "Өнөөдрийнх", ok: true };
  if (hours < 24 * 3) {
    return { label: `${Math.floor(hours / 24)} хоногийн өмнөх`, ok: false };
  }
  return { label: `${Math.floor(hours / 24)} хоног шинэчлэгдээгүй`, ok: false };
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  /** Хадгалах хугацааны маягтын утга — хоосон бол засаагүй */
  const [retention, setRetention] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listBackups();
      setBackups(data.backups);
      setSettings(data.settings);
      setRetention(String(data.settings.retentionDays));
    } catch (err) {
      console.error("Архивуудыг ачаалж чадсангүй:", err);
      setError(
        err instanceof Error ? err.message : "Архивуудыг ачаалахад алдаа гарлаа."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToken = async (create: boolean) => {
    setError("");
    setNotice("");

    try {
      if (create) {
        await createCronToken();
        setNotice("Токен үүслээ. Доорх командыг hPanel-ийн cron-д тавина уу.");
      } else {
        await removeCronToken();
        setNotice("Токен устгагдлаа — автомат нөөцлөлт зогсоно.");
      }
      await load();
    } catch (err) {
      console.error("Токены үйлдэл амжилтгүй:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    }
  };

  const handleRetention = async () => {
    setError("");
    setNotice("");

    try {
      const saved = await setRetentionDays(Number(retention));
      setNotice(`Хадгалах хугацаа ${saved} хоног боллоо.`);
      await load();
    } catch (err) {
      console.error("Хугацаа хадгалж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setNotice("");

    try {
      const result = await runBackup();
      setNotice(
        `${result.tables.length} хүснэгт, ${result.totalRows} мөр хуулбарлав ` +
          `(${(result.durationMs / 1000).toFixed(1)} сек)` +
          (result.pruned.length
            ? ` — хугацаа хэтэрсэн ${result.pruned.length} архив устлаа`
            : "")
      );
      await load();
    } catch (err) {
      console.error("Backup амжилтгүй боллоо:", err);
      setError(
        err instanceof Error ? err.message : "Backup үүсгэхэд алдаа гарлаа."
      );
    } finally {
      setRunning(false);
    }
  };

  const status = freshness(settings?.lastBackupAt ?? null);

  return (
    <div className="flex flex-col gap-5">
      {/* Холболт — эндээс бүх тохиргоо хийгдэнэ */}
      <DriveConnect onChange={load} />

      {/* Төлөвийн товч мэдээлэл */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface p-4">
          <p className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Сүүлийн хуулбар
          </p>
          <p className="mt-2 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            {status.ok ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-success-600" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 text-warning-500" />
            )}
            {status.label}
          </p>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {formatDate(settings?.lastBackupAt ?? null)}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Автомат хуулбар
          </p>
          <p className="mt-2 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            {settings?.tokenConfigured ? (
              <>
                <CheckCircle2 className="h-4.5 w-4.5 text-success-600" />
                Тохируулсан
              </>
            ) : (
              <>
                <AlertTriangle className="h-4.5 w-4.5 text-warning-500" />
                Тохируулаагүй
              </>
            )}
          </p>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {settings?.tokenConfigured
              ? "Cron ажиллах боломжтой"
              : "Токен үүсгээгүй — өдөр бүрийн хуулбар ажиллахгүй"}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Хадгалах хугацаа
          </p>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={settings?.retentionRange.min ?? 3}
              max={settings?.retentionRange.max ?? 365}
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              className="h-9 w-20 rounded-lg border border-gray-300 bg-white px-2.5 text-base font-semibold text-gray-900 dark:border-white/10 dark:bg-gray-900 dark:text-white"
            />
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              хоног
            </span>

            {settings && Number(retention) !== settings.retentionDays && (
              <Button type="button" size="sm" onClick={handleRetention}>
                Хадгалах
              </Button>
            )}
          </div>

          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            Хугацаа хэтэрсэн ч сүүлийн 3 хуулбар үргэлж үлдэнэ
          </p>
        </div>
      </div>

      {!loading && !settings?.tokenConfigured && (
        <div className="rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          <p className="font-medium">Автомат хуулбар идэвхгүй байна.</p>
          <p className="mt-1">
            Cron нь нэвтэрч чаддаггүй тул түүнд зориулсан токен хэрэгтэй.
            Товчийг дарахад үүсгэж, hPanel-д хуулж тавих командыг харуулна.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => handleToken(true)}>
              Токен үүсгэх
            </Button>
          </div>
        </div>
      )}

      {!loading && settings?.cronCommand && (
        <div className="surface p-5">
          <p className="font-medium text-gray-900 dark:text-white">
            hPanel → Advanced → Cron Jobs
          </p>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Өдөрт нэг удаа (жишээ нь шөнийн 3 цагт) ажиллахаар тохируулж, доорх
            командыг тавина:
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-gray-100 px-3 py-2 text-theme-xs dark:bg-white/10">
              {settings.cronCommand}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(settings.cronCommand ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Хууллаа" : "Хуулах"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleToken(true)}
            >
              Токен шинэчлэх
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleToken(false)}
            >
              Токен устгах
            </Button>
          </div>

          <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
            ⚠ Токен нь нөөцлөлт дуудах эрх өгнө — командыг задруулахгүй байх.
            Шинэчлэхэд хуучин токен тэр дороо хүчингүй болно, cron дээрх
            командыг ч заавал солино.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {backups.length} архив хадгалагдаж байна
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading || running}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Сэргээх
          </Button>
          <Button type="button" size="sm" onClick={handleRun} disabled={running}>
            <HardDriveDownload className="h-4 w-4" />
            {running ? "Хуулбарлаж байна..." : "Одоо хуулбарлах"}
          </Button>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-success-50 px-4 py-3 text-theme-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
          {notice}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Огноо</th>
              <th className="px-5 py-3.5 font-medium">Хэмжээ</th>
              <th className="px-5 py-3.5 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-10 text-center text-theme-sm text-gray-500"
                >
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && backups.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-10 text-center text-theme-sm text-gray-500"
                >
                  Архив байхгүй байна. «Одоо хуулбарлах» товчийг дарна уу.
                </td>
              </tr>
            )}

            {!loading &&
              backups.map((backup) => (
                <tr key={backup.name} className="text-theme-sm">
                  <td className="px-5 py-4 text-gray-800 dark:text-white/90">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                    {formatSize(backup.size)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      {/* Архив нь эзний Drive дотор — серверээр дамжуулахгүй,
                          шууд тэнд нээж татна */}
                      <a
                        href={backup.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Drive дээр нээх
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="surface p-5 text-theme-sm text-gray-600 dark:text-gray-400">
        <p className="font-medium text-gray-900 dark:text-white">
          Сэргээх талаар
        </p>
        <p className="mt-2">
          Сэргээлт нь өгөгдлийг бүхэлд нь солих тул дэлгэцээс хийхгүй — санамсаргүй
          дарахад бүх бүртгэл алдагдана. Татсан архиваас дараах командаар сэргээнэ:
        </p>
        <code className="mt-2 block overflow-x-auto rounded bg-gray-100 px-2 py-1.5 text-theme-xs dark:bg-white/10">
          npm run restore -- --file архив.ndjson.gz --write
        </code>
        <p className="mt-2">
          <code>--write</code> нэмэхгүй бол юу сэргээгдэхийг зөвхөн харуулна.
        </p>
      </div>
    </div>
  );
}
