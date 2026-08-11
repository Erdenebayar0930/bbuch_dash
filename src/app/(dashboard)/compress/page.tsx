import { Metadata } from "next";

import VideoCompressor from "@/components/media/VideoCompressor";

export const metadata: Metadata = {
  title: "Бичлэг шахах | ББУЧ",
  description: "Бичлэгийн хэмжээг төхөөрөмж дээрээ багасгах",
};

export default function CompressPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Бичлэг шахах
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Бичлэгийн хэмжээг багасгаж, буцаан татаж авна
        </p>
      </div>

      <VideoCompressor />
    </div>
  );
}