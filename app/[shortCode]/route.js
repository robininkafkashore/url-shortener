import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export const dynamic = "force-dynamic";

// shortCode는 영어·숫자 6자리만 (그 밖의 주소는 DB를 찾지 않고 바로 404)
const SHORT_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = SHORT_CODE_PATTERN.test(shortCode)
    ? await findUrlByShortCode(shortCode)
    : null;

  // 5주차 TODO: 없는 shortCode면 404
  if (!originalUrl) {
    console.warn("Short URL not found", { shortCode });

    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // 6주차: 클릭 수 기록 (실패해도 이동은 계속)
  try {
    await recordClick(shortCode);
  } catch (error) {
    console.error("Failed to record click", { shortCode });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}
