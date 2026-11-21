import type { ReactNode } from "react";

/**
 * Drawings made for this app (flat shapes, no photos). PLACEHOLDERS: they show the idea of a
 * scene, not a technique. A clinician checks every drawing that shows a baby's position before
 * the real app uses it, and the client may replace them with their own art.
 *
 * `tone` picks one of three skin tones, so the families shown are not all the same.
 * Colors come from the --color-ill-* tokens (design/tokens.css).
 */
export type Scene = "welcome" | "mat" | "chest" | "calm" | "path" | "idea" | "lap";

/** Builds SVG path data from a template with numbers in it. */
function svg(parts: TemplateStringsArray, ...values: number[]): string {
  return parts.reduce(
    (out, part, i) => out + part + (i < values.length ? String(values[i]) : ""),
    "",
  );
}

const skins = ["var(--color-ill-skin-1)", "var(--color-ill-skin-2)", "var(--color-ill-skin-3)"];

function skin(tone: number, shift = 0): string {
  return skins[(tone + shift) % skins.length] ?? "var(--color-ill-skin-2)";
}

function Baby({ x, y, tone, lift = 0 }: { x: number; y: number; tone: number; lift?: number }) {
  // A baby lying on its tummy, facing right. (x, y) is the middle of the body.
  const s = skin(tone);
  return (
    <g>
      <ellipse cx={x - 46} cy={y + 4} rx={15} ry={10} fill="var(--color-ill-cloth)" />
      <ellipse cx={x} cy={y} rx={44} ry={16} fill="var(--color-ill-cloth)" />
      <ellipse cx={x + 40} cy={y + 10} rx={13} ry={5} fill={s} />
      {/* The head, with its hair, eye and mouth: it bobs up a little when motion is allowed,
          the way a baby practises lifting its head (styles.css, .ill-head). */}
      <g className="ill-head">
        <circle cx={x + 56} cy={y - 10 - lift} r={19} fill={s} />
        <path
          d={svg`M${x + 42} ${y - 22 - lift}q8-10 22-6`}
          stroke="var(--color-ill-hair)"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={x + 66} cy={y - 12 - lift} r={2.2} fill="var(--color-ill-hair)" />
        <path
          d={svg`M${x + 63} ${y - 3 - lift}q4 3 8 0`}
          stroke="var(--color-ill-hair)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </g>
  );
}

function Face({
  cx,
  cy,
  r,
  tone,
  look = "left",
  closed = false,
}: {
  cx: number;
  cy: number;
  r: number;
  tone: number;
  look?: "left" | "right" | "front";
  closed?: boolean;
}) {
  const dx = look === "left" ? -r * 0.35 : look === "right" ? r * 0.35 : 0;
  const eyeY = cy - r * 0.05;
  const gap = r * 0.32;
  return (
    <g>
      <path
        d={svg`M${cx - r} ${cy}a${r} ${r} 0 0 1 ${2 * r} 0v-${r * 0.2}a${r} ${r * 1.05} 0 0 0-${2 * r} 0Z`}
        fill="var(--color-ill-hair)"
      />
      <circle cx={cx} cy={cy} r={r} fill={skin(tone, 1)} />
      <path
        d={svg`M${cx - r * 1.02} ${cy - r * 0.1}a${r * 1.02} ${r * 1.02} 0 0 1 ${2.04 * r} 0c-${r * 0.5}-${r * 0.5}-${r * 1.4}-${r * 0.6}-${2.04 * r} 0Z`}
        fill="var(--color-ill-hair)"
      />
      {closed ? (
        <>
          <path
            d={svg`M${cx + dx - gap - 4} ${eyeY}q4 3 8 0M${cx + dx + gap - 4} ${eyeY}q4 3 8 0`}
            stroke="var(--color-ill-hair)"
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <circle cx={cx + dx - gap} cy={eyeY} r={2.4} fill="var(--color-ill-hair)" />
          <circle cx={cx + dx + gap} cy={eyeY} r={2.4} fill="var(--color-ill-hair)" />
        </>
      )}
      <path
        d={svg`M${cx + dx - 6} ${cy + r * 0.4}q6 5 12 0`}
        stroke="var(--color-ill-hair)"
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

function Sparkles({ points }: { points: [number, number][] }) {
  return (
    <g fill="var(--color-surface)">
      {points.map(([x, y], i) => (
        <path
          key={i}
          className="ill-sparkle"
          // Each one twinkles a little after the last (styles.css, .ill-sparkle).
          style={{ animationDelay: `${String(i * 0.7)}s` }}
          d={svg`M${x} ${y - 6}l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8Z`}
        />
      ))}
    </g>
  );
}

const scenes: Record<Scene, { bg: string; draw: (tone: number) => ReactNode }> = {
  welcome: {
    bg: "var(--color-sun-soft)",
    draw: (tone) => (
      <>
        <circle cx={160} cy={210} r={120} fill="var(--color-ill-mat)" opacity={0.35} />
        <path d="M96 200c0-48 28-78 64-78s64 30 64 78Z" fill="var(--color-ill-cloth-2)" />
        <Face cx={160} cy={92} r={30} tone={tone} look="right" />
        <ellipse cx={176} cy={150} rx={36} ry={22} fill="var(--color-ill-cloth)" />
        <circle cx={206} cy={132} r={17} fill={skin(tone, 2)} />
        <path
          d="M118 166c20 18 62 18 92-4"
          stroke={skin(tone, 1)}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
        <Sparkles
          points={[
            [60, 50],
            [262, 64],
            [244, 30],
          ]}
        />
      </>
    ),
  },
  mat: {
    bg: "var(--color-teal-soft)",
    draw: (tone) => (
      <>
        <rect x={24} y={150} width={272} height={22} rx={11} fill="var(--color-ill-mat)" />
        <Baby x={126} y={136} tone={tone} lift={6} />
        <rect x={224} y={132} width={70} height={20} rx={10} fill="var(--color-ill-cloth-2)" />
        <Face cx={262} cy={112} r={24} tone={tone} look="left" />
        <Sparkles
          points={[
            [52, 58],
            [96, 34],
            [150, 70],
          ]}
        />
      </>
    ),
  },
  chest: {
    bg: "var(--color-sage-soft)",
    draw: (tone) => (
      <>
        <rect
          x={20}
          y={150}
          width={280}
          height={36}
          rx={18}
          fill="var(--color-ill-mat)"
          opacity={0.7}
        />
        <path d="M40 160 230 110c14-4 26 8 22 22l-6 28H40Z" fill="var(--color-ill-cloth-2)" />
        <Face cx={262} cy={92} r={26} tone={tone} look="left" />
        <g transform="rotate(-14 150 118)">
          <Baby x={140} y={118} tone={tone + 1} lift={2} />
        </g>
        <Sparkles
          points={[
            [50, 50],
            [110, 30],
          ]}
        />
      </>
    ),
  },
  lap: {
    bg: "var(--color-sun-soft)",
    draw: (tone) => (
      <>
        <path d="M30 168h260v18H30Z" fill="var(--color-ill-mat)" opacity={0.6} />
        <rect x={64} y={128} width={200} height={34} rx={17} fill="var(--color-ill-cloth-2)" />
        <Baby x={150} y={114} tone={tone + 2} lift={4} />
        <Face cx={258} cy={70} r={24} tone={tone} look="left" />
        <path
          d="M240 96c-8 14-8 26 0 34"
          stroke="var(--color-ill-cloth-2)"
          strokeWidth={18}
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  calm: {
    bg: "var(--color-lilac-soft)",
    draw: (tone) => (
      <>
        <circle cx={262} cy={52} r={20} fill="var(--color-surface)" />
        <circle cx={272} cy={46} r={18} fill="var(--color-lilac-soft)" />
        <path d="M100 200c0-44 26-70 60-70s60 26 60 70Z" fill="var(--color-ill-cloth)" />
        <Face cx={160} cy={98} r={30} tone={tone} look="front" closed />
        <g
          className="ill-breath"
          stroke="var(--color-surface)"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M40 92q20-14 40 0t40 0" />
          <path d="M200 132q20-14 40 0t40 0" />
        </g>
        <Sparkles
          points={[
            [56, 40],
            [228, 96],
          ]}
        />
      </>
    ),
  },
  path: {
    bg: "var(--color-teal-soft)",
    draw: () => (
      <>
        <path
          d="M30 170c60-10 70-60 130-60s70-50 130-60"
          stroke="var(--color-surface)"
          strokeWidth={18}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M30 170c60-10 70-60 130-60s70-50 130-60"
          stroke="var(--color-ill-cloth)"
          strokeWidth={4}
          strokeDasharray="2 12"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={58} cy={163} r={12} fill="var(--color-primary)" />
        <circle cx={160} cy={110} r={12} fill="var(--color-ill-mat)" />
        <circle cx={262} cy={58} r={12} fill="var(--color-ill-cloth-2)" />
        <path d="M262 58V20l22 8-22 8" fill="var(--color-ill-mat)" />
        <Sparkles
          points={[
            [110, 50],
            [210, 150],
          ]}
        />
      </>
    ),
  },
  idea: {
    bg: "var(--color-sun-soft)",
    draw: () => (
      <>
        <circle cx={160} cy={92} r={46} fill="var(--color-surface)" />
        <path
          d="M160 62a26 26 0 0 0-14 48v10h28v-10a26 26 0 0 0-14-48Z"
          fill="var(--color-ill-mat)"
        />
        <rect x={148} y={124} width={24} height={8} rx={4} fill="var(--color-ill-cloth)" />
        <g stroke="var(--color-ill-mat)" strokeWidth={4} strokeLinecap="round">
          <path d="M160 26v10M108 92H98M222 92h-10M124 56l-7-7M196 56l7-7" />
        </g>
        <Sparkles
          points={[
            [70, 150],
            [250, 150],
            [60, 40],
          ]}
        />
      </>
    ),
  },
};

export interface IllustrationProps {
  scene: Scene;
  tone?: number;
  /** What the drawing shows, for screen readers. Empty when the words next to it say it all. */
  alt?: string;
  className?: string;
}

export function Illustration({ scene, tone = 0, alt = "", className }: IllustrationProps) {
  const s = scenes[scene];
  const labelled = alt.length > 0;
  return (
    <svg
      className={["illustration", className].filter(Boolean).join(" ")}
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      {...(labelled ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      focusable="false"
    >
      <rect width={320} height={200} fill={s.bg} />
      {s.draw(tone)}
    </svg>
  );
}
