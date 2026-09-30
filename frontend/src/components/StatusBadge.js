// --- src/components/StatusBadge.js -------------------------------------------
// One place that decides how a status looks and what it is called, so the same
// word always carries the same colour across the whole portal.
import React from 'react';

const TONES = {
  neutral: 'is-neutral',
  info: 'is-info',
  warn: 'is-warn',
  success: 'is-success',
  danger: 'is-danger',
};

// TRF / submission review states.
export const TRF_STATUS = {
  pending: { label: 'Pending Review', tone: 'warn', tip: 'Waiting for the supervisor to read and decide.' },
  approved: { label: 'Approved', tone: 'success', tip: 'The supervisor accepted this Title Registration Form.' },
  revision: { label: 'Needs Revision', tone: 'danger', tip: 'The supervisor asked for changes before approval.' },
  'not-submitted': { label: 'Not Submitted', tone: 'neutral', tip: 'No Title Registration Form has been submitted yet.' },
};

// Milestone entry states.
export const MILESTONE_STATUS = {
  approved: { label: 'Approved', tone: 'success', tip: 'This milestone has been verified.' },
  pending: { label: 'Not verified', tone: 'neutral', tip: 'Not verified yet — score it and press Approve.' },
};

// Marking record states coming from the PHP marks service.
export const MARK_STATUS = {
  submitted: { label: 'Marks submitted', tone: 'success', tip: 'Final marks were submitted by the lecturer.' },
  draft: { label: 'Draft saved', tone: 'info', tip: 'Marks were saved but not submitted yet.' },
  'not graded': { label: 'Not graded yet', tone: 'neutral', tip: 'No marks have been entered for this student.' },
};

// Student result states used in the course report.
export const RESULT_STATUS = {
  pass: { label: 'Pass', tone: 'success', tip: 'Total marks are 40 or above.' },
  fail: { label: 'Fail', tone: 'danger', tip: 'Total marks are below the pass mark of 40.' },
  i: { label: 'I', tone: 'warn', tip: 'Incomplete — work or marks are still outstanding.' },
  xa: { label: 'XA', tone: 'warn', tip: 'Absent from assessment without a valid reason.' },
  xb: { label: 'XB', tone: 'warn', tip: 'Absent with a valid reason; a re-assessment is required.' },
  xm: { label: 'XM', tone: 'warn', tip: 'Medical or other approved deferment.' },
  w: { label: 'W', tone: 'neutral', tip: 'Withdrawn from the course.' },
};

function lookup(map, status) {
  if (!status) return null;
  const key = String(status).trim().toLowerCase().replace(/\s+/g, '-');
  return map[key] || map[String(status).trim().toLowerCase()] || null;
}

/**
 * <StatusBadge status="pending" kind="trf" />
 * Falls back to showing the raw status in a neutral pill when unknown, so a new
 * backend status never renders as an empty cell.
 */
export function StatusBadge({ status, kind = 'trf', showDot = true }) {
  const map = kind === 'milestone' ? MILESTONE_STATUS
    : kind === 'mark' ? MARK_STATUS
    : kind === 'result' ? RESULT_STATUS
    : TRF_STATUS;

  const match = lookup(map, status);
  const label = match?.label || formatFallback(status);
  if (!label) return <span className="ui-badge is-neutral">—</span>;

  return (
    <span className={`ui-badge ${TONES[match?.tone] || 'is-neutral'}`}>
      {showDot && <span className="ui-badge-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

function formatFallback(status) {
  if (status === null || status === undefined || status === '') return '';
  return String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default StatusBadge;
