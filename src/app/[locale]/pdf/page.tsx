"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAdmin } from "@/components/AdminContext";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import {
    IconCloudUpload, IconFileTypePdf, IconLoader2, IconDownload, IconArrowLeft,
    IconFileDescription, IconPhoto, IconFileText, IconPresentation, IconCode, IconX,
    IconFileCheck, IconBrandTelegram, IconLock, IconLockOpen, IconScissors, IconArrowsShuffle,
    IconRotate, IconLayersIntersect, IconEraser, IconWand, IconMaximize, IconMinimize, IconTxt,
    IconBrowser, IconFileZip, IconShield, IconSettings, IconChevronDown, IconChevronUp, IconSearch,
} from "@tabler/icons-react";
import { useToast } from "@/components/ToastContext";

type ToolType = 
    // Convert
    | "file-to-pdf" | "img-to-pdf" | "pdf-to-word" | "pdf-to-ppt" | "pdf-to-text" | "pdf-to-img" | "pdf-to-html" | "pdf-to-xml" | "pdf-to-pdfa" | "html-to-pdf" | "markdown-to-pdf" | "url-to-pdf" | "vector-to-pdf" | "text-editor-to-pdf" | "svg-to-pdf" | "pdf-to-xlsx" | "pdf-to-video" | "pdf-to-vector" | "pdf-to-text-editor" | "pdf-to-epub" | "pdf-to-csv" | "pdf-to-cbz" | "pdf-to-cbr" | "eml-to-pdf" | "ebook-to-pdf" | "cbz-to-pdf" | "cbr-to-pdf"
    // Edit / General
    | "merge-pdfs" | "split-pages" | "remove-pages" | "rotate-pdf" | "organize-pdf" | "scale-pages" | "crop-pdf" | "split-pdf-by-sections" | "split-pdf-by-chapters" | "split-for-poster-print" | "split-by-size-or-count" | "remove-image-pdf" | "pdf-to-single-page" | "overlay-pdfs" | "multi-page-layout" | "extract-bookmarks" | "edit-table-of-contents" | "booklet-imposition"
    // Security
    | "add-password" | "remove-password" | "add-watermark" | "sanitize-pdf" | "verify-pdf" | "validate-signature" | "remove-cert-sign" | "redact-pdf" | "get-info-on-pdf" | "cert-sign" | "auto-redact"
    // Misc
    | "compress-pdf" | "ocr-pdf" | "repair-pdf" | "flatten-pdf" | "remove-blanks" | "extract-images" | "update-metadata" | "unlock-pdf-forms" | "show-javascript" | "scanner-effect" | "replace-invert-pdf" | "rename-attachment" | "list-attachments" | "extract-image-scans" | "extract-attachments" | "delete-attachment" | "decompress-pdf" | "auto-split-pdf" | "auto-rename" | "add-stamp" | "add-page-numbers" | "add-image" | "add-attachments"
    // Filter
    | "filter-page-size" | "filter-page-rotation" | "filter-page-count" | "filter-file-size" | "filter-contains-text" | "filter-contains-image"
    // Analysis
    | "security-info" | "page-dimensions" | "page-count" | "form-fields" | "font-info" | "document-properties" | "basic-info" | "annotation-info"
    // Form
    | "modify-fields" | "fill-form" | "inspect-fields" | "fields-with-coordinates" | "extract-xlsx-form" | "extract-csv-form" | "delete-fields"
    // Pipeline
    | "import-database" | "handle-pipeline";

interface ToolDef {
    id: ToolType;
    title: string;
    desc: string;
    icon: any;
    accept: string;
    outputExt: string;
    category: "Convert" | "Edit" | "Security" | "Misc" | "Form" | "Analysis" | "Filter" | "Pipeline";
}

const TOOLS: ToolDef[] = [
    // Convert
    { id: "file-to-pdf", title: "File to PDF", desc: "Word, Excel, PPT to PDF", icon: IconFileDescription, accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html", outputExt: ".pdf", category: "Convert" },
    { id: "img-to-pdf", title: "Image to PDF", desc: "JPG, PNG to PDF", icon: IconPhoto, accept: "image/*", outputExt: ".pdf", category: "Convert" },
    { id: "pdf-to-word", title: "PDF to Word", desc: "PDF to Editable Word", icon: IconFileText, accept: ".pdf", outputExt: ".docx", category: "Convert" },
    { id: "pdf-to-ppt", title: "PDF to PPT", desc: "PDF to PowerPoint", icon: IconPresentation, accept: ".pdf", outputExt: ".pptx", category: "Convert" },
    { id: "pdf-to-img", title: "PDF to Images", desc: "Save pages as Images", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Convert" },
    { id: "pdf-to-text", title: "PDF to Text", desc: "Extract plain text", icon: IconTxt, accept: ".pdf", outputExt: ".txt", category: "Convert" },
    { id: "pdf-to-html", title: "PDF to HTML", desc: "Convert to Web Page", icon: IconBrowser, accept: ".pdf", outputExt: ".html", category: "Convert" },
    { id: "pdf-to-xml", title: "PDF to XML", desc: "Convert PDF to XML", icon: IconCode, accept: ".pdf", outputExt: ".xml", category: "Convert" },
    { id: "pdf-to-pdfa", title: "PDF to PDF/A", desc: "Convert to Archival Format", icon: IconFileCheck, accept: ".pdf", outputExt: ".pdf", category: "Convert" },
    { id: "html-to-pdf", title: "HTML to PDF", desc: "Convert HTML to PDF", icon: IconBrowser, accept: ".html,.zip", outputExt: ".pdf", category: "Convert" },
    { id: "markdown-to-pdf", title: "Markdown to PDF", desc: "Convert MD to PDF", icon: IconTxt, accept: ".md", outputExt: ".pdf", category: "Convert" },
    { id: "url-to-pdf", title: "URL to PDF", desc: "Convert Website URL to PDF", icon: IconBrowser, accept: "text/plain", outputExt: ".pdf", category: "Convert" },
    { id: "vector-to-pdf", title: "Vector to PDF", desc: "Convert PostScript to PDF", icon: IconPhoto, accept: "*/*", outputExt: ".pdf", category: "Convert" },
    { id: "text-editor-to-pdf", title: "Text Editor to PDF", desc: "Convert Text Format to PDF", icon: IconTxt, accept: "*/*", outputExt: ".pdf", category: "Convert" },
    { id: "svg-to-pdf", title: "SVG to PDF", desc: "Convert SVG to PDF", icon: IconPhoto, accept: ".svg", outputExt: ".pdf", category: "Convert" },
    { id: "pdf-to-xlsx", title: "PDF to XLSX", desc: "Convert PDF to Excel", icon: IconFileDescription, accept: ".pdf", outputExt: ".xlsx", category: "Convert" },
    { id: "pdf-to-video", title: "PDF to Video", desc: "Convert PDF to Slideshow", icon: IconPresentation, accept: ".pdf", outputExt: ".zip", category: "Convert" },
    { id: "pdf-to-vector", title: "PDF to Vector", desc: "Convert PDF to Vector format", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Convert" },
    { id: "pdf-to-text-editor", title: "PDF to Text Editor", desc: "Convert to Editor Format", icon: IconTxt, accept: ".pdf", outputExt: ".json", category: "Convert" },
    { id: "pdf-to-epub", title: "PDF to EPUB", desc: "Convert PDF to eBook", icon: IconFileDescription, accept: ".pdf", outputExt: ".epub", category: "Convert" },
    { id: "pdf-to-csv", title: "PDF to CSV", desc: "Extract CSV from PDF", icon: IconFileText, accept: ".pdf", outputExt: ".csv", category: "Convert" },
    { id: "pdf-to-cbz", title: "PDF to CBZ", desc: "Convert PDF to Comic Book", icon: IconFileZip, accept: ".pdf", outputExt: ".cbz", category: "Convert" },
    { id: "pdf-to-cbr", title: "PDF to CBR", desc: "Convert PDF to Comic Book", icon: IconFileZip, accept: ".pdf", outputExt: ".cbr", category: "Convert" },
    { id: "eml-to-pdf", title: "EML to PDF", desc: "Convert Email to PDF", icon: IconFileText, accept: ".eml,.msg", outputExt: ".pdf", category: "Convert" },
    { id: "ebook-to-pdf", title: "eBook to PDF", desc: "Convert eBook to PDF", icon: IconFileDescription, accept: ".epub,.mobi,.azw3", outputExt: ".pdf", category: "Convert" },
    { id: "cbz-to-pdf", title: "CBZ to PDF", desc: "Convert CBZ to PDF", icon: IconFileZip, accept: ".cbz", outputExt: ".pdf", category: "Convert" },
    { id: "cbr-to-pdf", title: "CBR to PDF", desc: "Convert CBR to PDF", icon: IconFileZip, accept: ".cbr", outputExt: ".pdf", category: "Convert" },

    // Edit
    { id: "merge-pdfs", title: "Merge PDFs", desc: "Combine multiple files", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "split-pages", title: "Split PDF", desc: "Separate pages", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "remove-pages", title: "Remove Pages", desc: "Delete unwanted pages", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "rotate-pdf", title: "Rotate", desc: "Rotate pages 90°/180°", icon: IconRotate, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "organize-pdf", title: "Organize", desc: "Rearrange page order", icon: IconArrowsShuffle, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "scale-pages", title: "Scale Pages", desc: "Change the size of a PDF", icon: IconArrowsShuffle, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "crop-pdf", title: "Crop PDF", desc: "Crops a document", icon: IconScissors, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "split-pdf-by-sections", title: "Split by Sections", desc: "Split pages into smaller sections", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "split-pdf-by-chapters", title: "Split by Chapters", desc: "Split PDEs by Chapters", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "split-for-poster-print", title: "Split for Poster", desc: "Split large pages to printable chunks", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "split-by-size-or-count", title: "Auto Split", desc: "Auto split documents by size or count", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "remove-image-pdf", title: "Remove Images", desc: "Remove images from file", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "pdf-to-single-page", title: "To Single Page", desc: "Convert to a single long page", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "overlay-pdfs", title: "Overlay PDFs", desc: "Overlay PDF files in various modes", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "multi-page-layout", title: "Multi-page Layout", desc: "Merge multiple pages into a single page", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "extract-bookmarks", title: "Extract Bookmarks", desc: "Extract PDF Bookmarks", icon: IconFileText, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "edit-table-of-contents", title: "Edit TOC", desc: "Edit Table of Contents", icon: IconFileText, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "booklet-imposition", title: "Booklet Imposition", desc: "Create a booklet", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },

    // Security
    { id: "add-password", title: "Protect", desc: "Add Password", icon: IconLock, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "remove-password", title: "Unlock", desc: "Remove Password", icon: IconLockOpen, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "sanitize-pdf", title: "Sanitize", desc: "Remove metadata/scripts", icon: IconShield, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "add-watermark", title: "Watermark", desc: "Add watermark to a file", icon: IconPhoto, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "verify-pdf", title: "Verify PDF", desc: "Verify Standards Compliance", icon: IconShield, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "validate-signature", title: "Validate Signature", desc: "Validate Digital Signature", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Security" },
    { id: "remove-cert-sign", title: "Remove Cert Sign", desc: "Remove digital signature", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "redact-pdf", title: "Redact", desc: "Redacts areas and pages", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "get-info-on-pdf", title: "Get Info", desc: "Get comprehensive info", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Security" },
    { id: "cert-sign", title: "Cert Sign", desc: "Sign with Digital Certificate", icon: IconLock, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "auto-redact", title: "Auto Redact", desc: "Redact PDF automatically", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Security" },

    // Misc
    { id: "compress-pdf", title: "Compress", desc: "Reduce file size", icon: IconMinimize, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "ocr-pdf", title: "OCR", desc: "Make text searchable", icon: IconCode, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "repair-pdf", title: "Repair", desc: "Fix broken PDFs", icon: IconWand, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "flatten-pdf", title: "Flatten", desc: "Flatten forms/layers", icon: IconMaximize, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "extract-images", title: "Extract Images", desc: "Get all images", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Misc" },
    { id: "remove-blanks", title: "Remove Blanks", desc: "Remove blank pages", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "update-metadata", title: "Update Metadata", desc: "Update file metadata", icon: IconSettings, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "unlock-pdf-forms", title: "Unlock Forms", desc: "Remove read-only from fields", icon: IconLockOpen, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "show-javascript", title: "Show JavaScript", desc: "Grabs all JS from PDF", icon: IconCode, accept: ".pdf", outputExt: ".js", category: "Misc" },
    { id: "scanner-effect", title: "Scanner Effect", desc: "Apply scanner effect", icon: IconPhoto, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "replace-invert-pdf", title: "Invert Color", desc: "Replace-Invert Color PDF", icon: IconPhoto, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "rename-attachment", title: "Rename Attachment", desc: "Rename attachment in PDF", icon: IconSettings, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "list-attachments", title: "List Attachments", desc: "List attachments in PDF", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Misc" },
    { id: "extract-image-scans", title: "Extract Scans", desc: "Extract image scans", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Misc" },
    { id: "extract-attachments", title: "Extract Attachments", desc: "Extract attachments from PDF", icon: IconFileZip, accept: ".pdf", outputExt: ".zip", category: "Misc" },
    { id: "delete-attachment", title: "Delete Attachment", desc: "Delete attachment from PDF", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "decompress-pdf", title: "Decompress", desc: "Decompress PDF streams", icon: IconMaximize, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "auto-split-pdf", title: "Auto Split", desc: "Auto split pages", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Misc" },
    { id: "auto-rename", title: "Auto Rename", desc: "Extract header from PDF", icon: IconSettings, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "add-stamp", title: "Add Stamp", desc: "Add stamp to a PDF", icon: IconPhoto, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "add-page-numbers", title: "Add Page Numbers", desc: "Add page numbers to document", icon: IconTxt, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "add-image", title: "Add Image", desc: "Overlay image onto a file", icon: IconPhoto, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "add-attachments", title: "Add Attachments", desc: "Add attachments to PDF", icon: IconFileZip, accept: ".pdf", outputExt: ".pdf", category: "Misc" },

    // Filter
    { id: "filter-page-size", title: "Filter Page Size", desc: "Check PDF page size", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },
    { id: "filter-page-rotation", title: "Filter Rotation", desc: "Check PDF rotation", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },
    { id: "filter-page-count", title: "Filter Page Count", desc: "Check PDF page count", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },
    { id: "filter-file-size", title: "Filter File Size", desc: "Check PDF file size", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },
    { id: "filter-contains-text", title: "Contains Text", desc: "Check if contains text", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },
    { id: "filter-contains-image", title: "Contains Image", desc: "Check if contains image", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Filter" },

    // Analysis
    { id: "security-info", title: "Security Info", desc: "Get security information", icon: IconShield, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "page-dimensions", title: "Page Dimensions", desc: "Get page dimensions", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "page-count", title: "Page Count", desc: "Get PDF page count", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "form-fields", title: "Form Fields", desc: "Get form field information", icon: IconFileDescription, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "font-info", title: "Font Info", desc: "Get font information", icon: IconTxt, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "document-properties", title: "Document Props", desc: "Get PDF properties", icon: IconSettings, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "basic-info", title: "Basic Info", desc: "Get basic information", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Analysis" },
    { id: "annotation-info", title: "Annotation Info", desc: "Get annotation info", icon: IconFileText, accept: ".pdf", outputExt: ".json", category: "Analysis" },

    // Form
    { id: "modify-fields", title: "Modify Fields", desc: "Modify existing form fields", icon: IconSettings, accept: ".pdf", outputExt: ".pdf", category: "Form" },
    { id: "fill-form", title: "Fill Form", desc: "Fill PDF form fields", icon: IconFileText, accept: ".pdf", outputExt: ".pdf", category: "Form" },
    { id: "inspect-fields", title: "Inspect Fields", desc: "Inspect PDF form fields", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Form" },
    { id: "fields-with-coordinates", title: "Fields w/ Coords", desc: "Inspect fields with coordinates", icon: IconFileCheck, accept: ".pdf", outputExt: ".json", category: "Form" },
    { id: "extract-xlsx-form", title: "Extract as XLSX", desc: "Extract form fields as XLSX", icon: IconFileDescription, accept: ".pdf", outputExt: ".xlsx", category: "Form" },
    { id: "extract-csv-form", title: "Extract as CSV", desc: "Extract form fields as CSV", icon: IconFileText, accept: ".pdf", outputExt: ".csv", category: "Form" },
    { id: "delete-fields", title: "Delete Fields", desc: "Delete form fields", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Form" },

    // Pipeline
    { id: "import-database", title: "Import Database", desc: "Import backup file", icon: IconSettings, accept: ".zip,.db", outputExt: ".json", category: "Pipeline" },
    { id: "handle-pipeline", title: "Handle Pipeline", desc: "Execute automated pipeline", icon: IconSettings, accept: ".pdf", outputExt: ".json", category: "Pipeline" },
];

const CATEGORIES = ["All", "Convert", "Edit", "Security", "Misc", "Form", "Analysis", "Filter", "Pipeline"];

// ═══════════════════════════════════════════
// Per-tool settings config from Stirling API
// ═══════════════════════════════════════════
type SettingFieldType = "select" | "text" | "number" | "toggle" | "slider" | "file";

const MULTI_FILE_TOOLS: ToolType[] = ["merge-pdfs", "overlay-pdfs", "img-to-pdf"];

interface SettingField {
    key: string;
    label: string;
    type: SettingFieldType;
    options?: { value: string; label: string }[];
    default: any;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
}

const TOOL_SETTINGS: Record<string, SettingField[]> = {
    "url-to-pdf": [
        { key: "urlInput", label: "Website URL", type: "text", default: "", placeholder: "https://google.com" },
    ],
    "html-to-pdf": [
        { key: "zoom", label: "Zoom Level", type: "number", default: 1, step: 0.1 },
    ],
    "img-to-pdf": [
        { key: "fitOption", label: "Fit Option", type: "select", default: "fillPage", options: [
            { value: "fillPage", label: "Fill Page" }, { value: "fitDocumentToImage", label: "Fit to Image" }, { value: "maintainAspectRatio", label: "Maintain Aspect Ratio" }
        ]},
        { key: "colorType", label: "Color", type: "select", default: "color", options: [
            { value: "color", label: "Color" }, { value: "greyscale", label: "Greyscale" }, { value: "blackwhite", label: "Black & White" }
        ]},
        { key: "autoRotate", label: "Auto Rotate", type: "toggle", default: true },
    ],
    "pdf-to-img": [
        { key: "imageFormat", label: "Format", type: "select", default: "png", options: [
            { value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }, { value: "gif", label: "GIF" }, { value: "webp", label: "WebP" }
        ]},
        { key: "singleOrMultiple", label: "Output Mode", type: "select", default: "multiple", options: [
            { value: "single", label: "Single Image" }, { value: "multiple", label: "One per Page" }
        ]},
        { key: "pageNumbers", label: "Pages", type: "text", default: "all", placeholder: "e.g. 1,3,5-9" },
        { key: "colorType", label: "Color", type: "select", default: "color", options: [
            { value: "color", label: "Color" }, { value: "greyscale", label: "Greyscale" }, { value: "blackwhite", label: "Black & White" }
        ]},
        { key: "dpi", label: "DPI", type: "select", default: "300", options: [
            { value: "72", label: "72" }, { value: "150", label: "150" }, { value: "300", label: "300" }
        ]},
    ],
    "pdf-to-csv": [
        { key: "pageNumbers", label: "Pages", type: "text", default: "all", placeholder: "e.g. 1,3" },
    ],
    "pdf-to-word": [
        { key: "outputFormat", label: "Format", type: "select", default: "docx", options: [
            { value: "docx", label: "DOCX" }, { value: "doc", label: "DOC" }, { value: "odt", label: "ODT" }
        ]},
    ],
    "pdf-to-ppt": [
        { key: "outputFormat", label: "Format", type: "select", default: "pptx", options: [
            { value: "pptx", label: "PPTX" }, { value: "ppt", label: "PPT" }, { value: "odp", label: "ODP" }
        ]},
    ],
    "pdf-to-text": [
        { key: "outputFormat", label: "Format", type: "select", default: "txt", options: [
            { value: "txt", label: "Plain Text" }, { value: "rtf", label: "RTF" }
        ]},
    ],
    "pdf-to-pdfa": [
        { key: "outputFormat", label: "PDF/A Type", type: "select", default: "pdfa", options: [
            { value: "pdfa", label: "PDF/A" }, { value: "pdfa-1", label: "PDF/A-1" }
        ]},
    ],
    "merge-pdfs": [
        { key: "sortType", label: "Sort Type", type: "select", default: "", options: [
            { value: "", label: "None" }, { value: "fileName", label: "By Filename" }, { value: "date", label: "By Date" }
        ]},
        { key: "removeCertSign", label: "Remove Signatures", type: "toggle", default: false },
    ],
    "split-pages": [
        { key: "pageNumbers", label: "Pages", type: "text", default: "all", placeholder: "e.g. 1,3,5-9 or all" },
    ],
    "split-pdf-by-sections": [
        { key: "horizontalDivisions", label: "Horizontal Divs", type: "number", default: 2, min: 1 },
        { key: "verticalDivisions", label: "Vertical Divs", type: "number", default: 1, min: 1 },
        { key: "merge", label: "Merge result", type: "toggle", default: false },
    ],
    "split-pdf-by-chapters": [
        { key: "bookmarkLevel", label: "Bookmark Level", type: "number", default: 1, min: 1 },
        { key: "includeMetadata", label: "Include Metadata", type: "toggle", default: false },
        { key: "allowDuplicates", label: "Allow Duplicates", type: "toggle", default: false },
    ],
    "split-by-size-or-count": [
        { key: "splitType", label: "Split Type", type: "select", default: "1", options: [
            { value: "0", label: "By Size" }, { value: "1", label: "By Page Count" }, { value: "2", label: "By Doc Count" }
        ]},
        { key: "splitValue", label: "Value (MB or Count)", type: "text", default: "5", placeholder: "e.g. 10MB or 5" },
    ],
    "remove-pages": [
        { key: "pageNumbers", label: "Pages to Remove", type: "text", default: "", placeholder: "e.g. 2,4,6" },
    ],
    "rotate-pdf": [
        { key: "angle", label: "Rotation Angle", type: "select", default: "90", options: [
            { value: "90", label: "90°" }, { value: "180", label: "180°" }, { value: "270", label: "270°" }
        ]},
    ],
    "organize-pdf": [
        { key: "customMode", label: "Mode", type: "select", default: "CUSTOM", options: [
            { value: "CUSTOM", label: "Custom Order" }, { value: "REVERSE_ORDER", label: "Reverse" }, { value: "DUPLEX_SORT", label: "Duplex Sort" }, { value: "BOOKLET_SORT", label: "Booklet" }, { value: "ODD_EVEN_SPLIT", label: "Odd/Even Split" }
        ]},
        { key: "pageNumbers", label: "Page Order", type: "text", default: "all", placeholder: "e.g. 3,1,4,2" },
    ],
    "scale-pages": [
        { key: "pageSize", label: "Page Size", type: "select", default: "A4", options: [
            { value: "A3", label: "A3" }, { value: "A4", label: "A4" }, { value: "A5", label: "A5" }, { value: "LETTER", label: "Letter" }, { value: "LEGAL", label: "Legal" }, { value: "KEEP", label: "Keep Original" }
        ]},
        { key: "scaleFactor", label: "Scale Factor", type: "number", default: 1, min: 0.1, max: 5, step: 0.1 },
    ],
    "crop-pdf": [
        { key: "x", label: "X", type: "number", default: 0 },
        { key: "y", label: "Y", type: "number", default: 0 },
        { key: "width", label: "Width", type: "number", default: 100 },
        { key: "height", label: "Height", type: "number", default: 100 },
    ],
    "overlay-pdfs": [
        { key: "overlayMode", label: "Mode", type: "select", default: "SequentialOverlay", options: [
            { value: "SequentialOverlay", label: "Sequential" }, { value: "InterleavedOverlay", label: "Interleaved" }, { value: "FixedRepeatOverlay", label: "Fixed Repeat" }
        ]},
        { key: "overlayPosition", label: "Position", type: "select", default: "0", options: [
            { value: "0", label: "Foreground" }, { value: "1", label: "Background" }
        ]},
    ],
    "multi-page-layout": [
        { key: "pagesPerSheet", label: "Pages per Sheet", type: "number", default: 2, min: 1 },
        { key: "addBorder", label: "Add Border", type: "toggle", default: false },
    ],
    "add-password": [
        { key: "password", label: "User Password", type: "text", default: "", placeholder: "Opens the document" },
        { key: "ownerPassword", label: "Owner Password", type: "text", default: "", placeholder: "Restricts editing (optional)" },
        { key: "keyLength", label: "Encryption", type: "select", default: "256", options: [
            { value: "40", label: "40-bit (weak)" }, { value: "128", label: "128-bit" }, { value: "256", label: "256-bit (recommended)" }
        ]},
        { key: "canPrint", label: "Allow Printing", type: "toggle", default: true },
        { key: "canModify", label: "Allow Modification", type: "toggle", default: true },
    ],
    "remove-password": [
        { key: "password", label: "Current Password", type: "text", default: "", placeholder: "Enter existing password" },
    ],
    "sanitize-pdf": [
        { key: "removeJavaScript", label: "Remove JavaScript", type: "toggle", default: true },
        { key: "removeEmbeddedFiles", label: "Remove Embedded Files", type: "toggle", default: true },
        { key: "removeMetadata", label: "Remove Metadata", type: "toggle", default: true },
        { key: "removeLinks", label: "Remove Links", type: "toggle", default: false },
        { key: "removeFonts", label: "Remove Fonts", type: "toggle", default: false },
    ],
    "add-watermark": [
        { key: "watermarkType", label: "Type", type: "select", default: "text", options: [{value: "text", label: "Text"}, {value: "image", label: "Image"}]},
        { key: "watermarkText", label: "Text", type: "text", default: "WATERMARK" },
        { key: "watermarkImage", label: "Image File", type: "file", default: null },
        { key: "rotation", label: "Rotation", type: "number", default: 45 },
        { key: "opacity", label: "Opacity", type: "number", default: 0.5, min: 0, max: 1, step: 0.1 },
    ],
    "auto-redact": [
        { key: "listOfText", label: "Text to Redact", type: "text", default: "", placeholder: "e.g. Email, Password" },
        { key: "useRegex", label: "Use Regex", type: "toggle", default: false },
        { key: "redactColor", label: "Color (hex)", type: "text", default: "#000000" },
    ],
    "compress-pdf": [
        { key: "optimizeLevel", label: "Compression Level", type: "slider", default: 5, min: 1, max: 9, step: 1 },
        { key: "expectedOutputSize", label: "Target Size", type: "text", default: "", placeholder: "e.g. 10MB" },
        { key: "linearize", label: "Fast Web View", type: "toggle", default: false },
        { key: "grayscale", label: "Grayscale", type: "toggle", default: false },
    ],
    "ocr-pdf": [
        { key: "ocrType", label: "OCR Mode", type: "select", default: "skip-text", options: [
            { value: "skip-text", label: "Skip existing text" }, { value: "force-ocr", label: "Force OCR" }, { value: "Normal", label: "Normal" }
        ]},
        { key: "ocrRenderType", label: "Render Type", type: "select", default: "hocr", options: [
            { value: "hocr", label: "hOCR" }, { value: "sandwich", label: "Sandwich" }
        ]},
        { key: "languages", label: "Language", type: "select", default: "eng", options: [
            { value: "eng", label: "English" }, { value: "rus", label: "Russian" }, { value: "deu", label: "German" }, { value: "fra", label: "French" }, { value: "spa", label: "Spanish" }, { value: "chi_sim", label: "Chinese (Simplified)" }, { value: "ara", label: "Arabic" }, { value: "jpn", label: "Japanese" }, { value: "kor", label: "Korean" }
        ]},
    ],
    "flatten-pdf": [
        { key: "flattenOnlyForms", label: "Forms Only", type: "toggle", default: true },
    ],
    "extract-images": [
        { key: "format", label: "Format", type: "select", default: "png", options: [
            { value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }, { value: "gif", label: "GIF" }
        ]},
    ],
    "remove-blanks": [
        { key: "threshold", label: "Threshold", type: "number", default: 10, min: 1, max: 100 },
        { key: "whitePercent", label: "White %", type: "number", default: 99.9, min: 50, max: 100, step: 0.1 },
    ],
    "update-metadata": [
        { key: "title", label: "Title", type: "text", default: "" },
        { key: "author", label: "Author", type: "text", default: "" },
        { key: "subject", label: "Subject", type: "text", default: "" },
        { key: "keywords", label: "Keywords", type: "text", default: "" },
        { key: "deleteAll", label: "Delete All First", type: "toggle", default: false },
    ],
    "replace-invert-pdf": [
        { key: "replaceAndInvertOption", label: "Option", type: "select", default: "INVERT", options: [
            { value: "INVERT", label: "Invert" }, { value: "HIGH_CONTRAST", label: "High Contrast" }, { value: "CUSTOM_COLOR", label: "Custom" }
        ]},
    ],
    "extract-image-scans": [
        { key: "angleThreshold", label: "Angle Threshold", type: "number", default: 10 },
        { key: "tolerance", label: "Tolerance", type: "number", default: 10 },
    ],
    "add-stamp": [
        { key: "stampType", label: "Type", type: "select", default: "text", options: [{value: "text", label: "Text"}, {value: "image", label: "Image"}]},
        { key: "stampText", label: "Text", type: "text", default: "STAMP" },
        { key: "stampImage", label: "Image File", type: "file", default: null },
        { key: "opacity", label: "Opacity", type: "number", default: 0.5, min: 0, max: 1, step: 0.1 },
    ],
    "add-page-numbers": [
        { key: "fontSize", label: "Font Size", type: "number", default: 12 },
        { key: "position", label: "Position (1-9)", type: "number", default: 9, min: 1, max: 9 },
        { key: "startingNumber", label: "Start From", type: "number", default: 1 },
        { key: "customText", label: "Text Pattern", type: "text", default: "{n} / {total}" },
    ],
    "add-image": [
        { key: "imageFile", label: "Image to Overlay", type: "file", default: null },
        { key: "x", label: "X Position", type: "number", default: 0 },
        { key: "y", label: "Y Position", type: "number", default: 0 },
        { key: "everyPage", label: "On Every Page", type: "toggle", default: true },
    ],
};

export default function PDFPage() {
    const t = useTranslations("pdf");
    const { user } = useAdmin();
    const { showToast } = useToast();
    const [activeTool, setActiveTool] = useState<ToolType | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "zipping" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [uploadedCount, setUploadedCount] = useState(0);
    const [convertedCount, setConvertedCount] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const [downloadName, setDownloadName] = useState<string>("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [toolSearch, setToolSearch] = useState("");

    // Tool settings (dynamic per-tool)
    const [toolSettings, setToolSettings] = useState<Record<string, any>>({});
    const [showSettings, setShowSettings] = useState(false);
    
    // Compat aliases
    const password = toolSettings.password || "";
    const setPassword = (v: string) => setToolSettings(prev => ({ ...prev, password: v }));
    
    // Initialize settings when tool changes
    const initSettings = (toolId: ToolType | null) => {
        if (!toolId) return;
        const fields = TOOL_SETTINGS[toolId];
        if (!fields) { setToolSettings({}); return; }
        const defaults: Record<string, any> = {};
        fields.forEach(f => { defaults[f.key] = f.default; });
        setToolSettings(defaults);
        setShowSettings(false);
    }; 

    const fileInputRef = useRef<HTMLInputElement>(null);

    const tool = TOOLS.find(t => t.id === activeTool);

    const filteredTools = TOOLS.filter(tool => {
        const matchCat = activeCategory === "All" || tool.category === activeCategory;
        const q = toolSearch.toLowerCase().trim();
        const matchSearch = !q || tool.title.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q);
        return matchCat && matchSearch;
    });

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        setFiles(prev => [...prev, ...Array.from(fileList)]);
        setStatus("idle");
        setErrorMsg("");
        setDownloadUrl("");
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getOutputFilename = (originalName: string, tool: ToolDef) => {
        const base = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        return `${base}${tool.outputExt}`;
    };


    // Reset settings when tool changes
    useEffect(() => {
        initSettings(activeTool);
    }, [activeTool]);

    const convert = async () => {
        const isUrlTool = activeTool === "url-to-pdf";
        if (!isUrlTool && files.length === 0) return;
        if (!activeTool || !tool) return;
        
        const total = isUrlTool ? 1 : files.length;
        setTotalFiles(total);
        setUploadedCount(0);
        setConvertedCount(0);
        setStatus("uploading");
        setDownloadUrl("");
        setErrorMsg("");

        if (user) {
             showToast(t("processingStarted"), "success");
        } else {
             showToast(t("keepTabOpen"), "info");
        }

        try {
            const isMultiFileTool = MULTI_FILE_TOOLS.includes(activeTool);
            
            if (isMultiFileTool) {
                // ── Special Case: Multi-file tools (Merge, Overlay, etc) ──
                const formData = new FormData();
                
                if (activeTool === "overlay-pdfs") {
                    formData.append("fileInput", files[0]);
                    files.slice(1).forEach(f => formData.append("overlayFiles", f));
                } else {
                    // Default multi-file behavior (Merge, Img-to-PDF)
                    files.forEach(f => formData.append("fileInput", f));
                }

                // Append settings
                const fields = TOOL_SETTINGS[activeTool] || [];
                fields.forEach(field => {
                    const val = toolSettings[field.key];
                    if (val instanceof File) {
                        formData.append(field.key, val);
                    } else if (val !== undefined && val !== "" && val !== null) {
                        formData.append(field.key, String(val));
                    }
                });

                formData.append("originalName", files[0]?.name || "merged-result");

                setUploadedCount(total);
                setStatus("processing");

                const res = await fetch(`/api/pdf-proxy?type=${activeTool}`, {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.details || errJson.error || "Processing failed");
                }

                const blob = await res.blob();
                setConvertedCount(total);
                setDownloadName(`converted-${activeTool}${tool.outputExt}`);
                setDownloadUrl(URL.createObjectURL(blob));
                setStatus("done");

            } else {
                // ── Default Case: One-by-one or single-request tool (Rotate, Split, OCR, etc) ──
                const zip = new JSZip();
                
                const processFile = async (file: File | null) => {
                    const formData = new FormData();
                    if (file) formData.append("fileInput", file);
                    
                    const fields = TOOL_SETTINGS[activeTool] || [];
                    fields.forEach(field => {
                        const val = toolSettings[field.key];
                        if (val instanceof File) {
                            formData.append(field.key, val);
                        } else if (val !== undefined && val !== "" && val !== null) {
                            formData.append(field.key, String(val));
                        }
                    });

                    formData.append("originalName", file?.name || "result");
                    setUploadedCount(prev => prev + 1);

                    const res = await fetch(`/api/pdf-proxy?type=${activeTool}`, {
                        method: "POST",
                        body: formData,
                    });

                    if (!res.ok) {
                        const errJson = await res.json().catch(() => ({}));
                        throw new Error(errJson.details || errJson.error || `Failed to process ${file?.name || 'request'}`);
                    }

                    const blob = await res.blob();
                    const newName = file ? getOutputFilename(file.name, tool) : `result${tool.outputExt}`;
                    setConvertedCount(prev => prev + 1);
                    return { name: newName, blob };
                };

                if (isUrlTool) {
                    const result = await processFile(null);
                    setDownloadName(result.name);
                    setDownloadUrl(URL.createObjectURL(result.blob));
                } else {
                    const filePromises = files.map(processFile);
                    setStatus("processing");
                    const results = await Promise.all(filePromises);

                    setStatus("zipping");
                    if (results.length === 1) {
                        setDownloadName(`converted-${results[0].name}`);
                        setDownloadUrl(URL.createObjectURL(results[0].blob));
                    } else {
                        results.forEach(r => zip.file(r.name, r.blob));
                        const finalBlob = await zip.generateAsync({ type: "blob" });
                        setDownloadName("converted-files.zip");
                        setDownloadUrl(URL.createObjectURL(finalBlob));
                    }
                }
                setStatus("done");
            }
            
        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message || "Unknown error occurred");
        }
    };

    const reset = () => {
        setFiles([]);
        setStatus("idle");
        setDownloadUrl("");
        setUploadedCount(0);
        setConvertedCount(0);
        setTotalFiles(0);
        initSettings(activeTool);
    };

    // ═══════════════════════════════
    // Setting input renderer
    // ═══════════════════════════════
    const currentSettings = activeTool ? TOOL_SETTINGS[activeTool] : null;

    const renderSettingField = (field: SettingField) => {
        const val = toolSettings[field.key] ?? field.default;
        const update = (v: any) => setToolSettings(prev => ({ ...prev, [field.key]: v }));

        switch (field.type) {
            case "select":
                return (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-600 whitespace-nowrap">{field.label}</label>
                        <select value={val} onChange={e => update(e.target.value)}
                            className="bg-white border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--foreground)] min-w-[140px]">
                            {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                );
            case "text":
                return (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-600 whitespace-nowrap">{field.label}</label>
                        <input type="text" value={val} onChange={e => update(e.target.value)} placeholder={field.placeholder}
                            className="bg-white border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--foreground)] min-w-[140px]" />
                    </div>
                );
            case "number":
                return (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-600 whitespace-nowrap">{field.label}</label>
                        <input type="number" value={val} onChange={e => update(parseFloat(e.target.value))} min={field.min} max={field.max} step={field.step}
                            className="bg-white border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--foreground)] w-24" />
                    </div>
                );
            case "toggle":
                return (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-600">{field.label}</label>
                        <button onClick={() => update(!val)}
                            className={`w-10 h-6 rounded-full transition-colors relative ${val ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${val ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                );
            case "slider":
                return (
                    <div key={field.key} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">{field.label}</label>
                            <span className="text-sm font-semibold tabular-nums">{val}</span>
                        </div>
                        <input type="range" value={val} onChange={e => update(parseInt(e.target.value))} min={field.min} max={field.max} step={field.step}
                            className="w-full accent-[var(--foreground)]" />
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>{t("low")}</span><span>{t("high")}</span>
                        </div>
                    </div>
                );
            case "file":
                return (
                    <div key={field.key} className="flex flex-col gap-2">
                        <label className="text-sm text-gray-600">{field.label}</label>
                        <input type="file" onChange={e => update(e.target.files?.[0])}
                            className="text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-black/5 file:text-gray-700 hover:file:bg-black/10 transition-all" />
                    </div>
                );
            default: return null;
        }
    };

    // Step indicator for active tool view
    const currentStep = !activeTool ? 1 : files.length === 0 ? 2 : status === "done" ? 3 : 2;

    return (
        <div className="w-full h-full font-sans overflow-auto pb-20 md:pb-0">
            <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-16">

                {/* Header */}
                <div className="mb-6 md:mb-10">
                    <h1 className="text-[22px] md:text-[40px] font-black tracking-tight mb-1">{t("title")}</h1>
                    <p className="text-[13px] md:text-[16px] text-gray-400">{t("subtitle")}</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[
                        { n: 1, label: "Choose tool" },
                        { n: 2, label: "Upload files" },
                        { n: 3, label: "Download" },
                    ].map((step, i) => (
                        <div key={step.n} className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                                currentStep === step.n
                                    ? "bg-[#1a1a1a] text-white"
                                    : currentStep > step.n
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-[#f3f3f3] text-gray-400"
                            }`}>
                                <span className="text-[10px] font-black tabular-nums">{step.n}</span>
                                <span className="text-[11px] font-bold hidden sm:inline">{step.label}</span>
                            </div>
                            {i < 2 && <div className="w-4 h-px bg-[#e0e0e0]" />}
                        </div>
                    ))}
                    {activeTool && user && (
                        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg text-blue-600">
                            <IconBrandTelegram className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold hidden sm:inline">{t("autoDelivery")}</span>
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {!activeTool ? (
                        <motion.div key="grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>

                            {/* Search + categories row */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                                {/* Search */}
                                <div className="relative flex-1">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={toolSearch}
                                        onChange={e => { setToolSearch(e.target.value); setActiveCategory("All"); }}
                                        placeholder="Search tools…"
                                        className="w-full pl-9 pr-4 py-2.5 border border-[var(--border)] rounded-xl text-[13px] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent placeholder-gray-300"
                                        style={{ fontSize: "16px" }}
                                    />
                                    {toolSearch && (
                                        <button onClick={() => setToolSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            <IconX className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Category pills */}
                            {!toolSearch && (
                                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: "none" }}>
                                    {CATEGORIES.map(cat => (
                                        <button key={cat} onClick={() => setActiveCategory(cat)}
                                            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                                                activeCategory === cat
                                                    ? "bg-[var(--foreground)] text-[var(--background)]"
                                                    : "bg-[var(--card)] text-gray-500 border border-[var(--border)] hover:text-[var(--foreground)]"
                                            }`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Tool grid — cards on desktop, compact rows on mobile */}
                            {filteredTools.length === 0 ? (
                                <div className="py-16 text-center text-gray-400 text-[13px]">No tools match "{toolSearch}"</div>
                            ) : (
                                <>
                                    {/* Mobile: compact list */}
                                    <div className="md:hidden bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
                                        {filteredTools.map((tool) => (
                                            <button key={tool.id} onClick={() => setActiveTool(tool.id)}
                                                className="group w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.02] active:bg-black/5 transition-colors text-left">
                                                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center shrink-0 group-hover:bg-black/10 transition-colors">
                                                    <tool.icon className="w-4.5 h-4.5 stroke-[1.5]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">{tool.title}</p>
                                                    <p className="text-[11px] text-gray-400 truncate">{tool.desc}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-300 bg-[#f3f3f3] px-1.5 py-0.5 rounded shrink-0">
                                                    {tool.outputExt}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Desktop: card grid */}
                                    <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredTools.map((tool) => (
                                            <button key={tool.id} onClick={() => setActiveTool(tool.id)}
                                                className="group relative bg-[var(--card)] p-5 hover:shadow-md border border-[var(--border)] hover:border-gray-300 rounded-2xl transition-all duration-200 text-left flex flex-col gap-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="p-2.5 bg-black/5 rounded-xl text-[var(--foreground)] group-hover:scale-110 transition-transform">
                                                        <tool.icon className="w-5 h-5 stroke-[1.5]" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-300 bg-[#f3f3f3] px-1.5 py-0.5 rounded">{tool.outputExt}</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-[14px] font-bold mb-0.5">{tool.title}</h3>
                                                    <p className="text-[12px] text-gray-400 line-clamp-2">{tool.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col max-w-2xl mx-auto w-full">

                            <div className="w-full flex items-center justify-between mb-5">
                                <button onClick={() => { setActiveTool(null); reset(); setToolSearch(""); }}
                                    className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 hover:text-[var(--foreground)] transition-colors px-3 py-2 rounded-xl hover:bg-black/5 -ml-3">
                                    <IconArrowLeft className="w-4 h-4" /> {t("backToTools")}
                                </button>
                                <div className="flex items-center gap-2">
                                    {tool?.icon && <tool.icon className="w-4 h-4 text-gray-400 stroke-[1.5]" />}
                                    <span className="text-[12px] font-bold text-gray-500">{tool?.title}</span>
                                </div>
                            </div>

                            <div className="w-full border border-[var(--border)] bg-[var(--card)] rounded-[var(--radius)] shadow-sm p-8 md:p-12 relative min-h-[400px] flex flex-col overflow-hidden">
                                {(status === "processing" || status === "uploading" || status === "zipping") && (
                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center rounded-[var(--radius)]">
                                        {/* Dual-phase progress */}
                                        <div className="w-full max-w-xs mb-6 space-y-5">
                                            {/* Upload Phase */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <IconCloudUpload className="w-4 h-4 text-blue-500" stroke={1.5} />
                                                        <span className="text-xs font-semibold text-gray-700">{t("uploadLabel")}</span>
                                                    </div>
                                                    <span className="text-xs font-bold tabular-nums text-blue-600">{uploadedCount}/{totalFiles}</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${totalFiles > 0 ? (uploadedCount / totalFiles) * 100 : 0}%` }} />
                                                </div>
                                            </div>

                                            {/* Convert Phase */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <IconLoader2 className={`w-4 h-4 text-green-500 ${convertedCount < totalFiles ? 'animate-spin' : ''}`} stroke={1.5} />
                                                        <span className="text-xs font-semibold text-gray-700">{t("convertLabel")}</span>
                                                    </div>
                                                    <span className="text-xs font-bold tabular-nums text-green-600">{convertedCount}/{totalFiles}</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${totalFiles > 0 ? (convertedCount / totalFiles) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-semibold text-lg mb-1 text-[var(--foreground)]">
                                            {status === "zipping" ? t("packaging") : uploadedCount < totalFiles ? t("uploading") : t("converting")}
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            {status === "zipping" ? t("almostDone") : t("filesProcessed").replace("{done}", String(convertedCount)).replace("{total}", String(totalFiles))}
                                        </p>
                                        
                                        {user ? (
                                            <p className="text-sm text-gray-500 max-w-xs">
                                                {t("telegramNote")}
                                            </p>
                                        ) : (
                                            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100 max-w-sm">
                                                <p className="text-xs">{t("guestNote")}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {files.length === 0 && activeTool !== "url-to-pdf" ? (
                                    <div
                                        className="w-full h-full min-h-[300px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[var(--foreground)] hover:bg-black/5 transition-all group p-6"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                    >
                                        <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <IconCloudUpload className="w-8 h-8 text-gray-400 group-hover:text-[var(--foreground)] transition-colors" stroke={1.5} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold mb-1">{t("uploadOrDrop")}</p>
                                            <p className="text-sm text-gray-500">{t("supportsFiles").replace("{accept}", tool?.accept ?? "")}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-6 flex-1">
                                        {activeTool !== "url-to-pdf" && (
                                            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-black/5 rounded-lg flex items-center justify-center">
                                                        <IconFileDescription className="w-5 h-5" stroke={1.5} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-sm leading-tight">{t("selectedFiles")}</h3>
                                                        <p className="text-xs text-gray-500">{files.length} {t("queued")}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors">{t("add")}</button>
                                                <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 minimal-scrollbar max-h-[300px]">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 group hover:shadow-sm transition-all">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded flex items-center justify-center shrink-0">
                                                            <span className="text-[10px] font-bold uppercase">{f.name.split('.').pop()}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{f.name}</p>
                                                            <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeFile(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <IconX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Settings Panel */}
                                        {currentSettings && currentSettings.length > 0 && (
                                            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                                                <button onClick={() => setShowSettings(!showSettings)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-black/[0.02] hover:bg-black/5 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <IconSettings className="w-4 h-4 text-gray-500" stroke={1.5} />
                                                        <span className="text-sm font-semibold text-gray-700">{t("conversionSettings")}</span>
                                                    </div>
                                                    {showSettings ? <IconChevronUp className="w-4 h-4 text-gray-400" /> : <IconChevronDown className="w-4 h-4 text-gray-400" />}
                                                </button>
                                                {showSettings && (
                                                    <div className="px-4 py-4 space-y-4 border-t border-[var(--border)] bg-[var(--card)]">
                                                        {currentSettings.map(f => renderSettingField(f))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {status === "done" ? (
                                            <div className="flex flex-col items-center justify-center py-6 animate-in fade-in slide-in-from-bottom-4">
                                                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                                                    <IconFileCheck className="w-8 h-8" stroke={1.5} />
                                                </div>
                                                <p className="font-bold text-xl mb-1 text-[var(--foreground)]">{t("success")}</p>
                                                <p className="text-sm text-gray-500 text-center max-w-xs mb-6">
                                                   {t("successDesc")}
                                                </p>
                                                
                                                <a href={downloadUrl} download={downloadName}
                                                    className="w-full py-3.5 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-semibold hover:opacity-90 hover:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md">
                                                    <IconDownload className="w-5 h-5" /> {t("downloadResult")}
                                                </a>
                                                <button onClick={reset} className="mt-4 text-sm font-medium text-gray-500 hover:text-[var(--foreground)] transition-colors">{t("processAnother")}</button>
                                            </div>
                                        ) : (
                                            <button onClick={convert}
                                                disabled={status !== "idle" && status !== "error"}
                                                className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-bold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md mt-2 flex items-center justify-center gap-2">
                                                {t("startProcessing")}
                                            </button>
                                        )}

                                        {status === "error" && (
                                            <div className="p-4 rounded-xl border border-red-200 bg-red-50 mt-2 flex gap-3 text-red-600">
                                                <IconX className="w-5 h-5 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-semibold text-sm mb-0.5">{t("operationFailed")}</p>
                                                    <p className="text-xs opacity-80 break-all">{errorMsg}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
