import * as pdfjsLib from "pdfjs-dist";

export interface ExtractedAudio {
  name: string;
  url: string;
  blob: Blob;
}

export interface ExtractedImage {
  pageNum: number;
  url: string;
  width: number;
  height: number;
}

/**
 * Extract embedded file attachments (audio files) from a PDF.
 * pdf.js exposes catalog-level file attachments via getAttachments().
 */
export async function extractAudioAttachments(
  file: File,
): Promise<ExtractedAudio[]> {
  const results: ExtractedAudio[] = [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Catalog-level embedded files
    const attachments = await (pdf as any).getAttachments?.();
    if (attachments) {
      for (const [name, attachment] of Object.entries<any>(attachments)) {
        const lower = name.toLowerCase();
        if (
          lower.endsWith(".mp3") ||
          lower.endsWith(".wav") ||
          lower.endsWith(".m4a") ||
          lower.endsWith(".ogg")
        ) {
          const content = attachment.content;
          if (content && content.length > 0) {
            const mimeMap: Record<string, string> = {
              ".mp3": "audio/mpeg",
              ".wav": "audio/wav",
              ".m4a": "audio/mp4",
              ".ogg": "audio/ogg",
            };
            const ext = lower.slice(lower.lastIndexOf("."));
            const mime = mimeMap[ext] || "audio/mpeg";
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            results.push({ name, url, blob });
          }
        }
      }
    }
  } catch (err) {
    console.warn("[pdfMediaExtractor] Erro ao extrair áudios:", err);
  }
  return results;
}

/**
 * Extract embedded images from PDF pages using the operator list.
 * Filters out small icons (< 50x50).
 */
export async function extractPageImages(
  file: File,
): Promise<ExtractedImage[]> {
  const results: ExtractedImage[] = [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const ops = await page.getOperatorList();

      const seenKeys = new Set<string>();

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
        if (fn !== 85 && fn !== 82) continue;

        const imgKey = ops.argsArray[i]?.[0];
        if (!imgKey || typeof imgKey !== "string") continue;
        if (seenKeys.has(imgKey)) continue;
        seenKeys.add(imgKey);

        try {
          const imgData = await new Promise<any>((resolve, reject) => {
            (page as any).objs.get(imgKey, (obj: any) => {
              if (obj) resolve(obj);
              else reject(new Error("Image object not found"));
            });
          });

          const w = imgData.width;
          const h = imgData.height;

          // Skip tiny images (icons/decorations)
          if (w < 50 || h < 50) continue;

          // Render image data to a canvas to get a PNG blob URL
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;

          // imgData can be ImageBitmap or have a data property (Uint8ClampedArray)
          if (imgData instanceof ImageBitmap) {
            ctx.drawImage(imgData, 0, 0);
          } else if (imgData.data) {
            const imageData = new ImageData(
              new Uint8ClampedArray(imgData.data),
              w,
              h,
            );
            ctx.putImageData(imageData, 0, 0);
          } else if (imgData.src) {
            // Some versions expose a bitmap/src
            const img = new Image();
            img.src = imgData.src;
            await new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
            });
            ctx.drawImage(img, 0, 0, w, h);
          } else {
            continue;
          }

          const dataUrl = canvas.toDataURL("image/png");
          results.push({ pageNum: p, url: dataUrl, width: w, height: h });
        } catch {
          // Individual image extraction failed, skip
        }
      }
    }
  } catch (err) {
    console.warn("[pdfMediaExtractor] Erro ao extrair imagens:", err);
  }
  return results;
}
