# YTDLP Node.js Wrapper
![Node.js](https://img.shields.io/badge/node.js-14+-green)
![Version](https://img.shields.io/badge/version-1.0.0-red)
![YTDLP](https://img.shields.io/badge/ytdlp-2025.06.09-orange)

An object-oriented Node.js wrapper for [yt-dlp](https://github.com/yt-dlp/yt-dlp) that makes YouTube video downloading simple and efficient. Download any quality with automatic audio merging, queue management, and error handling.

## ✨ Key Features

- 🎥 **Download ANY quality with audio** - 144p to 8K, all with combined audio tracks
- 🔄 **Automatic audio merging** - High quality video streams automatically merged with best audio
- 📋 **Queue management** - Download multiple videos with concurrency control
- 🎯 **Smart quality selection** - Automatic fallbacks and format optimization
- 🛠️ **Zero-config FFmpeg** - Bundled FFmpeg support with `ffmpeg-static`
- 📊 **Progress tracking** - Real-time download progress and completion events
- 🎮 **Object-oriented API** - Clean, intuitive class-based interface
- 🚫 **Error resilience** - Comprehensive error handling and recovery strategies

## 🚀 Quick Start

### Installation

```bash
# Install the wrapper dependencies
npm install ffmpeg-static

# Install yt-dlp (required)
pip install yt-dlp
# or download from: https://github.com/yt-dlp/yt-dlp/releases
```

### Basic Usage

```javascript
const { VideoData, DownloadQueue } = require('./ytdlp-wrapper');

async function downloadVideo() {
  // Create video instance
  const video = new VideoData("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  
  // Fetch video information
  await video.fetchMetadata();
  console.log(`Title: ${video.name}`);
  console.log(`Duration: ${video.duration} seconds`);
  
  // Download in 1080p (automatically includes audio!)
  const quality = video.getQuality(1080) || video.getBestQuality();
  const download = await video.download(quality, "./downloads/");
  
  // Setup progress tracking
  download
    .onProgress(percent => console.log(`Downloaded: ${percent.toFixed(1)}%`))
    .onComplete(filepath => console.log(`✅ Saved: ${filepath}`))
    .onError(error => console.error(`❌ Error: ${error.message}`));
  
  // Start download
  download.start();
  console.log("🚀 Download started!");
}

downloadVideo().catch(console.error);
```

## 📖 Examples

### Download Specific Quality

```javascript
const video = new VideoData("https://www.youtube.com/watch?v=example");
await video.fetchMetadata();

// Show available qualities
console.log('Available qualities:');
video.getAllQualities().forEach(q => {
  const type = video.requiresFFmpeg(q) ? '⚙️ ' : '✅ ';
  console.log(`${type}${q.quality} - ${q.vcodec}`);
});

// Download 4K with audio
const quality4K = video.getQuality(2160);
if (quality4K) {
  const download = await video.download(quality4K, "./downloads/");
  download.start();
}
```

### Queue Multiple Downloads

```javascript
const queue = new DownloadQueue("./downloads/", 3); // 3 concurrent downloads

// Setup event handlers
queue.onProgress((video, percent) => 
  console.log(`${video.name}: ${percent}%`)
);

queue.onVideoComplete((video, filepath) => 
  console.log(`✅ ${video.name} completed`)
);

// Add videos to queue
const urls = [
  "https://www.youtube.com/watch?v=video1",
  "https://www.youtube.com/watch?v=video2",
  "https://www.youtube.com/watch?v=video3"
];

for (const url of urls) {
  const video = new VideoData(url);
  await video.fetchMetadata();
  queue.add(video); // Downloads best quality automatically
}
```

### Safe Mode (No FFmpeg)

```javascript
const video = new VideoData("https://www.youtube.com/watch?v=example");
await video.fetchMetadata();

// Only use formats that don't require FFmpeg
const safeQuality = video.getBestNativeCombinedQuality();
console.log(`Downloading ${safeQuality.quality} (no FFmpeg needed)`);

const download = await video.download(safeQuality, "./downloads/");
download.start();
```

## 🔧 API Overview

### VideoData Class

```javascript
const video = new VideoData(url);
await video.fetchMetadata();

// Properties
video.name              // Video title
video.description       // Description
video.duration          // Duration in seconds
video.qualityOptions    // Available qualities

// Methods
video.getBestQuality()                    // Highest quality
video.getQuality(1080)                   // Specific height
video.getBestNativeCombinedQuality()     // Best without FFmpeg
video.requiresFFmpeg(quality)            // Check FFmpeg requirement
```

### DownloadInstance Class

```javascript
const download = await video.download(quality, path);

download
  .onProgress(percent => {})      // Progress updates
  .onComplete(filepath => {})     // Download finished
  .onError(error => {})           // Error handling
  .start();                       // Begin download

download.cancel();                // Cancel download
```

### DownloadQueue Class

```javascript
const queue = new DownloadQueue(path, maxConcurrent);

queue.add(video, quality);        // Add to queue
queue.remove(id);                 // Remove from queue
queue.pause() / queue.resume();   // Control queue
queue.getStatus();                // Get queue stats
```

## 📚 Documentation

For comprehensive documentation, examples, and troubleshooting guides, see [DOCUMENTATION.md](./DOCUMENTATION.md).

## 🛠️ Requirements

- **Node.js** 14.0 or higher
- **yt-dlp** installed and accessible in PATH
- **FFmpeg** (optional but recommended - auto-installed with `ffmpeg-static`)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

```bash
git clone https://github.com/BrazeDaGreat/node-ytdlp.git
cd node-ytdlp
npm install
```


## ⚠️ Disclaimer

This tool is for educational and personal use only. Please respect YouTube's Terms of Service and content creators' rights. Do not use this tool to download copyrighted content without permission.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The powerful underlying tool
- [FFmpeg](https://ffmpeg.org/) - Video/audio processing
- YouTube content creators - For the amazing content

## 🐛 Issues & Support

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/BrazeDaGreat/node-ytdlphttps://github.com/BrazeDaGreat/node-ytdlp/issues)
- 💡 **Feature requests**: [GitHub Discussions](https://github.com/BrazeDaGreat/node-ytdlphttps://github.com/BrazeDaGreat/node-ytdlp/discussions)
- 📖 **Documentation**: [DOCUMENTATION.md](./DOCUMENTATION.md)

---

<div align="center">

**⭐ Star this repo if it helped you!**

Made with ❤️ in Pakistan.

</div>