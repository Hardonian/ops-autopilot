export { 
  createSEOScanJob, 
  createExperimentJob, 
  createContentDraftJob,
  serializeJobRequest,
  batchJobRequests,
  validateJobRequest,
  createMockJobResponse,
  type JobForgeConfig,
  type JobForgeRequestOptions
} from './client.js';

export {
  analyze,
  renderReport,
  serializeBundle,
  serializeReport,
  validateBundle,
  validateReportBundle,
  writeReportMarkdown,
} from './integration.js';
