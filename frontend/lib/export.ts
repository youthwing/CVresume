import {saveAs} from "file-saver";
import html2canvas from "html2canvas";
import {jsPDF} from "jspdf";

export function slugifyFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "resume";
}

export function downloadTextFile({
  content,
  filename,
  mimeType
}: {
  content: string;
  filename: string;
  mimeType: string;
}) {
  const blob = new Blob([content], {type: `${mimeType};charset=utf-8`});
  saveAs(blob, filename);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function downloadWordDocument({
  title,
  content,
  filename
}: {
  title: string;
  content: string;
  filename: string;
}) {
  const html = `<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; margin: 32px; color: #0f172a; line-height: 1.7; }
      h1 { margin: 0 0 20px; font-size: 24px; }
      .content { white-space: pre-wrap; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <div class="content">${escapeHtml(content)}</div>
  </body>
</html>`;

  const blob = new Blob(["\ufeff", html], {type: "application/msword;charset=utf-8"});
  saveAs(blob, filename.endsWith(".doc") ? filename : `${filename}.doc`);
}

export async function downloadPdfFromElement({
  element,
  filename
}: {
  element: HTMLElement;
  filename: string;
}) {
  if ("fonts" in document) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false
  });

  const imageData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  let remainingHeight = imageHeight;
  let positionY = 0;

  pdf.addImage(imageData, "PNG", 0, positionY, imageWidth, imageHeight, undefined, "FAST");
  remainingHeight -= pageHeight;

  while (remainingHeight > 0) {
    positionY = remainingHeight - imageHeight;
    pdf.addPage();
    pdf.addImage(imageData, "PNG", 0, positionY, imageWidth, imageHeight, undefined, "FAST");
    remainingHeight -= pageHeight;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
