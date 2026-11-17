import { forwardRef } from 'react';
import type { QuestionId } from './guide';

export type Bubble =
  | { kind: 'question'; q: QuestionId; title: string; answers: { id: string; label: string; more?: boolean }[] }
  | { kind: 'undo'; who: string; text: string };

/**
 * The guide's bubble: a quick question when someone seems stuck, or what just changed with Undo
 * (answering a question, or the AI building). Undoing an answer brings its question back.
 */
export const QuickQuestion = forwardRef<HTMLDivElement, { bubble: Bubble; onAnswer: (id: string) => void; onClose: () => void; onUndo: () => void }>(
  function QuickQuestion({ bubble, onAnswer, onClose, onUndo }, ref) {
    return (
      <div className="bubble" ref={ref} role={bubble.kind === 'question' ? 'dialog' : 'status'} aria-label={bubble.kind === 'question' ? 'Quick question' : bubble.who}>
        <div className="who">
          <i />
          {bubble.kind === 'question' ? 'Quick question' : bubble.who}
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {bubble.kind === 'question' ? (
          <>
            <p>{bubble.title}</p>
            <div className="chips">
              {bubble.answers.map((a) => (
                <button type="button" key={a.id} className={a.more ? 'chip more' : 'chip'} onClick={() => onAnswer(a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="undo">
            <p>{bubble.text}</p>
            <button type="button" className="chip" onClick={onUndo}>
              Undo
            </button>
          </div>
        )}
      </div>
    );
  },
);
