import { apiFetch } from "./apiClient";

/**
 * Нөөцлөлтийн клиент тал.
 *
 * ⚠ Нэрийн төстэй `src/lib/backup/` фолдер нь СЕРВЕР талынх (`server-only`) —
 * тэндээс клиент рүү юу ч импортлож болохгүй. Энэ файл нь зөвхөн HTTP дуудлага.
 */

export type BackupFile = {
  id: string;
  name: string;
  /** Байтаар */
  size: number;
  createdAt: string;
  /** Google Drive дээр нээх холбоос */
  link: string;
};

export type BackupSettings = {
  retentionDays: number;
  /** Cron ажиллуулах токен тохируулсан эсэх (утга нь хэзээ ч ирэхгүй) */
  tokenConfigured: boolean;
  /** Google Drive-ийн холболт бүрдсэн эсэх */
  driveConfigured: boolean;
  /** hPanel-ийн cron-д хуулж тавих бүтэн команд (токентой) */
  cronCommand: string | null;
  /** Хадгалах хугацаанд зөвшөөрөгдөх хязгаар */
  retentionRange: { min: number; max: number };
  lastBackupAt: string | null;
};

export type BackupList = {
  backups: BackupFile[];
  settings: BackupSettings;
};

export async function listBackups(): Promise<BackupList> {
  return apiFetch<BackupList>("/api/backup");
}

export type BackupRunResult = {
  name: string;
  link: string;
  size: number;
  tables: string[];
  rows: Record<string, number>;
  totalRows: number;
  durationMs: number;
  pruned: string[];
};

export async function runBackup(): Promise<BackupRunResult> {
  return apiFetch<BackupRunResult>("/api/backup", { method: "POST" });
}

/** Cron токен үүсгэнэ — хуучин нь тэр дороо хүчингүй болно */
export async function createCronToken(): Promise<string | null> {
  const data = await apiFetch<{ cronCommand: string | null }>("/api/backup", {
    method: "PUT",
  });
  return data.cronCommand;
}

export async function removeCronToken(): Promise<void> {
  await apiFetch("/api/backup", { method: "DELETE" });
}

/** Хадгалах хугацааг өөрчилнө — cron-оор ажиллах нөөцлөлтөд ч шууд үйлчилнэ */
export async function setRetentionDays(days: number): Promise<number> {
  const data = await apiFetch<{ retentionDays: number }>("/api/backup", {
    method: "PATCH",
    body: { retentionDays: days },
  });
  return data.retentionDays;
}

// --- Google Drive-ийн холболт ------------------------------------------------

export type DriveStatus = {
  connected: boolean;
  /** Нууц биш тул буцааж харуулж болно */
  clientId: string;
  folderName: string;
  account: string;
  /** Google Console-д бүртгүүлэх ёстой хаяг */
  redirectUri: string;
};

export async function driveStatus(): Promise<DriveStatus> {
  return apiFetch<DriveStatus>("/api/backup/drive");
}

/**
 * Client ID/secret хадгалаад зөвшөөрлийн холбоос авна.
 *
 * Шилжилтийг клиент өөрөө хийнэ — сервер 302 буцаавал `fetch` түүнийг
 * чимээгүй дагаж, хэрэглэгч Google дээр очих ёстойгоо мэдэхгүй үлдэнэ.
 */
export async function driveConnectUrl(input: {
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const data = await apiFetch<{ url: string }>("/api/backup/drive", {
    method: "POST",
    body: input,
  });
  return data.url;
}

export async function driveDisconnect(): Promise<void> {
  await apiFetch("/api/backup/drive", { method: "DELETE" });
}
