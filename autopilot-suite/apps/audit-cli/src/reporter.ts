import type { AuditResult } from './auditor.js';

/**
 * Generate audit report in specified format
 * @param result - Audit result
 * @param format - Output format
 * @returns Formatted report string
 */
export function generateReport(result: AuditResult, format: 'json' | 'text'): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }
  
  return generateTextReport(result);
}

/**
 * Generate text report
 * @param result - Audit result
 * @returns Text report
 */
function generateTextReport(result: AuditResult): string {
  const lines: string[] = [];
  
  lines.push('╔════════════════════════════════════════════════════════╗');
  lines.push('║     AUTOPILOT RUNNERLESS COMPLIANCE AUDIT REPORT       ║');
  lines.push('╚════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Repository: ${result.repoPath}`);
  lines.push(`Timestamp:  ${result.timestamp}`);
  lines.push(`Status:     ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('');
  lines.push('──────────────────────────────────────────────────────────');
  lines.push('CHECKS');
  lines.push('──────────────────────────────────────────────────────────');
  
  for (const check of result.checks) {
    const icon = check.passed ? '✓' : '✗';
    lines.push(`${icon} ${check.name}`);
    if (check.details) {
      lines.push(`  ${check.details}`);
    }
  }
  
  lines.push('');
  lines.push('──────────────────────────────────────────────────────────');
  lines.push('SUMMARY');
  lines.push('──────────────────────────────────────────────────────────');
  lines.push(`Files analyzed: ${result.filesAnalyzed}`);
  lines.push(`Checks passed:  ${result.checks.filter((c) => c.passed).length}/${result.checks.length}`);
  lines.push(`Errors:         ${result.errors.length}`);
  lines.push(`Warnings:       ${result.warnings.length}`);
  
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('──────────────────────────────────────────────────────────');
    lines.push('ERRORS');
    lines.push('──────────────────────────────────────────────────────────');
    for (const error of result.errors) {
      lines.push(`✗ ${error.rule}`);
      lines.push(`  ${error.message}`);
      if (error.file) {
        lines.push(`  File: ${error.file}`);
      }
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('──────────────────────────────────────────────────────────');
    lines.push('WARNINGS');
    lines.push('──────────────────────────────────────────────────────────');
    for (const warning of result.warnings) {
      lines.push(`⚠ ${warning.rule}`);
      lines.push(`  ${warning.message}`);
      if (warning.file) {
        lines.push(`  File: ${warning.file}`);
      }
    }
  }
  
  lines.push('');
  lines.push('══════════════════════════════════════════════════════════');
  lines.push(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
  lines.push('══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}