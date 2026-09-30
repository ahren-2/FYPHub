// --- src/components/Term.js ---------------------------------------------------
// A word a reader may not know is dotted-underlined; hovering or focusing it
// explains the word in place, so jargon never needs a paragraph of its own.
//
//   <Term tip="Title Registration Form">TRF</Term>
//
// The bubble is CSS-driven: it stays out of the way until the user asks for it.
import React from 'react';

export function Term({ children, tip, wide = false }) {
  if (!tip) return <>{children}</>;

  return (
    <span className={`ui-tip${wide ? ' is-wide' : ''}`} tabIndex={0} role="note" aria-label={tip}>
      <span className="ui-term">{children}</span>
      <span className="ui-tip-bubble" role="tooltip">{tip}</span>
    </span>
  );
}

export default Term;
