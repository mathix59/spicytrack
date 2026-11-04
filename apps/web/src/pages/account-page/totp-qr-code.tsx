import { useMemo } from "react";
import { encode } from "uqr";

/** Light modules around the code; the QR spec asks for four so scanners find the edges. */
const QUIET_ZONE = 4;

/** One `M x y h1 v1 h-1 z` square per dark module, merged into runs along each row. */
function buildQrPath(data: string) {
  const { data: modules, size } = encode(data, { ecc: "M", border: 0 });
  let path = "";
  modules.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && row[x]) x += 1;
      path += `M${start + QUIET_ZONE} ${y + QUIET_ZONE}h${x - start}v1h${start - x}z`;
    }
  });
  return { path, size: size + QUIET_ZONE * 2 };
}

function TotpQrCode({
  value,
  label = "QR code for authenticator app",
}: {
  value: string;
  label?: string;
}) {
  const qr = useMemo(() => {
    try {
      return buildQrPath(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) return null;

  return (
    <svg
      aria-label={label}
      className="size-48 shrink-0 rounded-md"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Always white: authenticator scanners need dark-on-light, even in dark mode. */}
      <rect fill="#fff" height={qr.size} width={qr.size} />
      <path d={qr.path} fill="#000" />
    </svg>
  );
}

export { TotpQrCode };
