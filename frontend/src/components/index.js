// --- src/components/index.js -------------------------------------------------
// Barrel file so pages can import several helpers in one line:
//   import { Term, Callout, EmptyState } from '../components';
export { default as Term } from './Term';
export { default as StatusBadge, TRF_STATUS, MILESTONE_STATUS, MARK_STATUS, RESULT_STATUS } from './StatusBadge';
export { Callout, Legend, EmptyState, Meter, StepTrail } from './Feedback';
export { default as HelpCenter } from './HelpCenter';
export { PAGE_GUIDE, GLOSSARY } from './pageGuide';
