#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { auditRunnerless } from './auditor.js';
import { generateReport } from './reporter.js';

const program = new Command();

program
  .name('autopilot-suite')
  .description('Autopilot Suite CLI - coordinate and validate autopilot modules')
  .version('0.1.0');

program
  .command('audit-runnerless')
  .description('Audit a module repo for runnerless compliance')
  .argument('<path>', 'Path to module repository')
  .option('-o, --output <file>', 'Output file for report (JSON)')
  .option('-f, --format <format>', 'Output format (text|json)', 'text')
  .option('-s, --strict', 'Fail on warnings as well as errors', false)
  .action(async (repoPath, options) => {
    try {
      console.log(chalk.blue('🔍 Running runnerless audit...'));
      console.log(chalk.gray(`   Path: ${repoPath}`));
      
      const result = await auditRunnerless(repoPath);
      
      if (options.format === 'json') {
        const report = generateReport(result, 'json');
        if (options.output) {
          await Bun.write(options.output, report);
          console.log(chalk.green(`✓ Report saved to ${options.output}`));
        } else {
          console.log(report);
        }
      } else {
        printTextReport(result);
        
        if (options.output) {
          const jsonReport = generateReport(result, 'json');
          await Bun.write(options.output, jsonReport);
          console.log(chalk.green(`✓ JSON report saved to ${options.output}`));
        }
      }
      
      const hasErrors = result.errors.length > 0;
      const hasWarnings = result.warnings.length > 0;
      
      if (hasErrors || (options.strict && hasWarnings)) {
        process.exit(1);
      }
      
      console.log(chalk.green('\n✓ All runnerless compliance checks passed'));
    } catch (error) {
      console.error(chalk.red(`\n✗ Audit failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('autopilot-suite v0.1.0');
    console.log('Packages:');
    console.log('  @autopilot/contracts v0.1.0');
    console.log('  @autopilot/jobforge-client v0.1.0');
    console.log('  @autopilot/profiles v0.1.0');
  });

function printTextReport(result: Awaited<ReturnType<typeof auditRunnerless>>): void {
  console.log(chalk.blue('\n📋 Audit Results'));
  console.log(chalk.gray(`   Repository: ${result.repoPath}`));
  console.log(chalk.gray(`   Timestamp: ${result.timestamp}`));
  console.log();
  
  // Summary
  const totalChecks = result.checks.length;
  const passedChecks = result.checks.filter((c) => c.passed).length;
  const failedChecks = totalChecks - passedChecks;
  
  console.log(chalk.cyan('Summary:'));
  console.log(`  Total checks: ${totalChecks}`);
  console.log(chalk.green(`  Passed: ${passedChecks}`));
  console.log(chalk.red(`  Failed: ${failedChecks}`));
  console.log(chalk.yellow(`  Warnings: ${result.warnings.length}`));
  console.log();
  
  // Check details
  console.log(chalk.cyan('Checks:'));
  for (const check of result.checks) {
    const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
    const name = check.passed ? check.name : chalk.bold(check.name);
    console.log(`  ${icon} ${name}`);
    if (!check.passed && check.details) {
      console.log(chalk.gray(`      ${check.details}`));
    }
  }
  
  // Errors
  if (result.errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  ✗ ${error.rule}: ${error.message}`));
      if (error.file) {
        console.log(chalk.gray(`      File: ${error.file}`));
      }
    }
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning.rule}: ${warning.message}`));
      if (warning.file) {
        console.log(chalk.gray(`      File: ${warning.file}`));
      }
    }
  }
}

program.parse();