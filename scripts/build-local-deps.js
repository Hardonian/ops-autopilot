import { execSync } from 'child_process';

const build = (entry, outfile) => {
  const command = `./node_modules/.bin/esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outfile}`;
  execSync(command, { stdio: 'inherit' });
};

build('autopilot-suite/packages/contracts/src/index.ts', 'autopilot-suite/packages/contracts/dist/index.js');
build('autopilot-suite/packages/jobforge-client/src/index.ts', 'autopilot-suite/packages/jobforge-client/dist/index.js');
build('autopilot-suite/packages/profiles/src/index.ts', 'autopilot-suite/packages/profiles/dist/index.js');
