import type { BackendSession, FastLinkEnvironment } from "./backend-api";

export const FX_QUOTE_PATH = "/v1/wallet/fx/quotes" as const;
export const FX_QUOTE_MAX_JSON_BYTES = 4_096;
export const FX_QUOTE_MAX_VALIDITY_MS = 15 * 60_000;

export type FxQuoteEnvironment = "SANDBOX" | "TEST";

export type FxQuoteInput = Readonly<{
  sourceAssetCode: string;
  targetAssetCode: string;
  sourceAmount: string;
}>;

export type FxQuote = Readonly<{
  quoteId: string;
  environment: FxQuoteEnvironment;
  sourceAssetCode: string;
  targetAssetCode: string;
  sourceAmount: string;
  targetAmount: string;
  rate: string;
  expiresAt: string;
}>;

export class FxQuoteContractError extends Error {
  constructor() {
    super("FX quote contract could not be verified");
    this.name = "FxQuoteContractError";
  }
}

const ASSET_CODE = /^[A-Z0-9]{2,12}$/;
const SOURCE_AMOUNT = /^(?=.*[1-9])(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/;
const CANONICAL_DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,17})(?:\.(?:[1-9]|\d{1,17}[1-9]))?$/;
const SAFE_QUOTE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const RESPONSE_FIELDS = [
  "quoteId",
  "environment",
  "sourceAssetCode",
  "targetAssetCode",
  "sourceAmount",
  "targetAmount",
  "rate",
  "expiresAt",
] as const;
const RESPONSE_FIELD_SET: ReadonlySet<string> = new Set(RESPONSE_FIELDS);

function canonicalSourceAmount(value: unknown): string {
  if (typeof value !== "string" || !SOURCE_AMOUNT.test(value)) throw new FxQuoteContractError();
  const [whole, fraction = ""] = value.split(".");
  const canonicalFraction = fraction.replace(/0+$/, "");
  return canonicalFraction ? `${whole}.${canonicalFraction}` : whole;
}

function exactInput(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new FxQuoteContractError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  const expected = ["sourceAssetCode", "targetAssetCode", "sourceAmount"];
  if (
    actual.some((key) => typeof key !== "string") ||
    actual.length !== expected.length ||
    actual.some((key) => typeof key === "string" && !expected.includes(key))
  ) {
    throw new FxQuoteContractError();
  }
  const result: Record<string, unknown> = {};
  for (const field of expected) {
    const descriptor = descriptors[field];
    if (!descriptor || !("value" in descriptor)) throw new FxQuoteContractError();
    result[field] = descriptor.value;
  }
  return result;
}

export function normalizeFxQuoteInput(value: unknown): FxQuoteInput {
  const record = exactInput(value);
  const sourceAssetCode = record.sourceAssetCode;
  const targetAssetCode = record.targetAssetCode;
  if (
    typeof sourceAssetCode !== "string" ||
    !ASSET_CODE.test(sourceAssetCode) ||
    typeof targetAssetCode !== "string" ||
    !ASSET_CODE.test(targetAssetCode) ||
    sourceAssetCode === targetAssetCode
  ) {
    throw new FxQuoteContractError();
  }
  return Object.freeze({
    sourceAssetCode,
    targetAssetCode,
    sourceAmount: canonicalSourceAmount(record.sourceAmount),
  });
}

export function buildFxQuoteRequest(value: unknown): {
  path: typeof FX_QUOTE_PATH;
  init: RequestInit;
  input: FxQuoteInput;
} {
  const input = normalizeFxQuoteInput(value);
  return {
    path: FX_QUOTE_PATH,
    init: {
      method: "POST",
      body: JSON.stringify(input),
    },
    input,
  };
}

function rejectDuplicateTopLevelKeys(raw: string): void {
  const keys = new Set<string>();
  let depth = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === "{" || character === "[") {
      depth += 1;
      continue;
    }
    if (character === "}" || character === "]") {
      depth -= 1;
      continue;
    }
    if (character !== '"') continue;
    const start = index;
    index += 1;
    while (index < raw.length) {
      if (raw[index] === "\\") {
        index += 2;
        continue;
      }
      if (raw[index] === '"') break;
      index += 1;
    }
    if (index >= raw.length) throw new FxQuoteContractError();
    let cursor = index + 1;
    while (/\s/.test(raw[cursor] ?? "")) cursor += 1;
    if (depth !== 1 || raw[cursor] !== ":") continue;
    let key: unknown;
    try {
      key = JSON.parse(raw.slice(start, index + 1));
    } catch {
      throw new FxQuoteContractError();
    }
    if (typeof key !== "string" || keys.has(key)) throw new FxQuoteContractError();
    keys.add(key);
  }
  if (depth !== 0) throw new FxQuoteContractError();
}

function exactResponse(raw: string): Record<(typeof RESPONSE_FIELDS)[number], unknown> {
  if (
    typeof raw !== "string" ||
    raw.length > FX_QUOTE_MAX_JSON_BYTES ||
    new TextEncoder().encode(raw).byteLength > FX_QUOTE_MAX_JSON_BYTES
  ) {
    throw new FxQuoteContractError();
  }
  rejectDuplicateTopLevelKeys(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new FxQuoteContractError();
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    throw new FxQuoteContractError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(parsed);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== RESPONSE_FIELDS.length ||
    keys.some((key) => typeof key === "string" && !RESPONSE_FIELD_SET.has(key))
  ) {
    throw new FxQuoteContractError();
  }
  const result = {} as Record<(typeof RESPONSE_FIELDS)[number], unknown>;
  for (const field of RESPONSE_FIELDS) {
    const descriptor = descriptors[field];
    if (!descriptor || !("value" in descriptor)) throw new FxQuoteContractError();
    result[field] = descriptor.value;
  }
  return result;
}

function validExpiry(value: unknown, now: number): value is string {
  if (typeof value !== "string" || value.length > 64 || !RFC3339.test(value)) return false;
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    timestamp <= now ||
    timestamp - now > FX_QUOTE_MAX_VALIDITY_MS
  ) {
    return false;
  }
  const [date] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() === month - 1 &&
    normalized.getUTCDate() === day
  );
}

function calculatedTargetAmount(sourceAmount: string, rate: string): string | null {
  const decimal = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return { units: BigInt(`${whole}${fraction}`), scale: fraction.length };
  };
  const source = decimal(sourceAmount);
  const multiplier = decimal(rate);
  let units = source.units * multiplier.units;
  let scale = source.scale + multiplier.scale;
  if (scale > 18) {
    units /= 10n ** BigInt(scale - 18);
    scale = 18;
  }
  let digits = units.toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  let fraction = scale === 0 ? "" : digits.slice(-scale);
  fraction = fraction.replace(/0+$/, "");
  digits = fraction ? `${whole}.${fraction}` : whole;
  return CANONICAL_DECIMAL.test(digits) ? digits : null;
}

export function normalizeFxQuoteResponse(
  raw: string,
  expectedEnvironment: FxQuoteEnvironment,
  expectedInput: FxQuoteInput,
  now = Date.now(),
): FxQuote {
  const input = normalizeFxQuoteInput(expectedInput);
  const record = exactResponse(raw);
  if (
    typeof record.quoteId !== "string" ||
    !SAFE_QUOTE_ID.test(record.quoteId) ||
    record.environment !== expectedEnvironment ||
    record.sourceAssetCode !== input.sourceAssetCode ||
    record.targetAssetCode !== input.targetAssetCode ||
    record.sourceAmount !== input.sourceAmount ||
    typeof record.targetAmount !== "string" ||
    !CANONICAL_DECIMAL.test(record.targetAmount) ||
    typeof record.rate !== "string" ||
    !CANONICAL_DECIMAL.test(record.rate) ||
    calculatedTargetAmount(input.sourceAmount, record.rate) !== record.targetAmount ||
    !validExpiry(record.expiresAt, now)
  ) {
    throw new FxQuoteContractError();
  }
  return Object.freeze({
    quoteId: record.quoteId,
    environment: record.environment,
    sourceAssetCode: record.sourceAssetCode,
    targetAssetCode: record.targetAssetCode,
    sourceAmount: record.sourceAmount,
    targetAmount: record.targetAmount,
    rate: record.rate,
    expiresAt: record.expiresAt,
  }) as FxQuote;
}

export function fxQuoteSessionAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): session is BackendSession & { environment: FxQuoteEnvironment; expiresAt: string } {
  if (
    !session ||
    session.environment !== runtimeEnvironment ||
    (runtimeEnvironment !== "SANDBOX" && runtimeEnvironment !== "TEST") ||
    typeof session.actorId !== "string" ||
    !session.actorId ||
    typeof session.tenantId !== "string" ||
    !session.tenantId ||
    typeof session.customerId !== "string" ||
    !session.customerId ||
    typeof session.expiresAt !== "string"
  ) {
    return false;
  }
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

export function fxQuoteScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  input: unknown,
  inputGeneration: number,
  now = Date.now(),
): string | null {
  if (
    !fxQuoteSessionAllowed(session, runtimeEnvironment, now) ||
    !Number.isSafeInteger(inputGeneration) ||
    inputGeneration < 0
  ) {
    return null;
  }
  try {
    const normalized = normalizeFxQuoteInput(input);
    return JSON.stringify([
      session.actorId,
      session.expiresAt,
      session.tenantId,
      session.customerId,
      session.environment,
      runtimeEnvironment,
      normalized.sourceAssetCode,
      normalized.targetAssetCode,
      normalized.sourceAmount,
      inputGeneration,
    ]);
  } catch {
    return null;
  }
}
