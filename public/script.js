(() => {
  // DOM references
  const urlInput = document.getElementById("playlist-url");
  const analyzeBtn = document.getElementById("analyze-btn");
  const btnText = analyzeBtn.querySelector(".btn-text");
  const btnLoader = analyzeBtn.querySelector(".btn-loader");
  const clearBtn = document.getElementById("clear-input");
  const errorMsg = document.getElementById("error-msg");
  const resultsSection = document.getElementById("results");
  const apiKeyToggle = document.getElementById("api-key-toggle");
  const apiKeyModal = document.getElementById("api-key-modal");
  const apiKeyInput = document.getElementById("api-key-input");
  const apiKeySave = document.getElementById("api-key-save");
  const apiKeyClear = document.getElementById("api-key-clear");
  const modalClose = document.getElementById("modal-close");
  const videoSearch = document.getElementById("video-search");
  const sortToggle = document.getElementById("sort-toggle");
  const downloadWordBtn = document.getElementById("download-word");

  let currentVideos = [];
  let sortAsc = false;
  let storedPlaylistData = null;

  // --- API Key Management ---
  function getApiKey() { return localStorage.getItem("yt_api_key") || ""; }
  function setApiKey(k) { localStorage.setItem("yt_api_key", k); }
  function clearApiKey() { localStorage.removeItem("yt_api_key"); }

  apiKeyToggle.addEventListener("click", () => { apiKeyInput.value = getApiKey(); apiKeyModal.classList.remove("hidden"); });
  modalClose.addEventListener("click", () => apiKeyModal.classList.add("hidden"));
  apiKeyModal.addEventListener("click", (e) => { if (e.target === apiKeyModal) apiKeyModal.classList.add("hidden"); });
  apiKeySave.addEventListener("click", () => {
    const k = apiKeyInput.value.trim();
    if (k) { setApiKey(k); apiKeyModal.classList.add("hidden"); apiKeyInput.value = ""; }
  });
  apiKeyClear.addEventListener("click", () => { clearApiKey(); apiKeyInput.value = ""; });

  // --- Input Handling ---
  urlInput.addEventListener("input", () => { clearBtn.classList.toggle("hidden", !urlInput.value); });
  clearBtn.addEventListener("click", () => { urlInput.value = ""; clearBtn.classList.add("hidden"); urlInput.focus(); });

  document.querySelectorAll(".example-link").forEach((btn) => {
    btn.addEventListener("click", () => { urlInput.value = btn.dataset.url; clearBtn.classList.remove("hidden"); urlInput.focus(); });
  });

  urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") analyzeBtn.click(); });

  // --- Format helpers ---
  function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return m + ":" + String(s).padStart(2, "0");
  }

  // --- Analyze Playlist ---
  analyzeBtn.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) { showError("Please paste a YouTube playlist link."); return; }
    const apiKey = getApiKey();
    if (!apiKey) { showError("Please set your YouTube API key first (click the gear icon)."); apiKeyModal.classList.remove("hidden"); return; }

    setLoading(true);
    hideError();
    resultsSection.classList.add("hidden");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Something went wrong."); return; }
      renderResults(data);
    } catch (err) {
      showError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(on) {
    analyzeBtn.disabled = on;
    btnText.classList.toggle("hidden", on);
    btnLoader.classList.toggle("hidden", !on);
  }
  function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove("hidden"); }
  function hideError() { errorMsg.classList.add("hidden"); }

  // --- Render Results ---
  function renderResults(data) {
    storedPlaylistData = data;

    document.getElementById("playlist-title").textContent = data.playlistTitle;
    document.getElementById("playlist-channel").textContent = data.playlistChannel;
    const thumb = document.getElementById("playlist-thumb");
    if (data.playlistThumbnail) { thumb.src = data.playlistThumbnail; thumb.style.display = ""; }
    else { thumb.style.display = "none"; }

    document.querySelector("#video-count span").textContent = data.availableCount + " videos";
    const unavail = document.getElementById("unavailable-count");
    if (data.unavailableCount > 0) {
      unavail.classList.remove("hidden");
      unavail.querySelector("span").textContent = data.unavailableCount + " unavailable";
    } else { unavail.classList.add("hidden"); }

    document.getElementById("total-duration").textContent = data.totalDurationFormatted;
    document.getElementById("total-human").textContent = data.totalDurationHuman;

    const available = data.videos.filter((v) => !v.isUnavailable);
    if (available.length > 0) {
      const avgSec = Math.round(data.totalDurationSeconds / available.length);
      document.getElementById("avg-duration").textContent = formatDuration(avgSec);
      const sorted = [...available].sort((a, b) => a.durationSeconds - b.durationSeconds);
      document.getElementById("shortest-duration").textContent = sorted[0].durationFormatted;
      document.getElementById("shortest-title").textContent = sorted[0].title;
      document.getElementById("longest-duration").textContent = sorted[sorted.length - 1].durationFormatted;
      document.getElementById("longest-title").textContent = sorted[sorted.length - 1].title;
    }

    const speedContainer = document.getElementById("speed-cards");
    speedContainer.innerHTML = "";
    for (const [speed, duration] of Object.entries(data.atSpeeds)) {
      const card = document.createElement("div");
      card.className = "speed-card" + (speed === "1" ? " active" : "");
      card.innerHTML = '<div class="speed-label">' + speed + 'x</div><div class="speed-value">' + duration + '</div>';
      speedContainer.appendChild(card);
    }

    currentVideos = data.videos;
    renderVideoList(currentVideos);
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderVideoList(videos) {
    const list = document.getElementById("video-list");
    const empty = document.getElementById("video-list-empty");
    list.innerHTML = "";
    if (videos.length === 0) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");

    videos.forEach((v, i) => {
      const item = document.createElement("div");
      item.className = "video-item" + (v.isUnavailable ? " unavailable" : "");
      item.style.animationDelay = Math.min(i * 0.02, 0.5) + "s";
      var link = v.videoId ? '<a href="https://youtube.com/watch?v=' + v.videoId + '" target="_blank" rel="noopener">' + escapeHtml(v.title) + '</a>' : escapeHtml(v.title);
      item.innerHTML = '<span class="video-pos">' + v.position + '</span>' +
        '<div class="video-thumb"><img src="' + (v.thumbnail || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"/></div>' +
        '<div class="video-details"><div class="video-title">' + link + '</div><div class="video-channel">' + escapeHtml(v.channel) + '</div></div>' +
        '<span class="video-duration">' + v.durationFormatted + '</span>';
      list.appendChild(item);
    });
  }

  // --- Video Search ---
  videoSearch.addEventListener("input", () => {
    const q = videoSearch.value.toLowerCase();
    renderVideoList(currentVideos.filter((v) => v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q)));
  });

  // --- Sort Toggle ---
  sortToggle.addEventListener("click", () => {
    sortAsc = !sortAsc;
    renderVideoList([...currentVideos].sort((a, b) => sortAsc ? a.durationSeconds - b.durationSeconds : b.durationSeconds - a.durationSeconds));
  });

  // --- Word Document Download ---
  downloadWordBtn.addEventListener("click", () => {
    if (!storedPlaylistData || !currentVideos.length) {
      alert("Please analyze a playlist first before downloading.");
      return;
    }
    try {
      generateWordDoc(storedPlaylistData, currentVideos);
    } catch (err) {
      console.error("Word Document generation error:", err);
      alert("Error generating Word Document: " + err.message);
    }
  });

  function generateWordDoc(data, videos) {
    var header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
          "xmlns:w='urn:schemas-microsoft-com:office:word' " +
          "xmlns='http://www.w3.org/TR/REC-html40'>" +
          "<head><title>Playlist Checklist</title>" +
          "<style>" +
          "body { font-family: 'Segoe UI', Arial, sans-serif; color: #333333; margin: 20px; }" +
          "h1 { color: #f43f5e; font-size: 24px; margin-bottom: 5px; font-weight: bold; }" +
          ".channel { color: #666666; font-size: 14px; margin-bottom: 20px; }" +
          ".summary { background-color: #f8f5ff; border-left: 4px solid #6366f1; padding: 12px; margin-bottom: 25px; font-weight: bold; }" +
          "table { width: 100%; border-collapse: collapse; margin-top: 15px; }" +
          "th { background-color: #f5f5f8; text-align: left; padding: 10px; font-size: 13px; color: #666666; border-bottom: 2px solid #dddddd; font-weight: bold; }" +
          "td { padding: 10px; border-bottom: 1px solid #eeeeee; font-size: 13px; }" +
          ".checkbox { width: 18px; height: 18px; border: 1px solid #999999; display: inline-block; text-align: center; line-height: 18px; font-weight: bold; }" +
          ".pos { color: #888888; font-weight: bold; }" +
          ".duration { background-color: #f0f0f5; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; }" +
          "tr.even { background-color: #fcfcfe; }" +
          "</style>" +
          "</head>" +
          "<body>" +
          "<h1>" + (data.playlistTitle || "Playlist") + "</h1>" +
          "<div class='channel'>By " + (data.playlistChannel || "Unknown Channel") + " &bull; " + data.availableCount + " videos</div>" +
          "<div class='summary'>Total Duration: " + data.totalDurationFormatted + " (" + data.totalDurationHuman + ")</div>" +
          "<h2>Video Checklist</h2>" +
          "<table>" +
          "<thead>" +
          "<tr>" +
          "<th style='width: 60px;'>Done</th>" +
          "<th style='width: 40px;'>#</th>" +
          "<th>Video Title</th>" +
          "<th style='width: 100px; text-align: right;'>Duration</th>" +
          "</tr>" +
          "</thead>" +
          "<tbody>";

    var body = "";
    videos.forEach(function(v, i) {
      var rowClass = (i % 2 === 0) ? "even" : "odd";
      var title = v.title || "Unavailable";
      body += "<tr class='" + rowClass + "'>" +
        "<td>[  ]</td>" +
        "<td><span class='pos'>" + v.position + "</span></td>" +
        "<td>" + title + "</td>" +
        "<td style='text-align: right;'><span class='duration'>" + v.durationFormatted + "</span></td>" +
        "</tr>";
    });

    var footer = "</tbody></table></body></html>";
    var html = header + body + footer;

    var blob = new Blob(['\ufeff' + html], {
      type: 'application/msword'
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var safeName = (data.playlistTitle || "playlist").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    a.download = safeName + "_checklist.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();
