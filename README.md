# Light weight mf4 data graphic viewer


## Description
This is a lightweight viewer for mf4 data files. It is written using Vue3 + tauri + d3 + rust. 

## Features
- Load mf4 data files
- Display numeric data in a chart
- Support multiple data files

## WIP
- [ ] Support MDF version 2.0 and 3.0
- [ ] Support string channels e.g. "Text" "Enum"
- [ ] Support differencial cursors
- [ ] Support pan
- [ ] Support channel info display


## Dependencies
- Rust
- pnpm or npm 


## Installation
1. Clone the repository
2. Install dependencies
   ```bash
   pnpm install
   ```
3. Build the application
   ```bash
   pnpm tauri build
   ```
   or you can use tauri dev to develop the application
   ```bash
   pnpm tauri dev
   ```


## Contributing
Contributions are welcome! Please feel free to submit pull requests or open issues.

## License
This project is licensed under the MIT License - see the LICENSE file for details.