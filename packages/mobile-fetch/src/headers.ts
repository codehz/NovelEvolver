import type { StreamFetchHeader } from "./NativeStreamFetch.nitro";

export class StreamHeaders {
  readonly #map = new Map<string, string>();

  constructor(headers: StreamFetchHeader[] | HeadersInit | undefined = []) {
    if (Array.isArray(headers) && headers.length > 0 && isStreamHeaderList(headers)) {
      for (const header of headers) {
        this.#append(header.key, header.value);
      }
      return;
    }
    for (const [key, value] of iterateHeadersInit(headers as HeadersInit | undefined)) {
      this.#append(key, value);
    }
  }

  get(name: string): string | null {
    return this.#map.get(name.toLowerCase()) ?? null;
  }

  has(name: string): boolean {
    return this.#map.has(name.toLowerCase());
  }

  forEach(callback: (value: string, key: string, parent: this) => void): void {
    for (const [key, value] of this.#map) {
      callback(value, key, this);
    }
  }

  entries(): IterableIterator<[string, string]> {
    return this.#map.entries();
  }

  keys(): IterableIterator<string> {
    return this.#map.keys();
  }

  values(): IterableIterator<string> {
    return this.#map.values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.#map.entries();
  }

  #append(name: string, value: string): void {
    const key = name.toLowerCase();
    const existing = this.#map.get(key);
    this.#map.set(key, existing === undefined ? value : `${existing}, ${value}`);
  }
}

function isStreamHeaderList(
  headers: StreamFetchHeader[] | unknown[],
): headers is StreamFetchHeader[] {
  const first = headers[0];
  return (
    first != null &&
    typeof first === "object" &&
    "key" in first &&
    "value" in first &&
    !Array.isArray(first)
  );
}

export function iterateHeadersInit(headers: HeadersInit | undefined): Array<[string, string]> {
  if (headers == null) return [];
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const pairs: Array<[string, string]> = [];
    headers.forEach((value, key) => {
      pairs.push([key, value]);
    });
    return pairs;
  }
  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [String(key), String(value)]);
  }
  return Object.entries(headers).map(([key, value]) => [key, String(value)]);
}
