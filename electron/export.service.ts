/**
 * 문서 Export 서비스 — HTML/PDF/DOCX 내보내기
 */
import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import { markdownToBasicHtml } from './utils';

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/** HTML 파일로 내보내기 */
export async function exportAsHtml(filePath: string, markdownContent: string): Promise<ExportResult> {
  try {
    const html = markdownToBasicHtml(markdownContent);
    await fs.writeFile(filePath, html, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** PDF 파일로 내보내기 (headless BrowserWindow 사용) */
export async function exportAsPdf(filePath: string, markdownContent: string): Promise<ExportResult> {
  try {
    const html = markdownToBasicHtml(markdownContent);
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true });
    await fs.writeFile(filePath, pdf);
    printWindow.destroy();
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** DOCX 파일로 내보내기 */
export async function exportAsDocx(filePath: string, markdownContent: string): Promise<ExportResult> {
  try {
    const docxModule = await import('docx');
    const lines = markdownContent.split('\n');
    const children = lines.map((line) => {
      if (line.startsWith('# ')) {
        return new docxModule.Paragraph({
          heading: docxModule.HeadingLevel.HEADING_1,
          children: [new docxModule.TextRun(line.slice(2))],
        });
      }
      if (line.startsWith('## ')) {
        return new docxModule.Paragraph({
          heading: docxModule.HeadingLevel.HEADING_2,
          children: [new docxModule.TextRun(line.slice(3))],
        });
      }
      return new docxModule.Paragraph({
        children: [new docxModule.TextRun(line)],
      });
    });

    const doc = new docxModule.Document({
      sections: [{ children }],
    });
    const buffer = await docxModule.Packer.toBuffer(doc);
    await fs.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 포맷에 따라 적절한 export 함수를 호출한다. */
export async function exportDocument(
  filePath: string,
  format: 'html' | 'pdf' | 'docx',
  markdownContent: string
): Promise<ExportResult> {
  switch (format) {
    case 'html':
      return exportAsHtml(filePath, markdownContent);
    case 'pdf':
      return exportAsPdf(filePath, markdownContent);
    case 'docx':
      return exportAsDocx(filePath, markdownContent);
    default:
      return { success: false, error: `Unsupported export format: ${format}` };
  }
}
