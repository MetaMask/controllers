import {
  createSandbox,
  readFile,
  readJsonFile,
  writeFile as writeTextFile,
  writeJsonFile,
} from '@metamask/node-utils';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
  TsconfigLintMetaReport,
  TsconfigLintReport,
  Workspace,
  Workspaces,
} from './utils.ts';
import {
  ensureTsconfigsUpdated,
  lintTsconfigs,
  readTsconfig,
} from './utils.ts';

const EXPECTED_BUILD_EXTENDS = [
  './tsconfig.json',
  '../../tsconfig.packages.build.json',
];

const { withinSandbox } = createSandbox('lint-tsconfigs');

type PackageSandbox = {
  repoRoot: string;
  packageRoot: string;
  writeFile: (
    fileName: string,
    content: Parameters<typeof writeJsonFile>[1],
  ) => Promise<void>;
};

describe('lintTsconfigs', () => {
  it('passes when no tsconfig has any issues', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.packages.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeFile('tsconfig.packages.build.json', {
        compilerOptions: { types: ['node'] },
      });
      await writeFile('packages/foo/tsconfig.json', {
        extends: '../../tsconfig.packages.json',
        compilerOptions: { skipLibCheck: true, types: ['vitest/globals'] },
      });
      await writeFile('packages/foo/tsconfig.build.json', {
        extends: ['./tsconfig.json', '../../tsconfig.packages.build.json'],
        compilerOptions: { skipLibCheck: false, types: ['vitest/globals'] },
      });

      const metaReport = await lintTsconfigs({
        tsconfigs: [
          await readTsconfig(packageRoot, 'tsconfig.json'),
          await readTsconfig(packageRoot, 'tsconfig.build.json'),
        ],
        expectedPackageNames: new Set(),
        workspaces: buildWorkspaces(),
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      expect(metaReport.didPass).toBe(true);
      expect(getReportsByFileName(metaReport)).toStrictEqual({
        'tsconfig.json': {
          missingReferencePaths: [],
          extraReferencePaths: [],
          expectedExtends: undefined,
          redundantCompilerOptionNames: [],
          didChange: false,
        },
        'tsconfig.build.json': {
          missingReferencePaths: [],
          extraReferencePaths: [],
          expectedExtends: undefined,
          redundantCompilerOptionNames: [],
          didChange: false,
        },
      });
    });
  });

  it('does not check `extends` or compiler options of the root build-only tsconfig', async () => {
    await withinPackageSandbox(async ({ repoRoot, writeFile }) => {
      await writeFile('tsconfig.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeFile('tsconfig.build.json', {
        extends: './tsconfig.json',
        compilerOptions: { skipLibCheck: true },
      });

      const metaReport = await lintTsconfigs({
        tsconfigs: [await readTsconfig(repoRoot, 'tsconfig.build.json')],
        expectedPackageNames: new Set(),
        workspaces: buildWorkspaces(),
        repoRoot,
        currentWorkspaceRoot: repoRoot,
      });

      expect(metaReport.didPass).toBe(true);
    });
  });

  it('reports every issue across the tsconfigs of a package', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.base.json', {
        compilerOptions: { strict: true },
      });
      await writeFile('tsconfig.packages.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeFile('tsconfig.packages.build.json', {
        extends: './tsconfig.base.json',
      });
      await writeFile('packages/bar/tsconfig.build.json', {});
      await writeFile('packages/baz/tsconfig.build.json', {});
      await writeFile('packages/foo/tsconfig.json', {
        extends: '../../tsconfig.packages.json',
        compilerOptions: {
          skipLibCheck: true,
          paths: { '@foo/*': ['./foo/*'] },
        },
      });
      await writeFile('packages/foo/tsconfig.build.json', {
        extends: ['../../tsconfig.packages.build.json', './tsconfig.json'],
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          paths: { '@foo/*': ['./foo/*'] },
          outDir: './dist',
        },
        references: [{ path: '../baz/tsconfig.build.json' }],
      });

      const metaReport = await lintTsconfigs({
        tsconfigs: [
          await readTsconfig(packageRoot, 'tsconfig.json'),
          await readTsconfig(packageRoot, 'tsconfig.build.json'),
        ],
        expectedPackageNames: new Set(['@metamask/bar']),
        workspaces: buildWorkspaces({
          repoRoot,
          list: [
            { name: '@metamask/bar', location: 'packages/bar' },
            { name: '@metamask/baz', location: 'packages/baz' },
          ],
        }),
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      expect(metaReport.didPass).toBe(false);
      expect(getReportsByFileName(metaReport)).toStrictEqual({
        'tsconfig.json': {
          missingReferencePaths: ['../bar'],
          extraReferencePaths: [],
          expectedExtends: undefined,
          redundantCompilerOptionNames: [],
          didChange: false,
        },
        'tsconfig.build.json': {
          missingReferencePaths: ['../bar/tsconfig.build.json'],
          extraReferencePaths: ['../baz/tsconfig.build.json'],
          expectedExtends: EXPECTED_BUILD_EXTENDS,
          redundantCompilerOptionNames: ['strict', 'skipLibCheck', 'paths'],
          didChange: false,
        },
      });
    });
  });
});

describe('ensureTsconfigsUpdated', () => {
  it('does not rewrite any tsconfig when none has issues', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.packages.build.json', {});
      await writeFile('packages/foo/tsconfig.json', {
        references: [{ path: '../bar' }],
      });
      await writeFile('packages/foo/tsconfig.build.json', {
        extends: EXPECTED_BUILD_EXTENDS,
        references: [{ path: '../bar/tsconfig.build.json' }],
      });
      const developmentContent = await readFile(
        path.join(packageRoot, 'tsconfig.json'),
      );
      const buildContent = await readFile(
        path.join(packageRoot, 'tsconfig.build.json'),
      );

      const metaReport = await ensureTsconfigsUpdated({
        tsconfigs: [
          await readTsconfig(packageRoot, 'tsconfig.json'),
          await readTsconfig(packageRoot, 'tsconfig.build.json'),
        ],
        workspaces: [{ name: '@metamask/bar', location: 'packages/bar' }],
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      expect(
        Object.values(getReportsByFileName(metaReport)).map(
          (report) => report.didChange,
        ),
      ).toStrictEqual([false, false]);
      expect(await readFile(path.join(packageRoot, 'tsconfig.json'))).toBe(
        developmentContent,
      );
      expect(
        await readFile(path.join(packageRoot, 'tsconfig.build.json')),
      ).toBe(buildContent);
    });
  });

  it('fixes every issue across the tsconfigs of a package', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.packages.build.json', {
        compilerOptions: { declaration: true },
      });
      await writeFile('packages/foo/tsconfig.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeFile('packages/foo/tsconfig.build.json', {
        extends: '../../tsconfig.packages.build.json',
        compilerOptions: {
          declaration: true,
          skipLibCheck: true,
          outDir: './dist',
        },
        references: [{ path: '../baz/tsconfig.build.json' }],
      });

      const metaReport = await ensureTsconfigsUpdated({
        tsconfigs: [
          await readTsconfig(packageRoot, 'tsconfig.json'),
          await readTsconfig(packageRoot, 'tsconfig.build.json'),
        ],
        workspaces: [{ name: '@metamask/bar', location: 'packages/bar' }],
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      expect(
        Object.values(getReportsByFileName(metaReport)).map(
          (report) => report.didChange,
        ),
      ).toStrictEqual([true, true]);
      expect(
        await readJsonFile(path.join(packageRoot, 'tsconfig.json')),
      ).toStrictEqual({
        compilerOptions: { skipLibCheck: true },
        references: [{ path: '../bar' }],
      });
      expect(
        await readJsonFile(path.join(packageRoot, 'tsconfig.build.json')),
      ).toStrictEqual({
        extends: EXPECTED_BUILD_EXTENDS,
        compilerOptions: { outDir: './dist' },
        references: [{ path: '../bar/tsconfig.build.json' }],
      });
    });
  });

  it('removes `compilerOptions` when every option repeats a parent value', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.packages.build.json', {});
      await writeFile('packages/foo/tsconfig.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeFile('packages/foo/tsconfig.build.json', {
        extends: EXPECTED_BUILD_EXTENDS,
        compilerOptions: { skipLibCheck: true },
        include: ['./src'],
      });

      await ensureTsconfigsUpdated({
        tsconfigs: [await readTsconfig(packageRoot, 'tsconfig.build.json')],
        workspaces: [],
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      expect(
        await readJsonFile(path.join(packageRoot, 'tsconfig.build.json')),
      ).toStrictEqual({
        extends: EXPECTED_BUILD_EXTENDS,
        include: ['./src'],
      });
    });
  });

  it('preserves comments when rewriting `extends`, `compilerOptions`, and `references`', async () => {
    await withinPackageSandbox(async ({ repoRoot, packageRoot, writeFile }) => {
      await writeFile('tsconfig.packages.build.json', {});
      await writeFile('packages/foo/tsconfig.json', {
        compilerOptions: { skipLibCheck: true },
      });
      await writeTextFile(
        path.join(packageRoot, 'tsconfig.build.json'),
        `{
  // Comment about extends.
  "extends": "../../tsconfig.packages.build.json",
  "compilerOptions": {
    "skipLibCheck": true,
    // Comment about outDir.
    "outDir": "./dist"
  },
  // Comment about references.
  "references": []
}
`,
      );

      await ensureTsconfigsUpdated({
        tsconfigs: [await readTsconfig(packageRoot, 'tsconfig.build.json')],
        workspaces: [{ name: '@metamask/bar', location: 'packages/bar' }],
        repoRoot,
        currentWorkspaceRoot: packageRoot,
      });

      const text = await readFile(
        path.join(packageRoot, 'tsconfig.build.json'),
      );
      expect(text).toContain('// Comment about extends.');
      expect(text).toContain('// Comment about outDir.');
      expect(text).toContain('// Comment about references.');
      expect(text).not.toContain('skipLibCheck');
    });
  });
});

/**
 * Runs a test inside a temporary directory that stands in for the repository,
 * with a package directory at `packages/foo`.
 *
 * @param test - The test to run.
 * @param test.repoRoot - The root of the fake repository.
 * @param test.packageRoot - The root of the fake package.
 * @param test.writeFile - Writes a file at a path relative to the root of the
 * fake repository, creating directories as needed. The content is written as
 * JSON.
 */
async function withinPackageSandbox(
  test: (sandbox: PackageSandbox) => Promise<void>,
): Promise<void> {
  await withinSandbox(async ({ directoryPath }) => {
    await test({
      repoRoot: directoryPath,
      packageRoot: path.join(directoryPath, 'packages', 'foo'),
      async writeFile(fileName, content) {
        await writeJsonFile(path.join(directoryPath, fileName), content);
      },
    });
  });
}

/**
 * Builds a `Workspaces` object for the given workspaces (none by default).
 *
 * @param options - The options object.
 * @param options.repoRoot - The root of the fake repository.
 * @param options.list - The workspaces to include.
 * @returns The workspaces.
 */
function buildWorkspaces({
  repoRoot = '',
  list = [],
}: { repoRoot?: string; list?: Workspace[] } = {}): Workspaces {
  return {
    names: new Set(list.map((workspace) => workspace.name)),
    list,
    byName: new Map(list.map((workspace) => [workspace.name, workspace])),
    byAbsolutePath: new Map(
      list.map((workspace) => [
        path.resolve(repoRoot, workspace.location),
        workspace,
      ]),
    ),
  };
}

/**
 * Collects the report for each tsconfig in a meta report, keyed by file name.
 *
 * @param metaReport - The meta report to read.
 * @returns The reports keyed by tsconfig file name.
 */
function getReportsByFileName(
  metaReport: TsconfigLintMetaReport,
): Record<string, TsconfigLintReport> {
  return Object.fromEntries(
    [...metaReport.byTsconfig].map(([tsconfig, report]) => [
      tsconfig.fileName,
      report,
    ]),
  );
}
