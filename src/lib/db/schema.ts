import {
  boolean,
  decimal,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Postgres-руу хөрвүүлсэн тэмдэглэл:
 *
 *  • UUID нь Postgres дээр НАТИВ төрөл — `uuid("id").primaryKey().defaultRandom()`
 *    ашиглана, апп талаас `crypto.randomUUID()` онооход хэрэгцээгүй болсон.
 *  • JSON багана нь `jsonb`-ээр НАТИВ дэмжигдэнэ — драйвер аяндаа
 *    задалж/сериалжуулдаг тул MariaDB-ийн мөрөөр буцаах асуудал байхгүй.
 *  • TIMESTAMP бүгд `{ withTimezone: true }`-тэй зарлагдана — Postgres
 *    "timestamptz" нь UTC-гээр хадгалж, session цагийн бүсээс үл хамааран
 *    зөв утга буцаадаг тул MySQL-д хэрэгтэй байсан драйвер/session талын
 *    цагийн бүс тохиргоо шаардлагагүй болсон.
 */

/** Firebase UID нь 28 тэмдэгт — 128 нь ирээдүйд ч хүрэлцэнэ */
const UID_LEN = 128;

/** UUID хэлбэрийн үндсэн түлхүүр — Postgres native UUID, DB талаас үүснэ */
const uuidPk = () => uuid("id").primaryKey().defaultRandom();

/** Бусад хүснэгт рүү заах UUID гадаад түлхүүр */
const uuidRef = (name: string) => uuid(name);

/** Firebase UID агуулах багана */
const uidCol = (name: string) => varchar(name, { length: UID_LEN });

/** Урт чөлөөт бичвэр — анхдагч нь хоосон мөр */
const bodyText = (name: string) =>
  text(name)
    .notNull()
    .$defaultFn(() => "");

/** JSON багана — Postgres jsonb, драйвер өөрөө задалж/сериалжуулна. */
const jsonCol = <T>(name: string) => jsonb(name).$type<T>();

/** UTC-гээр хадгалагдах, цагийн бүстэй timestamp */
const utcTimestamp = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Хэрэглэгч. `uid` нь Firebase Auth-ийн UID — аутентикац Firebase дээр
 * үлдсэн тул энэ багана нь гадаад системтэй холбогдох түлхүүр болно.
 */
export const users = pgTable(
  "users",
  {
    uid: uidCol("uid").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull().default(""),
    lastName: varchar("last_name", { length: 255 }).notNull().default(""),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    position: varchar("position", { length: 255 }).notNull().default(""),
    /** URL to profile photo stored in Firebase Storage */
    photoUrl: varchar("photo_url", { length: 1024 }).notNull().default(""),

    // --- Чуулган (зөвхөн админ оноодог) -------------------------------------
    /** Дуудлагууд — дээд тал нь 5. Хэрэглэгч өөрөө засахгүй, зөвхөн харна. */
    callings: jsonCol<string[]>("callings")
      .notNull()
      .$defaultFn(() => []),
    /**
     * Харьяалагдах аймгууд — нэг хүн олон аймагт байж болно.
     * Мэдэгдлийг аймгаар чиглүүлэхэд jsonb containment (`@>`) хайлт хийнэ.
     */
    aimags: jsonCol<string[]>("aimags")
      .notNull()
      .$defaultFn(() => []),
    /** YYYY-MM-DD, хоосон бол хүлээж аваагүй */
    holySpiritBaptismDate: varchar("holy_spirit_baptism_date", { length: 10 })
      .notNull()
      .default(""),
    waterBaptismDate: varchar("water_baptism_date", { length: 10 })
      .notNull()
      .default(""),

    // --- Хувийн ------------------------------------------------------------
    /** YYYY-MM-DD */
    birthDate: varchar("birth_date", { length: 10 }).notNull().default(""),
    /** male | female | "" */
    gender: varchar("gender", { length: 16 }).notNull().default(""),
    ethnicity: varchar("ethnicity", { length: 255 }).notNull().default(""),
    birthplace: varchar("birthplace", { length: 255 }).notNull().default(""),
    /** MBTI 16 төрлийн нэг (ISTJ гэх мэт) */
    mbti: varchar("mbti", { length: 8 }).notNull().default(""),
    /**
     * Хайрын хэл бүр оноотойгоо: { "words": 12, "touch": 5 } —
     * temperaments-тэй яг ижил хэлбэр, олон хэл зэрэг сонгож болно.
     */
    loveLanguages: jsonCol<Record<string, number>>("love_languages")
      .notNull()
      .$defaultFn(() => ({})),
    /**
     * Темперамент — олон төрөл зэрэг байж болох тул сонгосон төрөл бүрийг
     * оноотой нь хадгална: { "sanguine": 12, "choleric": 8 }.
     * Сонгоогүй төрөл огт байхгүй байна.
     */
    temperaments: jsonCol<Record<string, number>>("temperaments")
      .notNull()
      .$defaultFn(() => ({})),
    occupation: varchar("occupation", { length: 255 }).notNull().default(""),
    hasCar: boolean("has_car").notNull().default(false),
    /** Тээврийн хэрэгслийн улсын дугаар */
    carPlate: varchar("car_plate", { length: 32 }).notNull().default(""),

    // --- Гэр бүл -----------------------------------------------------------
    /** Эхнэр / нөхрийн нэр */
    spouseName: varchar("spouse_name", { length: 255 }).notNull().default(""),
    /** YYYY-MM-DD */
    spouseBirthDate: varchar("spouse_birth_date", { length: 10 })
      .notNull()
      .default(""),
    /**
     * Админ бус ч мэдэгдэл илгээх эрх авсан эсэх (зөвхөн админ оноодог).
     * Админ/супер бол энэ талбараас үл хамааран үргэлж илгээх боломжтой.
     */
    canNotify: boolean("can_notify").notNull().default(false),
    /** super | admin | user */
    role: varchar("role", { length: 32 }).notNull().default("user"),
    /** active | pending | blocked */
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_email_idx").on(table.email),
    // ТАЙЛБАР: Postgres дээр энд `aimags`-ийн GIN индекс байсан. MySQL-д JSON
    // массивыг индекслэхийн тулд multi-valued index (8.0.17+) хэрэгтэй бөгөөд
    // Drizzle-ээр илэрхийлэх боломжгүй. Хэрэглэгчийн тоо цөөн тул
    // jsonb containment-ийн бүтэн скан хүлээн зөвшөөрөгдөнө; олон мянган
    // хэрэглэгчтэй болвол generated column + индекс нэмнэ.
  ]
);

/** Орлого / зарлагын гүйлгээ */
export const transactions = pgTable(
  "transactions",
  {
    id: uuidPk(),
    /** YYYY-MM-DD */
    date: varchar("date", { length: 10 }).notNull(),
    description: bodyText("description"),
    category: varchar("category", { length: 128 }).notNull().default(""),
    /** income | expense */
    type: varchar("type", { length: 16 }).notNull(),
    /** approved | pending | rejected */
    status: varchar("status", { length: 32 }).notNull().default("approved"),
    /** Үргэлж эерэг — тэмдгийг type тодорхойлно */
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    /** Аль данснаас орсон. Хоосон бол данстай холбоогүй (гараар оруулсан) гүйлгээ. */
    account: varchar("account", { length: 64 }).notNull().default(""),
    /**
     * Харьцсан данс — хуулгад «харьцсан дансны дугаар» гэж ирдэг талбар.
     * Хандивлагчийг нэрээр нь биш ЭНЭ дугаараар таньдаг: нэр нь хуулга
     * болгонд өөр бичигдэж болох ч данс нь тогтмол.
     */
    donorAccount: varchar("donor_account", { length: 64 })
      .notNull()
      .default(""),
    /** Гүйлгээ бүртгэгдэх үеийн данс эзэмшигчийн нэр — хуулгаас уншсанаар. */
    donorName: varchar("donor_name", { length: 255 }).notNull().default(""),
    /**
     * Банкны хуулгаас уншсан мөрийг давхардуулахгүй барих түлхүүр.
     *
     * Гараар оруулсан гүйлгээнд NULL — MySQL нь Postgres-ийн адил unique
     * индекс дотор NULL-уудыг ялгаатай гэж үздэг тул тэднийг хөндөхгүй. Нэг
     * хуулгыг хоёр удаа уншуулбал ижил түлхүүр үүсэж, давхар мөр бичигдэхгүй.
     */
    importKey: varchar("import_key", { length: 255 }),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_account_idx").on(table.account),
    index("transactions_donor_account_idx").on(table.donorAccount),
    uniqueIndex("transactions_import_key_idx").on(table.importKey),
  ]
);

/**
 * «1/10» гэж таних загварууд.
 *
 * Хүн бүр өөрөөр бичдэг («1/10», «аравны нэг», «10 хувь»...) тул тогтмол
 * жагсаалт кодод хатуу бичих нь болохгүй — админ энд нэмж, хасаж чадна.
 * Загварт таарсан гүйлгээний утга «1/10», бусад нь «Өргөл» болно.
 */
export const tithePatterns = pgTable(
  "tithe_patterns",
  {
    id: uuidPk(),
    /** Хайх хэсэг — жижиг үсэг, зайгүй болгож харьцуулна */
    pattern: varchar("pattern", { length: 255 }).notNull(),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tithe_patterns_pattern_idx").on(table.pattern)]
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
    id: uuidPk(),
    uid: uidCol("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull().default(""),
    /** YYYY-MM-DD */
    birthDate: varchar("birth_date", { length: 10 }).notNull().default(""),
    /** male | female | "" */
    gender: varchar("gender", { length: 16 }).notNull().default(""),
    /** Маягт дээрх эрэмбэ */
    position: integer("position").notNull().default(0),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("children_uid_idx").on(table.uid, table.position)]
);

/**
 * Агуулах — эд хөрөнгө хадгалагдаж буй байршил.
 * Эхний утгууд seed-ээр орох ба админ нэмж болно.
 */
export const warehouses = pgTable("warehouses", {
  id: uuidPk(),
  name: varchar("name", { length: 255 }).notNull(),
  /** Жагсаалт дахь эрэмбэ */
  position: integer("position").notNull().default(0),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
});

/** Эд хөрөнгийн төрөл — админ чөлөөтэй нэмнэ */
export const assetCategories = pgTable("asset_categories", {
  id: uuidPk(),
  name: varchar("name", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
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
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Аймгийн түлхүүр, эсвэл "" — аймагт үл хамаарах */
    aimag: varchar("aimag", { length: 64 }).notNull().default(""),
    categoryId: uuidRef("category_id").references(() => assetCategories.id, {
      onDelete: "set null",
    }),
    warehouseId: uuidRef("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    /** Хэмжих нэгж — ш, ком, кг гэх мэт */
    unit: varchar("unit", { length: 32 }).notNull().default("ш"),
    /** Дугаар, сериал, инвентарын код */
    code: varchar("code", { length: 128 }).notNull().default(""),
    note: bodyText("note"),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    assetId: uuidRef("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 1024 }).notNull(),
    /** Storage доторх зам — устгахад ашиглана */
    path: varchar("path", { length: 1024 }).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
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
    id: uuidPk(),
    assetId: uuidRef("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** ok | damaged | short | missing */
    status: varchar("status", { length: 32 }).notNull(),
    /** Тоолж олдсон тоо — бүртгэлийнхтэй харьцуулна */
    foundQuantity: integer("found_quantity").notNull().default(0),
    note: bodyText("note"),
    checkedBy: uidCol("checked_by"),
    checkedAt: utcTimestamp("checked_at").notNull().defaultNow(),
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
  id: uuidPk(),
  startedBy: uidCol("started_by"),
  startedAt: utcTimestamp("started_at").notNull().defaultNow(),
  endedAt: utcTimestamp("ended_at"),
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
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Аймгийн түлхүүр, эсвэл "" — бусад төсөл */
    aimag: varchar("aimag", { length: 64 }).notNull().default(""),
    description: bodyText("description"),
    /** Жагсаалт дахь эрэмбэ */
    position: integer("position").notNull().default(0),
    /** Дууссан төслийг нуухад — мөрийг устгахгүй */
    archived: boolean("archived").notNull().default(false),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    projectId: uuidRef("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: bodyText("description"),
    /** todo | in_progress | done */
    status: varchar("status", { length: 32 }).notNull().default("todo"),
    /** low | normal | high */
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    /** Гүйцэтгэгч — хоосон бол хараахан хуваарилаагүй */
    assignedTo: uidCol("assigned_to").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** YYYY-MM-DD, эсвэл хоосон */
    dueDate: varchar("due_date", { length: 10 }).notNull().default(""),
    /** Багана доторх эрэмбэ */
    position: integer("position").notNull().default(0),
    /** Дууссан төлөв рүү шилжсэн хугацаа — буцаахад null болно */
    completedAt: utcTimestamp("completed_at"),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    /** Хүлээн авагч */
    uid: uidCol("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    body: bodyText("body"),
    /** Дарахад шилжих зам — хоосон бол шилжихгүй */
    url: varchar("url", { length: 1024 }).notNull().default(""),
    /** Илгээсэн админы uid */
    createdBy: uidCol("created_by"),
    /** Уншсан хугацаа — null бол уншаагүй */
    readAt: utcTimestamp("read_at"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_uid_created_idx").on(table.uid, table.createdAt),
  ]
);

/**
 * Тогтмол (давтагддаг) мэдэгдлийн тохиргоо — өдөр бүр/долоо хоног бүр/сар
 * бүр тодорхой цагт `notifications`-руу шинэ мөр үүсгэж, боломжтой бол push
 * илгээнэ. Бодит явуулалт `/api/cron/notifications`-аар гадны cron дуудахад
 * хийгдэнэ — энэ хүснэгт зөвхөн ТОХИРГОО, түүхийг хадгална.
 */
export const scheduledNotifications = pgTable(
  "scheduled_notifications",
  {
    id: uuidPk(),
    title: varchar("title", { length: 255 }).notNull(),
    body: bodyText("body"),
    url: varchar("url", { length: 1024 }).notNull().default(""),
    /** all | aimag | role — хэрэглэгч сонгож илгээх шаардлагагүй тул "user" алга */
    targetType: varchar("target_type", { length: 16 }).notNull().default("all"),
    /**
     * targetType нь aimag/role үед л ашиглагдана. aimag үед олон утгатай
     * байж болно (жишээ нь ["praise", "guard"]); role үед ганц утгатай массив.
     */
    targetValues: jsonCol<string[]>("target_values")
      .notNull()
      .$defaultFn(() => []),
    /** daily | weekly | monthly */
    frequency: varchar("frequency", { length: 16 }).notNull().default("daily"),
    /** HH:mm, Улаанбаатарын цагаар */
    timeOfDay: varchar("time_of_day", { length: 5 }).notNull().default("09:00"),
    /** weekly үед 0(Ням)-6(Бямба); бусад үед -1 */
    dayOfWeek: integer("day_of_week").notNull().default(-1),
    /** monthly үед 1-28; бусад үед -1 */
    dayOfMonth: integer("day_of_month").notNull().default(-1),
    active: boolean("active").notNull().default(true),
    /** Сүүлд илгээсэн YYYY-MM-DD — нэг өдөр хоёр удаа явахаас сэргийлнэ */
    lastSentDate: varchar("last_sent_date", { length: 10 }).notNull().default(""),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("scheduled_notifications_active_idx").on(table.active)]
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
    id: uuidPk(),
    /** watering | dulaankhaan */
    kind: varchar("kind", { length: 32 }).notNull().default("watering"),
    /** YYYY-MM-DD */
    date: varchar("date", { length: 10 }).notNull(),
    /** Хариуцагч; хэрэглэгч уствал ээлжийн бүртгэл үлдэнэ */
    assignedTo: uidCol("assigned_to").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** Талбай, модны бүлэг эсвэл гүйцэтгэх ажил — чөлөөт текст */
    area: bodyText("area"),
    note: bodyText("note"),
    /** null бол гүйцэтгээгүй */
    doneAt: utcTimestamp("done_at"),
    doneBy: uidCol("done_by"),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unit: varchar("unit", { length: 32 }).notNull().default("ш"),
    /** Төсөвлөсөн нэгж үнэ, ₮ — 0 бол тодорхойгүй */
    estimatedPrice: integer("estimated_price").notNull().default(0),
    /** low | normal | high — taskOptions-ийн ач холбогдолтой ижил */
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    /** requested | approved | bought | rejected */
    status: varchar("status", { length: 32 }).notNull().default("requested"),
    note: bodyText("note"),
    /** Хүсэлт гаргасан хүн */
    requestedBy: uidCol("requested_by").references(() => users.uid, {
      onDelete: "set null",
    }),
    /** Худалдаж авсан огноо — status = bought үед бөглөгдөнө */
    boughtAt: utcTimestamp("bought_at"),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_requests_status_idx").on(table.status, table.createdAt),
  ]
);

/**
 * Харуулын цэг — газрын зураг дээрх тэмдэглэгээ (Харуулын аймаг).
 *
 * Хандивын хайрцагтай яг ижил хэв маяг: байршил нь баазад, эргэлт/шалгалтын
 * түүх нь тусдаа хүснэгтэд.
 */
export const guardPoints = pgTable(
  "guard_points",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    address: bodyText("address"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    note: bodyText("note"),
    /** false бол түр идэвхгүй — зураг дээр бүдэг харагдана */
    active: boolean("active").notNull().default(true),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("guard_points_active_idx").on(table.active)]
);

/**
 * Харуулын цэгийн эргэлт/шалгалтын түүх.
 *
 * Мөр бүр нэг удаагийн эргэлт: хэдийд, хэн, ямар байдалтай тэмдэглэсэн.
 * Хуучин бүртгэл хэзээ ч дарагдахгүй — түүх бүрэн үлдэнэ.
 */
export const guardPointVisits = pgTable(
  "guard_point_visits",
  {
    id: uuidPk(),
    pointId: uuidRef("point_id")
      .notNull()
      .references(() => guardPoints.id, { onDelete: "cascade" }),
    /** ok | issue */
    status: varchar("status", { length: 32 }).notNull().default("ok"),
    note: bodyText("note"),
    visitedBy: uidCol("visited_by"),
    visitedAt: utcTimestamp("visited_at").notNull().defaultNow(),
  },
  (table) => [
    index("guard_point_visits_point_idx").on(table.pointId, table.visitedAt),
  ]
);

/**
 * Хандивын хайрцгийн байршил — газрын зураг дээрх тэмдэглэгээ.
 *
 * Хайрцаг нь хөдөлдөг, нэмэгддэг тул баазад хадгална — админ зургаас шууд
 * байршуулна.
 * Координатыг `double`-оор: decimal нь текст болж буцдаг тул Leaflet руу
 * дамжуулах бүрд хөрвүүлэлт шаардана.
 */
export const donationBoxes = pgTable(
  "donation_boxes",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Хаяг, чиглүүлэг — «2 давхарт, хурлын танхимын үүдэнд» гэх мэт */
    address: bodyText("address"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    note: bodyText("note"),
    /** Хайрцаг түр хураагдвал мөрийг устгалгүй нуух */
    active: boolean("active").notNull().default(true),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    boxId: uuidRef("box_id")
      .notNull()
      .references(() => donationBoxes.id, { onDelete: "cascade" }),
    /** collected | empty | issue */
    status: varchar("status", { length: 32 }).notNull().default("collected"),
    /** Хураасан дүн, ₮ — бүхэл тоо */
    amount: integer("amount").notNull().default(0),
    /**
     * Хураасан хувцасны тоо, ширхэг.
     *
     * Мөнгөнөөс тусдаа багана: нэг эргэлтээр мөнгө ба хувцас хоёуланг нь
     * хураасан байж болно, нийлбэрийг нь ч тусад нь гаргах шаардлагатай.
     */
    clothingCount: integer("clothing_count").notNull().default(0),
    note: bodyText("note"),
    visitedBy: uidCol("visited_by"),
    visitedAt: utcTimestamp("visited_at").notNull().defaultNow(),
  },
  (table) => [
    index("donation_box_visits_box_idx").on(table.boxId, table.visitedAt),
  ]
);

/**
 * Хандив/1-10-ыг хүлээн авах банкны данс — «1/10 ба өргөл» хуудсанд харагдана.
 */
export const donationAccounts = pgTable(
  "donation_accounts",
  {
    id: uuidPk(),
    /** Дансны зориулалт — «1/10 ба өргөл» гэх мэт */
    title: varchar("title", { length: 255 }).notNull(),
    /** IBAN хэлбэрийн дугаар. Гүйлгээ энэ утгаар холбогддог тул давхцахгүй */
    number: varchar("number", { length: 64 }).notNull(),
    /** `data/donationAccounts.ts` дахь банкны түлхүүр (khan | state) */
    bank: varchar("bank", { length: 32 }).notNull().default(""),
    holder: varchar("holder", { length: 255 }).notNull().default(""),
    /** Жагсаалтын дараалал — бага нь эхэндээ */
    position: integer("position").notNull().default(0),
    /**
     * «1/10 ба өргөл» хуудас аль дансыг харуулах вэ. Яг нэг данс тэмдэглэгдэнэ
     * — шинээр тэмдэглэхэд өмнөхийнх нь автоматаар арилна.
     */
    isTithe: boolean("is_tithe").notNull().default(false),
    /**
     * Энэ дансны гүйлгээг харж болох хэрэглэгчийн uid-ууд.
     *
     * Админ ба super нь жагсаалтад байхаас үл хамааран бүгдийг хардаг тул
     * тэднийг энд нэмэх шаардлагагүй.
     */
    allowedUids: jsonCol<string[]>("allowed_uids")
      .notNull()
      .$defaultFn(() => []),
    /**
     * Эрх олгогдсон аймгууд (`data/profileOptions.ts` дахь түлхүүр).
     *
     * Хүн тус бүрээр оноох нь олон гишүүнтэй үед ажил ихтэй — аймгаар нь
     * олгоод, шинэ гишүүн нэмэгдэхэд эрх нь өөрөө дагана.
     *
     * ⚠ `allowedUids` ба энэ ХОЁУЛАА хоосон бол данс нь БҮХ идэвхтэй
     * хэрэглэгчид нээлттэй — хязгаарлалт тавиагүй гэсэн үг. Хаалттай болгохыг
     * хүсвэл ядаж нэг хүн эсвэл аймаг сонгоно.
     */
    allowedAimags: jsonCol<string[]>("allowed_aimags")
      .notNull()
      .$defaultFn(() => []),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("donation_accounts_number_idx").on(table.number)]
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
    id: uuidPk(),
    /** Өрхийн тэргүүн эсвэл холбоо барих хүний нэр */
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    /** Гэр бүлийн гишүүдийн тоо */
    familySize: integer("family_size").notNull().default(0),
    /** Нөхцөл байдлын тайлбар */
    note: bodyText("note"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
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
    id: uuidPk(),
    householdId: uuidRef("household_id")
      .notNull()
      .references(() => welfareHouseholds.id, { onDelete: "cascade" }),
    /** Юу үзүүлсэн — хүнс, түлш, эмчилгээний зардал гэх мэт */
    description: varchar("description", { length: 512 }).notNull(),
    /** Зарцуулсан дүн, ₮ — 0 бол мөнгөн бус тусламж */
    amount: integer("amount").notNull().default(0),
    note: bodyText("note"),
    providedBy: uidCol("provided_by"),
    providedAt: utcTimestamp("provided_at").notNull().defaultNow(),
  },
  (table) => [
    index("welfare_aids_household_idx").on(table.householdId, table.providedAt),
  ]
);

/**
 * Гарын авлага — админ байршуулсан заавар/журмын файлууд.
 *
 * Файл нь Firebase Storage дээр; энд зөвхөн татах URL болон `filePath`
 * (Storage доторх зам, устгахад хэрэгтэй) хадгалагдана.
 */
export const handbookDocuments = pgTable(
  "handbook_documents",
  {
    id: uuidPk(),
    title: varchar("title", { length: 255 }).notNull(),
    description: bodyText("description"),
    fileUrl: varchar("file_url", { length: 1024 }).notNull(),
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull().default(""),
    /** Байт */
    fileSize: integer("file_size").notNull().default(0),
    /** Жагсаалтын дараалал — бага нь эхэндээ */
    position: integer("position").notNull().default(0),
    createdBy: uidCol("created_by"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("handbook_documents_position_idx").on(table.position)]
);

/**
 * FCM token — ТӨХӨӨРӨМЖ тутамд нэг мөр.
 *
 * ⚠ Урьд нь `uid` нь PRIMARY KEY байсан буюу хэрэглэгч тутамд ГАНЦ мөр.
 * Тэр үед сүүлд нэвтэрсэн төхөөрөмж өмнөхийнхөө token-ыг дардаг байв:
 * компьютер дээрээ дашбордоо нээхэд утсан дээрх PWA-гийн бүртгэл устаж,
 * мэдэгдэл чимээгүйхэн зогсдог. Илгээх тал (`/api/notifications/send`) нь
 * олон төхөөрөмжийг аль хэдийн зөв тооцдог байсан — зөвхөн хүснэгтийн
 * бүтэц нь хоцорсон.
 *
 * Түлхүүр нь token өөрөө: FCM token нь дэлхий даяар давтагдашгүй бөгөөд
 * төхөөрөмж+хөтөч+суулгацын хослолыг тодорхойлно. Ижил төхөөрөмж дээр өөр
 * хүн нэвтэрвэл ижил token өөр uid-тай ирэх тул мөрийн эзэн нь шинэчлэгдэнэ.
 *
 * Token нь ~160 тэмдэгт байдаг ч 512 хүртэл зай авав; utf8mb4 дээр 512×4 =
 * 2048 байт нь InnoDB-ийн 3072 байтын индексийн хязгаарт багтана.
 */
export const fcmTokens = pgTable(
  "fcm_tokens",
  {
    token: varchar("token", { length: 512 }).primaryKey(),
    uid: uidCol("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Мэдэгдэл илгээхэд `where uid in (…)` гэж хайдаг тул заавал индекстэй
    index("fcm_tokens_uid_idx").on(table.uid),
  ]
);

/**
 * Хэрэглэгчийн нэвтэрсэн төхөөрөмж.
 *
 * `deviceId` нь клиент талд localStorage-д тогтмол хадгалагдах танигч —
 * `requireActiveUser` хүсэлт бүрд шалгаж, идэвхгүй бол шууд гаргана
 * (`src/lib/api/auth.ts`). Ингэснээр `active`-ыг false болгомогц тухайн
 * төхөөрөмж дараагийн API хүсэлт дээрээ шууд гарна — Firebase сесс өөрөө
 * "нэвтэрсэн" хэвээр харагдаж байсан ч ажиллахаа болино.
 */
export const devices = pgTable(
  "devices",
  {
    id: uuidPk(),
    uid: uidCol("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    /** Клиент талын localStorage-д хадгалагдах санамсаргүй танигч */
    deviceId: varchar("device_id", { length: 64 }).notNull(),
    /** Хөтөч+системээс задалсан танигдах нэр — "Chrome · Windows" гэх мэт */
    label: varchar("label", { length: 255 }).notNull().default(""),
    userAgent: varchar("user_agent", { length: 512 }).notNull().default(""),
    active: boolean("active").notNull().default(true),
    lastSeenAt: utcTimestamp("last_seen_at").notNull().defaultNow(),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("devices_uid_device_idx").on(table.uid, table.deviceId),
    index("devices_uid_idx").on(table.uid),
  ]
);

export type DeviceRow = typeof devices.$inferSelect;

/** Бүртгэлийн лог — админ хянахад */
export const registrations = pgTable("registrations", {
  id: uuidPk(),
  uid: uidCol("uid").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull().default(""),
  lastName: varchar("last_name", { length: 255 }).notNull().default(""),
  phone: varchar("phone", { length: 32 }).notNull().default(""),
  role: varchar("role", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
});

/**
 * Системийн тохиргоо — нэг мөртэй хүснэгт (id = 'app').
 * `hasAdmin` нь анхны админ үүссэн эсэхийг тэмдэглэнэ.
 */
export const appConfig = pgTable("app_config", {
  id: varchar("id", { length: 32 }).primaryKey().default("app"),
  hasAdmin: boolean("has_admin").notNull().default(false),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
});

/**
 * Ажиллах үед өөрчлөгддөг тохиргоо — түлхүүр/утга.
 *
 * ЯАГААД БААЗАД, ENV-Д БИШ ВЭ: Google Drive-ийн холболтыг дэлгэцээс хийхэд
 * refresh token нь OAuth урсгалын ДУНД үүснэ. Тэр агшинд орчны хувьсагч
 * бичих боломжгүй (hPanel руу гараар оруулах шаардлагатай болно) — тиймээс
 * тохиргоог өөрийн санд хадгална.
 *
 * ⚠ Энд НУУЦ утга (refresh token) орно. Хоёр зүйлийг санах:
 *   • Баазад хандах эрхтэй хүн эдгээрийг уншина — DB нууц үг = Drive хандалт
 *   • `drive_refresh_token` нь НӨӨЦЛӨЛТӨД ОРОХГҮЙ (src/lib/backup/dump.ts) —
 *     эс бөгөөс архив гарт орсон хүн Drive рүү ч хандана
 */
export const settings = pgTable("settings", {
  /**
   * Баганын нэр `setting_key` — `key` нь MySQL/MariaDB-ийн НӨӨЦЛӨГДСӨН үг
   * бөгөөд зарим хэрэгсэл (drizzle-kit-ийн introspection орно) түүнтэй
   * хүндрэлтэй ажилладаг.
   */
  key: varchar("setting_key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
});

export type SettingRow = typeof settings.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type TithePatternRow = typeof tithePatterns.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ScheduledNotificationRow = typeof scheduledNotifications.$inferSelect;
export type ChildRow = typeof children.$inferSelect;
export type WarehouseRow = typeof warehouses.$inferSelect;
export type AssetCategoryRow = typeof assetCategories.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;

export type ProjectRow = typeof projects.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type ScheduleShiftRow = typeof scheduleShifts.$inferSelect;
export type PurchaseRequestRow = typeof purchaseRequests.$inferSelect;
export type DonationBoxRow = typeof donationBoxes.$inferSelect;
export type DonationBoxVisitRow = typeof donationBoxVisits.$inferSelect;
export type WelfareHouseholdRow = typeof welfareHouseholds.$inferSelect;
export type WelfareAidRow = typeof welfareAids.$inferSelect;
export type DonationAccountRow = typeof donationAccounts.$inferSelect;
export type HandbookDocumentRow = typeof handbookDocuments.$inferSelect;
export type GuardPointRow = typeof guardPoints.$inferSelect;
export type GuardPointVisitRow = typeof guardPointVisits.$inferSelect;
