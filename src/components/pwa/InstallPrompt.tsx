"use client";

import { useEffect, useState } from "react";
import { Plus, Share, Smartphone, SquarePlus, X } from "lucide-react";

import { Modal } from "@/components/ui/modal";

/** `beforeinstallprompt` — стандарт TS lib-д алга тул өөрсдөө тодорхойлно */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS = 14;

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari-ийн хуучин, стандарт бус талбар
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Апп суулгах санал — Android/desktop дээр жинхэнэ суулгах цонх, iOS дээр
 * (Safari `beforeinstallprompt`-ийг дэмждэггүй тул) "Share → Нүүр дэлгэц рүү
 * нэмэх" зааврыг харуулна.
 */
export default function InstallPrompt() {
  const [platform, setPlatform] = useState<"none" | "ios" | "prompt">("none");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() < dismissedUntil) return;

    if (isIos()) {
      // iOS Safari `beforeinstallprompt`-ийг дэмждэггүй тул энд шууд мэдэгдэнэ
      // — SSR-д window байхгүй тул рендерийн явцад тооцох боломжгүй.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlatform("ios");
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setPlatform("prompt");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
    );
    setPlatform("none");
  };

  const handleInstallClick = async () => {
    if (platform === "ios") {
      setShowIosSteps(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (platform === "none") return null;

  return (
    <>
      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Smartphone className="h-5 w-5" strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-theme-sm font-medium text-gray-900 dark:text-white">
            Аппыг утсандаа суулгах
          </p>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            Нүүр дэлгэц дээрээ нэмээд, апп шиг түргэн ашиглаарай.
          </p>
        </div>

        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          {platform === "ios" ? (
            <>
              <SquarePlus className="h-4 w-4" strokeWidth={1.8} />
              Заавар харах
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" strokeWidth={2} />
              Суулгах
            </>
          )}
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Хаах"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      <Modal
        isOpen={showIosSteps}
        onClose={() => setShowIosSteps(false)}
        className="max-w-sm p-6"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          iPhone дээр суулгах
        </h3>

        <ol className="mt-4 flex flex-col gap-3">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              1
            </span>
            <p className="text-theme-sm text-gray-700 dark:text-gray-300">
              Safari-ийн доод (эсвэл дээд) талын{" "}
              <Share className="mx-1 inline h-4 w-4 -translate-y-0.5" strokeWidth={1.8} />
              «Хуваалцах» товч дарна.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              2
            </span>
            <p className="text-theme-sm text-gray-700 dark:text-gray-300">
              Жагсаалтаас <strong>«Нүүр дэлгэц рүү нэмэх»</strong> (Add to Home
              Screen) сонголтыг олж дарна.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              3
            </span>
            <p className="text-theme-sm text-gray-700 dark:text-gray-300">
              Баруун дээд буланд <strong>«Нэмэх»</strong> дарна — апп таны нүүр
              дэлгэцэнд гарч ирнэ.
            </p>
          </li>
        </ol>

        <button
          type="button"
          onClick={() => {
            setShowIosSteps(false);
            dismiss();
          }}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Ойлголоо
        </button>
      </Modal>
    </>
  );
}
