const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;
const MAX_FILE_SIZE = 500 * 1024;

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function isCompressibleImage(file: File): boolean {
  return file.type.startsWith("image/") && !file.type.includes("svg");
}

export async function compressImage(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  if (file.size <= MAX_FILE_SIZE) return file;

  let objectUrl = "";
  try {
    const { img, url } = await loadImage(file);
    objectUrl = url;

    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob()),
        "image/jpeg",
        JPEG_QUALITY
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const compressedFile = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return compressedFile;
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
