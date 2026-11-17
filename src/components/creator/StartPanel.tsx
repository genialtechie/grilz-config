import { forwardRef, useRef, type MutableRefObject } from 'react';
import { Composer } from './Composer';
import { SetPicture } from './SetPicture';
import { useGrab } from './useGrab';
import type { Build } from './model';

export const AI_FREE = 3;

type Props = {
  builds: { build: Build; price: string }[];
  /** The build last tapped (it shows as picked). */
  picked: string | null;
  /** A build is waiting (one in progress, or kept on this device). */
  waiting: string | null;
  big: boolean;
  setBig: (big: boolean) => void;
  aiText: string;
  aiPicture: string | null;
  onAiText: (text: string) => void;
  onAiPicture: (file: File | null) => void;
  onAiSend: () => void;
  onBuild: (id: string) => void;
  onEmpty: () => void;
  onContinue: () => void;
};

/**
 * The start page (lab v15): "Start your build" with its builds (Build it yourself first), then "or let AI
 * build it" and one field, "Describe your grillz or upload inspiration", with a camera inside it.
 * A build waiting comes back as "Your build is waiting" with Continue your build on top.
 * The handle grows the panel to show every build.
 */
export const StartPanel = forwardRef<HTMLDivElement, Props>(function StartPanel(props, ref) {
  const { builds, picked, waiting, big, setBig } = props;
  const own = useRef<HTMLDivElement | null>(null);
  const grab = useGrab(own, big, setBig, '.grab', '.head');
  const setRefs = (el: HTMLDivElement | null) => {
    own.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = el;
  };
  return (
    <div className={big ? 'openA big' : 'openA'} ref={setRefs} role="region" aria-label="Start your build" onPointerDown={grab.onPointerDown}>
      <button
        type="button"
        className="grab"
        aria-label={big ? 'Show less' : 'Show all builds'}
        aria-expanded={big}
        // Pointer taps toggle in useGrab; this is for the keyboard.
        onClick={(event) => {
          if (event.detail === 0) grab.resize(!big);
        }}
      >
        <i />
      </button>
      <div className="head">
        <h2>{waiting ? 'Your build is waiting' : 'Start your build'}</h2>
        <span>{waiting ?? 'Tap a build and change anything, or build it yourself.'}</span>
      </div>
      {waiting && (
        <button type="button" className="cta" onClick={props.onContinue}>
          Continue your build
        </button>
      )}
      <div className="builds" role="group" aria-label="Starting builds">
        <button type="button" className="build empty" onClick={props.onEmpty}>
          <span className="pic">
            <i>+</i>
          </span>
          <b>Build it yourself</b>
          <span>Pick every tooth</span>
        </button>
        {builds.map(({ build, price }) => (
          <button type="button" className="build" key={build.id} aria-pressed={picked === build.id} onClick={() => props.onBuild(build.id)}>
            <span className="pic">
              <SetPicture {...build.picture} />
            </span>
            <b>{build.label}</b>
            <span>{price}</span>
          </button>
        ))}
      </div>
      <p className="or">or let AI build it</p>
      <Composer
        id="doortext"
        placeholder="Describe your grillz or upload inspiration"
        text={props.aiText}
        picture={props.aiPicture}
        onText={props.onAiText}
        onPicture={props.onAiPicture}
        onSend={props.onAiSend}
      />
      <p className="cnote">{AI_FREE} free AI builds per phone. We text you a code first.</p>
    </div>
  );
});
