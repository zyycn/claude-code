#!/usr/bin/env bun
/**
 * Dev entrypoint — launches cli.tsx with MACRO.* defines injected
 * via Bun's -d flag (bunfig.toml [define] doesn't propagate to
 * dynamically imported modules at runtime).
 */
import { getMacroDefines } from "./defines.ts";

const env = {
    ...process.env,
    CLAUDE_CODE_BIN_NAME: process.env.CLAUDE_CODE_BIN_NAME?.trim() || "claudex",
    CLAUDE_CODE_PACKAGE_NAME:
        process.env.CLAUDE_CODE_PACKAGE_NAME?.trim() || "@zyycn/claudex",
    CLAUDE_CODE_PACKAGE_BIN:
        process.env.CLAUDE_CODE_PACKAGE_BIN?.trim() ||
        process.env.CLAUDE_CODE_BIN_NAME?.trim() ||
        "claudex",
    CLAUDE_CODE_FORCE_FULL_LOGO:
        process.env.CLAUDE_CODE_FORCE_FULL_LOGO ?? "1",
};
const defines = getMacroDefines(env);

const defineArgs = Object.entries(defines).flatMap(([k, v]) => [
    "-d",
    `${k}:${v}`,
]);

// Bun --feature flags: enable feature() gates at runtime.
// Default features enabled in dev mode.
const DEFAULT_FEATURES = ["BUDDY", "TRANSCRIPT_CLASSIFIER"];

// Any env var matching FEATURE_<NAME>=1 will also enable that feature.
// e.g. FEATURE_PROACTIVE=1 bun run dev
const envFeatures = Object.entries(process.env)
    .filter(([k]) => k.startsWith("FEATURE_"))
    .map(([k]) => k.replace("FEATURE_", ""));

const allFeatures = [...new Set([...DEFAULT_FEATURES, ...envFeatures])];
const featureArgs = allFeatures.flatMap((name) => ["--feature", name]);

const result = Bun.spawnSync(
    ["bun", "run", ...defineArgs, ...featureArgs, "src/entrypoints/cli.tsx", ...process.argv.slice(2)],
    {
        env,
        stdio: ["inherit", "inherit", "inherit"],
    },
);

process.exit(result.exitCode ?? 0);
