import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import MemoWindow from "./MemoWindow";

// URL 파라미터로 윈도우 타입 결정
const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

const root = document.getElementById("root") as HTMLElement;

if (windowType === "memo") {
  // 개별 메모 창
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MemoWindow />
    </React.StrictMode>
  );
} else {
  // 메인 창
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
