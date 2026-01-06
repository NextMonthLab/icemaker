import type { OrbitDocumentType } from "@shared/schema";
import { PDFParse } from 'pdf-parse';

export function detectDocumentType(fileName: string): OrbitDocumentType {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const typeMap: Record<string, OrbitDocumentType> = {
    'pdf': 'pdf',
    'ppt': 'ppt',
    'pptx': 'pptx',
    'doc': 'doc',
    'docx': 'docx',
    'txt': 'txt',
    'md': 'md',
  };
  return typeMap[ext] || 'txt';
}

export function isAllowedDocumentType(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'txt', 'md'].includes(ext);
}

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // pdf-parse v2 uses class-based API
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    
    return {
      text: result.text?.slice(0, 500000) || '', // Limit to 500k chars
      pageCount: result.total || 0,
    };
  } catch (error) {
    console.error('[DocumentProcessor] PDF extraction error:', error);
    return { text: '', pageCount: 0 };
  }
}

export async function extractTextFromPlainText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const text = buffer.toString('utf-8').slice(0, 500000);
  return { text, pageCount: 1 };
}

export async function extractDocumentText(
  buffer: Buffer, 
  fileType: OrbitDocumentType
): Promise<{ text: string; pageCount: number }> {
  switch (fileType) {
    case 'pdf':
      return extractTextFromPdf(buffer);
    case 'txt':
    case 'md':
      return extractTextFromPlainText(buffer);
    case 'ppt':
    case 'pptx':
    case 'doc':
    case 'docx':
      // For Office formats, we'd need additional libraries
      // For now, return empty and mark as needing manual text
      console.log('[DocumentProcessor] Office format not yet supported for extraction:', fileType);
      return { text: '', pageCount: 0 };
    default:
      return { text: '', pageCount: 0 };
  }
}
