import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function assertFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Expected file not found: ${path}`);
  }
}

function read(path) {
  return readFileSync(path, 'utf-8');
}

const tempDir = 'fixtures/jobforge/output.tmp';

run('node ./dist/cli.js --help');
run('node ./dist/cli.js analyze --help');

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

run(
  'node ./dist/cli.js analyze --inputs ./fixtures/jobforge/input.json --tenant tenant-demo --project project-demo --trace trace-demo --out ./fixtures/jobforge/output.tmp --stable-output'
);

const expectedBundle = 'fixtures/jobforge/request-bundle.json';
const expectedReport = 'fixtures/jobforge/report.json';
const expectedMarkdown = 'fixtures/jobforge/report.md';

assertFile(expectedBundle);
assertFile(expectedReport);
assertFile(expectedMarkdown);

const actualBundle = join(tempDir, 'request-bundle.json');
const actualReport = join(tempDir, 'report.json');
const actualMarkdown = join(tempDir, 'report.md');

assertFile(actualBundle);
assertFile(actualReport);
assertFile(actualMarkdown);

if (read(expectedBundle) !== read(actualBundle)) {
  throw new Error('request-bundle.json does not match expected output');
}

if (read(expectedReport) !== read(actualReport)) {
  throw new Error('report.json does not match expected output');
}

if (read(expectedMarkdown) !== read(actualMarkdown)) {
  throw new Error('report.md does not match expected output');
}

rmSync(tempDir, { recursive: true, force: true });
