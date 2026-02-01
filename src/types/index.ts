// 메모 앱 타입 정의

export interface WindowState {
  isOpen: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  color: string;
  updatedAt: number;
  window?: WindowState;
}

export type MemoColor = "yellow" | "green" | "blue" | "purple" | "pink" | "gray" | "dark";

// Tauri 이벤트 타입
export type MemoEventPayload =
  | { type: "created"; memo: Memo }
  | { type: "updated"; memo: Memo }
  | { type: "deleted"; id: string }
  | { type: "reloaded"; memos: Memo[] };
