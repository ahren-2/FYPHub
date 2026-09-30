// --- src/components/Feedback.js ----------------------------------------------
// Callout, Legend, EmptyState, Meter and StepTrail — the small pieces of
// "explain what you are looking at" that most pages need.
import React from 'react';

const CALLOUT_ICONS = {
  info: 'ℹ',
  success: '✓',
  warn: '!',
  danger: '!',
  next: '→',
  plain: '•',
};

/**
 * An inline notice. Use sparingly — one per page is usually enough.
 * <Callout tone="next" title="What to do next">Submit your TRF.</Callout>
 */
export function Callout({ tone = 'info', title, children, icon, className = '' }) {
  return (
    <div className={`ui-callout is-${tone} ${className}`.trim()} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="ui-callout-icon" aria-hidden="true">{icon || CALLOUT_ICONS[tone] || '•'}</span>
      <div className="ui-callout-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/**
 * Colour key for tables and grids that use colour to mean something.
 * <Legend title="Slot colours" items={[{ colour:'#fff', label:'Available' }]} />
 */
export function Legend({ title = 'Legend', items = [], className = '' }) {
  if (!items.length) return null;

  return (
    <div className={`ui-legend ${className}`.trim()}>
      <span className="ui-legend-title">{title}</span>
      {items.map((item) => (
        <span className="ui-legend-item" key={item.label}>
          <span
            className="ui-legend-swatch"
            style={{ backgroundColor: item.colour || '#fff', borderStyle: item.dashed ? 'dashed' : 'solid' }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Friendly "nothing here yet" panel, with an optional next action.
 */
export function EmptyState({ icon = '📭', title, message, children }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon" aria-hidden="true">{icon}</span>
      {title && <strong>{title}</strong>}
      {message && <p>{message}</p>}
      {children && <div className="ui-empty-action">{children}</div>}
    </div>
  );
}

/**
 * Thin progress meter, e.g. quota usage or milestone completion.
 */
export function Meter({ value = 0, max = 100, label, tone }) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const resolvedTone = tone || (percent >= 100 ? 'is-danger' : percent >= 75 ? 'is-warn' : 'is-success');

  return (
    <div className="ui-meter-row">
      <div className="ui-meter" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`ui-meter-fill ${resolvedTone}`} style={{ width: `${percent}%` }} />
      </div>
      {label && <span className="ui-meter-label">{label}</span>}
    </div>
  );
}

/**
 * Process indicator: shows where the user is in a multi-step flow.
 * <StepTrail steps={['Fill in TRF', 'Supervisor review', 'Outcome']} current={0} />
 * Pass current={-1} to mark every step as plain (no active step).
 */
export function StepTrail({ steps = [], current = 0, title }) {
  if (!steps.length) return null;

  return (
    <div className="ui-steps" role="list" aria-label={title || 'Progress through this process'}>
      {steps.map((step, index) => {
        const state = index < current ? 'is-done' : index === current ? 'is-current' : '';
        return (
          <React.Fragment key={step}>
            {index > 0 && <span className="ui-step-sep" aria-hidden="true">›</span>}
            <span className={`ui-step ${state}`.trim()} role="listitem">
              <span className="ui-step-index" aria-hidden="true">{index < current ? '✓' : index + 1}</span>
              {step}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default Callout;
