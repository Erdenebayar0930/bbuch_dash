import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { labelOf, aimags } from "@/data/profileOptions";
import { visitStatusLabels, type VisitStatus } from "@/data/donationBoxOptions";
import { scheduleConfigs, scheduleKinds } from "@/data/scheduleOptions";
import { purchaseStatusLabels, type PurchaseStatus } from "@/data/supplyOptions";
import {
  taskPriorityLabels,
  taskStatusLabels,
  type TaskPriority,
  type TaskStatus,
} from "@/data/taskOptions";
import { db } from "@/lib/db";
import {
  assetCategories,
  assets,
  donationBoxVisits,
  donationBoxes,
  projects,
  purchaseRequests,
  scheduleShifts,
  tasks,
  users,
  warehouses,
  welfareAids,
  welfareHouseholds,
} from "@/lib/db/schema";

import type { Sheet } from "./excel";

/** Мөнгөний баганад Excel дээр тавих формат */
const MONEY = "#,##0";

/** Хэрэглэгчийн харагдах нэр — хоосон бол зураас */
const nameOf = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ") || "—";

const yesNo = (value: boolean) => (value ? "Тийм" : "Үгүй");

/**
 * Татаж болох багц бүрийн тодорхойлолт.
 *
 * `adminOnly` нь хувийн мэдээлэл агуулсан багцад — хэрэглэгчийн жагсаалтыг
 * зөвхөн админ уншиж чаддагтай нийцүүлэв.
 */
export type Dataset = {
  /** Файлын нэрэнд орох латин түлхүүр */
  key: string;
  /** Татагдах файлын харагдах нэр */
  label: string;
  adminOnly: boolean;
  // Хуудас бүр өөр мөрийн төрөлтэй — гетероген массивт `any` зайлшгүй
  build: () => Promise<Sheet<any>[]>;
};

/** Халамжийн үйлчлэл — өрх ба үзүүлсэн тусламж */
const welfareDataset: Dataset = {
  key: "welfare",
  label: "Халамжийн үйлчлэл",
  adminOnly: false,
  build: async () => {
    const households = await db
      .select()
      .from(welfareHouseholds)
      .orderBy(asc(welfareHouseholds.createdAt));

    const aids = await db
      .select({
        householdName: welfareHouseholds.name,
        description: welfareAids.description,
        amount: welfareAids.amount,
        note: welfareAids.note,
        providedAt: welfareAids.providedAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(welfareAids)
      .innerJoin(
        welfareHouseholds,
        eq(welfareAids.householdId, welfareHouseholds.id)
      )
      .leftJoin(users, eq(welfareAids.providedBy, users.uid))
      .orderBy(desc(welfareAids.providedAt));

    return [
      {
        name: "Өрхүүд",
        rows: households,
        columns: [
          { header: "Нэр", value: (row) => row.name, width: 24 },
          { header: "Утас", value: (row) => row.phone || "—", width: 14 },
          { header: "Гэр бүлийн тоо", value: (row) => row.familySize },
          { header: "Тайлбар", value: (row) => row.note || "—", width: 40 },
          { header: "Өргөрөг", value: (row) => row.lat },
          { header: "Уртраг", value: (row) => row.lng },
          { header: "Идэвхтэй", value: (row) => yesNo(row.active) },
          { header: "Бүртгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
      {
        name: "Үзүүлсэн халамж",
        rows: aids,
        columns: [
          { header: "Өрх", value: (row) => row.householdName, width: 24 },
          { header: "Юу үзүүлсэн", value: (row) => row.description, width: 30 },
          {
            header: "Дүн, ₮",
            value: (row) => row.amount,
            numberFormat: MONEY,
            width: 14,
          },
          { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 30 },
          {
            header: "Үзүүлсэн",
            value: (row) => nameOf(row.firstName, row.lastName),
            width: 20,
          },
          { header: "Огноо", value: (row) => row.providedAt, width: 18 },
        ],
      },
    ];
  },
};

/** Хандивын хайрцаг — байршил ба эргэлт */
const donationBoxDataset: Dataset = {
  key: "donation-boxes",
  label: "Хандивын хайрцаг",
  adminOnly: false,
  build: async () => {
    const boxes = await db
      .select()
      .from(donationBoxes)
      .orderBy(asc(donationBoxes.createdAt));

    const visits = await db
      .select({
        boxName: donationBoxes.name,
        status: donationBoxVisits.status,
        amount: donationBoxVisits.amount,
        clothingCount: donationBoxVisits.clothingCount,
        note: donationBoxVisits.note,
        visitedAt: donationBoxVisits.visitedAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(donationBoxVisits)
      .innerJoin(donationBoxes, eq(donationBoxVisits.boxId, donationBoxes.id))
      .leftJoin(users, eq(donationBoxVisits.visitedBy, users.uid))
      .orderBy(desc(donationBoxVisits.visitedAt));

    return [
      {
        name: "Хайрцгууд",
        rows: boxes,
        columns: [
          { header: "Нэр", value: (row) => row.name, width: 24 },
          { header: "Хаяг", value: (row) => row.address || "—", width: 34 },
          { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 30 },
          { header: "Өргөрөг", value: (row) => row.lat },
          { header: "Уртраг", value: (row) => row.lng },
          { header: "Идэвхтэй", value: (row) => yesNo(row.active) },
          { header: "Бүртгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
      {
        name: "Эргэлт",
        rows: visits,
        columns: [
          { header: "Хайрцаг", value: (row) => row.boxName, width: 24 },
          {
            header: "Байдал",
            value: (row) =>
              visitStatusLabels[row.status as VisitStatus] ?? row.status,
            width: 16,
          },
          {
            header: "Мөнгө, ₮",
            value: (row) => row.amount,
            numberFormat: MONEY,
            width: 14,
          },
          { header: "Хувцас, ш", value: (row) => row.clothingCount },
          { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 30 },
          {
            header: "Эргэсэн",
            value: (row) => nameOf(row.firstName, row.lastName),
            width: 20,
          },
          { header: "Огноо", value: (row) => row.visitedAt, width: 18 },
        ],
      },
    ];
  },
};

/** Эд хөрөнгө */
const assetDataset: Dataset = {
  key: "assets",
  label: "Эд хөрөнгө",
  adminOnly: false,
  build: async () => {
    const rows = await db
      .select({
        name: assets.name,
        aimag: assets.aimag,
        categoryName: assetCategories.name,
        warehouseName: warehouses.name,
        quantity: assets.quantity,
        unit: assets.unit,
        code: assets.code,
        note: assets.note,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .leftJoin(warehouses, eq(assets.warehouseId, warehouses.id))
      .orderBy(desc(assets.createdAt));

    return [
      {
        name: "Эд хөрөнгө",
        rows,
        columns: [
          { header: "Нэр", value: (row) => row.name, width: 28 },
          {
            header: "Аймаг",
            value: (row) => (row.aimag ? labelOf(aimags, row.aimag) : "—"),
            width: 22,
          },
          { header: "Төрөл", value: (row) => row.categoryName ?? "—", width: 18 },
          {
            header: "Агуулах",
            value: (row) => row.warehouseName ?? "—",
            width: 18,
          },
          { header: "Тоо", value: (row) => row.quantity },
          { header: "Нэгж", value: (row) => row.unit || "—" },
          { header: "Код", value: (row) => row.code || "—", width: 16 },
          { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 30 },
          { header: "Бүртгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
    ];
  },
};

/** Худалдан авах жагсаалт */
const purchaseDataset: Dataset = {
  key: "purchases",
  label: "Худалдан авах жагсаалт",
  adminOnly: false,
  build: async () => {
    const rows = await db
      .select({
        name: purchaseRequests.name,
        quantity: purchaseRequests.quantity,
        unit: purchaseRequests.unit,
        estimatedPrice: purchaseRequests.estimatedPrice,
        priority: purchaseRequests.priority,
        status: purchaseRequests.status,
        note: purchaseRequests.note,
        boughtAt: purchaseRequests.boughtAt,
        createdAt: purchaseRequests.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(purchaseRequests.requestedBy, users.uid))
      .orderBy(desc(purchaseRequests.createdAt));

    return [
      {
        name: "Худалдан авалт",
        rows,
        columns: [
          { header: "Бараа", value: (row) => row.name, width: 28 },
          { header: "Тоо", value: (row) => row.quantity },
          { header: "Нэгж", value: (row) => row.unit || "—" },
          {
            header: "Нэгж үнэ, ₮",
            value: (row) => row.estimatedPrice,
            numberFormat: MONEY,
            width: 14,
          },
          {
            header: "Нийт, ₮",
            value: (row) => row.estimatedPrice * row.quantity,
            numberFormat: MONEY,
            width: 14,
          },
          {
            header: "Ач холбогдол",
            value: (row) =>
              taskPriorityLabels[row.priority as TaskPriority] ?? row.priority,
            width: 14,
          },
          {
            header: "Төлөв",
            value: (row) =>
              purchaseStatusLabels[row.status as PurchaseStatus] ?? row.status,
            width: 16,
          },
          {
            header: "Хүсэгч",
            value: (row) => nameOf(row.firstName, row.lastName),
            width: 20,
          },
          { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 30 },
          { header: "Авсан огноо", value: (row) => row.boughtAt, width: 18 },
          { header: "Үүсгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
    ];
  },
};

/** Ажлын даалгавар — төсөл ба даалгавар */
const taskDataset: Dataset = {
  key: "tasks",
  label: "Ажлууд",
  adminOnly: false,
  build: async () => {
    const projectRows = await db
      .select()
      .from(projects)
      .orderBy(asc(projects.createdAt));

    const taskRows = await db
      .select({
        projectName: projects.name,
        projectAimag: projects.aimag,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedTo, users.uid))
      .orderBy(desc(tasks.createdAt));

    return [
      {
        name: "Төслүүд",
        rows: projectRows,
        columns: [
          { header: "Нэр", value: (row) => row.name, width: 26 },
          {
            header: "Аймаг",
            value: (row) => (row.aimag ? labelOf(aimags, row.aimag) : "—"),
            width: 22,
          },
          {
            header: "Тайлбар",
            value: (row) => row.description || "—",
            width: 36,
          },
          { header: "Архивласан", value: (row) => yesNo(row.archived) },
          { header: "Үүсгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
      {
        name: "Даалгаврууд",
        rows: taskRows,
        columns: [
          { header: "Төсөл", value: (row) => row.projectName, width: 24 },
          {
            header: "Аймаг",
            value: (row) =>
              row.projectAimag ? labelOf(aimags, row.projectAimag) : "—",
            width: 22,
          },
          { header: "Даалгавар", value: (row) => row.title, width: 32 },
          {
            header: "Төлөв",
            value: (row) =>
              taskStatusLabels[row.status as TaskStatus] ?? row.status,
            width: 16,
          },
          {
            header: "Ач холбогдол",
            value: (row) =>
              taskPriorityLabels[row.priority as TaskPriority] ?? row.priority,
            width: 14,
          },
          {
            header: "Гүйцэтгэгч",
            value: (row) => nameOf(row.firstName, row.lastName),
            width: 20,
          },
          { header: "Дуусах огноо", value: (row) => row.dueDate || "—", width: 14 },
          { header: "Дууссан", value: (row) => row.completedAt, width: 18 },
          {
            header: "Тайлбар",
            value: (row) => row.description || "—",
            width: 36,
          },
          { header: "Үүсгэсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
    ];
  },
};

/**
 * Ээлжийн хуваарь — төрөл бүрт нэг багц.
 *
 * Мод услах, Дулаанхаан хоёр нэг хүснэгтэд сууж байгаа тул тодорхойлолтыг
 * scheduleConfigs-аас гаргаж авна: шинэ хуваарь нэмэхэд энд юу ч засахгүй.
 */
const scheduleDatasets: Dataset[] = scheduleKinds.map((kind) => {
  const config = scheduleConfigs[kind];

  return {
    key: `schedule-${kind}`,
    label: `${config.label} — хуваарь`,
    adminOnly: false,
    build: async () => {
      const rows = await db
        .select({
          date: scheduleShifts.date,
          area: scheduleShifts.area,
          note: scheduleShifts.note,
          doneAt: scheduleShifts.doneAt,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(scheduleShifts)
        .leftJoin(users, eq(scheduleShifts.assignedTo, users.uid))
        .where(eq(scheduleShifts.kind, kind))
        .orderBy(asc(scheduleShifts.date));

      return [
        {
          name: config.label,
          rows,
          columns: [
            { header: "Огноо", value: (row) => row.date, width: 14 },
            {
              header: "Хариуцагч",
              value: (row) => nameOf(row.firstName, row.lastName),
              width: 20,
            },
            {
              header: config.areaLabel,
              value: (row) => row.area || "—",
              width: 24,
            },
            { header: "Тэмдэглэл", value: (row) => row.note || "—", width: 36 },
            {
              header: "Төлөв",
              value: (row) =>
                row.doneAt ? config.doneLabel : "Хүлээгдэж буй",
              width: 16,
            },
            { header: "Гүйцэтгэсэн огноо", value: (row) => row.doneAt, width: 18 },
          ],
        },
      ];
    },
  };
});

/** Хэрэглэгчид — хувийн мэдээлэл тул зөвхөн админ */
const userDataset: Dataset = {
  key: "users",
  label: "Хэрэглэгчид",
  adminOnly: true,
  build: async () => {
    const rows = await db.select().from(users).orderBy(asc(users.createdAt));

    return [
      {
        name: "Хэрэглэгчид",
        rows,
        columns: [
          {
            header: "Нэр",
            value: (row) => nameOf(row.firstName, row.lastName),
            width: 24,
          },
          { header: "И-мэйл", value: (row) => row.email, width: 28 },
          { header: "Утас", value: (row) => row.phone || "—", width: 14 },
          { header: "Албан тушаал", value: (row) => row.position || "—", width: 20 },
          {
            header: "Аймаг",
            value: (row) =>
              row.aimags
                .map((item: string) => labelOf(aimags, item))
                .join(", ") || "—",
            width: 30,
          },
          {
            header: "Дуудлага",
            value: (row) => row.callings.join(", ") || "—",
            width: 30,
          },
          { header: "Эрх", value: (row) => row.role, width: 12 },
          { header: "Төлөв", value: (row) => row.status, width: 12 },
          { header: "Бүртгүүлсэн", value: (row) => row.createdAt, width: 18 },
        ],
      },
    ];
  },
};

/** Татаж болох бүх багц — түлхүүрээр нь хайна */
export const datasets: Dataset[] = [
  welfareDataset,
  donationBoxDataset,
  assetDataset,
  purchaseDataset,
  taskDataset,
  ...scheduleDatasets,
  userDataset,
];

export const findDataset = (key: string) =>
  datasets.find((dataset) => dataset.key === key) ?? null;