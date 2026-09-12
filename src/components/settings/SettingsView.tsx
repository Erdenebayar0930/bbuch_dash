"use client";

import React, { useState } from "react";
import { Bell, Palette, Shield, User, type LucideIcon } from "lucide-react";

import AppearanceSettings from "./AppearanceSettings";
import NotificationSettings from "./NotificationSettings";
import ProfileSettings from "./ProfileSettings";
import SecuritySettings from "./SecuritySettings";

type TabKey = "profile" | "notifications" | "security" | "appearance";

type Tab = {
  key: TabKey;
  name: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { key: "profile", name: "Профайл", icon: User },
  { key: "notifications", name: "Мэдэгдэл", icon: Bell },
  { key: "security", name: "Аюулгүй байдал", icon: Shield },
  { key: "appearance", name: "Харагдац", icon: Palette },
];

export default function SettingsView({
  initialTab = "profile",
}: {
  initialTab?: TabKey;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      {/* Хэсгүүдийн жагсаалт */}
      <nav className="surface h-fit p-2">
        <ul className="flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;

            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-theme-sm font-medium transition-colors ${
                    isActive
                      ? "border-accent-600 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{tab.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Сонгосон хэсгийн агуулга */}
      <div className="surface p-5 sm:p-6">
        {active.key === "profile" ? (
          <ProfileSettings />
        ) : active.key === "notifications" ? (
          <NotificationSettings />
        ) : active.key === "security" ? (
          <SecuritySettings />
        ) : (
          <AppearanceSettings />
        )}
      </div>
    </div>
  );
}
