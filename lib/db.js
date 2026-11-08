import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// 4주차: shortCode와 원본 URL 저장
// 같은 shortCode가 이미 있으면(동시에 같은 URL이 두 번 들어온 경우) 아무것도 하지 않음
export async function saveUrl(shortCode, originalUrl) {
  await sql`
    INSERT INTO urls (short_code, original_url)
    VALUES (${shortCode}, ${originalUrl})
    ON CONFLICT (short_code) DO NOTHING
  `;
}

// 5주차: shortCode로 원본 URL 찾기
export async function findUrlByShortCode(shortCode) {
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;

  return rows[0]?.original_url ?? null;
}

// 과제 기능 1: 이미 단축한 원본 URL이면 기존 shortCode 찾기
export async function findShortCodeByOriginalUrl(originalUrl) {
  const rows = await sql`
    SELECT short_code
    FROM urls
    WHERE original_url = ${originalUrl}
    LIMIT 1
  `;

  return rows[0]?.short_code ?? null;
}
