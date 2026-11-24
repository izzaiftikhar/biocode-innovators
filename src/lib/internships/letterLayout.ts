export type FieldKey = "name";

/**
 * x and y are percentages from the top-left of the image; size is a percentage
 * of the image width. With center on, x is the middle of the text instead of
 * its left edge.
 */
export type FieldBox = {
  x: number;
  y: number;
  size: number;
  hidden?: boolean;
  center?: boolean;
};

export type LetterLayout = {
  color: string;
  fields: Record<FieldKey, FieldBox>;
};

export const LETTER_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Student name" },
];

export const LAYOUT_LIMITS = {
  x: [0, 100],
  y: [0, 100],
  size: [0.5, 10],
} as const;

// Only the student's name is written on the document, centered.
export const DEFAULT_LETTER_LAYOUT: LetterLayout = {
  color: "#0B1F4D",
  fields: {
    name: { x: 50, y: 44, size: 5, center: true },
  },
};

function pick(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

/** Merges saved JSON with the defaults and drops anything invalid or unused. */
export function normalizeLayout(raw: unknown): LetterLayout {
  const source = (raw && typeof raw === "object" ? raw : {}) as {
    color?: unknown;
    fields?: Record<string, unknown>;
  };

  const color =
    typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)
      ? source.color
      : DEFAULT_LETTER_LAYOUT.color;

  const fields = {} as Record<FieldKey, FieldBox>;

  for (const { key } of LETTER_FIELDS) {
    const given = (source.fields?.[key] ?? {}) as Partial<
      Record<keyof FieldBox, unknown>
    >;
    const base = DEFAULT_LETTER_LAYOUT.fields[key];
    const saved = Object.keys(given).length > 0;

    fields[key] = {
      x: pick(given.x, base.x, ...LAYOUT_LIMITS.x),
      y: pick(given.y, base.y, ...LAYOUT_LIMITS.y),
      size: pick(given.size, base.size, ...LAYOUT_LIMITS.size),
      hidden:
        typeof given.hidden === "boolean"
          ? given.hidden
          : saved
            ? false
            : base.hidden === true,
      center:
        typeof given.center === "boolean"
          ? given.center
          : saved
            ? false
            : base.center === true,
    };
  }

  return { color, fields };
}
