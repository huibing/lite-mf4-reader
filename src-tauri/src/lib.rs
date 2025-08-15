use mf4_parse::{Mf4Wrapper, DataValue};
use tauri::Emitter;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;


pub struct FileCache {
    inner: Arc<Mutex<HashMap<String, Mf4Wrapper>>>,
}

impl FileCache {
    pub fn new() -> Self {
        FileCache {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn insert(&self, key: String, value: Mf4Wrapper) {
        let mut map = self.inner.lock().unwrap();
        map.insert(key, value);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(FileCache::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_mf4_channels, get_mf4_channel_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_mf4_channels(mf4_path: &str, app: tauri::AppHandle, cache: tauri::State<FileCache>) -> Result<Vec<String>, String> {
    let path = std::path::PathBuf::from(mf4_path);
    let mf4 = Mf4Wrapper::new(path, Some(&move | progress | {
        transmit_reading_progress(&app, progress)
    }));
    if let Ok(mf4) = mf4 {
        let channel_names = mf4.get_channel_names();
        cache.insert(mf4_path.to_string(), mf4);  // save to cache
        Ok(channel_names)
    } else {
        Err(String::from("Error opening file"))
    }
}


#[tauri::command]
fn get_mf4_channel_data(mf4_path: &str, channel_name: &str, cache: tauri::State<FileCache>) -> Result<(Vec<f64>, Vec<f64>), String> {
    let start = Instant::now();
    let mf4_obj = cache.inner.lock().unwrap();
    if let Some(mf4) = mf4_obj.get(mf4_path) {
       let (data, time) = get_channel_data(mf4, channel_name)?;
       let elapsed = start.elapsed();
       println!("Elapsed: {:?}", elapsed);
        Ok((data, time))
    } else {
      Err(String::from("File not found in cache, please load file first"))
    }
}

fn transmit_reading_progress(
    app: &tauri::AppHandle,
    progress: f64,
) {
    app.emit("progress-message", progress)
        .unwrap();
}


fn get_channel_data(mf4: &Mf4Wrapper, channel_name: &str) -> Result<(Vec<f64>, Vec<f64>), String> {
    let data: Vec<f64> = mf4.get_channel_data(channel_name)
        .ok_or("Failed to get channel data")?
        .try_into()
        .map_err(|_| String::from("Failed to convert channel data"))?;
    let time = mf4.get_channel_master_data(channel_name).ok_or("Failed to get channel data")?;
    if let DataValue::REAL(time) = time {
        let time: Vec<f64> = time.into_iter().map(|v| v.clone()).collect();
        Ok((data, time))
    } else {
        Err(String::from("Time data is not of type REAL"))
    }
}