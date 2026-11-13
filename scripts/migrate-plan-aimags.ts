/**
 * Төлөвлөгөөг олон аймагтай болгосны дараах нэг удаагийн шилжүүлэлт.
 *
 *   • projects.aimag (ганц) → projects.aimags (жагсаалт)
 *   • tasks.aimag ← даалгаврын төслийн хуучин аймаг
 *   • tasks.aimag (ганц) → tasks.aimags (жагсаалт)
 *
 * Дахин ажиллуулахад аюулгүй: зөвхөн хоосон хэвээр байгаа мөрийг бөглөнө.
 * `npm run db:push`-ийн ДАРАА ажиллуулна:
 *   npx tsx --env-file=.env.local scripts/migrate-plan-aimags.ts
 */
import { createDbPool, resolveDatabaseUrl } from "../src/lib/db/createPool";

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL тохируулаагүй байна (.env.local).");
  process.exit(1);
}

const pool = createDbPool(connectionString, 1);

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectsResult = await client.query(
      `UPDATE projects
          SET aimags = jsonb_build_array(aimag)
        WHERE aimag <> '' AND aimags = '[]'::jsonb`
    );

    const tasksResult = await client.query(
      `UPDATE tasks t
          SET aimag = p.aimag
         FROM projects p
        WHERE t.project_id = p.id AND t.aimag = '' AND p.aimag <> ''`
    );

    // Даалгавар олон аймагтай болсон — ганц аймгийг жагсаалт руу
    const taskAimagsResult = await client.query(
      `UPDATE tasks
          SET aimags = jsonb_build_array(aimag)
        WHERE aimag <> '' AND aimags = '[]'::jsonb`
    );

    await client.query("COMMIT");

    console.log(`✓ Төсөл: ${projectsResult.rowCount} мөр aimags руу шилжлээ`);
    console.log(`✓ Даалгавар: ${tasksResult.rowCount} мөрөнд аймаг онооллоо`);
    console.log(
      `✓ Даалгавар: ${taskAimagsResult.rowCount} мөр aimags руу шилжлээ`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Шилжүүлэлт амжилтгүй:", error);
  process.exit(1);
});
