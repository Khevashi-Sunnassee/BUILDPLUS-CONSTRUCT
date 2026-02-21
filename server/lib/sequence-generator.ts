import { db } from "../db";
import { sql } from "drizzle-orm";

export async function getNextSequenceNumber(
  entityType: string,
  scopeId: string,
  prefix: string,
  padLength: number = 4
): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO number_sequences (id, entity_type, scope_id, prefix, current_value, created_at, updated_at)
    VALUES (gen_random_uuid(), ${entityType}, ${scopeId}, ${prefix}, 1, NOW(), NOW())
    ON CONFLICT (entity_type, scope_id) 
    DO UPDATE SET current_value = number_sequences.current_value + 1, updated_at = NOW()
    RETURNING current_value
  `);
  const nextVal = Number(result.rows[0].current_value);
  return `${prefix}${String(nextVal).padStart(padLength, "0")}`;
}
