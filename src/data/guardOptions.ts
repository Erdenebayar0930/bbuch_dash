/** Харуулын цэгийн эргэлтийн байдал */
export type GuardVisitStatus = "ok" | "issue";

export const guardVisitStatuses: GuardVisitStatus[] = ["ok", "issue"];

export const guardVisitStatusLabels: Record<GuardVisitStatus, string> = {
  ok: "Хэвийн",
  issue: "Асуудалтай",
};

export const isGuardVisitStatus = (value: unknown): value is GuardVisitStatus =>
  typeof value === "string" &&
  guardVisitStatuses.includes(value as GuardVisitStatus);

/** Харуулын цэг нь Харуулын аймгийн хариуцлага — API ба хуудас хоёул ашиглана */
export const GUARD_AIMAG = "guard";

/** Эргэлтийн тэмдэглэлийн дээд урт */
export const MAX_GUARD_VISIT_NOTE = 400;
