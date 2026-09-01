const http = require("http");

async function main() {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const server = http.createServer(async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/explain") {
      let body = "";

      req.on("data", chunk => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);

          const text = data.text;
          const mode = data.mode;

          console.log("受け取ったmode:", mode);

          let instruction = "";

          if (mode === "easy") {
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

          if (mode === "detail") {
            instruction = `
あなたは大学の名無しの講師です。

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

          if (mode === "summary") {
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

          // modeが無い場合の保険
          if (!instruction) {
            instruction = `
次の文章を初心者にもわかるように、
日本語で簡潔に説明してください。
`;
          }

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: `${instruction}

次の文章が対象です。

${text}`
          });

          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8"
          });

          res.end(JSON.stringify({
            result: response.text
          }));

        } catch (error) {
          console.error(error);

          res.writeHead(500, {
            "Content-Type": "application/json; charset=utf-8"
          });

          res.end(JSON.stringify({
            result: "解説の取得に失敗しました"
          }));
        }
      });

      return;
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Not Found");
  });

  const PORT = process.env.PORT || 3000;

  server.listen(3000, () => {
    console.log(`サーバー起動: ${PORT}`);
  });
}

main();