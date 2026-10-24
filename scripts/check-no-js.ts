// O desafio reprova "JavaScript puro em qualquer parte". Este check roda no CI
// e falha se algum arquivo JS for versionado.
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
const offenders = tracked.filter((file) => /\.(c|m)?jsx?$/.test(file));

if (offenders.length > 0) {
  console.error("JavaScript files are not allowed in this repository:");
  for (const file of offenders) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`No JavaScript files among ${tracked.length - 1} tracked files.`);
