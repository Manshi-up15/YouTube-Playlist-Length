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
  const downloadPdfBtn = document.getElementById("download-pdf");

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

  // --- PDF Download ---
  downloadPdfBtn.addEventListener("click", () => {
    if (!storedPlaylistData || !currentVideos.length) {
      alert("Please analyze a playlist first before downloading.");
      return;
    }
    try {
      generatePDF(storedPlaylistData, currentVideos);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error generating PDF: " + err.message);
    }
  });

  function generatePDF(data, videos) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library is still loading. Please wait a moment and try again.");
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var marginL = 15, marginR = 15, marginT = 15;
    var contentW = pageW - marginL - marginR;
    var y = marginT;

    function addPageNumbers() {
      var pages = doc.internal.getNumberOfPages();
      for (var i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Page " + i + " of " + pages, pageW / 2, pageH - 8, { align: "center" });
        doc.text("PlaylistPulse", pageW - marginR, pageH - 8, { align: "right" });
      }
    }

    function needsNewPage(needed) {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = marginT;
        return true;
      }
      return false;
    }

    function toAscii(str) {
      if (!str) return "";
      return String(str).replace(/[^\x00-\x7F]/g, ""); // Remove non-ASCII
    }

    // === HEADER ===
    doc.setFillColor(15, 15, 25);
    doc.rect(0, 0, pageW, 52, "F");

    // Accent line
    doc.setFillColor(244, 63, 94);
    doc.rect(0, 52, pageW / 2, 1.2, "F");
    doc.setFillColor(168, 85, 247);
    doc.rect(pageW / 2, 52, pageW / 2, 1.2, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    var safeTitle = toAscii(data.playlistTitle || "Playlist");
    var titleLines = doc.splitTextToSize(safeTitle, contentW);
    doc.text(titleLines, marginL, 26);

    // Channel & stats - ASCII only
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 190);
    var channelName = toAscii(data.playlistChannel || "");
    doc.text(channelName + "  |  " + data.availableCount + " videos  |  Total: " + data.totalDurationFormatted + "  |  " + data.totalDurationHuman, marginL, 38);

    // Date
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text("Generated: " + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), marginL, 46);

    y = 60;

    // === CHECKLIST LABEL ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 50);
    doc.text("Video Checklist", marginL, y);
    y += 3;
    doc.setDrawColor(244, 63, 94);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + 30, y);
    y += 8;

    // === TABLE HEADER ===
    function drawTableHeader() {
      doc.setFillColor(245, 245, 248);
      doc.rect(marginL, y - 4, contentW, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 110);
      doc.text("Done", marginL + 2, y);
      doc.text("#", marginL + 14, y);
      doc.text("VIDEO TITLE", marginL + 22, y);
      doc.text("DURATION", pageW - marginR - 2, y, { align: "right" });
      y += 7;
    }
    drawTableHeader();

    // === VIDEO ROWS ===
    doc.setFont("helvetica", "normal");
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      var addedPage = needsNewPage(9);
      if (addedPage) { drawTableHeader(); }

      var rowY = y;

      // Alternating row bg
      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(marginL, rowY - 4, contentW, 8, "F");
      }

      // Checkbox square
      doc.setDrawColor(180, 180, 190);
      doc.setLineWidth(0.3);
      doc.rect(marginL + 2, rowY - 3, 4, 4, "S");

      // Position
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 160);
      doc.text(String(v.position), marginL + 14, rowY);

      // Title
      var maxTitleW = contentW - 55;
      doc.setFontSize(8.5);
      doc.setTextColor(v.isUnavailable ? 180 : 40, v.isUnavailable ? 180 : 40, v.isUnavailable ? 180 : 50);
      var title = toAscii(v.title || "Unavailable");
      while (doc.getTextWidth(title) > maxTitleW && title.length > 5) {
        title = title.substring(0, title.length - 4) + "...";
      }
      doc.text(title, marginL + 22, rowY);

      // Duration
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 120);
      var durText = v.durationFormatted || "N/A";
      var durW = doc.getTextWidth(durText) + 4;
      var durX = pageW - marginR - durW;
      doc.setFillColor(240, 240, 245);
      doc.rect(durX - 1, rowY - 3.5, durW + 2, 5, "F");
      doc.text(durText, durX + 1, rowY);

      y += 8;
    }

    // === FOOTER SUMMARY ===
    y += 4;
    needsNewPage(20);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 8;

    doc.setFillColor(248, 245, 255);
    doc.rect(marginL, y - 5, contentW, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(99, 102, 241);
    var summaryText = "Total Playlist Duration: " + data.totalDurationFormatted;
    doc.text(summaryText, marginL + 6, y + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 140);
    doc.text("(" + data.totalDurationHuman + ")", marginL + 6 + doc.getTextWidth(summaryText + "  "), y + 2);

    addPageNumbers();

    // Save using explicit Blob download to prevent browser extension / format corruption
    var safeName = (data.playlistTitle || "playlist").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    if (!safeName.replace(/_/g, "").trim()) {
      safeName = "playlist";
    }
    var filename = safeName + "_checklist.pdf";

    try {
      var blob = doc.output("blob");
      var blobUrl = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() {
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (e) {
      console.error("Blob download failed, falling back to doc.save", e);
      doc.save(filename);
    }
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();
