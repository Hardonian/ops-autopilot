import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { analyze, serializeBundle, serializeReport, writeReportMarkdown } from '../dist/jobforge/integration.js';

const outputDir = 'fixtures/jobforge';
const inputPath = 'fixtures/jobforge/input.json';

const input = JSON.parse(readFileSync(inputPath, 'utf-8'));
const result = analyze(input, { stableOutput: true });

mkdirSync(outputDir, { recursive: true });

writeFileSync(`${outputDir}/request-bundle.json`, serializeBundle(result.jobRequestBundle));
writeFileSync(`${outputDir}/report.json`, serializeReport(result.reportEnvelope));
writeFileSync(`${outputDir}/report.md`, writeReportMarkdown(result.reportEnvelope));

console.log('fixtures:export complete');
