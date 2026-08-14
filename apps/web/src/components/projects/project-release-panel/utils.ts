import { formatLocalDateTime, renderNullableText } from "@/lib/utils";

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function compactDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return formatLocalDateTime(value);
}

export { compactDate, formatBytes, renderNullableText };
