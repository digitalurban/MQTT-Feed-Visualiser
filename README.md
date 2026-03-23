A high-density, real-time visualization dashboard for MQTT data streams. This application maps thousands of unique MQTT topics onto a 90x90 grid, creating a "digital pulse" of the connected broker.

## 🚀 Live Demo
Check out the live application here: [MQTT Visualiser](https://ais-pre-5ikfcxjwrw2l6ulk4vthuk-554238243855.europe-west2.run.app)

## ✨ Features

- **High-Density Grid**: Visualizes up to 8,100 unique MQTT topics on a 90x90 interactive canvas.
- **Real-Time Activity**: Pixels flash white instantly when a message is received on their corresponding topic.
- **Branch-Based Color Coding**: Automatically categorizes topics by their root path:
  - 🟢 `personal/#` - Green
  - 🔵 `UCL/#` - Blue
  - 🟠 `student/#` - Orange
  - 🟡 `tasmota/#` - Yellow
  - ⚪ `Other` - Gray
- **Inactivity Monitoring**: Topics that haven't received an update in over 61 minutes turn **Red**, signaling potential offline status.
- **Interactive Inspection**: Click any pixel on the grid to view the full topic path, latest payload, and last-seen timestamp.
- **Featured Feed**: A dedicated section that cycles through active topics every 60 seconds to highlight live data.
- **Fullscreen Mode**: Immerse yourself in the data grid with a single click.

## 📸 Screenshots

| Dashboard Overview | Topic Inspection |
| :---: | :---: |
| ![Overview Placeholder](https://picsum.photos/seed/mqtt-overview/600/400) | ![Inspection Placeholder](https://picsum.photos/seed/mqtt-inspect/600/400) |
| *The main 90x90 visualization grid.* | *Detailed view of a selected MQTT topic.* |

## 🛠️ Technical Setup

### Broker Configuration
- **Broker**: `mqtt.cetools.org`
- **Protocol**: WebSockets (`wss`)
- **Port**: `8081`
- **Path**: `/mqtt`

### Built With
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **MQTT.js** - MQTT Client
- **Tailwind CSS** - Styling
