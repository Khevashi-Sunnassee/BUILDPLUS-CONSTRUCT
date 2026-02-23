import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { analyzePageCode, generateFindingsSummary, type AuditScores } from "../server/services/page-analyzer";

async function runFullAudit() {
  console.log("Starting full system audit with page-specific analysis...\n");

  const targets = await db.execute(sql`
    SELECT id, route_path, page_title, module, frontend_entry_file, latest_score
    FROM review_targets
    ORDER BY module, page_title
  `);

  console.log(`Found ${targets.rows.length} targets to audit\n`);

  // Delete today's audits to avoid duplicates on re-run
  await db.execute(sql`DELETE FROM review_audits WHERE reviewed_at::date = CURRENT_DATE`);
  console.log("Cleared any existing audits from today for idempotent re-run\n");

  let audited = 0;
  let errors = 0;
  const scoreSummary: { title: string; score: number }[] = [];

  for (const row of targets.rows) {
    const target = {
      id: row.id as string,
      routePath: row.route_path as string,
      pageTitle: row.page_title as string,
      module: row.module as string,
      frontendEntryFile: row.frontend_entry_file as string,
    };

    try {
      const scores = analyzePageCode(target.frontendEntryFile, target.routePath, target.pageTitle, target.module);
      const overallScore = Math.round(
        (scores.functionality + scores.uiUx + scores.security + scores.performance +
         scores.codeQuality + scores.dataIntegrity + scores.errorHandling + scores.accessibility) / 8
      );

      const scoreBreakdown = {
        functionality: scores.functionality,
        uiUx: scores.uiUx,
        security: scores.security,
        performance: scores.performance,
        codeQuality: scores.codeQuality,
        dataIntegrity: scores.dataIntegrity,
        errorHandling: scores.errorHandling,
        accessibility: scores.accessibility,
        functionalityNotes: scores.functionalityNotes,
        uiUxNotes: scores.uiUxNotes,
        securityNotes: scores.securityNotes,
        performanceNotes: scores.performanceNotes,
        codeQualityNotes: scores.codeQualityNotes,
        dataIntegrityNotes: scores.dataIntegrityNotes,
        errorHandlingNotes: scores.errorHandlingNotes,
        accessibilityNotes: scores.accessibilityNotes,
      };

      const findingsMd = generateFindingsSummary(target.pageTitle, target.routePath, target.module, scores);

      await db.execute(sql`
        INSERT INTO review_audits (id, target_id, overall_score, score_breakdown, findings_md, issues_found, issues_fixed, status, reviewed_at)
        VALUES (
          gen_random_uuid(),
          ${target.id},
          ${overallScore},
          ${JSON.stringify(scoreBreakdown)}::jsonb,
          ${findingsMd},
          0,
          0,
          'REVIEWED',
          NOW()
        )
      `);

      await db.execute(sql`
        UPDATE review_targets
        SET latest_score = ${overallScore},
            latest_score_breakdown = ${JSON.stringify(scoreBreakdown)}::jsonb,
            last_reviewed_at = NOW()
        WHERE id = ${target.id}
      `);

      audited++;
      scoreSummary.push({ title: target.pageTitle, score: overallScore });
      const dims = [scores.functionality, scores.uiUx, scores.security, scores.performance, scores.codeQuality, scores.dataIntegrity, scores.errorHandling, scores.accessibility];
      console.log(`  [${audited}/${targets.rows.length}] ${target.pageTitle} (${target.routePath}) -> ${overallScore}/10 [${dims.join(",")}]`);
    } catch (err: any) {
      errors++;
      console.error(`  ERROR: ${target.pageTitle} - ${err.message}`);
    }
  }

  const avg = scoreSummary.reduce((a, b) => a + b.score, 0) / scoreSummary.length;
  const dist = new Array(10).fill(0);
  for (const s of scoreSummary) dist[Math.min(s.score, 10) - 1]++;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`AUDIT COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Pages audited: ${audited}`);
  console.log(`Errors: ${errors}`);
  console.log(`Average score: ${avg.toFixed(1)}/10`);
  console.log(`Distribution: ${dist.map((c, i) => `${i + 1}★=${c}`).join(" | ")}`);

  process.exit(0);
}

runFullAudit();
