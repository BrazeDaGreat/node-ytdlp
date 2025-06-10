# YTDLP Node.js Wrapper Documentation

A powerful, object-oriented Node.js wrapper for yt-dlp that enables easy YouTube video downloading with automatic audio merging and queue management.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Classes](#core-classes)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Installation

### Prerequisites

1. **Install yt-dlp**: Download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and ensure it's in your PATH
2. **Install Node.js**: Version 14.0 or higher

### Package Installation

```bash
# Required packages
npm install yt-dlp-wrap

# Recommended for high-quality downloads
npm install ffmpeg-static ffprobe-static
```

### Project Setup

```bash
# Clone or copy the wrapper files
cp ytdlp-wrapper.js your-project/
cp index.js your-project/

# Or include in your package.json
```

## Quick Start

```javascript
const { VideoData, DownloadQueue } = require('./ytdlp-wrapper');

async function quickExample() {
  // Create video instance
  const video = new VideoData("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  
  // Fetch video information
  await video.fetchMetadata();
  
  // Download in best available quality
  const download = await video.download(video.getBestQuality(), "./downloads/");
  
  // Setup event handlers
  download.onProgress(percent => console.log(`${percent}%`));
  download.onComplete(filepath => console.log(`Saved: ${filepath}`));
  
  // Start download
  download.start();
}

quickExample().catch(console.error);
```

## Core Classes

### VideoData

Represents a single video and manages its metadata and download instances.

### DownloadInstance

Handles the actual downloading process for a specific video and quality.

### DownloadQueue

Manages multiple downloads with concurrency control and queue management.

## API Reference

### VideoData Class

#### Constructor

```javascript
const video = new VideoData(url)
```

**Parameters:**
- `url` (string): YouTube video URL

#### Properties

```javascript
video.name          // Video title
video.description   // Video description  
video.duration      // Duration in seconds
video.thumbnail     // Thumbnail URL
video.uploader      // Channel name
video.qualityOptions // Array of available quality options
```

#### Methods

##### `fetchMetadata()`

```javascript
await video.fetchMetadata()
```

Fetches video metadata including title, description, and available qualities.

**Returns:** Promise resolving to the VideoData instance

**Example:**
```javascript
const video = new VideoData("https://www.youtube.com/watch?v=example");
await video.fetchMetadata();
console.log(video.name); // "Example Video Title"
```

##### `download(quality, downloadPath)`

```javascript
const downloadInstance = await video.download(quality, downloadPath)
```

Creates a download instance for the video.

**Parameters:**
- `quality` (object): Quality object from `qualityOptions`
- `downloadPath` (string): Directory to save the video

**Returns:** Promise resolving to a DownloadInstance

##### `getBestQuality()`

```javascript
const quality = video.getBestQuality()
```

**Returns:** Highest available quality option

##### `getBestCombinedQuality()`

```javascript
const quality = video.getBestCombinedQuality()
```

**Returns:** Best quality that can be downloaded (all qualities are now combined)

##### `getBestNativeCombinedQuality()`

```javascript
const quality = video.getBestNativeCombinedQuality()
```

**Returns:** Best quality that doesn't require ffmpeg for merging

##### `getQuality(height)`

```javascript
const quality = video.getQuality(1080)
```

**Parameters:**
- `height` (number): Desired video height (e.g., 720, 1080, 1440)

**Returns:** Quality object for specified height, or null if not available

##### `getAllQualities()`

```javascript
const qualities = video.getAllQualities()
```

**Returns:** Array of all available quality options

##### `getNativeCombinedQualities()`

```javascript
const qualities = video.getNativeCombinedQualities()
```

**Returns:** Array of qualities that don't require ffmpeg

##### `getVideoOnlyQualities()`

```javascript
const qualities = video.getVideoOnlyQualities()
```

**Returns:** Array of qualities that require audio merging

##### `requiresFFmpeg(quality)`

```javascript
const needsFFmpeg = video.requiresFFmpeg(quality)
```

**Parameters:**
- `quality` (object): Quality object to check

**Returns:** Boolean indicating if quality requires ffmpeg for audio merging

##### `getAllFormats()`

```javascript
const formatsText = await video.getAllFormats()
```

**Returns:** Promise resolving to raw yt-dlp format listing (for debugging)

### DownloadInstance Class

#### Methods

##### `onProgress(callback)`

```javascript
download.onProgress((percent) => {
  console.log(`Downloaded: ${percent}%`);
})
```

**Parameters:**
- `callback` (function): Function called with download percentage

**Returns:** DownloadInstance (for chaining)

##### `onComplete(callback)`

```javascript
download.onComplete((filepath) => {
  console.log(`Video saved at: ${filepath}`);
})
```

**Parameters:**
- `callback` (function): Function called with final file path

**Returns:** DownloadInstance (for chaining)

##### `onError(callback)`

```javascript
download.onError((error) => {
  console.error('Download failed:', error.message);
})
```

**Parameters:**
- `callback` (function): Function called with error object

**Returns:** DownloadInstance (for chaining)

##### `start()`

```javascript
await download.start()
```

Starts the download process.

**Returns:** Promise resolving to DownloadInstance

##### `cancel()`

```javascript
download.cancel()
```

Cancels the download if in progress.

#### Properties

```javascript
download.isStarted    // Boolean: Has download started
download.isCompleted  // Boolean: Is download finished
download.isCancelled  // Boolean: Was download cancelled
download.filePath     // String: Expected file path
```

### DownloadQueue Class

#### Constructor

```javascript
const queue = new DownloadQueue(downloadPath, maxConcurrent = 3)
```

**Parameters:**
- `downloadPath` (string): Directory for downloads
- `maxConcurrent` (number): Maximum simultaneous downloads

#### Methods

##### `onProgress(callback)`

```javascript
queue.onProgress((video, percent) => {
  console.log(`${video.name}: ${percent}%`);
})
```

**Parameters:**
- `callback` (function): Function called with video object and percentage

##### `onVideoComplete(callback)`

```javascript
queue.onVideoComplete((video, filepath) => {
  console.log(`Completed: ${video.name}`);
})
```

**Parameters:**
- `callback` (function): Function called when individual video completes

##### `onQueueComplete(callback)`

```javascript
queue.onQueueComplete((stats) => {
  console.log(`Queue finished: ${stats.completed} completed, ${stats.failed} failed`);
})
```

**Parameters:**
- `callback` (function): Function called when entire queue finishes

##### `onError(callback)`

```javascript
queue.onError((video, error) => {
  console.error(`${video.name} failed:`, error.message);
})
```

**Parameters:**
- `callback` (function): Function called when a download fails

##### `add(videoData, quality)`

```javascript
const id = await queue.add(videoData, (videoData) => quality)
```

**Parameters:**
- `videoData` (VideoData): Video to download
- `quality` (function(VideoData), optional): Specific quality, accepts a callback function, giving VideoData as parameter.

**Returns:** Promise resolving to unique queue item ID

##### `remove(id)`

```javascript
const removed = queue.remove(id)
```

**Parameters:**
- `id` (string): Queue item ID from `add()`

**Returns:** Boolean indicating if item was removed

##### `pause()` / `resume()`

```javascript
queue.pause()   // Pause queue processing
queue.resume()  // Resume queue processing
```

##### `clear()`

```javascript
queue.clear()  // Remove all queued items and cancel active downloads
```

##### `getStatus()`

```javascript
const status = queue.getStatus()
// Returns: { queued, active, completed, failed, paused }
```

## Usage Examples

### Basic Download

```javascript
const { VideoData } = require('./ytdlp-wrapper');

async function basicDownload() {
  const video = new VideoData("https://www.youtube.com/watch?v=example");
  await video.fetchMetadata();
  
  console.log(`Title: ${video.name}`);
  console.log(`Duration: ${video.duration} seconds`);
  
  // Download best quality
  const download = await video.download(
    video.getBestQuality(), 
    "./downloads/"
  );
  
  download
    .onProgress(percent => console.log(`${percent}%`))
    .onComplete(filepath => console.log(`Saved: ${filepath}`))
    .onError(error => console.error('Error:', error.message));
  
  download.start();
}
```

### Specific Quality Download

```javascript
async function specificQualityDownload() {
  const video = new VideoData("https://www.youtube.com/watch?v=example");
  await video.fetchMetadata();
  
  // Try to get 1080p, fallback to best available
  const quality = video.getQuality(1080) || video.getBestQuality();
  
  console.log(`Downloading in ${quality.quality}`);
  
  if (video.requiresFFmpeg(quality)) {
    console.log('This quality requires ffmpeg for audio merging');
  }
  
  const download = await video.download(quality, "./downloads/");
  download.start();
}
```

### Quality Selection Menu

```javascript
async function qualityMenu() {
  const video = new VideoData("https://www.youtube.com/watch?v=example");
  await video.fetchMetadata();
  
  console.log('Available qualities:');
  video.getAllQualities().forEach((q, index) => {
    const ffmpeg = video.requiresFFmpeg(q) ? ' (requires ffmpeg)' : '';
    console.log(`${index + 1}. ${q.quality}${ffmpeg}`);
  });
  
  // Simulate user selecting option 3
  const selectedIndex = 2;
  const quality = video.getAllQualities()[selectedIndex];
  
  const download = await video.download(quality, "./downloads/");
  download.start();
}
```

### Safe Download (No FFmpeg Required)

```javascript
async function safeDownload() {
  const video = new VideoData("https://www.youtube.com/watch?v=example");
  await video.fetchMetadata();
  
  // Only use qualities that don't require ffmpeg
  const nativeQualities = video.getNativeCombinedQualities();
  
  if (nativeQualities.length === 0) {
    console.log('No native combined formats available');
    return;
  }
  
  const quality = nativeQualities[0]; // Best native quality
  console.log(`Downloading ${quality.quality} (no ffmpeg needed)`);
  
  const download = await video.download(quality, "./downloads/");
  download.start();
}
```

### Queue Management

```javascript
async function queueExample() {
  const queue = new DownloadQueue("./downloads/", 2); // 2 concurrent downloads
  
  // Setup event handlers
  queue.onProgress((video, percent) => {
    console.log(`${video.name}: ${percent.toFixed(1)}%`);
  });
  
  queue.onVideoComplete((video, filepath) => {
    console.log(`✅ Completed: ${video.name}`);
  });
  
  queue.onQueueComplete((stats) => {
    console.log(`Queue finished: ${stats.completed} completed, ${stats.failed} failed`);
  });
  
  queue.onError((video, error) => {
    console.error(`❌ ${video.name} failed: ${error.message}`);
  });
  
  // Add videos to queue
  const urls = [
    "https://www.youtube.com/watch?v=video1",
    "https://www.youtube.com/watch?v=video2",
    "https://www.youtube.com/watch?v=video3"
  ];
  
  for (const url of urls) {
    const video = new VideoData(url);
    await video.fetchMetadata();
    
    const quality = video.getQuality(720) || video.getBestQuality();
    await queue.add(video, quality);
  }
  
  // Monitor queue
  setInterval(() => {
    const status = queue.getStatus();
    console.log(`Queue status: ${status.active} active, ${status.queued} queued`);
  }, 5000);
}
```

### Advanced Queue Control

```javascript
async function advancedQueueControl() {
  const queue = new DownloadQueue("./downloads/", 1);
  
  // Add videos and store IDs
  const video1 = new VideoData("https://www.youtube.com/watch?v=video1");
  await video1.fetchMetadata();
  const id1 = await queue.add(video1);
  
  const video2 = new VideoData("https://www.youtube.com/watch?v=video2");
  await video2.fetchMetadata();
  const id2 = await queue.add(video2);
  
  // Remove specific video from queue
  setTimeout(() => {
    const removed = queue.remove(id2);
    console.log(`Video 2 removed: ${removed}`);
  }, 5000);
  
  // Pause queue after 10 seconds
  setTimeout(() => {
    queue.pause();
    console.log('Queue paused');
  }, 10000);
  
  // Resume after 15 seconds
  setTimeout(() => {
    queue.resume();
    console.log('Queue resumed');
  }, 15000);
}
```

### Error Handling and Retries

```javascript
async function robustDownload(url, maxRetries = 3) {
  const video = new VideoData(url);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await video.fetchMetadata();
      
      let quality = video.getQuality(1080);
      
      // Fallback to native quality if ffmpeg fails
      if (!quality || video.requiresFFmpeg(quality)) {
        const nativeQuality = video.getBestNativeCombinedQuality();
        if (nativeQuality) {
          quality = nativeQuality;
          console.log(`Using native quality: ${quality.quality}`);
        }
      }
      
      const download = await video.download(quality, "./downloads/");
      
      return new Promise((resolve, reject) => {
        download.onComplete(resolve);
        download.onError(reject);
        download.start();
      });
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Download failed after ${maxRetries} attempts`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}
```

## Configuration

### Quality Object Structure

```javascript
{
  quality: "1080p",           // Display name
  height: 1080,               // Video height in pixels
  formatId: "137",            // yt-dlp format ID
  ext: "mp4",                 // File extension
  filesize: 50000000,         // File size in bytes (may be null)
  fps: 30,                    // Frames per second
  hasAudio: false,            // Legacy field (now all have audio)
  vcodec: "avc1.640028",      // Video codec
  acodec: "none",             // Audio codec (for video-only)
  isNativeCombined: false,    // No ffmpeg needed if true
  needsMerging: true,         // Requires audio merging
  bestAudioFormat: "140",     // Best audio format ID for merging
  virtualCombined: true       // All qualities now "combined"
}
```

### Environment Variables

```bash
# Optional: Set custom yt-dlp path
export YTDLP_PATH="/custom/path/to/yt-dlp"

# Optional: Set custom ffmpeg path  
export FFMPEG_PATH="/custom/path/to/ffmpeg"
```

### Download Options

You can customize download behavior by modifying the args in the `start()` method:

```javascript
// Example: Add custom yt-dlp arguments
const args = [
  '--format', formatId,
  '--output', this.filePath,
  '--embed-subs',              // Embed subtitles
  '--write-thumbnail',         // Download thumbnail
  '--add-metadata',            // Add metadata to file
  '--merge-output-format', 'mp4',
  this.videoData.url
];
```

## Error Handling

### Common Errors

#### FFmpeg Not Found

```javascript
download.onError((error) => {
  if (error.message.includes('ffmpeg')) {
    console.log('FFmpeg required for this quality');
    console.log('Install with: npm install ffmpeg-static');
    
    // Try native quality instead
    const nativeQuality = video.getBestNativeCombinedQuality();
    if (nativeQuality) {
      console.log(`Alternative: Use ${nativeQuality.quality}`);
    }
  }
});
```

#### Video Not Available

```javascript
try {
  await video.fetchMetadata();
} catch (error) {
  if (error.message.includes('Video unavailable')) {
    console.log('Video is private, deleted, or region-blocked');
  } else if (error.message.includes('network')) {
    console.log('Network error - check internet connection');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

#### yt-dlp Not Found

```javascript
download.onError((error) => {
  if (error.message.includes('yt-dlp not found')) {
    console.log('Please install yt-dlp:');
    console.log('https://github.com/yt-dlp/yt-dlp#installation');
  }
});
```

### Error Recovery Strategies

```javascript
async function downloadWithFallback(video, preferredHeight) {
  try {
    // Try preferred quality
    let quality = video.getQuality(preferredHeight);
    if (quality) {
      return await attemptDownload(video, quality);
    }
  } catch (error) {
    console.log(`${preferredHeight}p failed, trying alternatives...`);
  }
  
  // Try native combined qualities
  const nativeQualities = video.getNativeCombinedQualities();
  for (const quality of nativeQualities) {
    try {
      return await attemptDownload(video, quality);
    } catch (error) {
      console.log(`${quality.quality} failed:`, error.message);
    }
  }
  
  throw new Error('All download attempts failed');
}

async function attemptDownload(video, quality) {
  const download = await video.download(quality, "./downloads/");
  
  return new Promise((resolve, reject) => {
    download.onComplete(resolve);
    download.onError(reject);
    download.start();
  });
}
```

## Troubleshooting

### Installation Issues

**Problem:** yt-dlp not found
```bash
# Download yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Or install via package manager
pip install yt-dlp
```

**Problem:** ffmpeg not found
```bash
# Install bundled version
npm install ffmpeg-static

# Or system version
# Windows: winget install ffmpeg
# macOS: brew install ffmpeg  
# Linux: sudo apt install ffmpeg
```

### Performance Issues

**Problem:** Slow downloads
- Use native combined qualities when possible
- Reduce concurrent downloads in queue
- Check internet connection speed

**Problem:** High memory usage
- Lower concurrent download limit
- Clear completed downloads from queue
- Use smaller qualities for testing

### Quality Issues

**Problem:** Only 360p available
```javascript
// Debug available formats
const allFormats = await video.getAllFormats();
console.log(allFormats);

// Check if video has higher qualities
console.log('All qualities:', video.getAllQualities());
```

**Problem:** Audio missing
- This shouldn't happen with the updated wrapper
- All qualities now include audio (either native or merged)
- Install ffmpeg-static for best results

### Debug Mode

```javascript
// Enable detailed logging
process.env.DEBUG = 'ytdlp-wrapper';

// Check what yt-dlp sees
const video = new VideoData(url);
await video.fetchMetadata();
const formats = await video.getAllFormats();
console.log('Raw formats:', formats);
```

## FAQ

### Q: What video qualities are supported?
A: All qualities from 144p to 8K (8320p) are supported, depending on what the video provides. Common qualities include 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, and 2160p (4K).

### Q: Do I need ffmpeg for all downloads?
A: No. Lower qualities (typically 360p and below) are often available as native combined video+audio formats that don't require ffmpeg. Higher qualities usually require ffmpeg to merge separate video and audio streams.

### Q: Can I download playlists?
A: The current wrapper focuses on individual videos. For playlists, fetch each video URL separately and add them to a DownloadQueue.

### Q: What file formats are supported?
A: The wrapper primarily outputs MP4 files, but yt-dlp supports many formats. You can customize the output format by modifying the download arguments.

### Q: How do I handle region-blocked videos?
A: This is a yt-dlp limitation. You can try using proxy settings in yt-dlp arguments, but respect content creators' geographic restrictions.

### Q: Can I download live streams?
A: yt-dlp supports live streams, but the wrapper is optimized for regular videos. Live streams may require additional configuration.

### Q: How do I update yt-dlp?
A: Update yt-dlp regularly as YouTube frequently changes their API:
```bash
pip install --upgrade yt-dlp
# or download latest from GitHub releases
```

### Q: Can I customize the filename format?
A: Yes, modify the filename template in the `start()` method:
```javascript
const filename = `%(uploader)s - %(title)s - %(upload_date)s.%(ext)s`;
```

### Q: How do I download age-restricted videos?
A: Some age-restricted videos may require authentication. This would need to be handled at the yt-dlp level with cookies or authentication.

### Q: What's the maximum concurrent downloads recommended?
A: Start with 2-3 concurrent downloads. Too many can overwhelm your connection or trigger rate limiting from YouTube.

---

## Support

For issues with:
- **This wrapper**: Check the troubleshooting section above
- **yt-dlp itself**: Visit [yt-dlp GitHub issues](https://github.com/yt-dlp/yt-dlp/issues)
- **ffmpeg**: Visit [ffmpeg documentation](https://ffmpeg.org/documentation.html)

## License

This wrapper follows the same license as yt-dlp. Please respect YouTube's Terms of Service and content creators' rights when using this tool.