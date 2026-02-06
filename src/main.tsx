import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 플랫폼 정보를 CSS에서 사용할 수 있도록 data attribute 설정
const platform = window.electronAPI?.platform || 'web';
document.documentElement.dataset.platform = platform;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
