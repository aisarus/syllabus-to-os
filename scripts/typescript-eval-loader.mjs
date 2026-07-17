const RELATIVE_SPECIFIER = /^(?:\.\/|\.\.\/)/;
const EXPLICIT_EXTENSION = /\.(?:[cm]?[jt]sx?|json|node)$/i;

/**
 * The application intentionally uses Vite's extensionless relative imports.
 * Node's experimental TypeScript stripping does not mirror that resolver, so
 * deterministic evals need this narrow fallback for local TypeScript modules.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!RELATIVE_SPECIFIER.test(specifier) || EXPLICIT_EXTENSION.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
