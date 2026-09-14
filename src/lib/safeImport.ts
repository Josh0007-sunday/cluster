// safeImport — load OPTIONAL SDKs without Vite/TS trying to resolve them.
//
// Background: packages like @reown/* and @circle-fin/* are declared in
// package.json but may not be installed yet (slow network, fresh clone).
// A normal `import('pkg')` — even with `/* @vite-ignore */` — is still
// seen by Vite's import-analysis in dev and fails the whole page with
// "Failed to resolve import". Routing through `eval('import')` makes the
// specifier a runtime-only string, invisible to both Vite and `tsc`.
// Returns null when the package (or network) is unavailable.

type ImportFn = (specifier: string) => Promise<Record<string, unknown>>;

function getDynamicImporter(): ImportFn | null {
  try {
    // Indirect eval: executes in global scope, invisible to bundlers.
    const indirect = (0, eval)('import') as ImportFn;
    return (specifier: string) => indirect(specifier);
  } catch {
    return null;
  }
}

let importer: ImportFn | null | undefined;

export async function safeImport<T = Record<string, unknown>>(
  specifier: string,
): Promise<T | null> {
  if (importer === undefined) importer = getDynamicImporter();
  if (!importer) return null;
  try {
    const mod = await importer(specifier);
    return mod as unknown as T;
  } catch {
    return null;
  }
}
