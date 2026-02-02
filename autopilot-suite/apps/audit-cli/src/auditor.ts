import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { glob } from 'glob';

/**
 * Violation severity
 */
type Severity = 'error' | 'warning';

/**
 * Violation record
 */
interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
}

/**
 * Check result
 */
interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

/**
 * Audit result
 */
export interface AuditResult {
  repoPath: string;
  timestamp: string;
  passed: boolean;
  checks: CheckResult[];
  errors: Violation[];
  warnings: Violation[];
  filesAnalyzed: number;
}

/**
 * Forbidden patterns for runnerless compliance
 */
const FORBIDDEN_PATTERNS = [
  // Job queue libraries
  { pattern: /require\(['"]bull['"]\)|import.*from\s+['"]bull['"]/, name: 'bull', type: 'queue' },
  { pattern: /require\(['"]bullmq['"]\)|import.*from\s+['"]bullmq['"]/, name: 'bullmq', type: 'queue' },
  { pattern: /require\(['"]bee-queue['"]\)|import.*from\s+['"]bee-queue['"]/, name: 'bee-queue', type: 'queue' },
  { pattern: /require\(['"]agenda['"]\)|import.*from\s+['"]agenda['"]/, name: 'agenda', type: 'queue' },
  { pattern: /require\(['"]kue['"]\)|import.*from\s+['"]kue['"]/, name: 'kue', type: 'queue' },
  
  // Scheduler libraries
  { pattern: /require\(['"]node-cron['"]\)|import.*from\s+['"]node-cron['"]/, name: 'node-cron', type: 'scheduler' },
  { pattern: /require\(['"]cron['"]\)|import.*from\s+['"]cron['"]/, name: 'cron', type: 'scheduler' },
  { pattern: /require\(['"]node-schedule['"]\)|import.*from\s+['"]node-schedule['"]/, name: 'node-schedule', type: 'scheduler' },
  
  // Server frameworks (potential worker implementation)
  { pattern: /require\(['"]express['"]\)|import.*from\s+['"]express['"]/, name: 'express', type: 'server' },
  { pattern: /require\(['"]fastify['"]\)|import.*from\s+['"]fastify['"]/, name: 'fastify', type: 'server' },
  { pattern: /require\(['"]koa['"]\)|import.*from\s+['"]koa['"]/, name: 'koa', type: 'server' },
  { pattern: /require\(['"]hapi['"]\)|import.*from\s+['"]hapi['"]/, name: 'hapi', type: 'server' },
  { pattern: /createServer\s*\(/, name: 'http.createServer', type: 'server' },
  { pattern: /\.listen\s*\(\s*\d+/, name: 'server.listen', type: 'server' },
  
  // Secret management
  { pattern: /process\.env\.[A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL)/, name: 'env-secret', type: 'secret' },
  { pattern: /require\(['"]dotenv['"]\).*config\s*\(\s*\{[^}]*secret/i, name: 'dotenv-secret', type: 'secret' },
  
  // Database connectors (direct implementation)
  { pattern: /new\s+(?:MongoClient|Client|Pool)\s*\(/, name: 'db-client', type: 'connector' },
  { pattern: /connect\s*\(\s*process\.env\./, name: 'db-connect-env', type: 'connector' },
  
  // HTTP clients for direct API calls (potential connector)
  { pattern: /axios\.[getpostputdelete]+\s*\(\s*['"]https?:/, name: 'axios-direct', type: 'connector' },
  { pattern: /fetch\s*\(\s*['"]https?:/, name: 'fetch-direct', type: 'connector' },
];

/**
 * Audit a repository for runnerless compliance
 * @param repoPath - Path to repository
 * @returns Audit result
 */
export async function auditRunnerless(repoPath: string): Promise<AuditResult> {
  const timestamp = new Date().toISOString();
  const violations: Violation[] = [];
  const warnings: Violation[] = [];
  let filesAnalyzed = 0;
  
  // Check 1: Verify package.json exists
  const hasPackageJson = await checkFileExists(join(repoPath, 'package.json'));
  
  // Check 2: Verify it's an autopilot module
  const isAutopilotModule = hasPackageJson && await checkIsAutopilotModule(repoPath);
  
  // Check 3: Scan source files for forbidden patterns
  if (hasPackageJson) {
    const sourceFiles = await glob('**/*.{ts,js,mjs}', {
      cwd: repoPath,
      ignore: ['node_modules/**', 'dist/**', 'coverage/**', 'tests/**', '**/*.test.{ts,js}'],
    });
    
    for (const file of sourceFiles) {
      const fullPath = join(repoPath, file);
      const content = await readFile(fullPath, 'utf-8');
      filesAnalyzed++;
      
      for (const { pattern, name, type } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          // Check if it's in an example or test file
          const isExample = file.includes('example') || file.includes('demo');
          const isTest = file.includes('test') || file.includes('spec');
          
          if (isExample || isTest) {
            warnings.push({
              rule: `forbidden-${type}`,
              severity: 'warning',
              message: `Found ${name} in ${isExample ? 'example' : 'test'} file - ensure this is not production code`,
              file,
            });
          } else {
            violations.push({
              rule: `forbidden-${type}`,
              severity: 'error',
              message: `Found ${name} - runnerless modules cannot use ${type} libraries`,
              file,
            });
          }
        }
      }
    }
  }
  
  // Check 4: Verify CLI entrypoint exists
  const hasCli = await checkFileExists(join(repoPath, 'src', 'cli.ts'));
  
  // Check 5: Verify contracts directory exists
  const hasContracts = await checkDirectoryExists(join(repoPath, 'src', 'contracts'));
  
  // Check 6: Verify jobforge directory exists
  const hasJobforge = await checkDirectoryExists(join(repoPath, 'src', 'jobforge'));
  
  // Check 7: Verify profiles directory exists
  const hasProfiles = await checkDirectoryExists(join(repoPath, 'src', 'profiles'));
  
  // Build check results
  const checks: CheckResult[] = [
    { name: 'package.json exists', passed: hasPackageJson },
    { name: 'Is autopilot module', passed: isAutopilotModule },
    { name: 'No forbidden libraries', passed: violations.filter((v) => v.severity === 'error').length === 0, details: `${filesAnalyzed} files analyzed` },
    { name: 'CLI entrypoint exists', passed: hasCli },
    { name: 'Contracts directory exists', passed: hasContracts },
    { name: 'JobForge directory exists', passed: hasJobforge },
    { name: 'Profiles directory exists', passed: hasProfiles },
  ];
  
  const passed = violations.filter((v) => v.severity === 'error').length === 0;
  
  return {
    repoPath,
    timestamp,
    passed,
    checks,
    errors: violations.filter((v) => v.severity === 'error'),
    warnings: [...warnings, ...violations.filter((v) => v.severity === 'warning')],
    filesAnalyzed,
  };
}

/**
 * Check if file exists
 */
async function checkFileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if directory exists
 */
async function checkDirectoryExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if directory is an autopilot module
 */
async function checkIsAutopilotModule(repoPath: string): Promise<boolean> {
  try {
    const packageJson = JSON.parse(await readFile(join(repoPath, 'package.json'), 'utf-8'));
    const name = packageJson.name || '';
    return name.includes('-autopilot') || name.includes('@autopilot/');
  } catch {
    return false;
  }
}