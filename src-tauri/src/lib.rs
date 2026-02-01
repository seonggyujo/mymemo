use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

// ============================================
// 데이터 구조체
// ============================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowState {
    #[serde(rename = "isOpen")]
    is_open: bool,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    #[serde(rename = "alwaysOnTop")]
    always_on_top: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Memo {
    id: String,
    title: String,
    content: String,
    color: String,
    #[serde(rename = "updatedAt")]
    updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    window: Option<WindowState>,
}

// 메모 업데이트 요청 구조체
#[derive(Debug, Deserialize)]
pub struct MemoUpdate {
    title: Option<String>,
    content: Option<String>,
    color: Option<String>,
    window: Option<WindowState>,
}

// 이벤트 페이로드
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum MemoEvent {
    Created { memo: Memo },
    Updated { memo: Memo },
    Deleted { id: String },
    Reloaded { memos: Vec<Memo> },
}

// ============================================
// 앱 상태 (메모리 캐시)
// ============================================

pub struct AppState {
    memos: Mutex<Vec<Memo>>,
    save_pending: AtomicBool,
}

impl AppState {
    fn new() -> Self {
        let memos = load_memos_from_file();
        Self {
            memos: Mutex::new(memos),
            save_pending: AtomicBool::new(false),
        }
    }
}

// ============================================
// 파일 I/O 함수
// ============================================

fn get_data_path() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mymemo");

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).ok();
    }

    data_dir.join("memos.json")
}

fn load_memos_from_file() -> Vec<Memo> {
    let path = get_data_path();

    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    } else {
        Vec::new()
    }
}

fn save_memos_to_file(memos: &Vec<Memo>) -> Result<(), String> {
    let path = get_data_path();

    // 개발 모드: pretty print, 프로덕션: compact
    #[cfg(debug_assertions)]
    let json = serde_json::to_string_pretty(memos).map_err(|e| e.to_string())?;

    #[cfg(not(debug_assertions))]
    let json = serde_json::to_string(memos).map_err(|e| e.to_string())?;

    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

// 배치 저장 스케줄링 (500ms 디바운스) - 수정됨
// Arc<AppState>를 받아 저장 시점에 최신 데이터를 읽음
fn schedule_save(state: &Arc<AppState>) {
    let state = Arc::clone(state);
    if !state.save_pending.swap(true, Ordering::SeqCst) {
        // 이미 pending이 아닐 때만 새 스레드 생성
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(500));
            // 저장 시점에 최신 데이터 읽기
            let memos = state.memos.lock().unwrap().clone();
            if let Err(e) = save_memos_to_file(&memos) {
                eprintln!("Failed to save memos: {}", e);
            }
            // 저장 완료 후 플래그 리셋
            state.save_pending.store(false, Ordering::SeqCst);
        });
    }
}

// 즉시 저장 (상태 변경 후 플래그 리셋)
fn save_immediately(state: &AppState) -> Result<(), String> {
    let memos = state.memos.lock().unwrap().clone();
    save_memos_to_file(&memos)?;
    state.save_pending.store(false, Ordering::SeqCst);
    Ok(())
}

// ============================================
// Tauri Commands - 메모 CRUD
// ============================================

// 타입 별칭: Arc로 감싼 AppState
type SharedState = Arc<AppState>;

/// 모든 메모 조회 (캐시에서)
#[tauri::command]
fn load_memos(state: State<SharedState>) -> Vec<Memo> {
    state.memos.lock().unwrap().clone()
}

/// 단일 메모 조회
#[tauri::command]
fn get_memo(state: State<SharedState>, id: String) -> Option<Memo> {
    state.memos.lock().unwrap().iter().find(|m| m.id == id).cloned()
}

/// 메모 생성
#[tauri::command]
fn create_memo(app: AppHandle, state: State<SharedState>, memo: Memo) -> Result<Memo, String> {
    {
        let mut memos = state.memos.lock().unwrap();
        memos.insert(0, memo.clone());
    }
    
    // State<Arc<AppState>>에서 &Arc<AppState>로 변환
    schedule_save(state.inner());
    
    // 이벤트 발행
    app.emit("memo-changed", MemoEvent::Created { memo: memo.clone() }).ok();
    
    Ok(memo)
}

/// 메모 업데이트 (개별 필드)
#[tauri::command]
fn update_memo(
    app: AppHandle,
    state: State<SharedState>,
    id: String,
    update: MemoUpdate,
) -> Result<Memo, String> {
    let updated_memo: Memo;
    
    {
        let mut memos = state.memos.lock().unwrap();
        let memo = memos.iter_mut().find(|m| m.id == id);
        
        match memo {
            Some(m) => {
                if let Some(title) = update.title {
                    m.title = title;
                }
                if let Some(content) = update.content {
                    m.content = content;
                }
                if let Some(color) = update.color {
                    m.color = color;
                }
                if let Some(window) = update.window {
                    m.window = Some(window);
                }
                m.updated_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                
                updated_memo = m.clone();
            }
            None => return Err(format!("Memo not found: {}", id)),
        }
    }
    
    schedule_save(state.inner());
    
    // 이벤트 발행
    app.emit("memo-changed", MemoEvent::Updated { memo: updated_memo.clone() }).ok();
    
    Ok(updated_memo)
}

/// 메모 삭제
#[tauri::command]
fn delete_memo(app: AppHandle, state: State<SharedState>, id: String) -> Result<(), String> {
    {
        let mut memos = state.memos.lock().unwrap();
        let len_before = memos.len();
        memos.retain(|m| m.id != id);
        
        if memos.len() == len_before {
            return Err(format!("Memo not found: {}", id));
        }
    }
    
    save_immediately(&state)?;
    
    // 이벤트 발행
    app.emit("memo-changed", MemoEvent::Deleted { id: id.clone() }).ok();
    
    Ok(())
}

// ============================================
// Tauri Commands - 윈도우 관리
// ============================================

#[tauri::command]
async fn open_memo_window(app: AppHandle, memo_id: String) -> Result<(), String> {
    let label = format!("memo-{}", memo_id);

    // 이미 열려 있으면 포커스만
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // 새 윈도우 생성 - 개발/프로덕션 모드 분기
    #[cfg(debug_assertions)]
    let url = WebviewUrl::External(
        format!("http://localhost:5173/?window=memo&id={}", memo_id)
            .parse()
            .unwrap(),
    );

    #[cfg(not(debug_assertions))]
    let url = WebviewUrl::App(format!("index.html?window=memo&id={}", memo_id).into());

    WebviewWindowBuilder::new(&app, &label, url)
        .title("메모")
        .inner_size(300.0, 350.0)
        .min_inner_size(200.0, 150.0)
        .decorations(false)
        .transparent(false)
        .always_on_top(false)
        .resizable(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_memo_window(app: AppHandle, memo_id: String) -> Result<(), String> {
    let label = format!("memo-{}", memo_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================
// 시스템 트레이
// ============================================

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "메모 목록 열기", true, None::<&str>)?;
    let new_i = MenuItem::with_id(app, "new", "새 메모", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_i, &new_i, &quit_i])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
                "new" => {
                    // 새 메모 생성
                    let memo_id = uuid::Uuid::new_v4().to_string();
                    let new_memo = Memo {
                        id: memo_id.clone(),
                        title: "새 메모".to_string(),
                        content: String::new(),
                        color: "yellow".to_string(),
                        updated_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                        window: None,
                    };

                    // AppState를 통해 메모 저장
                    let state = app.state::<SharedState>();
                    {
                        let mut memos = state.memos.lock().unwrap();
                        memos.insert(0, new_memo.clone());
                    }
                    if let Err(e) = save_immediately(&state) {
                        eprintln!("Failed to save memo: {}", e);
                    }

                    // 이벤트 발행
                    app.emit("memo-changed", MemoEvent::Created { memo: new_memo }).ok();

                    // 새 창 열기
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = open_memo_window(app_clone, memo_id).await {
                            eprintln!("Failed to open memo window: {}", e);
                        }
                    });
                }
                "quit" => {
                    // 종료 전 저장 보장
                    let state = app.state::<SharedState>();
                    save_immediately(&state).ok();
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ============================================
// 앱 진입점
// ============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(AppState::new()))
        .invoke_handler(tauri::generate_handler![
            load_memos,
            get_memo,
            create_memo,
            update_memo,
            delete_memo,
            open_memo_window,
            close_memo_window,
            show_main_window
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 메인 창 닫기 시 숨기기 (트레이로)
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    window.hide().ok();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
