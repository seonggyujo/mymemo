import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { Memo, MemoEventPayload } from "./types";
import { COLORS, getColorStyle } from "./constants/colors";
import "./MemoWindow.css";

function MemoWindow() {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");

  // 디바운스용 ref
  const saveTimeoutRef = useRef<number | null>(null);
  const memoRef = useRef<Memo | null>(null);

  // URL에서 메모 ID 추출
  const getMemoId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  };

  const memoId = useMemo(() => getMemoId(), []);

  // 색상 스타일 (메모이제이션)
  const colorStyle = useMemo(
    () => getColorStyle(memo?.color || "yellow"),
    [memo?.color]
  );

  // 메모 불러오기 (개별 API 사용)
  const loadMemo = useCallback(async () => {
    if (!memoId) return;

    try {
      const found: Memo | null = await invoke("get_memo", { id: memoId });
      if (found) {
        if (!found.color) found.color = "yellow";
        setMemo(found);
        memoRef.current = found;
      }
    } catch (e) {
      console.error("Failed to load memo:", e);
    }
  }, [memoId]);

  useEffect(() => {
    loadMemo();
  }, [loadMemo]);

  // 이벤트 리스너 - 다른 창에서 변경된 경우 동기화
  useEffect(() => {
    const unlisten = listen<MemoEventPayload>("memo-changed", (event) => {
      const payload = event.payload;
      
      if (payload.type === "updated" && payload.memo.id === memoId) {
        // 현재 편집 중이 아닐 때만 업데이트
        if (!saveTimeoutRef.current) {
          setMemo(payload.memo);
          memoRef.current = payload.memo;
        }
      } else if (payload.type === "deleted" && payload.id === memoId) {
        // 삭제되면 창 닫기
        getCurrentWindow().close();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [memoId]);

  // 디바운스 cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // 언마운트 시 마지막 변경사항 즉시 저장
        if (memoRef.current) {
          invoke("update_memo", {
            id: memoRef.current.id,
            update: {
              title: memoRef.current.title,
              content: memoRef.current.content,
              color: memoRef.current.color,
            },
          }).catch(console.error);
        }
      }
    };
  }, []);

  // 메모 저장 (새 API 사용)
  const saveMemo = useCallback(async (updatedMemo: Memo) => {
    setSaveStatus("saving");
    try {
      await invoke("update_memo", {
        id: updatedMemo.id,
        update: {
          title: updatedMemo.title,
          content: updatedMemo.content,
          color: updatedMemo.color,
          window: updatedMemo.window,
        },
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1000);
    } catch (e) {
      console.error("Failed to save:", e);
      setSaveStatus("");
    }
  }, []);

  // 메모 업데이트 (디바운스 수정)
  const updateMemo = useCallback(
    (field: "title" | "content" | "color", value: string) => {
      if (!memo) return;

      const updated: Memo = {
        ...memo,
        [field]: value,
        updatedAt: Date.now(),
      };
      setMemo(updated);
      memoRef.current = updated;

      // 기존 타이머 취소
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 새 타이머 설정 (500ms)
      saveTimeoutRef.current = window.setTimeout(() => {
        saveMemo(updated);
        saveTimeoutRef.current = null;
      }, 500);
    },
    [memo, saveMemo]
  );

  // Always on top 토글
  const toggleAlwaysOnTop = async () => {
    try {
      const window = getCurrentWindow();
      const newValue = !isAlwaysOnTop;
      await window.setAlwaysOnTop(newValue);
      setIsAlwaysOnTop(newValue);
    } catch (e) {
      console.error("Failed to toggle always on top:", e);
    }
  };

  // 창 닫기
  const closeWindow = async () => {
    try {
      // 대기 중인 저장 취소 후 즉시 저장
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // 윈도우 상태 저장
      if (memo) {
        const window = getCurrentWindow();
        const position = await window.outerPosition();
        const size = await window.outerSize();

        await invoke("update_memo", {
          id: memo.id,
          update: {
            title: memo.title,
            content: memo.content,
            color: memo.color,
            window: {
              isOpen: false,
              x: position.x,
              y: position.y,
              width: size.width,
              height: size.height,
              alwaysOnTop: isAlwaysOnTop,
            },
          },
        });
      }

      const window = getCurrentWindow();
      await window.close();
    } catch (e) {
      console.error("Failed to close:", e);
    }
  };

  // 리사이즈 시작
  const startResize = async () => {
    try {
      const window = getCurrentWindow();
      await window.startResizeDragging("SouthEast");
    } catch (e) {
      console.error("Failed to start resize:", e);
    }
  };

  if (!memo) {
    return (
      <div className="memo-window loading">
        <span>로딩 중...</span>
      </div>
    );
  }

  return (
    <div
      className="memo-window"
      style={{
        backgroundColor: colorStyle.bg,
        color: colorStyle.text,
      }}
    >
      {/* 헤더 (드래그 가능 영역) */}
      <div
        className="memo-header"
        data-tauri-drag-region
        style={{ backgroundColor: colorStyle.header }}
      >
        <div className="header-left" data-tauri-drag-region>
          <button
            className="header-btn color-btn"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="색상 변경"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" fill="currentColor" opacity="0.6" />
              <circle cx="7" cy="7" r="3" fill="currentColor" />
            </svg>
          </button>
          {saveStatus && (
            <span className="save-indicator">
              {saveStatus === "saving" ? "..." : "✓"}
            </span>
          )}
        </div>
        <div className="header-right">
          <button
            className={`header-btn pin-btn ${isAlwaysOnTop ? "active" : ""}`}
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? "고정 해제" : "항상 위에"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v3M3.5 4h5l-.75 3h-3.5L3.5 4zM4.25 7v4M7.75 7v4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button className="header-btn close-btn" onClick={closeWindow} title="닫기">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 색상 선택기 */}
      {showColorPicker && (
        <div className="color-picker">
          {COLORS.map((color) => (
            <button
              key={color.id}
              className={`color-option ${memo.color === color.id ? "active" : ""}`}
              style={{ backgroundColor: color.header }}
              onClick={() => {
                updateMemo("color", color.id);
                setShowColorPicker(false);
              }}
              title={color.id}
            />
          ))}
        </div>
      )}

      {/* 제목 */}
      <input
        type="text"
        className="memo-title"
        value={memo.title}
        onChange={(e) => updateMemo("title", e.target.value)}
        placeholder="제목"
        style={{ color: colorStyle.text }}
        spellCheck={false}
      />

      {/* 내용 */}
      <textarea
        className="memo-content"
        value={memo.content}
        onChange={(e) => updateMemo("content", e.target.value)}
        placeholder="메모를 입력하세요..."
        style={{ color: colorStyle.text }}
        spellCheck={false}
      />

      {/* 리사이즈 핸들 */}
      <div className="resize-handle" onMouseDown={startResize} />
    </div>
  );
}

export default MemoWindow;
