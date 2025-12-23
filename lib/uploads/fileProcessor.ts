/**
 * File Processor for Project Uploads
 * Handles text extraction from various file types and AI summary generation
 */

import { GoogleGenAI } from '@google/genai';
import logger from '@/lib/utils/logger';

// Supported file types
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
  'text/csv',
  'text/markdown',
];

export const MAX_TEXT_LENGTH = 50000; // Maximum characters to process for AI summary

export interface ProcessingResult {
  extractedText: string;
  summary: string;
  error?: string;
}

/**
 * Main entry point for processing uploaded files
 */
export async function processUploadedFile(
  fileUrl: string,
  mimeType: string,
  fileName: string,
  apiKey: string
): Promise<ProcessingResult> {
  logger.info(`[File Processor] Processing file: ${fileName} (${mimeType})`);
  
  try {
    let extractedText = '';
    
    // Route to appropriate extractor based on mime type
    if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
      extractedText = await extractImageText(fileUrl, apiKey);
    } else if (mimeType === 'application/pdf') {
      extractedText = await extractPdfText(fileUrl);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractDocxText(fileUrl);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      extractedText = await extractXlsxText(fileUrl);
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      extractedText = await extractPlainText(fileUrl);
    } else {
      return {
        extractedText: '',
        summary: '',
        error: `Unsupported file type: ${mimeType}`,
      };
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        extractedText: '',
        summary: 'No text content could be extracted from this file.',
        error: undefined,
      };
    }
    
    // Truncate if too long
    const truncatedText = extractedText.length > MAX_TEXT_LENGTH 
      ? extractedText.substring(0, MAX_TEXT_LENGTH) + '...[truncated]'
      : extractedText;
    
    // Generate AI summary
    const summary = await generateFileSummary(truncatedText, fileName, mimeType, apiKey);
    
    return {
      extractedText: truncatedText,
      summary,
    };
  } catch (error) {
    logger.error(`[File Processor] Error processing file ${fileName}:`, error);
    return {
      extractedText: '',
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown processing error',
    };
  }
}

/**
 * Extract text from images using Gemini Vision
 */
async function extractImageText(fileUrl: string, apiKey: string): Promise<string> {
  logger.info('[File Processor] Extracting text from image using Gemini Vision');
  
  try {
    const client = new GoogleGenAI({ apiKey });
    
    // Fetch the image
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';
    
    // Use Gemini Vision to extract text and describe the image
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `Analyze this image and provide:
1. Any text visible in the image (OCR)
2. A detailed description of the image content, including:
   - Main subjects/objects
   - Visual elements (colors, layout, design)
   - Context and purpose (e.g., screenshot, diagram, photo, mockup)
   - Any relevant details that would help understand the image

Format your response as:
---TEXT CONTENT---
[Any text found in the image, or "No text found" if none]

---IMAGE DESCRIPTION---
[Detailed description of what the image shows]`,
            },
          ],
        },
      ],
    });
    
    return result.text || '';
  } catch (error) {
    logger.error('[File Processor] Image extraction error:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF documents
 */
async function extractPdfText(fileUrl: string): Promise<string> {
  logger.info('[File Processor] Extracting text from PDF');
  
  try {
    // Dynamically import pdf-parse
    const pdfParseModule = await import('pdf-parse') as unknown as { default?: (buffer: Buffer) => Promise<{ text: string }>; (buffer: Buffer): Promise<{ text: string }> };
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    logger.error('[File Processor] PDF extraction error:', error);
    
    // If pdf-parse is not available, return a helpful message
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return '[PDF parsing library not available. Please install pdf-parse package.]';
    }
    
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from Word documents (.docx)
 */
async function extractDocxText(fileUrl: string): Promise<string> {
  logger.info('[File Processor] Extracting text from DOCX');
  
  try {
    // Dynamically import mammoth
    const mammoth = await import('mammoth');
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch DOCX: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    logger.error('[File Processor] DOCX extraction error:', error);
    
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return '[DOCX parsing library not available. Please install mammoth package.]';
    }
    
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from Excel files (.xlsx)
 */
async function extractXlsxText(fileUrl: string): Promise<string> {
  logger.info('[File Processor] Extracting text from XLSX');
  
  try {
    // Dynamically import xlsx
    const XLSX = await import('xlsx');
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch XLSX: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Extract text from all sheets
    const textParts: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        textParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
    }
    
    return textParts.join('\n\n');
  } catch (error) {
    logger.error('[File Processor] XLSX extraction error:', error);
    
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return '[Excel parsing library not available. Please install xlsx package.]';
    }
    
    throw new Error(`Failed to extract text from XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from plain text files (txt, csv, md, json)
 */
async function extractPlainText(fileUrl: string): Promise<string> {
  logger.info('[File Processor] Extracting plain text');
  
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    logger.error('[File Processor] Plain text extraction error:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate an AI summary of the extracted text
 */
async function generateFileSummary(
  extractedText: string,
  fileName: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  logger.info('[File Processor] Generating AI summary');
  
  try {
    const client = new GoogleGenAI({ apiKey });
    
    const fileTypeDescription = getFileTypeDescription(mimeType);
    
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are summarizing a ${fileTypeDescription} named "${fileName}" for a software project context.

EXTRACTED CONTENT:
${extractedText}

---

Please provide a concise summary (100-300 words) that captures:
1. The main purpose/content of this document
2. Key information, requirements, or specifications mentioned
3. Any actionable items or important details relevant to software development
4. Technical terminology or concepts if present

Format the summary as a clear, professional paragraph that could be used by an AI assistant to understand this document's relevance to a software project.`,
            },
          ],
        },
      ],
    });
    
    return result.text || 'Unable to generate summary.';
  } catch (error) {
    logger.error('[File Processor] Summary generation error:', error);
    return `Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get human-readable file type description
 */
function getFileTypeDescription(mimeType: string): string {
  const descriptions: Record<string, string> = {
    'image/png': 'PNG image',
    'image/jpeg': 'JPEG image',
    'image/jpg': 'JPEG image',
    'image/gif': 'GIF image',
    'image/webp': 'WebP image',
    'application/pdf': 'PDF document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
    'text/plain': 'text file',
    'text/csv': 'CSV file',
    'text/markdown': 'Markdown document',
    'application/json': 'JSON file',
  };
  
  return descriptions[mimeType] || 'file';
}

/**
 * Check if a file type is supported for processing
 */
export function isSupportedFileType(mimeType: string): boolean {
  return (
    SUPPORTED_IMAGE_TYPES.includes(mimeType) ||
    SUPPORTED_DOCUMENT_TYPES.includes(mimeType) ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json'
  );
}

/**
 * Get the processing status label for UI display
 */
export function getProcessingStatusLabel(
  isProcessed: boolean,
  processingError: string | null
): 'pending' | 'processing' | 'completed' | 'failed' {
  if (processingError) return 'failed';
  if (isProcessed) return 'completed';
  return 'pending';
}

