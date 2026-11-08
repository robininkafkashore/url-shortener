import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { findShortCodeByOriginalUrl, saveUrl } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256").update(originalUrl).digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

// 오류 응답을 같은 꼴({ error: { code, message } })로 만들기
function errorResponse(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/*
 * 과제 기능 2: 내 서비스 주소 모으기
 *
 * 지금 요청이 들어온 주소(Host)와
 * Vercel이 알려 주는 내 배포 주소들을 모두 "내 서비스"로 봅니다.
 */
function getOwnHosts(request) {
  const hosts = new Set();

  const add = (value) => {
    if (!value) return;
    // 포트(:3000)를 떼고 소문자로 맞춤
    hosts.add(value.split(",")[0].trim().toLowerCase().replace(/:\d+$/, ""));
  };

  add(new URL(request.url).host);
  add(request.headers.get("host"));
  add(request.headers.get("x-forwarded-host"));
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  return hosts;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {
    // 1. 요청 body에서 originalUrl 읽기
    const body = await request.json().catch(() => null);
    const raw = body?.originalUrl;
    const originalUrl = typeof raw === "string" ? raw.trim() : "";

    // 2. URL이 없으면 400
    if (!originalUrl) {
      return errorResponse("MISSING_URL", "Original URL is required.", 400);
    }

    // 3. URL이 너무 길면 400
    if (originalUrl.length > MAX_URL_LENGTH) {
      return errorResponse(
        "URL_TOO_LONG",
        `URL must be ${MAX_URL_LENGTH} characters or fewer.`,
        400
      );
    }

    // 4. URL 형식이 아니면 400
    let parsedUrl;
    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return errorResponse(
        "INVALID_URL",
        "URL must start with http:// or https://.",
        400
      );
    }

    // 5. http, https만 허용 (javascript: 같은 주소 차단)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return errorResponse(
        "INVALID_URL",
        "URL must start with http:// or https://.",
        400
      );
    }

    // 6. 과제 기능 2: 내 서비스 주소는 단축 금지 (http/https, 경로와 상관없이 도메인으로 판단)
    if (getOwnHosts(request).has(parsedUrl.hostname.toLowerCase())) {
      return errorResponse(
        "SELF_URL_NOT_ALLOWED",
        "URLs of this service cannot be shortened.",
        400
      );
    }

    const baseUrl = new URL(request.url).origin;

    // 7. 과제 기능 1: 이미 단축한 URL이면 기존 shortCode를 그대로 돌려줌 (200)
    const existingCode = await findShortCodeByOriginalUrl(originalUrl);
    if (existingCode) {
      return NextResponse.json(
        {
          shortCode: existingCode,
          shortUrl: `${baseUrl}/${existingCode}`,
          originalUrl,
        },
        { status: 200 }
      );
    }

    // 8. 새 shortCode 만들고 DB에 저장 (201 Created)
    const shortCode = createShortCode(originalUrl);
    await saveUrl(shortCode, originalUrl);

    return NextResponse.json(
      {
        shortCode,
        shortUrl: `${baseUrl}/${shortCode}`,
        originalUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    // 9. 예상하지 못한 서버 오류는 500
    console.error("Failed to create short URL", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create short URL.", 500);
  }
}
