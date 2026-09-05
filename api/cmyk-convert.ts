/**
 * PARICHAYIKA — Server-side CMYK Image Conversion API
 * 
 * Converts RGB/RGBA images to actual CMYK JPEG using sharp/libvips.
 * The CMYK JPEG is then embedded into the PDF by the client-side
 * PrintProduction component.
 * 
 * This endpoint fetches an image from a URL (Supabase Storage),
 * converts it to CMYK colorspace using sharp, and returns the
 * CMYK JPEG as base64 data.
 * 
 * The client then embeds this CMYK JPEG into the jsPDF document
 * with colorSpace: 'DeviceCMYK', producing a true CMYK image
 * object in the final PDF.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import sharp from "sharp";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    // 1. Fetch the original RGB image from Supabase Storage
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      return res.status(400).json({ error: `Failed to fetch image: ${imgResp.status}` });
    }

    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());

    // 2. Convert RGB → CMYK using sharp/libvips
    // sharp's toColorspace('cmyk') converts the image to true 4-channel CMYK
    // The output JPEG will have space='cmyk' in its metadata
    const cmykBuffer = await sharp(imgBuffer)
      .removeAlpha() // Remove alpha/transparency (CMYK JPEG doesn't support alpha)
      .toColorspace("cmyk") // Convert to CMYK colorspace
      .toFormat("jpeg", { quality: 92 }) // Output as JPEG (supports CMYK 4-channel)
      .toBuffer();

    // 3. Get metadata to verify CMYK conversion
    const metadata = await sharp(cmykBuffer).metadata();

    // 4. Return CMYK JPEG as base64 data URI
    const base64 = cmykBuffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64}`;

    res.json({
      success: true,
      cmykImage: dataUri,
      originalSize: imgBuffer.length,
      cmykSize: cmykBuffer.length,
      colorSpace: metadata.space, // Should be 'cmyk'
      channels: metadata.channels, // Should be 4
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha // Should be false
    });
  } catch (err: any) {
    console.error("[CMYK Conversion Error]", err?.message || err);
    res.status(500).json({
      error: "CMYK conversion failed",
      message: err?.message || "Unknown error"
    });
  }
}
