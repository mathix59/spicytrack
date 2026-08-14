import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

type HttpParserError = Error & { statusCode?: number };

export function decodeSentryBody(
  body: Buffer,
  contentEncoding: string | string[] | undefined,
  maxOutputLength: number,
): string {
  const encoding = (Array.isArray(contentEncoding) ? contentEncoding[0] : contentEncoding)
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  try {
    const decoded =
      !encoding || encoding === "identity"
        ? body
        : encoding === "gzip"
          ? gunzipSync(body, { maxOutputLength })
          : encoding === "deflate"
            ? inflateSync(body, { maxOutputLength })
            : encoding === "br"
              ? brotliDecompressSync(body, { maxOutputLength })
              : undefined;

    if (!decoded) {
      const error = new Error(`Unsupported content encoding: ${encoding}`) as HttpParserError;
      error.statusCode = 415;
      throw error;
    }
    if (decoded.byteLength > maxOutputLength) {
      const error = new Error("Decompressed request body is too large") as HttpParserError;
      error.statusCode = 413;
      throw error;
    }
    return decoded.toString("utf8");
  } catch (cause) {
    if (cause instanceof Error && "statusCode" in cause) throw cause;
    const error = new Error("Invalid compressed request body", { cause }) as HttpParserError;
    error.statusCode =
      cause instanceof Error && "code" in cause && cause.code === "ERR_BUFFER_TOO_LARGE"
        ? 413
        : 400;
    throw error;
  }
}
