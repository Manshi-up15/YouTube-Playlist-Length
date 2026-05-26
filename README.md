# PlaylistPulse — YouTube Playlist Length Calculator

PlaylistPulse is a fast, simple, and free-to-use web application that calculates the total length of any YouTube or YouTube Music playlist. With just a single click, you can get the total duration, view the titles of all videos along with their individual lengths, and calculate playback times at various speeds.

## ✨ Features

- **Lightning Fast:** Get results in seconds, even for playlists with hundreds of videos.
- **Detailed Insights:** View the total playlist length, shortest video, longest video, and average video duration.
- **Playback Speeds:** Automatically calculates total duration at 1x, 1.25x, 1.5x, 1.75x, and 2x speeds.
- **PDF Checklist Download:** Export the playlist details into a beautifully formatted PDF checklist for offline tracking.
- **Privacy First:** Your YouTube Data API v3 key is stored securely in your browser's local storage and is never transmitted to any third-party servers.
- **Free & Open Source:** No ads, no sign-ups, and no limits.

## 🚀 Getting Started

### Prerequisites

You need a **YouTube Data API v3 Key** to use this application. 
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Navigate to **APIs & Services > Library** and enable the **YouTube Data API v3**.
4. Go to **Credentials**, create an API key, and copy it.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Manshi-up15/YouTube-Playlist-Length.git
   cd YouTube-Playlist-Length
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file in the root directory and add your API key if you want to set a default fallback key for the server:
   ```env
   YOUTUBE_API_KEY=your_api_key_here
   PORT=3000
   ```
   *Note: Users can also provide their own API key directly through the app's settings UI.*

4. Start the development server:
   ```bash
   npm run dev
   ```
   Or start the production server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`.

## 🛠️ Technology Stack

- **Frontend:** HTML5, Vanilla CSS (Custom properties, Flexbox/Grid, Glassmorphism), JavaScript (ES6+).
- **Backend:** Node.js, Express.js.
- **API Integration:** YouTube Data API v3 via `node-fetch`.
- **Libraries:** `jsPDF` for client-side PDF generation.

## 📄 License

This project is open-source and free to use.
