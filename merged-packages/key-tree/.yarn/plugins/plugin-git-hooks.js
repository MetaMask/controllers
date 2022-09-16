const { execSync } = require('child_process');

const afterAllInstalled = (project) => {
  execSync('yarn simple-git-hooks', { cwd: project.cwd, stdio: 'inherit' });
};

module.exports = {
  name: 'plugin-git-hooks',
  factory: () => {
    return {
      default: {
        hooks: {
          afterAllInstalled
        }
      }
    };
  }
};
