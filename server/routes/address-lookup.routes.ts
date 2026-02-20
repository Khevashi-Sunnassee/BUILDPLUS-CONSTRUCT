import { Router, Request, Response } from "express";
import { australianSuburbs, SuburbEntry } from "../data/australian-suburbs";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/address-lookup", requireAuth, (req: Request, res: Response) => {
  const query = (req.query.q as string || "").trim().toLowerCase();
  if (!query || query.length < 2) {
    return res.json([]);
  }

  const results: SuburbEntry[] = [];
  const seen = new Set<string>();

  for (const entry of australianSuburbs) {
    const key = `${entry.suburb}-${entry.postcode}-${entry.state}`;
    if (seen.has(key)) continue;

    const suburbLower = entry.suburb.toLowerCase();
    const postcodeLower = entry.postcode.toLowerCase();

    if (suburbLower.startsWith(query) || postcodeLower.startsWith(query)) {
      seen.add(key);
      results.push(entry);
      if (results.length >= 15) break;
    }
  }

  if (results.length < 15) {
    for (const entry of australianSuburbs) {
      const key = `${entry.suburb}-${entry.postcode}-${entry.state}`;
      if (seen.has(key)) continue;

      const suburbLower = entry.suburb.toLowerCase();
      if (suburbLower.includes(query)) {
        seen.add(key);
        results.push(entry);
        if (results.length >= 15) break;
      }
    }
  }

  res.json(results);
});

export default router;
