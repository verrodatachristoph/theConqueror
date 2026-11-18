// Lets `node --test` load the app's own TypeScript modules unchanged.
//
// Next.js resolves "@/x" (→ src/x) and extensionless relative imports; plain Node
// does not. Instead of a test runner plus transpiler, this teaches Node's resolver
// those two rules. Node itself strips the types, so the tests run the real source.
//
//   node --import ./test/resolve.mjs --test test/*.test.ts
//
// "server-only" is a bundler marker with no runtime behaviour; it is stubbed so the
// pure parts of server modules can be tested.

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = path.resolve(import.meta.dirname, "..", "src");
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", "/index.ts"];

function firstExisting(base) {
  if (existsSync(base) && path.extname(base)) return base;
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
  return null;
}

const SERVER_ONLY = "data:text/javascript,export {}";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: SERVER_ONLY, shortCircuit: true };

    const alias = specifier.startsWith("@/");
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!alias && !relative) return nextResolve(specifier, context);

    const from = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : src;
    const base = alias ? path.join(src, specifier.slice(2)) : path.resolve(from, specifier);
    const found = firstExisting(base);
    return found ? { url: pathToFileURL(found).href, shortCircuit: true } : nextResolve(specifier, context);
  },
});
