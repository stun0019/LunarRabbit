# Lunar Rabbit — TypeScript + PixiJS

遊戲邏輯：`src/main.ts`。PixiJS 盤面、圖片精靈與動畫：`src/renderer.ts`。
版面：`index.html`、`style.css`、`reference-ui.css`。

需要 Node.js 20.19+ 與 npm。

```sh
npm install
npm run build
npm run dev
```

開發時修改 TypeScript 後重新執行 build。`dist/game.js` 是編譯成果，請和 HTML、CSS、PNG 一起提交至 GitHub Pages。瀏覽器執行 JavaScript，不會直接執行 TypeScript。使用 HTTP 本機伺服器或 GitHub Pages 開啟，勿直接雙擊 HTML（WebGL 圖片載入可能受本機檔案來源限制）。

保留原型遊戲規則與體驗幣；非原版遊戲或原版數學模型。AUTO 每輪 25 次，停止會完成當前一局。
