const { createRootConfig, getPackageDirectories } = await import(
  '../tests/vitest/create-root-config.ts'
);

const start = performance.now();
const directories = await getPackageDirectories();
const lookup = performance.now() - start;
const config = await createRootConfig(directories);

console.log('workspaces:', directories.length);
console.log('projects:', (config.test?.projects as string[]).length);
console.log('lookup ms:', Math.round(lookup));
console.log(
  'excluded:',
  directories.filter(
    (directory) =>
      !(config.test?.projects as string[]).some((project) =>
        project.startsWith(`${directory}/`),
      ),
  ),
);
