import {
  boolean,
  customType,
  decimal,
  double,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * MySQL-ийн ялгаатай тал (Postgres-ээс хөрвүүлэхэд анхаарах зүйлс):
 *
 *  • UUID төрөл байхгүй — `varchar(36)` дээр апп талаас утга онооно.
 *    `crypto.randomUUID()` нь Node 20 ба браузарт глобалаар бэлэн тул
 *    `node:crypto` импортлохгүй (импортловол клиент бандлыг эвдэнэ).
 *  • TEXT багана индекслэхийн тулд урьдчилсан урт шаарддаг тул индекс,
 *    unique, foreign key-д оролцох бүх багана `varchar(n)` байна.
 *  • TEXT / JSON баганад DB талын DEFAULT тавих боломжгүй (MySQL 8.0.13-аас
 *    өмнө огт, дараа нь ч хязгаартай) — тиймээс `$defaultFn`-ээр апп талаас
 *    анхдагч утгыг өгнө. Бүх бичилт Drizzle-ээр явдаг тул энэ хангалттай.
 *  • TIMESTAMP нь дотооддоо UTC-гээр хадгалагдана. Холболтын цагийн бүсийг
 *    `src/lib/db/index.ts`-д `timezone: "Z"` гэж тогтоосон — эс бөгөөс серверийн
 *    локал бүсээр хөрвүүлж, огноо нааш цааш зөрнө.
 *  • JSON баганыг `jsonCol` дамжуулан үүсгэнэ — MariaDB дээр JSON нь
 *    LONGTEXT тул драйвер мөрөөр буцаадаг (доорх тайлбарыг үзнэ үү).
 *
 * Шаардлага: MySQL 8.0+ эсвэл MariaDB 10.2+ — зарим асуулга цонхны функц
 * (`row_number() over`) болон `JSON_CONTAINS` ашигладаг.
 */

/** Firebase UID нь 28 тэмдэгт — 128 нь ирээдүйд ч хүрэлцэнэ */
const UID_LEN = 128;

/** UUID хэлбэрийн үндсэн түлхүүр — MySQL-д төрөл нь байхгүй тул varchar(36) */
const uuidPk = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Бусад хүснэгт рүү заах UUID гадаад түлхүүр */
const uuidRef = (name: string) => varchar(name, { length: 36 });

/** Firebase UID агуулах багана */
const uidCol = (name: string) => varchar(name, { length: UID_LEN });

/** Урт чөлөөт бичвэр — анхдагч нь хоосон мөр (DB default тавих боломжгүй) */
const bodyText = (name: string) =>
  text(name)
    .notNull()
    .$defaultFn(() => "");

/**
 * JSON багана — MySQL болон MariaDB хоёуланд ажиллана.
 *
 * MySQL 8-д JSON нь бие даасан төрөл тул драйвер өөрөө задалж объект өгдөг.
 * MariaDB-д JSON нь LONGTEXT-ийн ӨӨР НЭР бөгөөд драйвер МӨРӨӨР буцаадаг —
 * тэр үед `row.aimags` нь массив биш мөр болж, `Array.isArray` шалгалтууд
 * чимээгүйхэн хоосон үр дүн өгнө. Тиймээс мөр ирвэл өөрсдөө задална.
 */
const jsonCol = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "json",
    toDriver: (value: T) => JSON.stringify(value),
    fromDriver: (value: unknown) =>
      typeof value === "string" ? (JSON.parse(value) as T) : (value as T),
  })(name);

/**
 * Хэрэглэгч. `uid` нь Firebase Auth-ийн UID — аутентикац Firebase дээр
 * үлдсэн тул энэ багана нь гадаад системтэй холбогдох түлхүүр болно.
 */
export const users = mysqlTable(
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
     * Мэдэгдлийг аймгаар чиглүүлэхэд `JSON_CONTAINS` хайлт хийнэ.
     */
    aimags: jsonCol<string[]>("aimags")
      .notNull()
      .$defaultFn(() => []),

    // --- Хувийн ------------------------------------------------------------
    /** MBTI 16 төрлийн нэг (ISTJ гэх мэт) */
    mbti: varchar("mbti", { length: 8 }).notNull().default(""),
    /** Хайрын 5 хэлний нэг */
    loveLanguage: varchar("love_language", { length: 64 }).notNull().default(""),
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
    /** super | admin | user */
    role: varchar("role", { length: 32 }).notNull().default("user"),
    /** active | pending | blocked */
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_email_idx").on(table.email),
    // ТАЙЛБАР: Postgres дээр энд `aimags`-ийн GIN индекс байсан. MySQL-д JSON
    // массивыг индекслэхийн тулд multi-valued index (8.0.17+) хэрэгтэй бөгөөд
    // Drizzle-ээр илэрхийлэх боломжгүй. Хэрэглэгчийн тоо цөөн тул
    // `JSON_CONTAINS`-ийн бүтэн скан хүлээн зөвшөөрөгдөнө; олон мянган
    // хэрэглэгчтэй болвол generated column + индекс нэмнэ.
  ]
);

/** Орлого / зарлагын гүйлгээ */
export const transactions = mysqlTable(
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
    /**
     * Аль данснаас орсон — `data/donationAccounts.ts` дахь дансны дугаар.
     * Хоосон бол данстай холбоогүй (гараар оруулсан) гүйлгээ.
     */
    account: varchar("account", { length: 64 }).notNull().default(""),
    /**
     * Харьцсан данс — хуулгад «харьцсан дансны дугаар» гэж ирдэг талбар.
     * Хандивлагчийг нэрээр нь биш ЭНЭ дугаараар таньдаг: нэр нь хуулга
     * болгонд өөр бичигдэж болох ч данс нь тогтмол.
     */
    donorAccount: varchar("donor_account", { length: 64 })
      .notNull()
      .default(""),
    /**
     * Гүйлгээ бүртгэгдэх үеийн данс эзэмшигчийн нэр. `donors` бүртгэлээс
     * хойш нэрийг нь засвал энэ мөрийнх хэвээр үлдэнэ — тайланд юу гарсныг
     * дараа нь сэргээж чадна.
     */
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_account_idx").on(table.account),
    index("transactions_donor_account_idx").on(table.donorAccount),
    uniqueIndex("transactions_import_key_idx").on(table.importKey),
  ]
);

/**
 * Данс эзэмшигчийн нэрийн бүртгэл.
 *
 * Хуулга уншуулахад харьцсан данс бүрийн нэрийг энд хуримтлуулна. Дараагийн
 * хуулгад ижил данс тааралдвал нэр нь ШУУД гарч ирнэ — банк заримдаа нэрийг
 * товчлох, орхих зэргээр өөрөөр өгдөг тул нэг удаа зассан нэр цаашид хэвээр
 * хэрэглэгдэнэ.
 */
export const donors = mysqlTable(
  "donors",
  {
    id: uuidPk(),
    /** Харьцсан дансны дугаар — таних цорын ганц түлхүүр */
    accountNumber: varchar("account_number", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    note: bodyText("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("donors_account_number_idx").on(table.accountNumber)]
);

/**
 * «1/10» гэж таних загварууд.
 *
 * Хүн бүр өөрөөр бичдэг («1/10», «аравны нэг», «10 хувь»...) тул тогтмол
 * жагсаалт кодод хатуу бичих нь болохгүй — админ энд нэмж, хасаж чадна.
 * Загварт таарсан гүйлгээний утга «1/10», бусад нь «Өргөл» болно.
 */
export const tithePatterns = mysqlTable(
  "tithe_patterns",
  {
    id: uuidPk(),
    /** Хайх хэсэг — жижиг үсэг, зайгүй болгож харьцуулна */
    pattern: varchar("pattern", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tithe_patterns_pattern_idx").on(table.pattern)]
);

/**
 * Хүүхдийн бүртгэл — хэрэглэгч тутамд олон мөр.
 *
 * Профайл хадгалахад бүх мөрийг солих (replace) зарчмаар бичнэ, тиймээс
 * дараалал `position`-оор тогтоно.
 */
export const children = mysqlTable(
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
    position: int("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("children_uid_idx").on(table.uid, table.position)]
);

/**
 * Агуулах — эд хөрөнгө хадгалагдаж буй байршил.
 * Эхний утгууд seed-ээр орох ба админ нэмж болно.
 */
export const warehouses = mysqlTable("warehouses", {
  id: uuidPk(),
  name: varchar("name", { length: 255 }).notNull(),
  /** Жагсаалт дахь эрэмбэ */
  position: int("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Эд хөрөнгийн төрөл — админ чөлөөтэй нэмнэ */
export const assetCategories = mysqlTable("asset_categories", {
  id: uuidPk(),
  name: varchar("name", { length: 255 }).notNull(),
  position: int("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const assets = mysqlTable(
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
    quantity: int("quantity").notNull().default(1),
    /** Хэмжих нэгж — ш, ком, кг гэх мэт */
    unit: varchar("unit", { length: 32 }).notNull().default("ш"),
    /** Дугаар, сериал, инвентарын код */
    code: varchar("code", { length: 128 }).notNull().default(""),
    note: bodyText("note"),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const assetImages = mysqlTable(
  "asset_images",
  {
    id: uuidPk(),
    assetId: uuidRef("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 1024 }).notNull(),
    /** Storage доторх зам — устгахад ашиглана */
    path: varchar("path", { length: 1024 }).notNull(),
    position: int("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("asset_images_asset_idx").on(table.assetId, table.position)]
);

/**
 * Бүрэн бүтэн байдлын шалгалт — эд хөрөнгө тутамд олон бүртгэл.
 *
 * Мөр бүр нэг удаагийн тооллого: хэдийд, хэн, ямар төлөвтэй, хэдэн ширхэг
 * олдсоныг тэмдэглэнэ. Хуучин бүртгэл хэзээ ч дарагдахгүй — түүх бүрэн үлдэнэ.
 */
export const assetChecks = mysqlTable(
  "asset_checks",
  {
    id: uuidPk(),
    assetId: uuidRef("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** ok | damaged | short | missing */
    status: varchar("status", { length: 32 }).notNull(),
    /** Тоолж олдсон тоо — бүртгэлийнхтэй харьцуулна */
    foundQuantity: int("found_quantity").notNull().default(0),
    note: bodyText("note"),
    checkedBy: uidCol("checked_by"),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
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
export const assetCountSessions = mysqlTable("asset_count_sessions", {
  id: uuidPk(),
  startedBy: uidCol("started_by"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

/**
 * Төсөл — ажлын даалгаврыг бүлэглэх нэгж.
 *
 * `aimag` нь profileOptions.aimags доторх түлхүүр (guard, praise ...) бөгөөд
 * хоосон бол аймагт үл хамаарах "бусад" төсөл. Аймгийг ID-аар биш түлхүүрээр
 * хадгалж байгаа нь мэдэгдэл илгээх, хэрэглэгчийн харьяаллаар шүүхэд
 * users.aimags-тай шууд тааруулах боломж өгнө.
 */
export const projects = mysqlTable(
  "projects",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Аймгийн түлхүүр, эсвэл "" — бусад төсөл */
    aimag: varchar("aimag", { length: 64 }).notNull().default(""),
    description: bodyText("description"),
    /** Жагсаалт дахь эрэмбэ */
    position: int("position").notNull().default(0),
    /** Дууссан төслийг нуухад — мөрийг устгахгүй */
    archived: boolean("archived").notNull().default(false),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const tasks = mysqlTable(
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
    position: int("position").notNull().default(0),
    /** Дууссан төлөв рүү шилжсэн хугацаа — буцаахад null болно */
    completedAt: timestamp("completed_at"),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const notifications = mysqlTable(
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
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const scheduleShifts = mysqlTable(
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
    doneAt: timestamp("done_at"),
    doneBy: uidCol("done_by"),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const purchaseRequests = mysqlTable(
  "purchase_requests",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unit: varchar("unit", { length: 32 }).notNull().default("ш"),
    /** Төсөвлөсөн нэгж үнэ, ₮ — 0 бол тодорхойгүй */
    estimatedPrice: int("estimated_price").notNull().default(0),
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
    boughtAt: timestamp("bought_at"),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_requests_status_idx").on(table.status, table.createdAt),
  ]
);

/**
 * Хандивын дансууд.
 *
 * Дугаар, эзэмшигч өөрчлөгддөг, шинэ данс нэмэгддэг тул кодод биш баазад
 * сууна — админ өөрөө удирдана.
 *
 * ХОЁР ТҮВШИНГИЙН ХАРАГДАЦ:
 *  • Дансны КАРТ (нэр, дугаар, банк) нь бүх хүнд харагдана — хандив өгөхийн
 *    тулд дугаар нь хэрэгтэй.
 *  • Дансны ГҮЙЛГЭЭ нь анхдагчаар мөн нээлттэй; `allowedUids` эсвэл
 *    `allowedAimags`-д утга оруулмагц зөвхөн тэдгээрт (ба админд) харагдана.
 */
export const donationAccounts = mysqlTable(
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
    position: int("position").notNull().default(0),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("donation_accounts_number_idx").on(table.number)]
);

/**
 * Хандивын хайрцгийн байршил — газрын зураг дээрх тэмдэглэгээ.
 *
 * Хайрцаг нь хөдөлдөг, нэмэгддэг тул баазад хадгална — админ зургаас шууд
 * байршуулна.
 * Координатыг `double`-оор: decimal нь текст болж буцдаг тул Leaflet руу
 * дамжуулах бүрд хөрвүүлэлт шаардана.
 */
export const donationBoxes = mysqlTable(
  "donation_boxes",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Хаяг, чиглүүлэг — «2 давхарт, хурлын танхимын үүдэнд» гэх мэт */
    address: bodyText("address"),
    lat: double("lat").notNull(),
    lng: double("lng").notNull(),
    note: bodyText("note"),
    /** Хайрцаг түр хураагдвал мөрийг устгалгүй нуух */
    active: boolean("active").notNull().default(true),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const donationBoxVisits = mysqlTable(
  "donation_box_visits",
  {
    id: uuidPk(),
    boxId: uuidRef("box_id")
      .notNull()
      .references(() => donationBoxes.id, { onDelete: "cascade" }),
    /** collected | empty | issue */
    status: varchar("status", { length: 32 }).notNull().default("collected"),
    /** Хураасан дүн, ₮ — бүхэл тоо */
    amount: int("amount").notNull().default(0),
    /**
     * Хураасан хувцасны тоо, ширхэг.
     *
     * Мөнгөнөөс тусдаа багана: нэг эргэлтээр мөнгө ба хувцас хоёуланг нь
     * хураасан байж болно, нийлбэрийг нь ч тусад нь гаргах шаардлагатай.
     */
    clothingCount: int("clothing_count").notNull().default(0),
    note: bodyText("note"),
    visitedBy: uidCol("visited_by"),
    visitedAt: timestamp("visited_at").notNull().defaultNow(),
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
export const welfareHouseholds = mysqlTable(
  "welfare_households",
  {
    id: uuidPk(),
    /** Өрхийн тэргүүн эсвэл холбоо барих хүний нэр */
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    /** Гэр бүлийн гишүүдийн тоо */
    familySize: int("family_size").notNull().default(0),
    /** Нөхцөл байдлын тайлбар */
    note: bodyText("note"),
    lat: double("lat").notNull(),
    lng: double("lng").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: uidCol("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("welfare_households_active_idx").on(table.active)]
);

/**
 * Халамж үзүүлсэн бүртгэл — өрх тутамд олон мөр.
 *
 * Мөр бүр нэг удаагийн тусламж: хэзээ, хэн, юу үзүүлсэн, ямар дүнтэй.
 * Хуучин бүртгэл хэзээ ч дарагдахгүй — тайлан гаргахад түүх бүрэн байх ёстой.
 */
export const welfareAids = mysqlTable(
  "welfare_aids",
  {
    id: uuidPk(),
    householdId: uuidRef("household_id")
      .notNull()
      .references(() => welfareHouseholds.id, { onDelete: "cascade" }),
    /** Юу үзүүлсэн — хүнс, түлш, эмчилгээний зардал гэх мэт */
    description: varchar("description", { length: 512 }).notNull(),
    /** Зарцуулсан дүн, ₮ — 0 бол мөнгөн бус тусламж */
    amount: int("amount").notNull().default(0),
    note: bodyText("note"),
    providedBy: uidCol("provided_by"),
    providedAt: timestamp("provided_at").notNull().defaultNow(),
  },
  (table) => [
    index("welfare_aids_household_idx").on(table.householdId, table.providedAt),
  ]
);

/** FCM token — хэрэглэгч тутамд нэг */
export const fcmTokens = mysqlTable("fcm_tokens", {
  uid: uidCol("uid")
    .primaryKey()
    .references(() => users.uid, { onDelete: "cascade" }),
  token: varchar("token", { length: 512 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Бүртгэлийн лог — админ хянахад */
export const registrations = mysqlTable("registrations", {
  id: uuidPk(),
  uid: uidCol("uid").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull().default(""),
  lastName: varchar("last_name", { length: 255 }).notNull().default(""),
  phone: varchar("phone", { length: 32 }).notNull().default(""),
  role: varchar("role", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Системийн тохиргоо — нэг мөртэй хүснэгт (id = 'app').
 * `hasAdmin` нь анхны админ үүссэн эсэхийг тэмдэглэнэ.
 */
export const appConfig = mysqlTable("app_config", {
  id: varchar("id", { length: 32 }).primaryKey().default("app"),
  hasAdmin: boolean("has_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type DonorRow = typeof donors.$inferSelect;
export type DonationAccountRow = typeof donationAccounts.$inferSelect;
export type TithePatternRow = typeof tithePatterns.$inferSelect;
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
