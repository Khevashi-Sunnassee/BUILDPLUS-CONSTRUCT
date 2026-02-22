import { db } from "../server/db";
import { sql } from "drizzle-orm";

const DIMENSION_KEYS = ["functionality", "uiUx", "security", "performance", "codeQuality", "dataIntegrity", "errorHandling", "accessibility"];
const NOTES_KEYS = DIMENSION_KEYS.map(k => `${k}Notes`);

async function mergeScores() {
  console.log("Merging: restoring original scores + keeping new detailed notes...\n");

  const rows = await db.execute(sql`
    SELECT 
      rt.id as target_id,
      rt.page_title,
      old_a.id as old_audit_id,
      old_a.overall_score as old_overall,
      old_a.score_breakdown as old_breakdown,
      new_a.id as new_audit_id,
      new_a.overall_score as new_overall,
      new_a.score_breakdown as new_breakdown
    FROM review_targets rt
    JOIN review_audits old_a ON old_a.target_id = rt.id AND old_a.reviewed_at < '2026-02-22'
    JOIN review_audits new_a ON new_a.target_id = rt.id AND new_a.reviewed_at >= '2026-02-22'
    ORDER BY rt.page_title
  `);

  console.log(`Found ${rows.rows.length} targets with both old and new audits\n`);

  let updated = 0;

  for (const row of rows.rows) {
    const oldBreakdown = row.old_breakdown as any;
    const newBreakdown = row.new_breakdown as any;

    if (!oldBreakdown || !newBreakdown) continue;

    const mergedBreakdown: Record<string, any> = {};

    for (const key of DIMENSION_KEYS) {
      mergedBreakdown[key] = oldBreakdown[key] ?? newBreakdown[key] ?? 4;
    }

    for (const notesKey of NOTES_KEYS) {
      const newNotes = newBreakdown[notesKey] || "";
      const dimKey = notesKey.replace("Notes", "");
      const score = mergedBreakdown[dimKey];

      if (newNotes) {
        mergedBreakdown[notesKey] = newNotes.replace(
          /\*\*Score: \d\/5/,
          `**Score: ${score}/5`
        );
      }
    }

    const overallScore = row.old_overall as number;

    await db.execute(sql`
      UPDATE review_audits 
      SET score_breakdown = ${JSON.stringify(mergedBreakdown)}::jsonb,
          overall_score = ${overallScore}
      WHERE id = ${row.new_audit_id as string}
    `);

    await db.execute(sql`
      UPDATE review_targets
      SET latest_score = ${overallScore},
          latest_score_breakdown = ${JSON.stringify(mergedBreakdown)}::jsonb
      WHERE id = ${row.target_id as string}
    `);

    updated++;
    console.log(`  [${updated}] ${row.page_title}: restored score ${overallScore}/5`);
  }

  const verify = await db.execute(sql`
    SELECT 
      ROUND(AVG(latest_score::numeric), 1) as avg_score,
      COUNT(*) FILTER (WHERE latest_score = 5) as s5,
      COUNT(*) FILTER (WHERE latest_score = 4) as s4,
      COUNT(*) FILTER (WHERE latest_score = 3) as s3
    FROM review_targets
  `);

  const v = verify.rows[0];
  console.log(`\nDone. Updated ${updated} audits.`);
  console.log(`System average: ${v.avg_score}/5`);
  console.log(`Distribution: 5★=${v.s5} | 4★=${v.s4} | 3★=${v.s3}`);

  process.exit(0);
}

mergeScores();
