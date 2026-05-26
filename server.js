require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Parse ISO 8601 duration (e.g. PT1H2M3S) into total seconds.
 */
function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format total seconds to HH:MM:SS or MM:SS.
 */
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Extract playlist ID from various YouTube URL formats.
 */
function extractPlaylistId(url) {
  // Handle direct playlist ID (no URL)
  if (/^PL[A-Za-z0-9_-]+$/.test(url.trim())) {
    return url.trim();
  }
  // Also handle OLAK (YouTube Music album playlists), RD (mixes), etc.
  if (/^(PL|OL|RD|UU|FL|LL)[A-Za-z0-9_-]+$/.test(url.trim())) {
    return url.trim();
  }

  try {
    const parsed = new URL(url.trim());
    const listParam = parsed.searchParams.get("list");
    if (listParam) return listParam;
  } catch (e) {
    // not a valid URL
  }
  return null;
}

/**
 * API endpoint to analyze a YouTube playlist.
 */
app.post("/api/analyze", async (req, res) => {
  try {
    const { url, apiKey } = req.body;

    // Use user-provided key or fallback to env key
    const key = apiKey && apiKey.trim() ? apiKey.trim() : YOUTUBE_API_KEY;

    if (!key || key === "YOUR_API_KEY_HERE") {
      return res.status(400).json({
        error:
          "No YouTube API key configured. Please provide your API key in the settings.",
      });
    }

    const playlistId = extractPlaylistId(url || "");
    if (!playlistId) {
      return res.status(400).json({
        error:
          "Invalid playlist URL. Please paste a valid YouTube or YouTube Music playlist link.",
      });
    }

    // 1. Get playlist metadata
    const playlistMeta = await fetch(
      `${YOUTUBE_API_BASE}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${key}`
    );
    const playlistData = await playlistMeta.json();

    if (playlistData.error) {
      return res.status(400).json({
        error: playlistData.error.message || "YouTube API error",
      });
    }

    if (!playlistData.items || playlistData.items.length === 0) {
      return res.status(404).json({ error: "Playlist not found." });
    }

    const playlist = playlistData.items[0];
    const playlistTitle = playlist.snippet.title;
    const playlistChannel = playlist.snippet.channelTitle;
    const playlistThumbnail =
      playlist.snippet.thumbnails?.maxres?.url ||
      playlist.snippet.thumbnails?.high?.url ||
      playlist.snippet.thumbnails?.medium?.url ||
      playlist.snippet.thumbnails?.default?.url ||
      "";
    const totalVideos = playlist.contentDetails.itemCount;

    // 2. Fetch all playlist items (paginated)
    let allItems = [];
    let nextPageToken = "";

    do {
      const itemsUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${key}`;
      const itemsRes = await fetch(itemsUrl);
      const itemsData = await itemsRes.json();

      if (itemsData.error) {
        return res.status(400).json({
          error: itemsData.error.message || "YouTube API error fetching items",
        });
      }

      if (itemsData.items) {
        allItems = allItems.concat(itemsData.items);
      }
      nextPageToken = itemsData.nextPageToken || "";
    } while (nextPageToken);

    // 3. Get video durations in batches of 50
    const videoIds = allItems
      .map((item) => item.contentDetails?.videoId)
      .filter(Boolean);

    let videoDurations = {};
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const videosUrl = `${YOUTUBE_API_BASE}/videos?part=contentDetails,snippet&id=${batch.join(",")}&key=${key}`;
      const videosRes = await fetch(videosUrl);
      const videosData = await videosRes.json();

      if (videosData.items) {
        for (const video of videosData.items) {
          videoDurations[video.id] = {
            duration: video.contentDetails.duration,
            seconds: parseDuration(video.contentDetails.duration),
            title: video.snippet.title,
            channel: video.snippet.channelTitle,
            thumbnail:
              video.snippet.thumbnails?.medium?.url ||
              video.snippet.thumbnails?.default?.url ||
              "",
          };
        }
      }
    }

    // 4. Build the response
    const videos = allItems.map((item, index) => {
      const videoId = item.contentDetails?.videoId;
      const info = videoDurations[videoId];
      return {
        position: index + 1,
        title: info?.title || item.snippet?.title || "Private/Deleted Video",
        channel: info?.channel || item.snippet?.videoOwnerChannelTitle || "",
        thumbnail: info?.thumbnail || item.snippet?.thumbnails?.medium?.url || "",
        videoId: videoId,
        durationSeconds: info?.seconds || 0,
        durationFormatted: info ? formatDuration(info.seconds) : "N/A",
        isUnavailable: !info,
      };
    });

    const totalSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
    const availableCount = videos.filter((v) => !v.isUnavailable).length;
    const unavailableCount = videos.filter((v) => v.isUnavailable).length;

    // Calculate average speed durations
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const atSpeeds = {};
    for (const speed of speeds) {
      atSpeeds[speed] = formatDuration(Math.round(totalSeconds / speed));
    }

    res.json({
      playlistTitle,
      playlistChannel,
      playlistThumbnail,
      playlistId,
      totalVideos: totalVideos,
      availableCount,
      unavailableCount,
      totalDurationSeconds: totalSeconds,
      totalDurationFormatted: formatDuration(totalSeconds),
      totalDurationHuman: humanizeDuration(totalSeconds),
      atSpeeds,
      videos,
    });
  } catch (err) {
    console.error("Error analyzing playlist:", err);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

/**
 * Convert seconds to a human-friendly string.
 */
function humanizeDuration(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
  return parts.join(", ") || "0 seconds";
}

app.listen(PORT, () => {
  console.log(`🎬 YouTube Playlist Length Calculator running at http://localhost:${PORT}`);
});
