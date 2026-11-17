// PLACEHOLDER from the builder track (Nov 17), so the builder runs on its own. The after track owns this
// file: its real AfterFlow (Your grill → phone + code → Sent) replaces this one when the tracks merge.
import type { AfterFlowProps } from '../contract';

export function AfterFlow({ design, onKeepEditing, onStartOver }: AfterFlowProps) {
  return (
    <>
      <div className="thead">
        <h2>Here are your grillz</h2>
      </div>
      <div className="tbody flow">
        <p className="intro">{design.summary}</p>
        <p className="note">About ${design.total.toLocaleString('en-US')}{design.deposit !== null ? ` · deposit $${design.deposit.toLocaleString('en-US')}` : ''}</p>
        <p className="note">Sending it to the shop comes next (built by the after track).</p>
      </div>
      <div className="tfoot col">
        <div className="btns">
          <button type="button" className="cta ghost second" onClick={onStartOver}>
            Start over
          </button>
          <button type="button" className="cta" onClick={onKeepEditing}>
            Keep editing
          </button>
        </div>
      </div>
    </>
  );
}

export default AfterFlow;
