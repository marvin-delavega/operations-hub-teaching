import { DEFAULT_PO_CODE_PREFIX } from "./activeoneConstants";
import { createGetAppSettingUseCase } from "@/container";

/**
 * Default display padding width for app PO codes. Generation stores the minimal
 * form (`PO-1`); this width only affects how app-generated codes are rendered
 * (UI + printable reports) via `formatAppPoCode`. Configurable at runtime via
 * app_settings.po_code_display_width.
 */
export const PO_CODE_DISPLAY_WIDTH = 6;

export const PO_CODE_DISPLAY_WIDTH_MAX = 9;

/**
 * Pads the numeric tail of an app-generated PO code for display only. Only codes
 * of the exact shape `{prefix}-<digits>` (i.e. codes this app minted under the
 * configured prefix) are padded; everything else — native ActiveOne numeric
 * codes, DRAFT-* placeholders, other prefixes — passes through unchanged.
 * Padded codes from before this feature (`PO-009005`) round-trip unchanged.
 */
export function formatAppPoCode(
  code: string,
  prefix: string = DEFAULT_PO_CODE_PREFIX,
  width: number = PO_CODE_DISPLAY_WIDTH,
): string {
  const match = code.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return code;
  return `${prefix}-${match[1].padStart(width, "0")}`;
}

/**
 * Resolves the active PO code prefix + display width from app_settings once per
 * server response so every display surface renders pre-formatted codes (the
 * client never fetches these settings). Width falls back to the default and is
 * clamped to the same 0..9 range the admin settings route validates. Fail-open:
 * a settings-read blip must never turn a *successful* write (PO commit) into an
 * error response, so display formatting degrades to defaults instead.
 */
export async function getPoCodeDisplaySettings(): Promise<{ prefix: string; width: number }> {
  try {
    const [prefixRaw, widthRaw] = await Promise.all([
      createGetAppSettingUseCase().execute("po_code_prefix"),
      createGetAppSettingUseCase().execute("po_code_display_width"),
    ]);
    const widthNum = widthRaw === null || widthRaw === undefined || widthRaw === "" ? NaN : Number(widthRaw);
    const width = Number.isFinite(widthNum)
      ? Math.min(PO_CODE_DISPLAY_WIDTH_MAX, Math.max(0, Math.trunc(widthNum)))
      : PO_CODE_DISPLAY_WIDTH;
    const prefix = prefixRaw?.trim().toUpperCase() || DEFAULT_PO_CODE_PREFIX;
    return { prefix, width };
  } catch {
    return { prefix: DEFAULT_PO_CODE_PREFIX, width: PO_CODE_DISPLAY_WIDTH };
  }
}
