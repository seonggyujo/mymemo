import React from "react";
import type { Memo } from "../types";
import { getColorStyle } from "../constants/colors";

interface MemoCardProps {
  memo: Memo;
  onOpen: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatTime: (timestamp: number) => string;
}

const MemoCard: React.FC<MemoCardProps> = React.memo(
  ({ memo, onOpen, onDelete, formatTime }) => {
    const color = getColorStyle(memo.color);

    return (
      <div
        className="memo-card"
        style={{
          backgroundColor: color.bg,
          borderColor: color.header,
        }}
        onClick={() => onOpen(memo.id)}
      >
        <div
          className="memo-card-header"
          style={{ backgroundColor: color.header }}
        >
          <span className="memo-card-title" style={{ color: color.text }}>
            {memo.title || "제목 없음"}
          </span>
          <button
            className="delete-btn"
            onClick={(e) => onDelete(memo.id, e)}
            title="삭제"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="memo-card-content" style={{ color: color.text }}>
          {memo.content.slice(0, 100) || "내용 없음"}
        </div>
        <div className="memo-card-footer">
          <span className="memo-card-time">{formatTime(memo.updatedAt)}</span>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 커스텀 비교: memo 객체가 같으면 리렌더 스킵
    return (
      prevProps.memo.id === nextProps.memo.id &&
      prevProps.memo.title === nextProps.memo.title &&
      prevProps.memo.content === nextProps.memo.content &&
      prevProps.memo.color === nextProps.memo.color &&
      prevProps.memo.updatedAt === nextProps.memo.updatedAt
    );
  }
);

export default MemoCard;
