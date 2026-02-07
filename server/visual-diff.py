#!/usr/bin/env python3
"""
Visual diff engine for PDF/image document comparison.
Generates pixel-level overlay images highlighting differences between two documents.

Usage:
    python3 visual-diff.py <file1_path> <file2_path> <output_path> [--dpi=150] [--sensitivity=30] [--page=0]

Output: JSON to stdout with result metadata
"""

import sys
import os
import json
import argparse
import tempfile
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def pdf_page_to_image(pdf_path: str, page_num: int = 0, dpi: int = 150) -> Image.Image:
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        raise ValueError(f"Page {page_num} does not exist in {pdf_path} (has {len(doc)} pages)")
    page = doc[page_num]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


def load_image(file_path: str, page_num: int = 0, dpi: int = 150) -> Image.Image:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return pdf_page_to_image(file_path, page_num, dpi)
    elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"):
        return Image.open(file_path).convert("RGB")
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def get_page_count(file_path: str) -> int:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    return 1


def normalize_sizes(img1: Image.Image, img2: Image.Image) -> tuple:
    w = max(img1.width, img2.width)
    h = max(img1.height, img2.height)

    def pad_image(img, target_w, target_h):
        if img.width == target_w and img.height == target_h:
            return img
        padded = Image.new("RGB", (target_w, target_h), (255, 255, 255))
        padded.paste(img, (0, 0))
        return padded

    return pad_image(img1, w, h), pad_image(img2, w, h)


def compute_diff(img1: Image.Image, img2: Image.Image, sensitivity: int = 30) -> dict:
    arr1 = np.array(img1, dtype=np.int16)
    arr2 = np.array(img2, dtype=np.int16)

    diff = np.abs(arr1 - arr2)
    diff_gray = np.max(diff, axis=2)
    mask = diff_gray > sensitivity

    total_pixels = mask.size
    changed_pixels = int(np.sum(mask))
    change_pct = round((changed_pixels / total_pixels) * 100, 2)

    return {
        "mask": mask,
        "diff_gray": diff_gray,
        "total_pixels": total_pixels,
        "changed_pixels": changed_pixels,
        "change_percentage": change_pct,
    }


def generate_overlay(
    img1: Image.Image,
    img2: Image.Image,
    diff_result: dict,
    output_path: str,
) -> dict:
    mask = diff_result["mask"]
    h, w = mask.shape

    arr1 = np.array(img1.convert("RGBA"))
    arr2 = np.array(img2)

    brightness = np.mean(arr2, axis=2)
    dark_mask = mask & (brightness < 128)
    light_mask = mask & (brightness >= 128)

    overlay_arr = np.zeros((h, w, 4), dtype=np.uint8)
    overlay_arr[dark_mask] = [255, 50, 50, 180]
    overlay_arr[light_mask] = [50, 50, 255, 140]

    alpha_o = overlay_arr[:, :, 3:4].astype(np.float32) / 255.0
    alpha_b = arr1[:, :, 3:4].astype(np.float32) / 255.0

    out_alpha = alpha_o + alpha_b * (1 - alpha_o)
    safe_alpha = np.where(out_alpha > 0, out_alpha, 1)

    out_rgb = (overlay_arr[:, :, :3].astype(np.float32) * alpha_o +
               arr1[:, :, :3].astype(np.float32) * alpha_b * (1 - alpha_o)) / safe_alpha

    result_arr = np.zeros((h, w, 3), dtype=np.uint8)
    result_arr[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)

    result_img = Image.fromarray(result_arr, "RGB")
    result_img.save(output_path, "PNG", optimize=True)

    return {
        "width": w,
        "height": h,
        "output_path": output_path,
    }


def generate_side_by_side(
    img1: Image.Image,
    img2: Image.Image,
    diff_result: dict,
    output_path: str,
) -> dict:
    mask = diff_result["mask"]
    h, w = mask.shape

    gap = 20
    canvas_w = w * 2 + gap
    canvas = Image.new("RGB", (canvas_w, h + 40), (245, 245, 245))

    draw = ImageDraw.Draw(canvas)
    draw.text((10, 10), "ORIGINAL (Doc A)", fill=(0, 0, 0))
    draw.text((w + gap + 10, 10), "REVISED (Doc B) - Changes Highlighted", fill=(0, 0, 0))

    canvas.paste(img1, (0, 40))

    arr2 = np.array(img2)
    if np.any(mask):
        region_mask_img = Image.fromarray((mask * 255).astype(np.uint8), "L")
        dilated = region_mask_img.filter(ImageFilter.MaxFilter(7))
        dilated_arr = np.array(dilated)
        border_mask = (dilated_arr > 0) & ~mask

        highlight = np.zeros((h, w, 4), dtype=np.uint8)
        highlight[border_mask] = [255, 0, 0, 100]

        img2_rgba = img2.copy().convert("RGBA")
        overlay_img = Image.fromarray(highlight, "RGBA")
        img2_result = Image.alpha_composite(img2_rgba, overlay_img).convert("RGB")
    else:
        img2_result = img2.copy().convert("RGB")

    canvas.paste(img2_result, (w + gap, 40))

    canvas.save(output_path, "PNG", optimize=True)
    return {"width": canvas_w, "height": h + 40, "output_path": output_path}


def main():
    parser = argparse.ArgumentParser(description="Visual document diff engine")
    parser.add_argument("file1", help="Path to first document (base/original)")
    parser.add_argument("file2", help="Path to second document (revised)")
    parser.add_argument("output", help="Output path for overlay image")
    parser.add_argument("--dpi", type=int, default=150, help="DPI for PDF rendering")
    parser.add_argument("--sensitivity", type=int, default=30, help="Pixel diff threshold (0-255)")
    parser.add_argument("--page", type=int, default=0, help="Page number to compare (0-indexed)")
    parser.add_argument("--mode", choices=["overlay", "side-by-side", "both"], default="overlay",
                        help="Comparison mode")
    args = parser.parse_args()

    try:
        pages1 = get_page_count(args.file1)
        pages2 = get_page_count(args.file2)

        img1 = load_image(args.file1, args.page, args.dpi)
        img2 = load_image(args.file2, args.page, args.dpi)

        img1, img2 = normalize_sizes(img1, img2)

        diff_result = compute_diff(img1, img2, args.sensitivity)

        output_files = {}

        if args.mode in ("overlay", "both"):
            overlay_path = args.output
            overlay_info = generate_overlay(img1, img2, diff_result, overlay_path)
            output_files["overlay"] = overlay_info

        if args.mode in ("side-by-side", "both"):
            sbs_path = args.output.replace(".png", "_sbs.png")
            sbs_info = generate_side_by_side(img1, img2, diff_result, sbs_path)
            output_files["side_by_side"] = sbs_info

        result = {
            "success": True,
            "pages_doc1": pages1,
            "pages_doc2": pages2,
            "compared_page": args.page,
            "total_pixels": diff_result["total_pixels"],
            "changed_pixels": diff_result["changed_pixels"],
            "change_percentage": diff_result["change_percentage"],
            "sensitivity": args.sensitivity,
            "dpi": args.dpi,
            "output_files": output_files,
        }

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
