import JSZip from "jszip";
import { createExtractorFromData } from "node-unrar-js";
import type { BiddingAttachment } from "../types";

export type BinaryFile = { name: string; buffer: Buffer };

export type PreparedPdf = { name: string; buffer: Buffer };

export type PrepareAttachmentsOptions = {
  log?: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Converts raw attachments (zip, rar, doc, docx, pdf) into a flat list of PDFs
 * ready for upload. Unpacks zips/rars recursively; doc/docx use CloudConvert mock.
 */
export async function prepareAttachments(
  attachments: BiddingAttachment[],
  options?: PrepareAttachmentsOptions
): Promise<PreparedPdf[]> {
  const pdfs: PreparedPdf[] = [];
  const log = options?.log;

  for (const att of attachments) {
    const name = att.meta.titulo
      ? att.meta.titulo.replace(/[^\w.\-]/g, "_")
      : String(att.meta.sequencialDocumento);
    const isZip =
      name.toLowerCase().endsWith(".zip") ||
      att.contentType === "application/zip" ||
      att.contentType === "application/x-zip-compressed";

    if (isZip) {
      log?.("Unzipping attachment", { filename: name });
      const extracted = await unzip(att.buffer);
      for (const f of extracted) {
        if (f.name.toLowerCase().endsWith(".pdf")) {
          const base = f.name.split("/").pop() ?? f.name;
          pdfs.push({ name: base, buffer: f.buffer });
        }
      }
    } else if (
      name.toLowerCase().endsWith(".rar") ||
      att.contentType === "application/x-rar-compressed" ||
      att.contentType === "application/vnd.rar"
    ) {
      log?.("Unraring attachment", { filename: name });
      const extracted = await unrar(att.buffer);
      for (const f of extracted) {
        if (f.name.toLowerCase().endsWith(".pdf")) {
          const base = f.name.split("/").pop() ?? f.name;
          pdfs.push({ name: base, buffer: f.buffer });
        }
      }
    } else if (
      name.toLowerCase().endsWith(".doc") ||
      name.toLowerCase().endsWith(".docx")
    ) {
      log?.("Docx to PDF (CloudConvert mock)", { filename: name });
      const pdfBuffer = await docxToPdf(att.buffer, name);
      if (pdfBuffer.length > 0) {
        const pdfName = name.replace(/\.(docx?|doc)$/i, ".pdf");
        pdfs.push({ name: pdfName, buffer: pdfBuffer });
      }
    } else if (name.toLowerCase().endsWith(".pdf")) {
      pdfs.push({ name, buffer: att.buffer });
    }
  }

  return pdfs;
}

/**
 * Extracts all files from a zip buffer, recursively unpacking nested zips.
 * Returns only leaf (non-zip) files.
 */
export async function unzip(buffer: Buffer): Promise<BinaryFile[]> {
  const results: BinaryFile[] = [];
  const zip = await JSZip.loadAsync(buffer);

  for (const [path, file] of Object.entries(zip.files)) {
    const entry = file as JSZip.JSZipObject;
    if (entry.dir) continue;
    const entryBuffer = await entry.async("nodebuffer");

    if (path.toLowerCase().endsWith(".zip")) {
      const nested = await unzip(entryBuffer);
      results.push(...nested);
    } else {
      results.push({ name: path, buffer: entryBuffer });
    }
  }

  return results;
}

/**
 * Extracts all files from a rar buffer, recursively unpacking nested rars.
 * Returns only leaf (non-rar) files.
 */
export async function unrar(buffer: Buffer): Promise<BinaryFile[]> {
  const results: BinaryFile[] = [];
  const data =
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
  const extractor = await createExtractorFromData({ data });
  const extracted = extractor.extract();
  const files = [...extracted.files];

  for (const { fileHeader, extraction } of files) {
    if (fileHeader.flags.directory || extraction == null) continue;
    const entryBuffer = Buffer.from(extraction);
    const name = fileHeader.name;

    if (name.toLowerCase().endsWith(".rar")) {
      const nested = await unrar(entryBuffer);
      results.push(...nested);
    } else {
      results.push({ name, buffer: entryBuffer });
    }
  }

  return results;
}

/**
 * Converts a DOC/DOCX buffer to PDF via CloudConvert (mock).
 * Returns empty buffer until the real API is wired; pipeline should log when calling.
 */
export async function docxToPdf(
  _buffer: Buffer,
  _filename?: string
): Promise<Buffer> {
  void _buffer;
  void _filename;
  // TODO: call CloudConvert API when implemented
  return Buffer.alloc(0);
}
