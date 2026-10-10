import { useMemo } from 'react';
import type { MovementPattern } from '../types';

type P = [number, number];
interface Pose { head: P; neck: P; hip: P; knee: P; foot: P; elbow: P; hand: P; knee2?: P; foot2?: P }
interface Anim { a: Pose; b: Pose; mirrorArms?: boolean; dur?: number; prop?: 'bench' | 'seat' | 'bar' | 'plank' }

const stand = { head: [50, 18], neck: [50, 27], hip: [50, 55], knee: [50, 73], foot: [50, 91] } as const;
const S = (o: Partial<Pose>): Pose => ({ ...(stand as unknown as Pose), elbow: [52, 41], hand: [52, 55], ...o });

// Simplified side/front poses per movement pattern (start → end), in a 100×100 box.
const ANIMS: Record<MovementPattern, Anim> = {
  squat: { a: S({ elbow: [58, 32], hand: [54, 25] }), b: { head: [44, 37], neck: [44, 45], hip: [34, 66], knee: [58, 70], foot: [50, 91], elbow: [51, 50], hand: [48, 43] }, prop: 'bar' },
  hinge: { a: S({ elbow: [51, 41], hand: [52, 56] }), b: { head: [77, 41], neck: [70, 44], hip: [47, 53], knee: [53, 72], foot: [50, 91], elbow: [68, 58], hand: [67, 71] }, prop: 'bar' },
  lunge: { a: S({ knee2: [50, 73], foot2: [50, 91] }), b: { head: [48, 30], neck: [48, 39], hip: [48, 64], knee: [64, 72], foot: [66, 91], knee2: [38, 86], foot2: [26, 91], elbow: [50, 52], hand: [50, 64] } },
  pushH: { a: { head: [18, 57], neck: [26, 59], hip: [60, 61], knee: [76, 58], foot: [82, 91], elbow: [28, 44], hand: [28, 30] }, b: { head: [18, 57], neck: [26, 59], hip: [60, 61], knee: [76, 58], foot: [82, 91], elbow: [38, 66], hand: [30, 50] }, prop: 'bench' },
  pushV: { a: S({ elbow: [58, 38], hand: [55, 27] }), b: S({ elbow: [55, 17], hand: [53, 5] }), prop: 'bar' },
  pullV: { a: { head: [48, 32], neck: [48, 40], hip: [48, 68], knee: [66, 68], foot: [66, 91], elbow: [54, 22], hand: [56, 8] }, b: { head: [48, 32], neck: [48, 40], hip: [48, 68], knee: [66, 68], foot: [66, 91], elbow: [60, 52], hand: [57, 37] }, prop: 'seat' },
  pullH: { a: { head: [42, 36], neck: [42, 44], hip: [40, 72], knee: [60, 64], foot: [78, 76], elbow: [57, 54], hand: [74, 58] }, b: { head: [38, 36], neck: [39, 44], hip: [40, 72], knee: [60, 64], foot: [78, 76], elbow: [26, 57], hand: [44, 60] }, prop: 'seat' },
  curl: { a: S({ elbow: [51, 42], hand: [53, 58] }), b: S({ elbow: [51, 42], hand: [57, 30] }) },
  extension: { a: S({ elbow: [53, 42], hand: [63, 34] }), b: S({ elbow: [53, 42], hand: [56, 59] }) },
  raise: { a: S({ elbow: [45, 42], hand: [44, 56] }), b: S({ elbow: [35, 32], hand: [24, 31] }), mirrorArms: true },
  fly: { a: S({ elbow: [33, 33], hand: [20, 32] }), b: S({ elbow: [43, 35], hand: [48, 38] }), mirrorArms: true },
  core: { a: { head: [17, 60], neck: [25, 62], hip: [55, 63], knee: [70, 65], foot: [86, 70], elbow: [27, 76], hand: [36, 76] }, b: { head: [17, 59], neck: [25, 61], hip: [54, 55], knee: [70, 63], foot: [86, 70], elbow: [27, 76], hand: [36, 76] }, prop: 'plank' },
  calf: { a: S({}), b: { head: [50, 13], neck: [50, 22], hip: [50, 50], knee: [50, 68], foot: [50, 87], elbow: [52, 36], hand: [52, 50] } },
  legMachine: { a: { head: [40, 26], neck: [42, 34], hip: [44, 62], knee: [62, 62], foot: [63, 88], elbow: [44, 48], hand: [50, 62] }, b: { head: [40, 26], neck: [42, 34], hip: [44, 62], knee: [62, 62], foot: [82, 58], elbow: [44, 48], hand: [50, 62] }, prop: 'seat' },
  cardio: { a: S({ knee: [58, 70], foot: [52, 90], elbow: [57, 38], hand: [63, 46], knee2: [44, 72], foot2: [38, 88] }), b: S({ knee: [44, 72], foot: [38, 88], elbow: [43, 38], hand: [39, 47], knee2: [58, 70], foot2: [52, 90] }), dur: 0.8 }
};

const mirror = (p: P): P => [100 - p[0], p[1]];

function reducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

/** Animated SVG stick figure illustrating a movement pattern (inspired by GymApp's exercise art). */
export function ExerciseFigure({ pattern, size = 'md', animate = true, label }: { pattern: MovementPattern; size?: 'sm' | 'md' | 'lg'; animate?: boolean; label?: string }) {
  const anim = ANIMS[pattern] ?? ANIMS.curl;
  const still = !animate || reducedMotion();
  const dur = `${anim.dur ?? 2.2}s`;
  const segs = useMemo(() => {
    const out: { k: string; a: [P, P]; b: [P, P]; w: number; accent?: boolean; faint?: boolean }[] = [];
    const add = (k: string, f: keyof Pose, t: keyof Pose, w = 5, extra: { faint?: boolean } = {}) => {
      const a1 = anim.a[f], a2 = anim.a[t], b1 = anim.b[f] ?? a1, b2 = anim.b[t] ?? a2;
      if (a1 && a2) out.push({ k, a: [a1, a2], b: [b1!, b2!], w, ...extra });
    };
    if (anim.a.knee2) { add('t2', 'hip', 'knee2', 5, { faint: true }); add('s2', 'knee2', 'foot2', 5, { faint: true }); }
    add('torso', 'neck', 'hip', 6);
    add('thigh', 'hip', 'knee');
    add('shin', 'knee', 'foot');
    add('upper', 'neck', 'elbow', 4.5);
    add('fore', 'elbow', 'hand', 4.5);
    if (anim.mirrorArms) {
      out.push({ k: 'upperM', a: [mirror(anim.a.neck), mirror(anim.a.elbow)], b: [mirror(anim.b.neck), mirror(anim.b.elbow)], w: 4.5 });
      out.push({ k: 'foreM', a: [mirror(anim.a.elbow), mirror(anim.a.hand)], b: [mirror(anim.b.elbow), mirror(anim.b.hand)], w: 4.5 });
    }
    return out;
  }, [anim]);
  const dim = size === 'sm' ? 'h-16 w-16' : size === 'lg' ? 'h-56 w-full' : 'h-28 w-28';
  const v = (a: number, b: number) => `${a};${b};${a}`;
  const handA = anim.a.hand, handB = anim.b.hand;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-navy-900 ${dim}`} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <line x1="6" y1="93" x2="94" y2="93" stroke="#243a5e" strokeWidth="2" strokeLinecap="round" />
        {anim.prop === 'bench' && <rect x="14" y="64" width="56" height="5" rx="2" fill="#243a5e" />}
        {anim.prop === 'seat' && <rect x={(anim.a.hip[0] - 12)} y={anim.a.hip[1] + 3} width="24" height="5" rx="2" fill="#243a5e" />}
        {segs.map((s) => (
          <line key={s.k} x1={s.a[0][0]} y1={s.a[0][1]} x2={s.a[1][0]} y2={s.a[1][1]} stroke={s.faint ? '#4f6b98' : '#b8c9d4'} strokeWidth={s.w} strokeLinecap="round">
            {!still && <>
              <animate attributeName="x1" values={v(s.a[0][0], s.b[0][0])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
              <animate attributeName="y1" values={v(s.a[0][1], s.b[0][1])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
              <animate attributeName="x2" values={v(s.a[1][0], s.b[1][0])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
              <animate attributeName="y2" values={v(s.a[1][1], s.b[1][1])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
            </>}
          </line>
        ))}
        <circle cx={anim.a.head[0]} cy={anim.a.head[1]} r="6.5" fill="#b8c9d4">
          {!still && <>
            <animate attributeName="cx" values={v(anim.a.head[0], anim.b.head[0])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
            <animate attributeName="cy" values={v(anim.a.head[1], anim.b.head[1])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
          </>}
        </circle>
        {/* Load / hand marker in the accent colour (GymApp style). */}
        <circle cx={handA[0]} cy={handA[1]} r={anim.prop === 'bar' ? 5 : 3.5} fill="#20e0b2">
          {!still && <>
            <animate attributeName="cx" values={v(handA[0], handB[0])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
            <animate attributeName="cy" values={v(handA[1], handB[1])} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1" />
          </>}
        </circle>
      </svg>
    </div>
  );
}
