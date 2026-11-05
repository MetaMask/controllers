import { fileExists, readFile, readJsonFile } from '@metamask/node-utils';
import * as commentJson from 'comment-json';
import { execa } from 'execa';
import fs from 'fs';
import type { FormatConfig } from 'oxfmt';
import { format as oxfmtFormat } from 'oxfmt';
import path from 'path';
import { isDeepStrictEqual } from 'util';

// oxlint-disable-next-line n/no-unsupported-features/node-builtins
const REPO_ROOT = path.join(import.meta.dirname, '..', '..');

const PACKAGE_BUILD_TSCONFIG_FILE_NAME = 'tsconfig.build.json';

const PACKAGE_DEVELOPMENT_TSCONFIG_EXTENDS_PATH = './tsconfig.json';

const SHARED_BUILD_TSCONFIG_FILE_NAME = 'tsconfig.packages.build.json';

/**
 * A Yarn workspace as returned by `yarn workspaces list`.
 */
export type Workspace = {
  location: string;
  name: string;
};

/**
 * The collection of all workspaces in this repo, and various ways to access
 * them.
 */
export type Workspaces = {
  names: Set<string>;
  list: Workspace[];
  byName: Map<string, Workspace>;
  byAbsolutePath: Map<string, Workspace>;
};

/**
 * The content of a `package.json`, whether at the root level or package level.
 */
export type PackageManifest = {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  private?: boolean;
  workspaces?: string[];
};

/**
 * An object in the `references` field in a TypeScript config file.
 */
export type TsconfigReference = { path: string };

/**
 * The content of a TypeScript config file.
 */
export type TsconfigContent = {
  extends?: string | readonly string[];
  compilerOptions?: Record<string, unknown>;
  references?: readonly TsconfigReference[];
};

/**
 * Information about a TypeScript config file, including its content.
 */
export type Tsconfig = {
  filePath: string;
  fileName: string;
  content: TsconfigContent;
};

/**
 * The result after linting a TypeScript config file.
 */
export type TsconfigLintReport = {
  missingReferencePaths: readonly string[];
  extraReferencePaths: readonly string[];
  /**
   * The `extends` value a package build config should have. Only present when
   * the config's current `extends` does not match.
   */
  expectedExtends: readonly string[] | undefined;
  /**
   * Names of `compilerOptions` in a package build config that repeat the value
   * it already inherits from the configs it extends.
   */
  redundantCompilerOptionNames: readonly string[];
  didChange: boolean;
};

/**
 * The result after linting all TypeScript config files across the repo.
 */
export type TsconfigLintMetaReport = {
  didPass: boolean;
  didApplyFixes: boolean;
  byTsconfig: Map<Tsconfig, TsconfigLintReport>;
};

/**
 * Returns all non-root Yarn workspaces keyed by package name.
 *
 * @param repoRoot - The root directory of the repository.
 * @returns Three ways to work with the workspaces: as an array, as a map keyed
 * by name, as a map keyed by absolute path.
 */
export async function getAllNonRootWorkspaces(
  repoRoot: string,
): Promise<Workspaces> {
  const { stdout } = await execa('yarn', ['workspaces', 'list', '--json']);

  const lines = stdout.split('\n').filter((line) => line.trim() !== '');
  const allWorkspaces = lines.map((line) => JSON.parse(line) as Workspace);
  const nonRootSortedWorkspaces = allWorkspaces
    .filter((workspace) => workspace.location !== '.')
    .sort((a, b) => a.name.localeCompare(b.name));

  const workspacesByName = new Map(
    nonRootSortedWorkspaces.map(
      (workspace) => [workspace.name, workspace] as const,
    ),
  );
  const names = new Set(workspacesByName.keys());

  const workspacesByAbsolutePath = new Map<string, Workspace>();
  for (const workspace of nonRootSortedWorkspaces) {
    const workspaceAbsolutePath = path.resolve(repoRoot, workspace.location);
    workspacesByAbsolutePath.set(workspaceAbsolutePath, workspace);
  }

  return {
    names,
    list: nonRootSortedWorkspaces,
    byName: workspacesByName,
    byAbsolutePath: workspacesByAbsolutePath,
  };
}

/**
 * Filters workspaces to those that contain a particular TypeScript config.
 *
 * @param args - The arguments to this function.
 * @param args.workspaces - The workspaces to filter.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.fileName - The TypeScript config filename to look for.
 * @returns The workspaces containing the requested TypeScript config.
 */
export async function filterWorkspacesWithTsconfig({
  workspaces,
  repoRoot,
  fileName,
}: {
  workspaces: readonly Workspace[];
  repoRoot: string;
  fileName: string;
}): Promise<Workspace[]> {
  const results = await Promise.all(
    workspaces.map(async (workspace) => {
      const filePath = path.resolve(repoRoot, workspace.location, fileName);
      if (await fileExists(filePath)) {
        return workspace;
      }
    }),
  );

  return results.filter(
    (workspace): workspace is Workspace => workspace !== undefined,
  );
}

/**
 * Reads and parses a package manifest from a package root directory.
 *
 * @param packageRoot - Absolute path to the package directory.
 * @returns The parsed `package.json` contents.
 */
export async function readPackageManifest(
  packageRoot: string,
): Promise<PackageManifest> {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  return await readJsonFile<PackageManifest>(packageJsonPath);
}

/**
 * Reads and parses a TypeScript config file and returns path metadata.
 *
 * @param directory - Where to find the tsconfig file.
 * @param fileName - The path to the tsconfig file in the directory.
 * @returns Parsed tsconfig content with absolute and relative paths.
 */
export async function readTsconfig(
  directory: string,
  fileName: string,
): Promise<Tsconfig> {
  const filePath = path.join(directory, fileName);
  const rawContent = await readFile(filePath);
  return {
    filePath,
    fileName,
    content: commentJson.parse(rawContent) as TsconfigContent,
  };
}

/**
 * Resolves a reference path inside of a tsconfig file to its TypeScript
 * "project" directory (i.e., the same directory that the tsconfig file lives
 * in).
 *
 * Handles both direct directory references (e.g. `../../accounts-controller/`)
 * and references to specific tsconfig files
 * (`../../accounts-controller/tsconfig.json`).
 *
 * @param referencePath - The reference path from the tsconfig.
 * @param tsconfigPath - Path to the tsconfig file containing the reference.
 * @returns The absolute path to the workspace directory.
 */
async function resolveTsconfigReferenceToTsProjectDirectory(
  referencePath: string,
  tsconfigPath: string,
): Promise<string> {
  const absoluteReferencePath = path.resolve(
    path.dirname(tsconfigPath),
    referencePath,
  );

  const stats = await fs.promises.stat(absoluteReferencePath);
  if (stats.isFile()) {
    return path.dirname(absoluteReferencePath);
  }
  return absoluteReferencePath;
}

/**
 * Extracts the workspace package names from the references in a tsconfig file.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - Parsed contents of the tsconfig file.
 * @param args.workspaces - The workspaces to use as references.
 * @returns A set of package names that are referenced in the tsconfig.
 */
async function getReferencedPackageNamesFromTsconfigFile({
  tsconfig,
  workspaces,
}: {
  tsconfig: Tsconfig;
  workspaces: Workspaces;
}): Promise<Set<string>> {
  const packageNames = new Set<string>();

  for (const reference of tsconfig.content.references ?? []) {
    const tsProjectAbsolutePath =
      await resolveTsconfigReferenceToTsProjectDirectory(
        reference.path,
        tsconfig.filePath,
      );
    const workspace = workspaces.byAbsolutePath.get(tsProjectAbsolutePath);
    if (workspace) {
      packageNames.add(workspace.name);
    } else {
      throw new Error(
        `Error parsing tsconfig ${tsconfig.fileName}: Could not resolve reference to workspace: ${reference.path}`,
      );
    }
  }

  return packageNames;
}

/**
 * Computes the expected reference path for a workspace within a tsconfig file.
 *
 * Note if the file is `tsconfig.json`, we drop the trailing `/tsconfig.json`
 * from the reference path.
 *
 * @param args - The arguments to this function.
 * @param args.workspace - The workspace to compute the path for.
 * @param args.tsconfig - The tsconfig file to compute the path relative to.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns The expected reference path string.
 */
function getExpectedReferencePath({
  workspace,
  tsconfig,
  repoRoot,
  currentWorkspaceRoot,
}: {
  workspace: Workspace;
  tsconfig: Tsconfig;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): string {
  const absoluteWorkspacePath = path.resolve(repoRoot, workspace.location);
  const relativeWorkspacePath = path.relative(
    currentWorkspaceRoot,
    absoluteWorkspacePath,
  );
  const prefixedRelativePath = relativeWorkspacePath.startsWith('..')
    ? relativeWorkspacePath
    : `./${relativeWorkspacePath}`;
  if (tsconfig.fileName === 'tsconfig.json') {
    return prefixedRelativePath;
  }
  return `${prefixedRelativePath}/${tsconfig.fileName}`;
}

/**
 * Compares the references in a tsconfig file against expected package names.
 * For a package build config, also checks that `extends` is as expected and
 * that no compiler option repeats a value it already inherits.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - Parsed contents of the tsconfig file.
 * @param args.expectedPackageNames - Package names that should be referenced.
 * @param args.workspaces - The workspaces to use as reference.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns Missing and extra reference paths, plus any `extends` and
 * `compilerOptions` issues, for the tsconfig.
 */
async function lintTsconfig({
  tsconfig,
  expectedPackageNames,
  workspaces,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfig: Tsconfig;
  expectedPackageNames: Set<string>;
  workspaces: Workspaces;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): Promise<TsconfigLintReport> {
  const actualPackageNames = await getReferencedPackageNamesFromTsconfigFile({
    tsconfig,
    workspaces,
  });

  const missingReferencePaths = [...expectedPackageNames]
    .filter((name) => !actualPackageNames.has(name))
    .sort()
    .map((name) => {
      const workspace = workspaces.byName.get(name);
      if (!workspace) {
        throw new Error(`Expected workspace not found for package: ${name}`);
      }
      return getExpectedReferencePath({
        workspace,
        tsconfig,
        repoRoot,
        currentWorkspaceRoot,
      });
    });

  const extraReferencePaths = [...actualPackageNames]
    .filter((name) => !expectedPackageNames.has(name))
    .sort()
    .map((name) => {
      const workspace = workspaces.byName.get(name);
      if (!workspace) {
        throw new Error(`Expected workspace not found for package: ${name}`);
      }
      return getExpectedReferencePath({
        workspace,
        tsconfig,
        repoRoot,
        currentWorkspaceRoot,
      });
    });

  const newExtends = getNewExtends({
    tsconfig,
    repoRoot,
    currentWorkspaceRoot,
  });
  const expectedExtends = areJsonValuesEqual(
    newExtends,
    tsconfig.content.extends,
  )
    ? undefined
    : getExtendsEntries({ extends: newExtends });

  const newCompilerOptions = await getNewCompilerOptions({
    tsconfig,
    repoRoot,
    currentWorkspaceRoot,
  });
  const redundantCompilerOptionNames = Object.keys(
    tsconfig.content.compilerOptions ?? {},
  ).filter((name) => !Object.hasOwn(newCompilerOptions ?? {}, name));

  return {
    missingReferencePaths,
    extraReferencePaths,
    expectedExtends,
    redundantCompilerOptionNames,
    didChange: false,
  };
}

/**
 * Checks for issues in the given tsconfig files.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfigs - The parsed tsconfigs to check.
 * @param args.expectedPackageNames - Package names that should be referenced.
 * @param args.workspaces - The workspaces to use as references.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig files.
 * @returns A report for each tsconfig file (i.e., an object keyed by the
 * tsconfig filename which contains issues).
 */
export async function lintTsconfigs({
  tsconfigs,
  expectedPackageNames,
  workspaces,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfigs: Tsconfig[];
  expectedPackageNames: Set<string>;
  workspaces: Workspaces;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): Promise<TsconfigLintMetaReport> {
  const results = await Promise.all(
    tsconfigs.map(async (tsconfig) => {
      const report = await lintTsconfig({
        tsconfig,
        expectedPackageNames,
        workspaces,
        repoRoot,
        currentWorkspaceRoot,
      });
      return [tsconfig, report] as const;
    }),
  );
  const byTsconfig = new Map(results);
  const didPass = results.every(
    ([, report]) =>
      report.missingReferencePaths.length === 0 &&
      report.extraReferencePaths.length === 0 &&
      report.expectedExtends === undefined &&
      report.redundantCompilerOptionNames.length === 0,
  );
  return { didPass, didApplyFixes: false, byTsconfig };
}

/**
 * Determines whether a tsconfig file is the build config of a package (as
 * opposed to the build config at the root of the repository).
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - The tsconfig file to check.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns `true` if the file is a package build config.
 */
function isPackageBuildTsconfig({
  tsconfig,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfig: Tsconfig;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): boolean {
  return (
    tsconfig.fileName === PACKAGE_BUILD_TSCONFIG_FILE_NAME &&
    path.resolve(currentWorkspaceRoot) !== path.resolve(repoRoot)
  );
}

/**
 * Computes the `extends` value that a package build config should have: the
 * package's own development config, followed by the shared build config. The
 * shared build config comes last so that its settings take precedence.
 *
 * @param args - The arguments to this function.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns The expected `extends` entries.
 */
function getExpectedPackageBuildExtends({
  repoRoot,
  currentWorkspaceRoot,
}: {
  repoRoot: string;
  currentWorkspaceRoot: string;
}): string[] {
  const sharedBuildTsconfigPath = path.join(
    path.relative(currentWorkspaceRoot, repoRoot),
    SHARED_BUILD_TSCONFIG_FILE_NAME,
  );
  return [PACKAGE_DEVELOPMENT_TSCONFIG_EXTENDS_PATH, sharedBuildTsconfigPath];
}

/**
 * Normalizes the `extends` field of a tsconfig file to an array.
 *
 * @param content - The parsed content of the tsconfig file.
 * @returns The entries of `extends`, in order.
 */
function getExtendsEntries(content: TsconfigContent): string[] {
  if (content.extends === undefined) {
    return [];
  }
  return typeof content.extends === 'string'
    ? [content.extends]
    : [...content.extends];
}

/**
 * Determines whether two values from tsconfig files are deeply equal.
 *
 * Values parsed by `comment-json` carry their comments in symbol properties
 * and are not plain arrays and objects, so they would never equal otherwise
 * identical values. Round-tripping through JSON compares only the data.
 *
 * @param valueA - The first value.
 * @param valueB - The second value.
 * @returns `true` if the values are deeply equal.
 */
function areJsonValuesEqual(valueA: unknown, valueB: unknown): boolean {
  return isDeepStrictEqual(toPlainJson(valueA), toPlainJson(valueB));
}

/**
 * Strips comments and class instances from a value parsed by `comment-json`.
 *
 * @param value - The value to copy.
 * @returns The plain copy, or `undefined` if the value is `undefined`.
 */
function toPlainJson(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Resolves the `compilerOptions` that a tsconfig file ends up with after
 * inheriting from the configs it extends, in the same way TypeScript does:
 * later entries in `extends` override earlier ones, and the file's own options
 * override all of them.
 *
 * @param filePath - Absolute path to the tsconfig file.
 * @returns The resolved compiler options.
 */
async function readResolvedCompilerOptions(
  filePath: string,
): Promise<Record<string, unknown>> {
  const tsconfig = await readTsconfig(
    path.dirname(filePath),
    path.basename(filePath),
  );

  let inheritedOptions: Record<string, unknown> = {};
  for (const entry of getExtendsEntries(tsconfig.content)) {
    if (!entry.startsWith('.')) {
      throw new Error(
        `Error parsing tsconfig ${tsconfig.fileName}: Cannot resolve non-relative \`extends\` entry: ${entry}`,
      );
    }
    const parentPath = path.resolve(path.dirname(filePath), entry);
    const parentOptions = await readResolvedCompilerOptions(
      parentPath.endsWith('.json') ? parentPath : `${parentPath}.json`,
    );
    inheritedOptions = { ...inheritedOptions, ...parentOptions };
  }

  return { ...inheritedOptions, ...tsconfig.content.compilerOptions };
}

/**
 * Computes the `extends` value a tsconfig file should have. Package build
 * configs are expected to extend the package's development config and the
 * shared build config; all other configs are left as they are.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - Parsed contents of the tsconfig file.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns The `extends` value the file should have.
 */
function getNewExtends({
  tsconfig,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfig: Tsconfig;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): TsconfigContent['extends'] {
  if (!isPackageBuildTsconfig({ tsconfig, repoRoot, currentWorkspaceRoot })) {
    return tsconfig.content.extends;
  }
  return getExpectedPackageBuildExtends({ repoRoot, currentWorkspaceRoot });
}

/**
 * Computes the `compilerOptions` a tsconfig file should have. For a package
 * build config, this is its current options minus any whose value is the same
 * as the value it already inherits from the configs it is expected to extend.
 * Other configs are left as they are.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - Parsed contents of the tsconfig file.
 * @param args.repoRoot - The root directory of the repository.
 * @param args.currentWorkspaceRoot - The directory containing the tsconfig file.
 * @returns The `compilerOptions` the file should have, or `undefined` if it
 * should have none.
 */
async function getNewCompilerOptions({
  tsconfig,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfig: Tsconfig;
  repoRoot: string;
  currentWorkspaceRoot: string;
}): Promise<TsconfigContent['compilerOptions']> {
  const currentOptions = tsconfig.content.compilerOptions;
  if (
    currentOptions === undefined ||
    !isPackageBuildTsconfig({ tsconfig, repoRoot, currentWorkspaceRoot })
  ) {
    return currentOptions;
  }

  let inheritedOptions: Record<string, unknown> = {};
  for (const entry of getExpectedPackageBuildExtends({
    repoRoot,
    currentWorkspaceRoot,
  })) {
    const parentOptions = await readResolvedCompilerOptions(
      path.resolve(currentWorkspaceRoot, entry),
    );
    inheritedOptions = { ...inheritedOptions, ...parentOptions };
  }

  const keptNames = Object.keys(currentOptions).filter(
    (name) =>
      !Object.hasOwn(inheritedOptions, name) ||
      !areJsonValuesEqual(inheritedOptions[name], currentOptions[name]),
  );
  if (keptNames.length === Object.keys(currentOptions).length) {
    return currentOptions;
  }
  if (keptNames.length === 0) {
    return undefined;
  }
  // Copying through `comment-json` keeps the comments of the options we keep.
  return commentJson.assign({}, currentOptions, keptNames);
}

/**
 * Normalizes a tsconfig reference path to a bare directory path for
 * comparison purposes, by stripping a trailing `/tsconfig.json` suffix if
 * present. This allows existing references that use explicit file paths (e.g.
 * `../foo/tsconfig.json`) to be matched against canonical bare-directory paths
 * (e.g. `../foo`).
 *
 * @param refPath - The reference path to normalize.
 * @returns The normalized path.
 */
function normalizeReferencePath(refPath: string): string {
  return refPath.replace(/\/tsconfig\.json$/u, '');
}

/**
 * Produces an updated `references` list within a tsconfig file that preserves
 * the order of existing references, removes extras, and adds missing ones in
 * the order they appear in `newReferences`.
 *
 * @param currentReferences - The references currently in the tsconfig file.
 * @param newReferences - The complete desired set of references.
 * @returns The merged references list.
 */
function mergeReferences(
  currentReferences: readonly TsconfigReference[],
  newReferences: readonly TsconfigReference[],
): TsconfigReference[] {
  const currentNormalizedPaths = new Set(
    currentReferences.map((ref) => normalizeReferencePath(ref.path)),
  );
  const newReferencesByNormalizedPath = new Map(
    newReferences.map((ref) => [normalizeReferencePath(ref.path), ref]),
  );

  // Keep existing references that are still valid, replacing them with the
  // canonical form from newReferences.
  const keptReferences = currentReferences
    .map((ref) =>
      newReferencesByNormalizedPath.get(normalizeReferencePath(ref.path)),
    )
    .filter((ref): ref is TsconfigReference => ref !== undefined);

  // Append new references that aren't already present.
  const addedReferences = newReferences.filter(
    (ref) => !currentNormalizedPaths.has(normalizeReferencePath(ref.path)),
  );

  return [...keptReferences, ...addedReferences];
}

/**
 * Determines whether two reference lists are equivalent, i.e. they contain
 * the same paths in the same order.
 *
 * @param referencesA - The first list of references.
 * @param referencesB - The second list of references.
 * @returns `true` if the two lists contain the same paths in the same order.
 */
function areReferencesEqual(
  referencesA: readonly TsconfigReference[],
  referencesB: readonly TsconfigReference[],
): boolean {
  return (
    referencesA.length === referencesB.length &&
    referencesA.every((reference, index) => {
      return reference.path === referencesB[index]?.path;
    })
  );
}

/**
 * Updates the given tsconfig file to reference all of the given workspace
 * packages, preserving the existing order of references and appending any
 * missing ones in alphabetical order. For a package build config, also fixes
 * `extends` and removes compiler options that repeat inherited values. Updates
 * the formatting of the file to appease Oxfmt if necessary.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfig - Parsed tsconfig file to update.
 * @param args.workspaces - Workspaces to update the file with.
 * @param args.repoRoot - The path to the whole repository
 * @param args.currentWorkspaceRoot - The path to the current workspace (the
 * root of the repository or the path to a package within it).
 * @returns `true` if the tsconfig file's contents were changed, `false`
 * otherwise.
 */
async function ensureTsconfigUpdated({
  tsconfig,
  workspaces,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfig: Tsconfig;
  workspaces: Workspace[];
  repoRoot: string;
  currentWorkspaceRoot: string;
}): Promise<boolean> {
  const currentReferences = tsconfig.content.references ?? [];
  const expectedReferences = workspaces.map((workspace) => ({
    path: getExpectedReferencePath({
      workspace,
      tsconfig,
      repoRoot,
      currentWorkspaceRoot,
    }),
  }));
  const newReferences = mergeReferences(currentReferences, expectedReferences);
  const didReferencesChange = !areReferencesEqual(
    currentReferences,
    newReferences,
  );

  const newExtends = getNewExtends({
    tsconfig,
    repoRoot,
    currentWorkspaceRoot,
  });
  const didExtendsChange = !areJsonValuesEqual(
    newExtends,
    tsconfig.content.extends,
  );

  const newCompilerOptions = await getNewCompilerOptions({
    tsconfig,
    repoRoot,
    currentWorkspaceRoot,
  });
  const didCompilerOptionsChange = !areJsonValuesEqual(
    newCompilerOptions,
    tsconfig.content.compilerOptions,
  );

  // If nothing has changed, then there's no need to reformat and rewrite the
  // file, even if its current formatting doesn't match Oxfmt.
  if (!didReferencesChange && !didExtendsChange && !didCompilerOptionsChange) {
    return false;
  }

  if (didReferencesChange) {
    commentJson.assign(tsconfig.content, { references: [...newReferences] });
  }
  if (didExtendsChange) {
    // We already used commentJson.assign to create newExtends,
    // so we can simply reassign this property.
    tsconfig.content.extends = newExtends;
  }
  if (didCompilerOptionsChange) {
    if (newCompilerOptions === undefined) {
      delete tsconfig.content.compilerOptions;
    } else {
      // We already used commentJson.assign to create newCompilerOptions,
      // so we can simply reassign this property.
      tsconfig.content.compilerOptions = newCompilerOptions;
    }
  }

  await writeFormattedTsconfig(tsconfig);
  return true;
}

/**
 * Writes the parsed content of a tsconfig file back to disk, formatted with
 * Oxfmt.
 *
 * @param tsconfig - The tsconfig file to write.
 */
async function writeFormattedTsconfig(tsconfig: Tsconfig): Promise<void> {
  const { default: oxfmtRc } = (await import(
    path.join(REPO_ROOT, '.oxfmtrc.json'),
    {
      with: {
        type: 'json',
      },
    }
  )) as { default: FormatConfig };

  const updatedContent = commentJson.stringify(tsconfig.content, null, 2);
  const { code: updatedFormattedContent, errors } = await oxfmtFormat(
    tsconfig.fileName,
    updatedContent,
    oxfmtRc,
  );
  if (errors.length > 0) {
    throw new Error(
      `Failed to format ${tsconfig.fileName} with Oxfmt: ${errors.map((error) => error.message).join('; ')}`,
    );
  }

  await fs.promises.writeFile(tsconfig.filePath, updatedFormattedContent);
}

/**
 * Updates the given tsconfig files to reference the given workspace packages,
 * preserving the existing order of references and appending any missing ones
 * in alphabetical order.
 *
 * @param args - The arguments to this function.
 * @param args.tsconfigs - Parsed tsconfig files.
 * @param args.workspaces - The workspaces to use.
 * @param args.repoRoot - The path to the whole repository
 * @param args.currentWorkspaceRoot - The path to the current workspace (the
 * root of the repository or the path to a package within it).
 * @returns A report for each tsconfig file (i.e., an object keyed by the
 * tsconfig filename which indicates whether its contents were changed).
 */
export async function ensureTsconfigsUpdated({
  tsconfigs,
  workspaces,
  repoRoot,
  currentWorkspaceRoot,
}: {
  tsconfigs: Tsconfig[];
  workspaces: Workspace[];
  repoRoot: string;
  currentWorkspaceRoot: string;
}): Promise<TsconfigLintMetaReport> {
  const byTsconfig = new Map(
    await Promise.all(
      tsconfigs.map(async (tsconfig) => {
        const didChange = await ensureTsconfigUpdated({
          tsconfig,
          workspaces,
          repoRoot,
          currentWorkspaceRoot,
        });
        const report: TsconfigLintReport = {
          missingReferencePaths: [],
          extraReferencePaths: [],
          expectedExtends: undefined,
          redundantCompilerOptionNames: [],
          didChange,
        };
        return [tsconfig, report] as const;
      }),
    ),
  );

  return {
    didPass: true,
    didApplyFixes: true,
    byTsconfig,
  };
}

/**
 * Prints the results from linting tsconfig files. Only tsconfig files with
 * issues (or, when fixing, files that were changed) are printed.
 *
 * @param metaReport - The report to print (includes all tsconfigs linted).
 */
export function printReport(metaReport: TsconfigLintMetaReport): void {
  if (metaReport.didApplyFixes) {
    for (const [tsconfig, report] of metaReport.byTsconfig.entries()) {
      if (report.didChange) {
        console.log(
          `✅ Updated ${getDisplayPath(tsconfig)} so its \`extends\`, compiler options, and references are correct.`,
        );
      }
    }

    return;
  }

  for (const [tsconfig, report] of metaReport.byTsconfig.entries()) {
    if (
      report.missingReferencePaths.length > 0 ||
      report.extraReferencePaths.length > 0 ||
      report.expectedExtends !== undefined ||
      report.redundantCompilerOptionNames.length > 0
    ) {
      console.log(
        `❌ Detected the following issues within ${getDisplayPath(tsconfig)}:`,
      );

      for (const referencePath of report.missingReferencePaths) {
        console.log(`  - Missing reference: \`${referencePath}\``);
      }

      for (const referencePath of report.extraReferencePaths) {
        console.log(`  - Unnecessary reference: \`${referencePath}\``);
      }

      if (report.expectedExtends !== undefined) {
        console.log(
          `  - Incorrect \`extends\`: expected ${JSON.stringify(report.expectedExtends).replace(',', ', ')}`,
        );
      }

      for (const name of report.redundantCompilerOptionNames) {
        console.log(
          `  - Redundant compiler option (same as inherited value): \`${name}\``,
        );
      }
    }
  }

  if (!metaReport.didPass) {
    console.log(
      '\nYou can run `yarn workspace <workspace> run lint:tsconfigs:fix` or `yarn run lint:tsconfigs:fix:all` to quickly fix these issues.',
    );
  }
}

/**
 * Gets the path of a tsconfig file relative to the current working directory,
 * for display purposes.
 *
 * @param tsconfig - The tsconfig file.
 * @returns The relative path to the tsconfig file.
 */
function getDisplayPath(tsconfig: Tsconfig): string {
  return path.relative(process.cwd(), tsconfig.filePath);
}
