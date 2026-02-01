import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Memo, MemoEventPayload } from "./types";
import MemoCard from "./components/MemoCard";
import "./App.css";

// 시간 포맷 함수 (컴포넌트 외부 - 재생성 방지)
const formatTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "방금 전";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return new Date(timestamp).toLocaleDateString("ko-KR");
};

function App() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");

  // 메모 목록 불러오기 (초기 로드용)
  const loadMemos = useCallback(async () => {
    try {
      const loaded: Memo[] = await invoke("load_memos");
      setMemos(loaded);
    } catch (e) {
      console.error("Failed to load memos:", e);
    }
  }, []);

  // 초기 로드 + 이벤트 리스너 설정 (폴링 제거!)
  useEffect(() => {
    loadMemos();

    // Tauri 이벤트 리스너로 실시간 동기화
    const unlisten = listen<MemoEventPayload>("memo-changed", (event) => {
      const payload = event.payload;

      switch (payload.type) {
        case "created":
          setMemos((prev) => [payload.memo, ...prev.filter((m) => m.id !== payload.memo.id)]);
          break;
        case "updated":
          setMemos((prev) =>
            prev.map((m) => (m.id === payload.memo.id ? payload.memo : m))
          );
          break;
        case "deleted":
          setMemos((prev) => prev.filter((m) => m.id !== payload.id));
          break;
        case "reloaded":
          setMemos(payload.memos);
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadMemos]);

  // 새 메모 생성 (새 API 사용)
  const createMemo = async () => {
    const newMemo: Memo = {
      id: crypto.randomUUID(),
      title: "새 메모",
      content: "",
      color: "yellow",
      updatedAt: Date.now(),
    };

    setSaveStatus("saving");
    try {
      await invoke("create_memo", { memo: newMemo });
      // 이벤트로 자동 반영되므로 setMemos 불필요
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1500);

      // 바로 창 열기
      openMemoWindow(newMemo.id);
    } catch (e) {
      console.error("Failed to create memo:", e);
      setSaveStatus("");
    }
  };

  // 메모 삭제 (새 API 사용)
  const deleteMemo = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await invoke("delete_memo", { id });
      // 이벤트로 자동 반영됨

      // 열려있는 창도 닫기
      await invoke("close_memo_window", { memoId: id }).catch(() => {});
    } catch (err) {
      console.error("Failed to delete memo:", err);
    }
  }, []);

  // 메모 창 열기
  const openMemoWindow = useCallback(async (memoId: string) => {
    try {
      await invoke("open_memo_window", { memoId });
    } catch (e) {
      console.error("Failed to open memo window:", e);
    }
  }, []);

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="app-header">
        <h1 className="app-title">MyMemo</h1>
        <div className="header-actions">
          {saveStatus && (
            <span className="save-status">
              {saveStatus === "saving" ? "저장 중..." : "✓ 저장됨"}
            </span>
          )}
          <button className="new-btn" onClick={createMemo} title="새 메모">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span>새 메모</span>
          </button>
        </div>
      </header>

      {/* 메모 그리드 */}
      <main className="memo-grid">
        {memos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect
                  x="10"
                  y="8"
                  width="44"
                  height="48"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M20 22h24M20 32h24M20 42h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p>메모가 없습니다</p>
            <button className="create-btn" onClick={createMemo}>
              첫 메모 만들기
            </button>
          </div>
        ) : (
          memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onOpen={openMemoWindow}
              onDelete={deleteMemo}
              formatTime={formatTime}
            />
          ))
        )}
      </main>

      {/* 푸터 */}
      <footer className="app-footer">
        <span>{memos.length}개의 메모</span>
        <span className="hint">
          클릭하여 메모 열기 • 메인 창을 닫아도 메모는 유지됩니다
        </span>
      </footer>
    </div>
  );
}

export default App;
