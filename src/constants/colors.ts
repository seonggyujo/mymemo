// 메모 색상 상수 및 유틸리티
import type { MemoColor } from "../types";

export interface ColorStyle {
  id: MemoColor;
  bg: string;
  header: string;
  text: string;
}

export const COLORS: ColorStyle[] = [
  { id: "yellow", bg: "#fef3c7", header: "#fcd34d", text: "#92400e" },
  { id: "green", bg: "#d1fae5", header: "#6ee7b7", text: "#065f46" },
  { id: "blue", bg: "#dbeafe", header: "#93c5fd", text: "#1e40af" },
  { id: "purple", bg: "#ede9fe", header: "#c4b5fd", text: "#5b21b6" },
  { id: "pink", bg: "#fce7f3", header: "#f9a8d4", text: "#9d174d" },
  { id: "gray", bg: "#f3f4f6", header: "#d1d5db", text: "#374151" },
  { id: "dark", bg: "#1f2937", header: "#374151", text: "#f3f4f6" },
];

// O(1) 조회를 위한 색상 맵
export const COLOR_MAP: Record<MemoColor, ColorStyle> = Object.fromEntries(
  COLORS.map((c) => [c.id, c])
) as Record<MemoColor, ColorStyle>;

// 색상 스타일 조회 (O(1))
export const getColorStyle = (colorId: string): ColorStyle => {
  return COLOR_MAP[colorId as MemoColor] || COLORS[0];
};
