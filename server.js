const http = require("http");

// -------------------------
// 簡易レート制限
// -------------------------

const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;

  const data = rateLimitMap.get(ip);

  if (!data || now - data.startTime > windowMs) {
    rateLimitMap.set(ip, {
      count: 1,
      startTime: now
    });

    return false;
  }

  data.count++;

  return data.count > maxRequests;
}

// -------------------------
// Gemini 503対策
// -------------------------

async function generateWithRetry(
  ai,
  params,
  maxRetries = 2
) {
  let lastError;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      lastError = error;

      const message =
        String(error?.message || "");

      const isTemporary =
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        message.includes("high demand");

      // 一時エラー以外ならそのまま終了
      if (!isTemporary) {
        throw error;
      }

      // 最後の試行まで失敗したら終了
      if (attempt === maxRetries) {
        throw error;
      }

      const waitTime =
        1500 * (attempt + 1);

      console.log(
        `Gemini一時エラー。${waitTime}ms後に再試行します。`
      );

      await new Promise(resolve =>
        setTimeout(resolve, waitTime)
      );
    }
  }

  throw lastError;
}

// -------------------------
// メイン処理
// -------------------------

async function main() {
  const { GoogleGenAI } =
    await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const server =
    http.createServer(async (req, res) => {

      // -------------------------
      // CORS
      // -------------------------

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
      );

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // -------------------------
      // /explain
      // -------------------------

      if (
        req.method === "POST" &&
        req.url === "/explain"
      ) {
        const forwarded =
          req.headers["x-forwarded-for"];

        const ip = forwarded
          ? forwarded.split(",")[0].trim()
          : req.socket.remoteAddress;

        // -------------------------
        // レート制限
        // -------------------------

        if (isRateLimited(ip)) {
          res.writeHead(429, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          res.end(JSON.stringify({
            result:
              "短時間に多くのリクエストが送信されました。1分ほど待ってからもう一度お試しください。"
          }));

          return;
        }

        let body = "";

        req.on("data", chunk => {
          body += chunk;
        });

        req.on("end", async () => {
          try {
            const data = JSON.parse(body);

            const text = data.text;
            const mode = data.mode;
            const language = data.language;

            console.log(
              "受け取ったmode:",
              mode
            );

            console.log(
              "受け取ったlanguage:",
              language
            );

            // -------------------------
            // 入力チェック
            // -------------------------

            if (
              !text ||
              typeof text !== "string"
            ) {
              res.writeHead(400, {
                "Content-Type":
                  "application/json; charset=utf-8"
              });

              res.end(JSON.stringify({
                result:
                  "解説する文章がありません。"
              }));

              return;
            }

            if (text.length > 5000) {
              res.writeHead(413, {
                "Content-Type":
                  "application/json; charset=utf-8"
              });

              res.end(JSON.stringify({
                result:
                  "文章が長すぎます。5000文字以内で選択してください。"
              }));

              return;
            }

            // -------------------------
            // Geminiへの指示
            // -------------------------

            let instruction = "";

            // -------------------------
            // かんたん
            // -------------------------

            if (mode === "easy") {
              if (language === "en") {
                instruction = `
You are a tutor for beginners.

Explain the following text in simple English.

Conditions:
- Use easy words
- Keep it to about 3 to 5 sentences
- Explain technical terms if necessary
- Include one simple example
- Avoid unnecessary background information
`;
              } else {
                instruction = `
あなたは初心者向けの家庭教師です。

次の文章を、とにかくやさしい日本語で説明してください。

条件:
- 3〜5文程度
- 専門用語はできるだけ使わない
- 専門用語を使う場合は意味も説明する
- 具体例を1つ入れる
- 細かい背景説明は省く
`;
              }
            }

            // -------------------------
            // 詳しく
            // -------------------------

            if (mode === "detail") {
              if (language === "en") {
                instruction = `
You are a university-level instructor.

Explain the following text in detail.

Conditions:
- Explain relevant background knowledge
- Explain technical terms
- Explain why it works that way
- Include concrete examples
- Use bullet points when useful
- Do not make the explanation too short
`;
              } else {
                instruction = `
あなたは大学の講師です。

次の文章を詳しく解説してください。

条件:
- 背景知識も説明する
- 専門用語の意味も説明する
- なぜそうなるのか仕組みを説明する
- 具体例を入れる
- 必要なら箇条書きを使う
- 短くまとめすぎない
`;
              }
            }

            // -------------------------
            // 要約
            // -------------------------

            if (mode === "summary") {
              if (language === "en") {
                instruction = `
You are an expert at summarizing text.

Summarize the following text.

Conditions:
- Do not explain it in detail
- Extract only the most important points
- Use no more than 3 bullet points
- Keep each point short
- Do not add information that is not in the original text
`;
              } else {
                instruction = `
あなたは文章要約の専門家です。

次の文章を要約してください。

条件:
- 解説はしない
- 最重要ポイントだけ抜き出す
- 3項目以内の箇条書き
- 1項目は短くする
- 元の文章にない情報を追加しない
`;
              }
            }

            // -------------------------
            // modeが無い場合
            // -------------------------

            if (!instruction) {
              if (language === "en") {
                instruction = `
Explain the following text clearly in English.
`;
              } else {
                instruction = `
次の文章を初心者にもわかるように、
日本語で簡潔に説明してください。
`;
              }
            }

            // -------------------------
            // Gemini API
            // -------------------------

            const response =
              await generateWithRetry(
                ai,
                {
                  model:
                    "gemini-3.5-flash-lite",

                  contents: `${instruction}

Text to process:

${text}`
                }
              );

            // -------------------------
            // 成功
            // -------------------------

            res.writeHead(200, {
              "Content-Type":
                "application/json; charset=utf-8"
            });

            res.end(JSON.stringify({
              result: response.text
            }));

          } catch (error) {
            console.error(error);

            const message =
              String(error?.message || "");

            const isTemporary =
              message.includes("503") ||
              message.includes("UNAVAILABLE") ||
              message.includes("high demand");

            // Gemini混雑時
            if (isTemporary) {
              res.writeHead(503, {
                "Content-Type":
                  "application/json; charset=utf-8"
              });

              res.end(JSON.stringify({
                result:
                  "現在AIが混雑しています。少し待ってからもう一度お試しください。"
              }));

              return;
            }

            // その他のエラー
            res.writeHead(500, {
              "Content-Type":
                "application/json; charset=utf-8"
            });

            res.end(JSON.stringify({
              result:
                "解説の取得に失敗しました。"
            }));
          }
        });

        return;
      }

      // -------------------------
      // それ以外
      // -------------------------

      res.writeHead(404, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end("Not Found");
    });

  // -------------------------
  // サーバー起動
  // -------------------------

  const PORT =
    process.env.PORT || 3000;

  server.listen(PORT, () => {
    console.log(
      `サーバー起動: ${PORT}`
    );
  });
}

main();