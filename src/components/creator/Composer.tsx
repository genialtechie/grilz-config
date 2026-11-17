import { useLayoutEffect, useRef, type ChangeEvent } from 'react';
import { Ico } from './icons';

/** Most lines the field grows to before it scrolls (about five). */
const MAX_HEIGHT = 132;

/**
 * The composer (lab v15): one field for talking to the AI, a camera inside it, and a send button that wakes
 * when there's something to send. The same piece on the start page and at the foot of the AI conversation.
 */
export function Composer({
  id,
  placeholder,
  text,
  picture,
  busy,
  onText,
  onPicture,
  onSend,
}: {
  id: string;
  placeholder: string;
  text: string;
  picture: string | null;
  busy?: boolean;
  onText: (text: string) => void;
  onPicture: (file: File | null) => void;
  onSend: () => void;
}) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  // The field grows with its text, up to about five lines.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    else el.style.height = '';
  }, [text]);
  const has = Boolean(text.trim() || picture);
  return (
    <div className="composer">
      {picture && (
        <span className="cpic">
          <img alt="Your picture" src={picture} />
          <button type="button" className="cx" aria-label="Remove the picture" onClick={() => onPicture(null)}>
            ×
          </button>
        </span>
      )}
      <textarea
        ref={field}
        id={id}
        rows={1}
        maxLength={300}
        placeholder={placeholder}
        aria-label={placeholder}
        value={text}
        onChange={(event) => onText(event.target.value.slice(0, 300))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (has && !busy) onSend();
          }
        }}
      />
      <div className="crow">
        <label className="cam" title="Add a photo or a screenshot">
          <Ico name="cam" />
          <span className="sr">Add a photo or a screenshot</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onPicture(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </label>
        <button type="button" className="send" disabled={!has || busy} aria-label="Build it with AI" onClick={onSend}>
          <Ico name="spark" />
        </button>
      </div>
    </div>
  );
}
