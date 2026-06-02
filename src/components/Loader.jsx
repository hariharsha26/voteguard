import { useEffect, useRef } from 'react';

/**
 * Full-screen loader replicating the landing page's async animation sequence.
 * Phases: shapes appear → clockwise pulse → messages → lock → brand → progress → fade out.
 *
 * @param {{ onComplete: () => void }} props
 */
export default function Loader({ onComplete }) {
  const loaderRef = useRef(null);

  useEffect(() => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));

    const shapes = ['ls1', 'ls2', 'ls3', 'ls4'];
    const msgs = [
      'Initializing Security Layer...',
      'Loading Audit Engine...',
      'Verifying Election Integrity...',
      'Synchronizing Governance Modules...',
      'Preparing Voting Infrastructure...',
      'System Ready.',
    ];

    async function go() {
      const loader = loaderRef.current;
      if (!loader) return;
      const msg = loader.querySelector('#ld-msg');
      const brand = loader.querySelector('#ld-brand');
      const bwrap = loader.querySelector('#ld-bar-wrap');
      const bar = loader.querySelector('#ld-bar');

      // Phase 1: shapes appear
      for (let i = 0; i < shapes.length; i++) {
        await T(i === 0 ? 80 : 120);
        const el = loader.querySelector(`#${shapes[i]}`);
        if (el) el.classList.add('vis');
      }

      // Phase 2: clockwise pulse x1
      const order = [0, 1, 3, 2];
      for (const si of order) {
        await T(120);
        shapes.forEach((id) => {
          const el = loader.querySelector(`#${id}`);
          if (el) el.classList.remove('hi');
        });
        const el = loader.querySelector(`#${shapes[si]}`);
        if (el) el.classList.add('hi');
      }
      await T(120);
      shapes.forEach((id) => {
        const el = loader.querySelector(`#${id}`);
        if (el) el.classList.remove('hi');
      });
      await T(80);

      // Phase 3: messages (3 only, fast — every other message)
      const fastMsgs = msgs.filter((_, i) => i % 2 === 0);
      for (let i = 0; i < fastMsgs.length; i++) {
        if (msg) {
          msg.classList.remove('vis');
          await T(50);
          msg.textContent = fastMsgs[i];
          msg.classList.add('vis');
          await T(260);
        }
      }

      // Phase 4: lock
      shapes.forEach((id) => {
        const el = loader.querySelector(`#${id}`);
        if (el) {
          el.classList.remove('vis', 'hi');
          el.classList.add('lk');
        }
      });
      await T(150);

      // Phase 5: brand reveal
      if (brand) brand.classList.add('vis');
      await T(350);

      // Phase 6: progress bar
      if (bwrap) bwrap.classList.add('vis');
      let prog = 0;
      const TOTAL = 600;
      const STEP = 20;
      const inc = 100 / (TOTAL / STEP);
      while (prog < 100) {
        prog = Math.min(100, prog + inc);
        if (bar) {
          bar.style.width = prog.toFixed(1) + '%';
          if (prog >= 99.9) bar.classList.add('done');
        }
        await T(STEP);
      }
      await T(200);

      // Phase 7: Fade out
      if (loader) loader.classList.add('done');
      document.body.classList.remove('loading');

      setTimeout(() => {
        onComplete?.();
      }, 900);
    }

    document.body.classList.add('loading');
    go();
  }, [onComplete]);

  return (
    <div id="loader" ref={loaderRef}>
      <div className="ld-grid">
        <div className="ld-shape" id="ls1">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <rect x="3" y="3" width="40" height="40" rx="10" fill="none" stroke="#d0cec8" strokeWidth="2" />
          </svg>
        </div>
        <div className="ld-shape" id="ls2">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="19" fill="none" stroke="#d0cec8" strokeWidth="2" />
          </svg>
        </div>
        <div className="ld-shape" id="ls3">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <polygon points="23,5 43,41 3,41" fill="none" stroke="#d0cec8" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="ld-shape" id="ls4">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <rect x="3" y="3" width="40" height="40" rx="10" fill="none" stroke="#d0cec8" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="ld-brand" id="ld-brand">
        <div className="ld-wordmark">VoteGuard</div>
        <div className="ld-tag">Secure Election Governance Platform</div>
      </div>
      <div className="ld-msg" id="ld-msg">Initializing Security Layer...</div>
      <div className="ld-bar-wrap" id="ld-bar-wrap">
        <div className="ld-bar" id="ld-bar"></div>
      </div>
    </div>
  );
}
