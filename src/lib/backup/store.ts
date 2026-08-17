import {
  deleteFile,
  downloadFile,
  driveConfig,
  listFiles,
  uploadFile,
  type DriveFile,
} from "./drive";

/**
 * Backup архивуудыг Google Drive дээр хадгална.
 *
 * ЯАГААД СЕРВЕРЭЭС ГАДНА ВЭ: сервер дээрээ хадгалсан хуулбар нь диск гэмтэх,
 * данс хаагдах, деплой буруу явах гэсэн ЯГ ТЭР тохиолдлуудад хамт алга болно.
 *
 * ЯАГААД DRIVE ВЭ: файлууд эзний Drive дотор энгийн файл болж суудаг тул
 * хөтчөөс шууд харах, татах, өөр газар хуулах боломжтой — гамшгийн үед аппаа
 * ажиллуулж чадахгүй байсан ч өгөгдөл гарт байна.
 *
 * ⚠ Хуулбар нь БҮХ хэрэглэгчийн бүх өгөгдлийг агуулна. Хадгалах фолдерыг
 * ХЭНТЭЙ Ч хуваалцахгүй байх ёстой.
 */

export type BackupFile = {
  /** Drive дээрх файлын ID — татах, устгахад хэрэглэнэ */
  id: string;
  name: string;
  /** Байтаар */
  size: number;
  createdAt: string;
  /** Drive дээр нээх холбоос */
  link: string;
};

const toBackup = (file: DriveFile): BackupFile => ({
  id: file.id,
  name: file.name,
  size: file.size,
  createdAt: file.createdTime,
  link: file.webViewLink,
});

/** Drive холбогдсон эсэх — дэлгэц болон /api/health-д хэрэгтэй */
export const isConfigured = async (): Promise<boolean> =>
  (await driveConfig()) !== null;

/**
 * Архивын нэр.
 *
 * Огноогоороо цагаан толгойн дараалалтай байхаар сонгосон — Drive-ийн
 * `orderBy: name desc` нь ингэснээр цагийн дараалал болно.
 */
export function backupName(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `bid-tuslay-${stamp}.ndjson.gz`;
}

export async function listBackups(): Promise<BackupFile[]> {
  return (await listFiles()).map(toBackup);
}

/** Түр файлыг Drive рүү байршуулна */
export async function uploadBackup(
  localPath: string,
  name: string
): Promise<BackupFile> {
  return toBackup(await uploadFile(localPath, name));
}

export async function deleteBackup(id: string): Promise<void> {
  await deleteFile(id);
}

export async function downloadBackup(id: string): Promise<Buffer> {
  return downloadFile(id);
}

/**
 * Хугацаа хэтэрсэн архивуудыг устгана.
 *
 * ХАМГААЛАЛТ: хэдэн ч хоног өнгөрсөн бай, хамгийн сүүлийн `keepLatest`
 * ширхгийг ХЭЗЭЭ Ч устгахгүй. Ингэснээр backup хэсэг хугацаанд ажиллахгүй
 * байгаад дараа нь цэвэрлэгээ ажиллахад "бүгд хуучирсан" гэж бүх хуулбар
 * алга болох тохиолдлоос сэргийлнэ.
 */
export async function pruneBackups(
  retentionDays: number,
  keepLatest = 3
): Promise<string[]> {
  const files = await listBackups();
  const cutoff = Date.now() - retentionDays * 86_400_000;

  const stale = files
    .slice(keepLatest)
    .filter((file) => new Date(file.createdAt).getTime() < cutoff);

  for (const file of stale) {
    await deleteBackup(file.id);
  }

  return stale.map((file) => file.name);
}
