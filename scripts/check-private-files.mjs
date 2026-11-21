import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privateDirectory = /(^|[\\/])reference([\\/]|$)/i;
const privateOriginal = /^(DOMCUNENTI_IMPORTANTI\.pdf|PDF\.pdf|IMG_997[45]\.HEIC|SOGGETTO_PNG\.png)$/i;
const failures = [];
if (fs.existsSync(path.join(root, ".git"))) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0");
  if (tracked.some((file) => privateDirectory.test(file)))
    failures.push("Private reference directory is tracked by Git.");
}
function inspect(folder, traces = false) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (privateDirectory.test(file) || privateOriginal.test(entry.name)) {
      failures.push("Private original found in public assets or build output.");
      continue;
    }
    if (entry.isSymbolicLink()) {
      if (privateDirectory.test(fs.realpathSync(file)))
        failures.push("Public symlink points to private material.");
    } else if (entry.isDirectory()) inspect(file, traces);
    else if (traces && file.endsWith(".nft.json")) {
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      if (manifest.files?.some((name) => privateDirectory.test(name)))
        failures.push("Private reference material is included in a deployment trace.");
    }
  }
}
inspect(path.join(root, "apps/web/public"));
if (process.argv.includes("--artifacts")) {
  inspect(path.join(root, "apps/web/.next"), true);
  inspect(path.join(root, "apps/web/.next-e2e"), true);
  inspect(path.join(root, ".vercel/output"), true);
}
if (failures.length) throw new Error([...new Set(failures)].join("\n"));
console.log("Private-file check passed: no reference originals tracked or exposed.");
