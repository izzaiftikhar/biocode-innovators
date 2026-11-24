import path from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { LETTER_FIELDS, normalizeLayout } from "./letterLayout";

// Only "name" is drawn. Extra values passed by callers are ignored.
export type LetterValues = { name: string; [extra: string]: string | undefined };

const NAME_FONT = "PinyonScript";
const FALLBACK_FONT = "BioCodeSans";
const FONT_STACK = `${NAME_FONT}, ${FALLBACK_FONT}`;

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;

  const dir = path.join(process.cwd(), "src", "lib", "internships", "fonts");

  if (
    !GlobalFonts.registerFromPath(
      path.join(dir, "PinyonScript-Regular.ttf"),
      NAME_FONT
    )
  ) {
    throw new Error("The name font could not be loaded.");
  }

  if (
    !GlobalFonts.registerFromPath(
      path.join(dir, "NotoSans-Regular.ttf"),
      FALLBACK_FONT
    )
  ) {
    throw new Error("The fallback font could not be loaded.");
  }

  fontsReady = true;
}

/** Reads width and height from a PNG header. Returns null if the bytes are not a PNG. */
export function readPngSize(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (data.length < 24 || signature.some((byte, i) => data[i] !== byte)) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function renderOfferLetterPng(input: {
  templateBytes: ArrayBuffer;
  layout: unknown;
  values: LetterValues;
}): Promise<Buffer> {
  const size = readPngSize(input.templateBytes);

  if (
    !size ||
    size.width < 200 ||
    size.height < 200 ||
    size.width > 5000 ||
    size.height > 5000
  ) {
    throw new Error(
      "The offer letter template must be a PNG image between 200 and 5000 pixels wide and tall."
    );
  }

  ensureFonts();

  const { width, height } = size;
  const layout = normalizeLayout(input.layout);

  const image = await loadImage(Buffer.from(input.templateBytes));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, width, height);
  ctx.fillStyle = layout.color;
  ctx.textBaseline = "alphabetic";

  for (const { key } of LETTER_FIELDS) {
    const text = input.values[key];
    if (!text) continue;

    const box = layout.fields[key];
    if (box.hidden) continue;

    const xPx = Math.round((width * box.x) / 100);
    let fontSize = Math.max(8, Math.round((width * box.size) / 100));

    // Room available: centered text must fit on both sides of its middle
    // point, left-aligned text must fit to the right of its start.
    const maxWidth = box.center
      ? Math.min(width * 0.7, 2 * Math.min(xPx, width - xPx) * 0.95)
      : (width - xPx) * 0.95;

    ctx.font = `${fontSize}px ${FONT_STACK}`;
    while (fontSize > 8 && ctx.measureText(text).width > maxWidth) {
      fontSize -= 1;
      ctx.font = `${fontSize}px ${FONT_STACK}`;
    }

    // "Top (%)" is the top of the text line, so move down by the font's ascent.
    const ascent =
      ctx.measureText(text).fontBoundingBoxAscent || fontSize * 0.9;

    ctx.textAlign = box.center ? "center" : "left";
    ctx.fillText(
      text,
      xPx,
      Math.round((height * box.y) / 100) + ascent
    );
  }

  return canvas.toBuffer("image/png");
}
