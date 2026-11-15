"use client";

/**
 * Текстийг санах ойд (clipboard) хуулна. Амжилттай бол true.
 *
 * Clipboard API нь HTTPS биш орчинд (локал сүлжээгээр утаснаас нээх г.м.)
 * ажиллахгүй тул хуучин `execCommand("copy")` аргаар дахин оролдоно.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}
