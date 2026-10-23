import { fromRgba, type Gray } from "./image";

/** getUserMedia needs a secure context: https, or localhost. Plain http://<ip> will not work. */
export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    },
  });
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => video.addEventListener("loadedmetadata", () => resolve(), { once: true }));
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

function draw(video: HTMLVideoElement, maxEdge: number): { canvas: HTMLCanvasElement; w: number; h: number } {
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0, w, h);
  return { canvas, w, h };
}

/** Current frame as grayscale, downscaled so the long edge is <= maxEdge. */
export function grabFrame(video: HTMLVideoElement, maxEdge = 1800): Gray {
  const { canvas, w, h } = draw(video, maxEdge);
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, w, h);
  return fromRgba(data, w, h);
}

/** Small JPEG of the rectified sheet, kept as the evidence trail for a disputed row. */
export function toThumbnail(gray: Gray, width = 900): Promise<Blob | null> {
  const scale = Math.min(1, width / gray.width);
  const w = Math.round(gray.width * scale);
  const h = Math.round(gray.height * scale);
  const full = new ImageData(gray.width, gray.height);
  for (let i = 0, j = 0; i < gray.data.length; i++, j += 4) {
    const v = gray.data[i];
    full.data[j] = v;
    full.data[j + 1] = v;
    full.data[j + 2] = v;
    full.data[j + 3] = 255;
  }
  const source = document.createElement("canvas");
  source.width = gray.width;
  source.height = gray.height;
  source.getContext("2d")!.putImageData(full, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72));
}
