"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Link2, Link2Off, Loader2 } from "lucide-react";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
  driveConnectUrl,
  driveDisconnect,
  driveStatus,
  type DriveStatus,
} from "@/lib/backups";

/** Callback-аас буцаж ирэх алдааны кодыг хүний хэлээр */
const REASONS: Record<string, string> = {
  access_denied: "Зөвшөөрөл өгөгдсөнгүй.",
  "no-code": "Google-ээс зөвшөөрлийн код ирсэнгүй.",
  "state-missing": "Хүсэлт хугацаа хэтэрсэн байна. Дахин оролдоно уу.",
  "state-mismatch": "Хүсэлтийн баталгаа таарсангүй. Дахин оролдоно уу.",
  "state-expired": "Хүсэлт хугацаа хэтэрлээ. Дахин оролдоно уу.",
  "no-client": "Client ID/secret хадгалагдаагүй байна.",
};

export default function DriveConnect({
  onChange,
}: {
  /** Холболт өөрчлөгдөхөд эцэг хэсэг архивуудаа дахин уншина */
  onChange?: () => void;
}) {
  const params = useSearchParams();

  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await driveStatus();
      setStatus(data);
      setClientId(data.clientId);
      // Холбогдоогүй бол маягтыг шууд нээнэ — хийх зүйл нь тэр
      setShowForm(!data.connected);
    } catch (err) {
      console.error("Drive-ийн төлөв уншиж чадсангүй:", err);
      setError(
        err instanceof Error ? err.message : "Төлөв уншихад алдаа гарлаа."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Google-ээс буцаж ирсэн үр дүнг нэг удаа харуулна
  useEffect(() => {
    const result = params.get("drive");
    if (!result) return;

    if (result === "connected") {
      setNotice("Google Drive амжилттай холбогдлоо.");
      onChange?.();
    } else {
      const reason = params.get("reason") ?? "";
      setError(REASONS[reason] ?? `Холбоход алдаа гарлаа: ${reason}`);
    }

    // Хаягийг цэвэрлэнэ — сэргээхэд мессеж дахин гарахгүй
    window.history.replaceState(null, "", "/backup");
  }, [params, onChange]);

  const handleConnect = async () => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const url = await driveConnectUrl({ clientId, clientSecret });
      // Google руу ЭНД шилжинэ — сервер 302 буцаавал fetch нь чимээгүй дагана
      window.location.href = url;
    } catch (err) {
      console.error("Холбох холбоос авч чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await driveDisconnect();
      setNotice("Холболт салгагдлаа.");
      await load();
      onChange?.();
    } catch (err) {
      console.error("Салгаж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="surface flex items-center gap-2 p-5 text-theme-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Холболтын төлөв шалгаж байна...
      </div>
    );
  }

  return (
    <div className="surface flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            {status?.connected ? (
              <CheckCircle2 className="h-5 w-5 text-success-600" />
            ) : (
              <Link2Off className="h-5 w-5 text-warning-500" />
            )}
            Google Drive
          </p>

          {status?.connected ? (
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
              {status.account || "холбогдсон"} → «{status.folderName}» фолдер
            </p>
          ) : (
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
              Холбогдоогүй байна — нөөцлөлт ажиллахгүй.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {status?.connected ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm((prev) => !prev)}
              >
                Дахин холбох
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={busy}
              >
                Салгах
              </Button>
            </>
          ) : (
            !showForm && (
              <Button type="button" size="sm" onClick={() => setShowForm(true)}>
                <Link2 className="h-4 w-4" />
                Холбох
              </Button>
            )
          )}
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

      {showForm && (
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
          <div className="rounded-lg bg-gray-50 p-4 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white">
              Нэг удаагийн бэлтгэл (~5 минут)
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                <a
                  href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-600 underline-offset-4 hover:underline dark:text-accent-400"
                >
                  Google Drive API
                </a>{" "}
                → <b>Enable</b>
              </li>
              <li>
                <a
                  href="https://console.cloud.google.com/auth/audience"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-600 underline-offset-4 hover:underline dark:text-accent-400"
                >
                  Google Auth Platform → Audience
                </a>{" "}
                → User type <b>External</b>. Дараа нь <b>Publish app</b> дарж
                төлөвийг <b>In production</b> болгоно.
                <span className="mt-1 block text-theme-xs">
                  ⚠ <b>Testing</b> төлөвт үлдээвэл зөвшөөрөл <b>7 хоногийн
                  дараа хүчингүй</b> болж нөөцлөлт зогсоно. Ашиглаж буй эрх
                  (<code>drive.file</code>) нь эмзэг бус тул баталгаажуулалт
                  шаардахгүй, шууд нийтэлж болно.
                </span>
              </li>
              <li>
                <a
                  href="https://console.cloud.google.com/auth/clients"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-600 underline-offset-4 hover:underline dark:text-accent-400"
                >
                  Clients
                </a>{" "}
                → Create client → Application type: <b>Web application</b>
              </li>
              <li>
                <b>Authorized redirect URIs</b> хэсэгт яг энэ хаягийг нэмнэ:
                <code className="mt-1 block overflow-x-auto rounded bg-white px-2 py-1.5 text-theme-xs dark:bg-black/30">
                  {status?.redirectUri}
                </code>
              </li>
              <li>Гарах Client ID / secret-ийг доор буулгана</li>
            </ol>
            <p className="mt-2">
              Фолдерыг апп өөрөө үүсгэнэ — Drive рүү орж юу ч хийх шаардлагагүй.
            </p>
            <p className="mt-2 text-theme-xs">
              Console-ийн цэс саяхан өөрчлөгдсөн: хуучин <b>APIs &amp; Services
              → OAuth consent screen</b> нь одоо <b>Google Auth Platform</b>{" "}
              доор <b>Branding / Audience / Clients</b> гэж хуваагдсан.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Client ID <span className="text-error-500">*</span>
              </Label>
              <Input
                placeholder="....apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div>
              <Label>
                Client secret <span className="text-error-500">*</span>
              </Label>
              <Input
                type="password"
                placeholder="GOCSPX-..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button
              type="button"
              size="sm"
              onClick={handleConnect}
              disabled={busy || !clientId.trim() || !clientSecret.trim()}
            >
              <Link2 className="h-4 w-4" />
              {busy ? "Шилжиж байна..." : "Google-ээр зөвшөөрөх"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
