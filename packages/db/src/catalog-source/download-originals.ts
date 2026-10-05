/**
 * Downloads the full-size dish photos referenced by the captured public menu
 * (`data/brenvo/raw/dish-pics.json`) into `data/brenvo/originals/<dishId>.jpg`, the input of
 * `catalog:normalize`. Originals are not committed: the optimized WebP files in
 * `apps/web/public/menu` are. Existing files are kept, so the script can be re-run safely.
 *
 * Run: npm run catalog:photos -w @dimsum/db
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, "../../data/brenvo");
const ORIGINALS = path.join(DATA, "originals");

interface DishPics {
  body: { dishs?: { _id: string; pic?: string }[] }[];
}

const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(DATA, "raw", file), "utf8")) as T;

async function main() {
  const menus = read<{ dbResults: { dishs: { _id: string }[] }[] }>("menu.json").dbResults;
  const urls = new Map<string, string>();
  for (const response of read<DishPics[]>("dish-pics.json")) {
    for (const menu of response.body) {
      for (const dish of menu.dishs ?? []) {
        // The query string only asks the CDN for a 300 px thumbnail.
        if (dish.pic && !dish.pic.includes("dish-default")) urls.set(dish._id, dish.pic.split("?")[0]!);
      }
    }
  }

  fs.mkdirSync(ORIGINALS, { recursive: true });
  let saved = 0;
  let kept = 0;
  const failed: string[] = [];
  for (const dish of menus.flatMap((m) => m.dishs)) {
    const url = urls.get(dish._id);
    if (!url) continue;
    const dest = path.join(ORIGINALS, `${dish._id}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      kept++;
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      failed.push(`${res.status} ${url}`);
      continue;
    }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved++;
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`[catalog] photos: ${saved} downloaded, ${kept} already present, ${failed.length} failed`);
  for (const f of failed) console.log(`  ${f}`);
  if (failed.length) process.exitCode = 1;
}

await main();
