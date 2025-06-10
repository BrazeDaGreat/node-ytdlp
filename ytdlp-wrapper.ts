import {
  spawn,
  ChildProcess,
  ChildProcessWithoutNullStreams,
} from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import { promises as fs } from "fs";

let ffmpegPath: string = "ffmpeg";

try {
  ffmpegPath = require("ffmpeg-static");
} catch (error) {
  console.warn(
    "ffmpeg-static not found, using system ffmpeg. Install with: npm install ffmpeg-static"
  );
}

interface Format {
  format_id: string;
  ext?: string;
  filesize?: number;
  fps?: number;
  height?: number;
  width?: number;
  vcodec?: string;
  acodec?: string;
  vbr?: number;
  abr?: number;
  tbr?: number;
  protocol?: string;
  url?: string;
}

interface Metadata {
  title?: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  formats?: Format[];
}

interface Quality {
  quality: string;
  height: number;
  formatId: string;
  ext: string;
  filesize?: number;
  fps?: number;
  hasAudio: boolean;
  vcodec?: string;
  acodec?: string;
  isNativeCombined: boolean;
  needsMerging: boolean;
  bestAudioFormat?: string;
  virtualCombined: boolean;
}

interface QueueItem {
  videoData: VideoData;
  quality: Quality;
  id: number;
}

interface ActiveDownload {
  instance: DownloadInstance;
  videoData: VideoData;
}

interface CompletedDownload {
  videoData: VideoData;
  filepath: string;
  completedAt: Date;
}

interface FailedDownload {
  videoData: VideoData;
  error: string;
  failedAt: Date;
}

interface QueueStatus {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  paused: boolean;
}

interface QueueCompleteResult {
  completed: number;
  failed: number;
}

type QualitySelector = (videoData: VideoData) => Quality | null;
type ProgressCallback = (percent: number) => void;
type CompleteCallback = (filepath: string) => void;
type ErrorCallback = (error: Error) => void;
type VideoCompleteCallback = (videoData: VideoData, filepath: string) => void;
type QueueProgressCallback = (videoData: VideoData, percent: number) => void;
type QueueCompleteCallback = (result: QueueCompleteResult) => void;
type QueueErrorCallback = (videoData: VideoData, error: Error) => void;

class VideoData {
  public url: string;
  public name: string = "";
  public description: string = "";
  public qualityOptions: Quality[] = [];
  public duration: number = 0;
  public thumbnail: string = "";
  public uploader: string = "";
  private _metadataFetched: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  public get metadataFetched(): boolean {
    return this._metadataFetched;
  }

  async fetchMetadata(): Promise<VideoData> {
    if (this._metadataFetched) return this;

    return new Promise<VideoData>((resolve, reject) => {
      const args = ["--dump-json", "--no-playlist", this.url];

      const ytdlp = spawn("yt-dlp", args);
      let output = "";
      let errorOutput = "";

      ytdlp.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      ytdlp.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      ytdlp.on("close", (code: number | null) => {
        if (code === 0) {
          try {
            const metadata: Metadata = JSON.parse(output);
            this.name = metadata.title || "Unknown Title";
            this.description = metadata.description || "";
            this.duration = metadata.duration || 0;
            this.thumbnail = metadata.thumbnail || "";
            this.uploader = metadata.uploader || "";

            this.qualityOptions = this._parseFormats(metadata.formats || []);
            this._metadataFetched = true;
            resolve(this);
          } catch (error) {
            reject(
              new Error(`Failed to parse metadata: ${(error as Error).message}`)
            );
          }
        } else {
          reject(new Error(`yt-dlp failed: ${errorOutput}`));
        }
      });

      ytdlp.on("error", (error: Error) => {
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });
    });
  }

  private _parseFormats(formats: Format[]): Quality[] {
    const videoFormats = formats.filter((f) => f.vcodec !== "none" && f.height);

    const audioFormats = formats.filter(
      (f) => f.acodec !== "none" && f.vcodec === "none"
    );
    const bestAudio =
      audioFormats.length > 0
        ? audioFormats.reduce((best, current) =>
            (current.abr || 0) > (best.abr || 0) ? current : best
          )
        : null;

    const qualityMap = new Map<
      number,
      { native: Format | null; videoOnly: Format | null }
    >();

    videoFormats.forEach((format) => {
      const height = format.height!;
      const isNativeCombined = format.acodec !== "none";

      if (!qualityMap.has(height)) {
        qualityMap.set(height, {
          native: isNativeCombined ? format : null,
          videoOnly: !isNativeCombined ? format : null,
        });
      } else {
        const existing = qualityMap.get(height)!;
        if (isNativeCombined) {
          existing.native = format;
        } else if (
          !existing.videoOnly ||
          (format.vbr || 0) > (existing.videoOnly.vbr || 0)
        ) {
          existing.videoOnly = format;
        }
      }
    });

    const uniqueQualities = Array.from(qualityMap.keys()).sort((a, b) => b - a);

    return uniqueQualities.map((height) => {
      const formatData = qualityMap.get(height)!;
      const preferredFormat = formatData.native || formatData.videoOnly!;
      const hasNativeCombined = !!formatData.native;

      return {
        quality: `${height}p`,
        height: height,
        formatId: preferredFormat.format_id,
        ext: preferredFormat.ext || "mp4",
        filesize: preferredFormat.filesize,
        fps: preferredFormat.fps,
        hasAudio: hasNativeCombined,
        vcodec: preferredFormat.vcodec,
        acodec: preferredFormat.acodec,
        isNativeCombined: hasNativeCombined,
        needsMerging: !hasNativeCombined && !!bestAudio,
        bestAudioFormat: bestAudio ? bestAudio.format_id : undefined,
        virtualCombined: true,
      };
    });
  }

  async download(
    quality: Quality,
    downloadPath: string
  ): Promise<DownloadInstance> {
    if (!this.metadataFetched) {
      await this.fetchMetadata();
    }
    return new DownloadInstance(this, quality, downloadPath);
  }

  getBestQuality(): Quality | null {
    return this.qualityOptions[0] || null;
  }

  getBestCombinedQuality(): Quality | null {
    return this.qualityOptions[0] || null;
  }

  getBestNativeCombinedQuality(): Quality | null {
    return this.qualityOptions.find((q) => q.isNativeCombined) || null;
  }

  getQuality(height: number): Quality | null {
    return this.qualityOptions.find((q) => q.height === height) || null;
  }

  getAllQualities(): Quality[] {
    return this.qualityOptions;
  }

  getCombinedQualities(): Quality[] {
    return this.qualityOptions;
  }

  getNativeCombinedQualities(): Quality[] {
    return this.qualityOptions.filter((q) => q.isNativeCombined);
  }

  getVideoOnlyQualities(): Quality[] {
    return this.qualityOptions.filter((q) => !q.isNativeCombined);
  }

  requiresFFmpeg(quality: Quality): boolean {
    return quality && !quality.isNativeCombined;
  }

  async getAllFormats(): Promise<string> {
    if (!this.metadataFetched) {
      await this.fetchMetadata();
    }

    return new Promise<string>((resolve, reject) => {
      const args = ["--list-formats", "--no-playlist", this.url];

      const ytdlp = spawn("yt-dlp", args);
      let output = "";

      ytdlp.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      ytdlp.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error("Failed to list formats"));
        }
      });
    });
  }
}

class DownloadInstance extends EventEmitter {
  public videoData: VideoData;
  public quality: Quality;
  public downloadPath: string;
  public isStarted: boolean = false;
  public isCompleted: boolean = false;
  public isCancelled: boolean = false;
  public filePath: string = "";
  public process: ChildProcessWithoutNullStreams | null = null;
  private actualFilePath?: string;

  constructor(videoData: VideoData, quality: Quality, downloadPath: string) {
    super();
    this.videoData = videoData;
    this.quality = quality;
    this.downloadPath = downloadPath;
  }

  onProgress(callback: ProgressCallback): DownloadInstance {
    this.on("progress", callback);
    return this;
  }

  onComplete(callback: CompleteCallback): DownloadInstance {
    this.on("complete", callback);
    return this;
  }

  onError(callback: ErrorCallback): DownloadInstance {
    this.on("error", callback);
    return this;
  }

  async start(): Promise<DownloadInstance> {
    if (this.isStarted) {
      throw new Error("Download already started");
    }

    this.isStarted = true;

    try {
      await fs.access(this.downloadPath);
    } catch {
      await fs.mkdir(this.downloadPath, { recursive: true });
    }

    let formatId: string;

    if (this.quality.isNativeCombined) {
      formatId = this.quality.formatId;
      console.log(`Using native combined format: ${this.quality.quality}`);
    } else if (this.quality.needsMerging && this.quality.bestAudioFormat) {
      formatId = `${this.quality.formatId}+${this.quality.bestAudioFormat}/bestvideo[height<=${this.quality.height}]+bestaudio/best[height<=${this.quality.height}]`;
      console.log(
        `Merging ${this.quality.quality} video with audio (requires ffmpeg)`
      );
    } else {
      formatId = `best[height<=${this.quality.height}]`;
      console.log(`Using best available format for ${this.quality.quality}`);
    }

    const filename = `${this.videoData.name.replace(
      /[<>:"/\\|?*]/g,
      "_"
    )}.%(ext)s`;
    this.filePath = path.join(this.downloadPath, filename);

    const args = [
      "--format",
      formatId,
      "--output",
      this.filePath,
      "--merge-output-format",
      "mp4",
      "--newline",
    ];

    if (ffmpegPath !== "ffmpeg") {
      args.splice(-1, 0, "--ffmpeg-location", ffmpegPath);
    }

    args.push(this.videoData.url);

    this.process = spawn("yt-dlp", args);

    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();

      const progressMatch = output.match(/(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        this.emit("progress", percent);
      }

      if (output.includes("[download]") && output.includes("Destination:")) {
        console.log("Download started:", output.trim());
      }
    });

    this.process.stderr.on("data", (data: Buffer) => {
      const errorOutput = data.toString();

      if (errorOutput.includes("WARNING") && errorOutput.includes("ffmpeg")) {
        console.warn("⚠️  FFmpeg warning:", errorOutput.trim());

        if (
          errorOutput.includes("not installed") ||
          errorOutput.includes("not found")
        ) {
          console.log(
            "💡 Installing ffmpeg-static will enable higher quality downloads:"
          );
          console.log("   npm install ffmpeg-static");
          console.log("   Continuing with available format...");
        }
        return;
      }

      if (errorOutput.includes("WARNING")) {
        console.warn("⚠️  Warning:", errorOutput.trim());
        return;
      }

      if (
        errorOutput.includes("ERROR") ||
        errorOutput.includes("error:") ||
        errorOutput.includes("Unable to download") ||
        errorOutput.includes("HTTP Error")
      ) {
        this.emit("error", new Error(errorOutput.trim()));
      }
    });

    this.process.on("close", (code: number | null) => {
      if (code === 0 && !this.isCancelled) {
        this.isCompleted = true;
        const possibleExts = ["mp4", "webm", "mkv"];
        const basePath = this.filePath.replace(".%(ext)s", "");

        possibleExts.forEach((ext) => {
          const testPath = `${basePath}.${ext}`;
          require("fs").access(
            testPath,
            require("fs").constants.F_OK,
            (err: NodeJS.ErrnoException | null) => {
              if (!err && !this.actualFilePath) {
                this.actualFilePath = testPath;
                this.emit("complete", testPath);
              }
            }
          );
        });

        setTimeout(() => {
          if (!this.actualFilePath) {
            const fallbackPath = `${basePath}.mp4`;
            this.emit("complete", fallbackPath);
          }
        }, 100);
      } else if (!this.isCancelled) {
        this.emit("error", new Error(`Download failed with exit code ${code}`));
      }
    });

    this.process.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        this.emit(
          "error",
          new Error(
            "yt-dlp not found. Please install yt-dlp: https://github.com/yt-dlp/yt-dlp#installation"
          )
        );
      } else {
        this.emit("error", error);
      }
    });

    return this;
  }

  cancel(): void {
    if (this.process && !this.isCompleted) {
      this.isCancelled = true;
      this.process.kill("SIGTERM");
    }
  }
}

class DownloadQueue extends EventEmitter {
  public downloadPath: string;
  public maxConcurrent: number;
  public queue: QueueItem[] = [];
  public activeDownloads: Map<number, ActiveDownload> = new Map();
  public completedDownloads: CompletedDownload[] = [];
  public failedDownloads: FailedDownload[] = [];
  private paused: boolean = false;

  constructor(downloadPath: string, maxConcurrent: number = 3) {
    super();
    this.downloadPath = downloadPath;
    this.maxConcurrent = maxConcurrent;
  }

  onProgress(callback: QueueProgressCallback): DownloadQueue {
    this.on("progress", callback);
    return this;
  }

  onVideoComplete(callback: VideoCompleteCallback): DownloadQueue {
    this.on("videoComplete", callback);
    return this;
  }

  onQueueComplete(callback: QueueCompleteCallback): DownloadQueue {
    this.on("queueComplete", callback);
    return this;
  }

  onError(callback: QueueErrorCallback): DownloadQueue {
    this.on("error", callback);
    return this;
  }

  async add(
    videoData: VideoData,
    quality: QualitySelector | null = null
  ): Promise<number> {
    if (!videoData.metadataFetched) {
      await videoData.fetchMetadata();
    }

    const selectedQuality = quality?.(videoData) || videoData.qualityOptions[0];
    const queueItem: QueueItem = {
      videoData,
      quality: selectedQuality,
      id: Date.now() + Math.random(),
    };

    this.queue.push(queueItem);
    this._processQueue();

    return queueItem.id;
  }

  remove(id: number): boolean {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }

    if (this.activeDownloads.has(id)) {
      const download = this.activeDownloads.get(id)!;
      download.instance.cancel();
      this.activeDownloads.delete(id);
      return true;
    }

    return false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this._processQueue();
  }

  clear(): void {
    this.queue = [];
    for (const [id, download] of this.activeDownloads) {
      download.instance.cancel();
    }
    this.activeDownloads.clear();
  }

  getStatus(): QueueStatus {
    return {
      queued: this.queue.length,
      active: this.activeDownloads.size,
      completed: this.completedDownloads.length,
      failed: this.failedDownloads.length,
      paused: this.paused,
    };
  }

  private async _processQueue(): Promise<void> {
    if (
      this.paused ||
      this.activeDownloads.size >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    const queueItem = this.queue.shift()!;
    const downloadInstance = await queueItem.videoData.download(
      queueItem.quality,
      this.downloadPath
    );

    this.activeDownloads.set(queueItem.id, {
      instance: downloadInstance,
      videoData: queueItem.videoData,
    });

    downloadInstance.onProgress((percent: number) => {
      this.emit("progress", queueItem.videoData, percent);
    });

    downloadInstance.onComplete((filepath: string) => {
      this.activeDownloads.delete(queueItem.id);
      this.completedDownloads.push({
        videoData: queueItem.videoData,
        filepath,
        completedAt: new Date(),
      });

      this.emit("videoComplete", queueItem.videoData, filepath);

      if (this.activeDownloads.size === 0 && this.queue.length === 0) {
        this.emit("queueComplete", {
          completed: this.completedDownloads.length,
          failed: this.failedDownloads.length,
        });
      }

      this._processQueue();
    });

    downloadInstance.onError((error: Error) => {
      this.activeDownloads.delete(queueItem.id);
      this.failedDownloads.push({
        videoData: queueItem.videoData,
        error: error.message,
        failedAt: new Date(),
      });

      this.emit("error", queueItem.videoData, error);
      this._processQueue();
    });

    downloadInstance.start();
    this._processQueue();
  }
}

export {
  VideoData,
  DownloadInstance,
  DownloadQueue,
  Quality,
  Format,
  Metadata,
  QueueStatus,
  QualitySelector,
  ProgressCallback,
  CompleteCallback,
  ErrorCallback,
  VideoCompleteCallback,
  QueueProgressCallback,
  QueueCompleteCallback,
  QueueErrorCallback,
};
