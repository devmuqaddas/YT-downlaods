

let currentVideoData = null;
const activeDownloads = new Map();
const progressIntervals = new Map();

// DOM elements with proper null checks
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const extractBtn = document.getElementById("extractBtn");
const loading = document.getElementById("loading");
const error = document.getElementById("error");
const success = document.getElementById("success");
const videoInfo = document.getElementById("videoInfo");
const thumbnail = document.getElementById("thumbnail");
const videoTitle = document.getElementById("videoTitle");
const videoDuration = document.getElementById("videoDuration");
const videoUploader = document.getElementById("videoUploader");
const videoViews = document.getElementById("videoViews");
const videoLikes = document.getElementById("videoLikes");
const uploadDate = document.getElementById("uploadDate");
const videoDescription = document.getElementById("videoDescription");
const downloadsContainer = document.getElementById("downloadsContainer");
const downloadsList = document.getElementById("downloadsList");
const videoPlayer = document.getElementById("videoPlayer");
const videoElement = document.getElementById("videoElement");

function hideAllSections() {
  if (loading) loading.style.display = "none";
  if (videoInfo) videoInfo.style.display = "none";
  if (videoPlayer) videoPlayer.style.display = "none";
}

function showError(message) {
  if (error) {
    error.textContent = message;
    error.style.display = "block";
  }
  if (success) {
    success.style.display = "none";
  }
  setTimeout(() => {
    if (error) error.style.display = "none";
  }, 5000);
}

function showSuccess(message) {
  if (success) {
    success.textContent = message;
    success.style.display = "block";
  }
  if (error) {
    error.style.display = "none";
  }
  setTimeout(() => {
    if (success) success.style.display = "none";
  }, 3000);
}

function formatFileSize(bytes) {
  if (!bytes) return "Unknown size";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return "Unknown duration";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatNumber(num) {
  if (!num) return "Unknown";
  return num.toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return "Unknown date";
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
}

if (urlForm) {
  urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      showError("Please enter a valid YouTube URL");
      return;
    }

    hideAllSections();
    if (loading) loading.style.display = "block";
    if (extractBtn) extractBtn.disabled = true;

    try {
      const response = await fetch("/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        currentVideoData = data.data;
        currentVideoData.url = url;
        displayVideoInfo(data.data);
        showSuccess("Video information extracted successfully!");
      } else {
        showError(
          data.error || data.detail || "Failed to extract video information"
        );
      }
    } catch (err) {
      console.error("Network error:", err);
      showError("Network error. Please check your connection and try again.");
    } finally {
      if (loading) loading.style.display = "none";
      if (extractBtn) extractBtn.disabled = false;
    }
  });
}

function createFormatCard(format, isRecommended) {
  const formatCard = document.createElement("div");
  formatCard.className = "format-card";
  formatCard.dataset.formatId = format.format_id;
  formatCard.dataset.quality = format.quality;

  if (isRecommended) {
    formatCard.classList.add("recommended");
  }

  if (format.type === "audio") {
    formatCard.classList.add("audio-only");
  }

  const qualityText = format.quality || "Unknown Quality";
  let formatDetails = "";

  if (format.type === "audio") {
    formatDetails = `
            Format: ${format.ext?.toUpperCase() || "MP3"}<br>
            <strong style="color: #6f42c1;">🎵 Perfect for Music</strong>
        `;
  } else {
    formatDetails = `
            Format: ${format.ext?.toUpperCase() || "MP4"}<br>
       
        `;
  }

  formatCard.innerHTML = `
        <div class="format-quality">${qualityText}</div>
        <div class="format-details">
            ${formatDetails}
        </div>
        <button class="btn btn-download-format" data-format-id="${format.format_id}">
            🚀 Download
        </button>
    `;

  const downloadButton = formatCard.querySelector(".btn-download-format");


  downloadButton.addEventListener("click", function () {
      downloadsContainer.scrollIntoView({
        behavior: "smooth",
      });
    });

  if (downloadButton) {
    downloadButton.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (!currentVideoData) {
        showError("Video data not available. Please extract video info first.");
        return;
      }

      downloadButton.disabled = true;
      downloadButton.textContent = "⏳ Starting...";

      try {
        await startDownload(format, downloadButton);
      } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "🚀 Download";
      }
    });
  }

  return formatCard;
}

async function startDownload(format, downloadButton) {
  if (!currentVideoData) {
    showError("Please extract video info first");
    return;
  }

  try {
    const response = await fetch("/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: currentVideoData.url,
        format_id: format.format_id,
        quality: format.quality,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const taskId = data.task_id;

      activeDownloads.set(taskId, {
        format: format,
        taskId: taskId,
        button: downloadButton,
        startTime: Date.now(),
      });

      if (downloadsContainer) {
        downloadsContainer.style.display = "block";



        downloadsContainer.style.visibility = "visible";
        downloadsContainer.style.opacity = "1";
      }

      createDownloadProgressBar(taskId, format);
      startProgressTrackingForDownload(taskId);

      setTimeout(() => {
        if (downloadsContainer) {
          const containerTop =
            downloadsContainer.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({
            top: containerTop - 20,
            behavior: "smooth",
          });
        }
      }, 300);

      showSuccess(`Download started for ${format.quality}!`);
    } else {
      showError(data.error || data.detail || "Failed to start download");
    }
  } catch (err) {
    console.error("Download error:", err);
    showError("Failed to start download. Please check your connection.");
  }
}



function createDownloadProgressBar(taskId, format) {
  if (!downloadsList) return;

  const videoName = currentVideoData?.title || "YouTube Video";
  const formatInfo = `${format.quality} - ${format.ext?.toUpperCase()}`;

  const progressContainer = document.createElement("div");
  progressContainer.className = "download-progress-item";
  progressContainer.id = `download-${taskId}`;
  progressContainer.innerHTML = `
    <div class="download-header">
      <div class="download-info">
        <div class="download-title">${videoName}</div>
        <div class="download-format">${formatInfo}</div>
        <div class="download-message">Downloading...</div>
      </div>
      
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    <div class="download-footer">
      <span class="progress-text">0%</span>
      <div class="download-actions-active" style="display: flex; gap: 8px;">
        <button class="btn btn-cancel" data-task-id="${taskId}">
          🚫 Cancel
        </button>
      </div>
      <div class="download-actions-completed" style="display: none;">
        <a href="#" class="btn btn-download" data-task-id="${taskId}" download>
          📥 Download File
        </a>
      </div>
    </div>
  `;

  downloadsList.prepend(progressContainer);

  const closeBtn = progressContainer.querySelector(".btn-close-download");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      clearDownload(taskId);
    });
  }

  const cancelBtn = progressContainer.querySelector(".btn-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      await cancelDownload(taskId);
    });
  }
}







async function cancelDownload(taskId) {
  try {
    const progressContainer = document.getElementById(`download-${taskId}`);
    if (!progressContainer) return;

    const cancelBtn = progressContainer.querySelector(".btn-cancel");
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "⏳ Cancelling...";
    }

    const response = await fetch(`/cancel/${taskId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showSuccess("Download cancelled successfully!");

      const messageDiv = progressContainer.querySelector(".download-message");
      if (messageDiv) {
        messageDiv.textContent = "Download cancelled";
        messageDiv.style.color = "#ff9800";
      }

      setTimeout(() => {
        clearDownload(taskId);
      }, 2000);
    } else {
      showError(data.detail || "Failed to cancel download");
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = "🚫 Cancel";
      }
    }
  } catch (err) {
    console.error("Cancel error:", err);
    showError("Failed to cancel download. Please try again.");

    const progressContainer = document.getElementById(`download-${taskId}`);
    if (progressContainer) {
      const cancelBtn = progressContainer.querySelector(".btn-cancel");
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = "🚫 Cancel";
      }
    }
  }
}

function startProgressTrackingForDownload(taskId) {
  const interval = setInterval(async () => {
    if (!activeDownloads.has(taskId)) {
      clearInterval(interval);
      return;
    }

    try {
      const response = await fetch(`/task/${taskId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        const task = data.task;

        updateDownloadProgress(taskId, task);

        if (task.status === "completed") {
          clearInterval(interval);
          handleDownloadCompleted(taskId, task);
        } else if (task.status === "failed") {
          clearInterval(interval);
          handleDownloadFailed(taskId, task);
        } else if (task.status === "cancelled") {
          clearInterval(interval);
          handleDownloadCancelled(taskId, task);
        }
      }
    } catch (err) {
      console.error("Progress tracking error:", err);
    }
  }, 1000);

  progressIntervals.set(taskId, interval);
}

function updateDownloadProgress(taskId, task) {
  const progressContainer = document.getElementById(`download-${taskId}`);
  if (!progressContainer) return;

  const progressFill = progressContainer.querySelector(".progress-fill");
  const progressText = progressContainer.querySelector(".progress-text");
  const messageDiv = progressContainer.querySelector(".download-message");

  if (progressFill) progressFill.style.width = `${task.progress || 0}%`;
  if (progressText) progressText.textContent = `${task.progress || 0}%`;
  if (messageDiv) messageDiv.textContent = task.message || "Processing...";
}

function handleDownloadCompleted(taskId, task) {
  const progressContainer = document.getElementById(`download-${taskId}`);
  if (!progressContainer) return;

  const progressFill = progressContainer.querySelector(".progress-fill");
  const messageDiv = progressContainer.querySelector(".download-message");
  const downloadActionsActive = progressContainer.querySelector(
    ".download-actions-active"
  );
  const downloadActionsCompleted = progressContainer.querySelector(
    ".download-actions-completed"
  );
  const downloadLink = progressContainer.querySelector(".btn-download");

  if (progressFill) progressFill.style.width = "100%";
  if (messageDiv) {
    messageDiv.textContent = "Download completed! Ready to save.";
    messageDiv.style.color = "#28a745";
  }

  if (downloadActionsActive) downloadActionsActive.style.display = "none";

  if (downloadLink && task.download_url) {
    downloadLink.href = task.download_url;
    downloadLink.download = task.filename || "download";
    if (downloadActionsCompleted)
      downloadActionsCompleted.style.display = "block";
  }

  if (activeDownloads.has(taskId)) {
    activeDownloads.delete(taskId);
  }
}

function handleDownloadFailed(taskId, task) {
  const progressContainer = document.getElementById(`download-${taskId}`);
  if (!progressContainer) return;

  const messageDiv = progressContainer.querySelector(".download-message");
  if (messageDiv) {
    messageDiv.textContent = task.error || "Download failed";
    messageDiv.style.color = "#dc3545";
  }

  if (activeDownloads.has(taskId)) {
    activeDownloads.delete(taskId);
  }
}

function handleDownloadCancelled(taskId, task) {
  const progressContainer = document.getElementById(`download-${taskId}`);
  if (!progressContainer) return;

  const messageDiv = progressContainer.querySelector(".download-message");
  const downloadActionsActive = progressContainer.querySelector(
    ".download-actions-active"
  );

  if (messageDiv) {
    messageDiv.textContent = "Download cancelled by user";
    messageDiv.style.color = "#ff9800";
  }

  if (downloadActionsActive) {
    downloadActionsActive.style.display = "none";
  }

  if (activeDownloads.has(taskId)) {
    activeDownloads.delete(taskId);
  }

  setTimeout(() => {
    clearDownload(taskId);
  }, 2000);
}

function clearDownload(taskId) {
  const progressContainer = document.getElementById(`download-${taskId}`);
  if (progressContainer) {
    progressContainer.remove();
  }

  if (progressIntervals.has(taskId)) {
    clearInterval(progressIntervals.get(taskId));
    progressIntervals.delete(taskId);
  }

  activeDownloads.delete(taskId);

  if (downloadsContainer && downloadsList) {
    const remainingDownloads = downloadsList.querySelectorAll(
      ".download-progress-item"
    );
    if (remainingDownloads.length === 0) {
      downloadsContainer.style.display = "none";
    }
  }
}

function displayVideoInfo(data) {
  if (thumbnail) {
    thumbnail.src =
      data.thumbnail ||
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'%3E%3Crect width='200' height='150' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-size='14' text-anchor='middle' dy='.3em' fill='%23999'%3ENo Thumbnail%3C/text%3E%3C/svg%3E";
    thumbnail.onerror = function () {
      this.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'%3E%3Crect width='200' height='150' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-size='14' text-anchor='middle' dy='.3em' fill='%23999'%3ENo Thumbnail%3C/text%3E%3C/svg%3E";
    };
  }

  if (videoTitle) videoTitle.textContent = data.title || "YouTube Video";
  if (videoDuration)
    videoDuration.textContent = `⏱️ Duration: ${formatDuration(data.duration)}`;
  if (videoUploader)
    videoUploader.textContent = `📺 Channel: ${data.uploader || "Unknown"}`;
  if (videoViews)
    videoViews.textContent = `👁️ ${formatNumber(data.view_count)} views`;
  if (videoLikes)
    videoLikes.textContent = `👍 ${formatNumber(data.like_count)} likes`;
  if (uploadDate) uploadDate.textContent = `📅 ${formatDate(data.upload_date)}`;
  if (videoDescription)
    videoDescription.textContent =
      data.description || "No description available";

  const videoFormatsGrid = document.getElementById("videoFormatsGrid");
  const audioFormatsGrid = document.getElementById("audioFormatsGrid");

  if (!videoFormatsGrid || !audioFormatsGrid) {
    showError("Page elements missing. Please refresh the page.");
    return;
  }

  videoFormatsGrid.innerHTML = "";
  audioFormatsGrid.innerHTML = "";

  if (!data.video_formats || data.video_formats.length === 0) {
    videoFormatsGrid.innerHTML =
      '<p style="color: #666; text-align: center; padding: 20px;">No video formats available for this video.</p>';
  } else {
    data.video_formats.forEach((format, index) => {
      const formatCard = createFormatCard(format, index === 0);
      videoFormatsGrid.appendChild(formatCard);
    });
  }

  if (!data.audio_formats || data.audio_formats.length === 0) {
    audioFormatsGrid.innerHTML =
      '<p style="color: #666; text-align: center; padding: 20px;">No audio formats available for this video.</p>';
  } else {
    data.audio_formats.forEach((format, index) => {
      const formatCard = createFormatCard(format, false);
      audioFormatsGrid.appendChild(formatCard);
    });
  }

  const formatTabs = document.querySelectorAll(".format-tab");
  if (formatTabs && formatTabs.length > 0) {
    formatTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll(".format-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const tabName = tab.dataset.tab;
        document.querySelectorAll(".formats-grid").forEach((grid) => {
          grid.classList.remove("active");
        });
        const targetGrid = document.getElementById(`${tabName}FormatsGrid`);
        if (targetGrid) {
          targetGrid.classList.add("active");
        }
      });
    });
  }

  if (videoInfo) videoInfo.style.display = "block";
}

const playBtn = videoPlayer?.querySelector(".btn-primary");
if (playBtn) {
  playBtn.addEventListener("click", () => {
    if (videoPlayer && videoElement) {
      videoPlayer.style.display = "block";
      videoElement.scrollIntoView({ behavior: "smooth" });
    }
  });
}

window.addEventListener("beforeunload", async (e) => {
  // Cancel all active downloads
  const activeTaskIds = Array.from(activeDownloads.keys());

  if (activeTaskIds.length > 0) {
    // Send cancel requests for all active downloads
    const cancelPromises = activeTaskIds.map((taskId) =>
      fetch(`/cancel/${taskId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true, // Important: keeps request alive even after page unload
      }).catch((err) => console.error(`Failed to cancel ${taskId}:`, err))
    );

    // Wait for all cancellations (browser will keep these alive with keepalive flag)
    await Promise.allSettled(cancelPromises);
  }

  // Clear intervals
  progressIntervals.forEach((interval) => clearInterval(interval));
});

if (urlInput) {
  urlInput.focus();
}
