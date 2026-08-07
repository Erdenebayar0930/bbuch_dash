import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Хэрэглэгч. `uid` нь Firebase Auth-ийн UID — аутентикац Firebase дээр
 * үлдсэн тул энэ багана нь гадаад системтэй холбогдох түлхүүр болно.
 */
export const users = pgTable(
  "users",
  {
    uid: text("uid").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    position: text("position").notNull().default(""),
    /** URL to profile photo stored in Firebase Storage */
    photoUrl: text("photo_url").notNull().default(""),

    // --- Чуулган (зөвхөн админ оноодог) -------------------------------------
    /** Дуудлагууд — дээд тал нь 5. Хэрэглэгч өөрөө засахгүй, зөвхөн харна. */
    callings: jsonb("callings").$type<string[]>().notNull().default([]),
    /**
     * Харьяалагдах аймгууд — нэг хүн олон аймагт байж болно.
     * Мэдэгдлийг аймгаар чиглүүлэхэд containment (@>) хайлт хийнэ.
     */
    aimags: jsonb("aimags").$type<string[]>().notNull().default([]),

    // --- Хувийн ------------------------------------------------------------
    /** MBTI 16 төрлийн нэг (ISTJ гэх мэт) */
    mbti: text("mbti").notNull().default(""),
    /** Хайрын 5 хэлний нэг */
    loveLanguage: text("love_language").notNull().default(""),
    /**
     * Темперамент — олон төрөл зэрэг байж болох тул сонгосон төрөл бүрийг
     * оноотой нь хадгална: { "sanguine": 12, "choleric": 8 }.
     * Сонгоогүй төрөл огт байхгүй байна.
     */
    temperaments: jsonb("temperaments")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    occupation: text("occupation").notNull().default(""),
    hasCar: boolean("has_car").notNull().default(false),
    /** Тээврийн хэрэгслийн улсын дугаар */
    carPlate: text("car_plate").notNull().default(""),

    // --- Гэр бүл -----------------------------------------------------------
    /** Эхнэр / нөхрийн нэр */
    spouseName: text("spouse_name").notNull().default(""),
    /** YYYY-MM-DD */
    spouseBirthDate: text("spouse_birth_date").notNull().default(""),
    /** super | admin | user */
    role: text("role").notNull().default("user"),
    /** active | pending | blocked */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_email_idx").on(table.email),
    // Аймгаар мэдэгдэл илгээхэд `aimags @> [...]` хайлт хийдэг.
    // Схемд бүртгэхгүй бол drizzle push дараагийн удаад устгана.
    index("users_aimags_idx").using("gin", table.aimags),
  ]
);

/** Орлого / зарлагын гүйлгээ */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    /** income | expense */
    type: text("type").notNull(),
    /** approved | pending | rejected */
    status: text("status").notNull().default("approved"),
    /** Үргэлж эерэг — тэмдгийг type тодорхойлно */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("transactions_date_idx").on(table.date)]
);

/**
 * Хүүхдийн бүртгэл — хэрэглэгч тутамд олон мөр.
 *
 * Профайл хадгалахад бүх мөрийг солих (replace) зарчмаар бичнэ, тиймээс
 * дараалал `position`-оор тогтоно.
 */
export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uid: text("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    /** YYYY-MM-DD */
    birthDate: text("birth_date").notNull().default(""),
    /** male | female | "" */
    gender: text("gender").notNull().default(""),
    /** Маягт дээрх эрэмбэ */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("children_uid_idx").on(table.uid, table.position)]
);

/**
 * Агуулах — эд хөрөнгө хадгалагдаж буй байршил.
 * Эхний утгууд seed-ээр орох ба админ нэмж болно.
 */
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Жагсаалт дахь эрэмбэ */
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Эд хөрөнгийн төрөл — админ чөлөөтэй нэмнэ */
export const assetCategories = pgTable("asset_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Эд хөрөнгийн нэгж бүртгэл.
 *
 * Агуулах эсвэл төрөл устсан ч бүртгэл алдагдах ёсгүй тул FK нь
 * `set null` — тухайн талбар хоосон болно, мөр үлдэнэ.
 *
 * `aimag` нь profileOptions.aimags доторх түлхүүр (guard, praise ...). Хоосон
 * бол аймагт хамааралгүй, чуулган нийтийн хөрөнгө. Агуулахтай давхцахгүй:
 * агуулах нь БАЙРШИЛ, аймаг нь ЭЗЭМШИГЧ нэгжийг заана — нэг агуулахад олон
 * аймгийн хөрөнгө байж болно.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Аймгийн түлхүүр, эсвэл "" — аймагт үл хамаарах */
    aimag: text("aimag").notNull().default(""),
    categoryId: uuid("category_id").references(() => assetCategories.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    /** Хэмжих нэгж — ш, ком, кг гэх мэт */
    unit: text("unit").notNull().default("ш"),
    /** Дугаар, сериал, инвентарын код */
    code: text("code").notNull().default(""),
    note: text("note").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assets_warehouse_idx").on(table.warehouseId),
    index("assets_category_idx").on(table.categoryId),
    index("assets_aimag_idx").on(table.aimag),
  ]
);

/**
 * Эд хөрөнгийн зураг — нэг хөрөнгөд олон зураг.
 *
 * Файл нь Firebase Storage дээр; энд зөвхөн татах URL болон `path` (Storage
 * доторх зам) хадгалагдана. `path` нь файлыг устгахад ЗААВАЛ хэрэгтэй —
 * URL-аас буцааж гаргах найдваргүй.
 */
export const assetImages = pgTable(
  "asset_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Storage доторх зам — устгахад ашиглана */
    path: text("path").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("asset_images_asset_idx").on(table.assetId, table.position)]
);

/**
 * Бүрэн бүтэн байдлын шалгалт — эд хөрөнгө тутамд олон бүртгэл.
 *
 * Мөр бүр нэг удаагийн тооллого: хэдийд, хэн, ямар төлөвтэй, хэдэн ширхэг
 * олдсоныг тэмдэглэнэ. Хуучин бүртгэл хэзээ ч дарагдахгүй — түүх бүрэн үлдэнэ.
 */
export const assetChecks = pgTable(
  "asset_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** ok | damaged | short | missing */
    status: text("status").notNull(),
    /** Тоолж олдсон тоо — бүртгэлийнхтэй харьцуулна */
    foundQuantity: integer("found_quantity").notNull().default(0),
    note: text("note").notNull().default(""),
    checkedBy: text("checked_by"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("asset_checks_asset_idx").on(table.assetId, table.checkedAt)]
);

/**
 * Тооллогын үе — "тооллого эхлүүлэх"-ээс "дуусгах" хүртэлх хугацаа.
 *
 * Тусдаа шалгалт бүрийг энэ мөр рүү холбохгүй: тооллогын явцад тоологдсон
 * эсэхийг `asset_checks.checked_at >= started_at` гэж тооцно. Ингэснээр хуучин
 * шалгалтын бүртгэл хөндөгдөхгүй, олон хүн зэрэг тоолоход ч нэг дүр зураг
 * харагдана. `ended_at` нь null бол тооллого идэвхтэй.
 */
export const assetCountSessions = pgTable("asset_count_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedBy: text("started_by"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/**
 * Төсөл — ажлын даалгаврыг бүлэглэх нэгж.
 *
 * `aimag` нь profileOptions.aimags доторх түлхүүр (guard, praise ...) бөгөөд
 * хоосон бол аймагт үл хамаарах "бусад" төсөл. Аймгийг ID-аар биш түлхүүрээр
 * хадгалж байгаа нь мэдэгдэл илгээх, хэрэглэгчийн харьяаллаар шүүхэд
 * users.aimags-тай шууд тааруулах боломж өгнө.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Аймгийн түлхүүр, эсвэл "" — бусад төсөл */
    aimag: text("aimag").notNull().default(""),
    description: text("description").notNull().default(""),
    /** Жагсаалт дахь эрэмбэ */
    position: integer("position").notNull().default(0),
    /** Дууссан төслийг нуухад — мөрийг устгахгүй */
    archived: boolean("archived").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_aimag_idx").on(table.aimag)]
);

/**
 * Ажлын даалгавар — канбан самбарын нэг карт.
 *
 * Гүйцэтгэгч (`assignedTo`) устсан ч даалгавар алдагдах ёсгүй тул FK нь
 * `set null`. Багана доторх дараалал `position`-оор тогтох ба өөр багана руу
 * зөөхөд сүүлд нь тавигдана.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** todo | in_progress | done */
    status: text("status").notNull().default("todo"),
    /** low | normal | high */
    priority: text("priority").notNull().default("normal"),
    /** Гүйцэтгэгч — хоосон бол хараахан хуваарилаагүй */
    assignedTo: text("assigned_to").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** YYYY-MM-DD, эсвэл хоосон */
    dueDate: text("due_date").notNull().default(""),
    /** Багана доторх эрэмбэ */
    position: integer("position").notNull().default(0),
    /** Дууссан төлөв рүү шилжсэн хугацаа — буцаахад null болно */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tasks_project_status_idx").on(
      table.projectId,
      table.status,
      table.position
    ),
    index("tasks_assigned_idx").on(table.assignedTo),
  ]
);

/**
 * Мэдэгдэл — хүлээн авагч тутамд НЭГ мөр (fan-out on write).
 *
 * Push нь зөвхөн мэдэгдүүлэг; жинхэнэ бүртгэл нь энэ хүснэгт. Тиймээс
 * хэрэглэгч апп нээгээгүй, зөвшөөрөл өгөөгүй байсан ч мэдэгдэл алдагдахгүй,
 * дараа нэвтрэхэд уншаагүй төлөвтэй хүлээж байна.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Хүлээн авагч */
    uid: text("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** Дарахад шилжих зам — хоосон бол шилжихгүй */
    url: text("url").notNull().default(""),
    /** Илгээсэн админы uid */
    createdBy: text("created_by"),
    /** Уншсан хугацаа — null бол уншаагүй */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_uid_created_idx").on(table.uid, table.createdAt),
  ]
);

/**
 * Ээлжийн хуваарь — "Мод услах" ба "Дулаанхаан" хоёулаа эндээс уншина.
 *
 * Хоёр хуваарь бүтцээрээ ижил (өдөр · хариуцагч · ажил · гүйцэтгэл) тул нэг
 * хүснэгтэд `kind`-аар ялгав: тусад нь хүснэгт барих нь ижил API, ижил UI-г
 * хоёр удаа гаргахаас өөр үр дүнгүй.
 *
 * `date` нь YYYY-MM-DD текст: timestamp биш учир нь ээлж бол ТОДОРХОЙ ӨДӨР,
 * агшин биш — цагийн бүс хөрвүүлэлт өдрийг нааш цааш зөөх ёсгүй.
 * `doneAt` нь null бол ээлж хараахан гүйцэтгэгдээгүй.
 */
export const scheduleShifts = pgTable(
  "schedule_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** watering | dulaankhaan */
    kind: text("kind").notNull().default("watering"),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** Хариуцагч; хэрэглэгч уствал ээлжийн бүртгэл үлдэнэ */
    assignedTo: text("assigned_to").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** Талбай, модны бүлэг эсвэл гүйцэтгэх ажил — чөлөөт текст */
    area: text("area").notNull().default(""),
    note: text("note").notNull().default(""),
    /** null бол гүйцэтгээгүй */
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: text("done_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Хуваарийг үргэлж төрөл + огноогоор шүүнэ — хамтарсан индекс хоёуланг барина
    index("schedule_shifts_date_idx").on(table.kind, table.date),
    index("schedule_shifts_assigned_idx").on(table.assignedTo),
  ]
);

/**
 * Худалдан авах жагсаалт — Хангамжийн аймаг.
 *
 * `status`: requested | approved | bought | rejected. Худалдаж авсныг мөрийг
 * устгахгүйгээр `bought` болгоно — түүх нь дараагийн төлөвлөлтөд хэрэгтэй.
 * Үнийг бүхэл төгрөгөөр хадгална (мөнгөн тэмдэгтийн жижиг нэгж байхгүй).
 */
export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit").notNull().default("ш"),
    /** Төсөвлөсөн нэгж үнэ, ₮ — 0 бол тодорхойгүй */
    estimatedPrice: integer("estimated_price").notNull().default(0),
    /** low | normal | high — taskOptions-ийн ач холбогдолтой ижил */
    priority: text("priority").notNull().default("normal"),
    /** requested | approved | bought | rejected */
    status: text("status").notNull().default("requested"),
    note: text("note").notNull().default(""),
    /** Хүсэлт гаргасан хүн */
    requestedBy: text("requested_by").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** Худалдаж авсан огноо — status = bought үед бөглөгдөнө */
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("purchase_requests_status_idx").on(table.status, table.createdAt),
  ]
);

/**
 * Хандивын хайрцгийн байршил — газрын зураг дээрх тэмдэглэгээ.
 *
 * Дансууд нь `data/donationAccounts.ts`-д тогтмолоор сууж байгаа ч хайрцаг нь
 * хөдөлдөг, нэмэгддэг тул баазад хадгална — админ зургаас шууд байршуулна.
 * Координатыг `double precision`-оор: numeric нь текст болж буцдаг тул
 * Leaflet руу дамжуулах бүрд хөрвүүлэлт шаардана.
 */
export const donationBoxes = pgTable(
  "donation_boxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Хаяг, чиглүүлэг — «2 давхарт, хурлын танхимын үүдэнд» гэх мэт */
    address: text("address").notNull().default(""),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    note: text("note").notNull().default(""),
    /** Хайрцаг түр хураагдвал мөрийг устгалгүй нуух */
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("donation_boxes_active_idx").on(table.active)]
);

/**
 * Хайрцгийн эргэлт — хайрцаг тутамд олон бүртгэл.
 *
 * Мөр бүр нэг удаагийн эргэлт: хэзээ, хэн очиж, хэдийг хурааж, ямар байдалтай
 * байсныг тэмдэглэнэ. Хуучин бүртгэл хэзээ ч дарагдахгүй — мөнгөний бүртгэл
 * тул түүх бүрэн үлдэх ёстой. Хайрцаг уствал эргэлтийн түүх нь ч дагаж
 * устана (`cascade`): эзэнгүй мөр үлдээх нь тайланг гуйвуулна.
 */
export const donationBoxVisits = pgTable(
  "donation_box_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boxId: uuid("box_id")
      .notNull()
      .references(() => donationBoxes.id, { onDelete: "cascade" }),
    /** collected | empty | issue */
    status: text("status").notNull().default("collected"),
    /** Хураасан дүн, ₮ — бүхэл тоо */
    amount: integer("amount").notNull().default(0),
    /**
     * Хураасан хувцасны тоо, ширхэг.
     *
     * Мөнгөнөөс тусдаа багана: нэг эргэлтээр мөнгө ба хувцас хоёуланг нь
     * хураасан байж болно, нийлбэрийг нь ч тусад нь гаргах шаардлагатай.
     */
    clothingCount: integer("clothing_count").notNull().default(0),
    note: text("note").notNull().default(""),
    visitedBy: text("visited_by"),
    visitedAt: timestamp("visited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("donation_box_visits_box_idx").on(table.boxId, table.visitedAt),
  ]
);

/**
 * Халамжийн үйлчлэлд хамрагдах өрх — газрын зураг дээрх байршил.
 *
 * Хандивын хайрцагтай ижил хэв маяг: байршил нь баазад, түүхэн бүртгэл нь
 * тусдаа хүснэгтэд. `active` нь өрх жагсаалтаас гарсан ч түүхийг устгалгүй
 * нуух боломж өгнө.
 */
export const welfareHouseholds = pgTable(
  "welfare_households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Өрхийн тэргүүн эсвэл холбоо барих хүний нэр */
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    /** Гэр бүлийн гишүүдийн тоо */
    familySize: integer("family_size").notNull().default(0),
    /** Нөхцөл байдлын тайлбар */
    note: text("note").notNull().default(""),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("welfare_households_active_idx").on(table.active)]
);

/**
 * Халамж үзүүлсэн бүртгэл — өрх тутамд олон мөр.
 *
 * Мөр бүр нэг удаагийн тусламж: хэзээ, хэн, юу үзүүлсэн, ямар дүнтэй.
 * Хуучин бүртгэл хэзээ ч дарагдахгүй — тайлан гаргахад түүх бүрэн байх ёстой.
 */
export const welfareAids = pgTable(
  "welfare_aids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => welfareHouseholds.id, { onDelete: "cascade" }),
    /** Юу үзүүлсэн — хүнс, түлш, эмчилгээний зардал гэх мэт */
    description: text("description").notNull(),
    /** Зарцуулсан дүн, ₮ — 0 бол мөнгөн бус тусламж */
    amount: integer("amount").notNull().default(0),
    note: text("note").notNull().default(""),
    providedBy: text("provided_by"),
    providedAt: timestamp("provided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("welfare_aids_household_idx").on(table.householdId, table.providedAt),
  ]
);

/** FCM token — хэрэглэгч тутамд нэг */
export const fcmTokens = pgTable("fcm_tokens", {
  uid: text("uid")
    .primaryKey()
    .references(() => users.uid, { onDelete: "cascade" }),
  token: text("token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Бүртгэлийн лог — админ хянахад */
export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  uid: text("uid").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Системийн тохиргоо — нэг мөртэй хүснэгт (id = 'app').
 * `hasAdmin` нь анхны админ үүссэн эсэхийг тэмдэглэнэ.
 */
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey().default("app"),
  hasAdmin: boolean("has_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ChildRow = typeof children.$inferSelect;
export type WarehouseRow = typeof warehouses.$inferSelect;
export type AssetCategoryRow = typeof assetCategories.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;

export type AssetImageRow = typeof assetImages.$inferSelect;
export type AssetCheckRow = typeof assetChecks.$inferSelect;
export type AssetCountSessionRow = typeof assetCountSessions.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type ScheduleShiftRow = typeof scheduleShifts.$inferSelect;
export type PurchaseRequestRow = typeof purchaseRequests.$inferSelect;
export type DonationBoxRow = typeof donationBoxes.$inferSelect;
export type DonationBoxVisitRow = typeof donationBoxVisits.$inferSelect;
export type WelfareHouseholdRow = typeof welfareHouseholds.$inferSelect;
export type WelfareAidRow = typeof welfareAids.$inferSelect;
