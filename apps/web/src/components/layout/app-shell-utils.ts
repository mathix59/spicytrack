import type { MeResponseDto } from "@/generated/api";
import { renderNullableText } from "@/lib/utils";

function getDisplayName(me: MeResponseDto) {
  return renderNullableText(me.user.name, me.user.email);
}

export { getDisplayName };
