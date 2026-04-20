import { execSync } from 'child_process';
import { cpSync, mkdirSync, realpathSync } from 'fs';

const build = (entry, outfile) => {
  const command = `./node_modules/.bin/esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outfile}`;
  execSync(command, { stdio: 'inherit' });
};

const syncToNodeModules = packageName => {
  const sourceDist = `autopilot-suite/packages/${packageName}/dist`;
  const targetDist = `node_modules/@autopilot/${packageName}/dist`;

  let sourceRealPath;
  let targetRealPath;

  try {
    sourceRealPath = realpathSync(sourceDist);
  } catch {
    return;
  }

  try {
    targetRealPath = realpathSync(targetDist);
  } catch {
    mkdirSync(targetDist, { recursive: true });
    targetRealPath = realpathSync(targetDist);
  }

  if (sourceRealPath === targetRealPath) {
    return;
  }

  cpSync(sourceDist, targetDist, { recursive: true, force: true });
};

build('autopilot-suite/packages/contracts/src/index.ts', 'autopilot-suite/packages/contracts/dist/index.js');
build('autopilot-suite/packages/jobforge-client/src/index.ts', 'autopilot-suite/packages/jobforge-client/dist/index.js');
build('autopilot-suite/packages/profiles/src/index.ts', 'autopilot-suite/packages/profiles/dist/index.js');

syncToNodeModules('contracts');
syncToNodeModules('jobforge-client');
syncToNodeModules('profiles');
