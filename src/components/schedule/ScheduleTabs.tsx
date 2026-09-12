"use client";

import { useState } from "react";

import { scheduleConfigs, scheduleKinds } from "@/data/scheduleOptions";

import ScheduleBoard from "./ScheduleBoard";

/**
 * "Хуваарь" хуудасны таб — Мод услах ба Дулаанхаан хоёр ижил бүтэцтэй
 * ScheduleBoard-ыг нэг цэсэн дор нэгтгэнэ.
 */
export default function ScheduleTabs() {
  const [active, setActive] = useState(scheduleKinds[0]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {scheduleKinds.map((kind) => {
          const isActive = kind === active;

          return (
            <button
              key={kind}
              type="button"
              onClick={() => setActive(kind)}
              className={`rounded-lg px-3.5 py-2 text-theme-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
              }`}
            >
              {scheduleConfigs[kind].label}
            </button>
          );
        })}
      </div>

      <ScheduleBoard kind={active} />
    </div>
  );
}
