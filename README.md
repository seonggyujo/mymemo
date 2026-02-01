# MyMemo

> Windows용 가벼운 메모 위젯 앱

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/seonggyujo/mymemo/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/seonggyujo/mymemo/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 소개

MyMemo는 Windows 데스크톱에서 사용할 수 있는 심플한 메모 위젯 앱입니다. 노션 스타일의 깔끔한 디자인과 가벼운 성능을 제공합니다.

## 주요 기능

- **메모 카드 관리** - 메인 창에서 모든 메모를 카드 형태로 관리
- **개별 메모 창** - 각 메모를 독립된 위젯 창으로 열어 사용
- **드래그 & 리사이즈** - 메모 창을 자유롭게 이동하고 크기 조절
- **Always on Top** - 메모 창을 항상 위에 고정
- **7가지 색상 테마** - Yellow, Green, Blue, Pink, Purple, Orange, Gray
- **자동 저장** - 변경 사항 자동 저장 (디바운스 적용)
- **시스템 트레이** - 메인 창을 닫아도 메모 위젯 유지

## 설치

### 다운로드

[Releases](https://github.com/seonggyujo/mymemo/releases) 페이지에서 최신 버전을 다운로드하세요.

| 파일 | 설명 |
|------|------|
| `MyMemo_x.x.x_x64_en-US.msi` | MSI 설치 파일 |
| `MyMemo_x.x.x_x64-setup.exe` | NSIS 설치 파일 |

### 시스템 요구 사항

- Windows 10/11 (64-bit)
- WebView2 Runtime (Windows 11에는 기본 포함)

## 개발

### 사전 요구 사항

- [Node.js](https://nodejs.org/) (v18 이상)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/seonggyujo/mymemo.git
cd mymemo

# 의존성 설치
npm install

# 개발 모드 실행
npm run tauri dev

# 프로덕션 빌드
npm run tauri build
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Rust, Tauri 2 |
| 상태 관리 | 메모리 캐시 + 이벤트 기반 동기화 |
| 데이터 저장 | JSON 파일 (LocalAppData) |

## 프로젝트 구조

```
mymemo/
├── src/                    # React 프론트엔드
│   ├── components/         # 재사용 컴포넌트
│   ├── constants/          # 상수 (색상 등)
│   ├── types/              # TypeScript 타입
│   ├── App.tsx             # 메인 창
│   └── MemoWindow.tsx      # 개별 메모 창
├── src-tauri/              # Rust 백엔드
│   ├── src/lib.rs          # Tauri 커맨드, 트레이
│   └── tauri.conf.json     # Tauri 설정
└── package.json
```

## 데이터 저장 위치

```
%LocalAppData%\mymemo\memos.json
```

예: `C:\Users\{사용자}\AppData\Local\mymemo\memos.json`

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.

## 만든 사람

- [@seonggyujo](https://github.com/seonggyujo)
