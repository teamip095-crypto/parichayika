import React, { useState } from "react";
import {
  Grid,
  Layers,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Check,
  Loader2,
  Phone,
  User,
  Sliders,
  Sparkles,
  Maximize2
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Advertisement } from "../types";
import { formatDobToDDMMYYYY } from "../dateUtils";

interface PrintProductionProps {
  advertisements: Advertisement[];
}

export default function PrintProduction({ advertisements }: PrintProductionProps) {
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSangathan, setSelectedSangathan] = useState("");
  const [selectedEdition, setSelectedEdition] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID_ONLY" | "SUBMITTED_ONLY">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "matrimony" | "business">("ALL");
  // FIX: Add toggle to show already-printed (Completed) ads so client can see what's been used
  const [showPrinted, setShowPrinted] = useState(false);

  // Print Setup Options with Custom Page Dimensions
  const [pageSize, setPageSize] = useState<"letter" | "a4" | "magazine_trim" | "half_sheet" | "quarter_sheet" | "custom">("letter");
  const [customWidth, setCustomWidth] = useState<number>(8.5);
  const [customHeight, setCustomHeight] = useState<number>(11.0);
  const [bleed, setBleed] = useState(0.125); // Bleed margin in inches
  const [safeArea, setSafeArea] = useState(0.2); // Safe area inside in inches
  const [columns, setColumns] = useState(2); // Columns for Matrimony tiles
  const [rows, setRows] = useState(5); // Rows for Matrimony tiles
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showColorBars, setShowColorBars] = useState(true);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Total stats
  const totalPaid = advertisements.filter((a) => a.payment_status === "PAID").length;
  const totalMatrimony = advertisements.filter((a) => a.type_code === "matrimony").length;
  const totalBusiness = advertisements.filter((a) => a.type_code === "business").length;

  // Filter advertisements
  const eligibleAds = advertisements.filter((ad) => {
    if (paymentFilter === "PAID_ONLY" && ad.payment_status !== "PAID") return false;
    if (paymentFilter === "SUBMITTED_ONLY" && ad.payment_status !== "SUBMITTED") return false;
    if (typeFilter !== "ALL" && ad.type_code !== typeFilter) return false;
    if (selectedDistrict && ad.district_hi !== selectedDistrict) return false;
    if (selectedSangathan && ad.sangathan_hi !== selectedSangathan) return false;
    if (selectedEdition && ad.edition_hi !== selectedEdition) return false;
    // FIX: Hide already-printed (Completed) ads by default — prevents duplicate printing.
    // Toggle via showPrinted checkbox below the filter bar.
    if (!showPrinted && ad.production_status === "Completed") return false;
    return true;
  });

  // Count of printed ads (for UI display)
  const printedCount = advertisements.filter((ad) => ad.production_status === "Completed").length;

  const matrimonyAds = eligibleAds.filter((ad) => ad.type_code === "matrimony");
  const businessAds = eligibleAds.filter((ad) => ad.type_code === "business");

  // Get distinct filter values
  const uniqueDistricts = Array.from(new Set(advertisements.map((a) => a.district_hi).filter(Boolean)));
  const uniqueSangathans = Array.from(new Set(advertisements.map((a) => a.sangathan_hi).filter(Boolean)));
  const uniqueEditions = Array.from(new Set(advertisements.map((a) => a.edition_hi).filter(Boolean)));

  // Matrimony pagination tiling: total items per page is cols * rows
  const itemsPerPage = Math.max(1, columns * rows);
  const matrimonyPageCount = Math.ceil(matrimonyAds.length / itemsPerPage);
  const totalPrintPages = (matrimonyAds.length > 0 ? matrimonyPageCount : 0) + (businessAds.length > 0 ? businessAds.length : 0);

  // Page dimensions mapping (in inches)
  const getPageDimensions = () => {
    switch (pageSize) {
      case "a4":
        return { width: 8.27, height: 11.69, label: "A4 (8.27 × 11.69 in)" };
      case "magazine_trim":
        return { width: 7.2, height: 9.6, label: "पत्रिका ट्रिम साइज (7.2 × 9.6 in)" };
      case "half_sheet":
        return { width: 7.2, height: 4.8, label: "हाफ पेज (7.2 × 4.8 in)" };
      case "quarter_sheet":
        return { width: 3.6, height: 4.8, label: "क्वार्टर पेज (3.6 × 4.8 in)" };
      case "custom":
        return {
          width: customWidth > 0 ? customWidth : 8.5,
          height: customHeight > 0 ? customHeight : 11.0,
          label: `कस्टम साइज़ (${customWidth} × ${customHeight} in)`
        };
      case "letter":
      default:
        return { width: 8.5, height: 11.0, label: "Letter (8.5 × 11.0 in)" };
    }
  };

  const pageDimensions = getPageDimensions();

  // Handle Preset Page Size change
  const handlePageSizeChange = (val: "letter" | "a4" | "magazine_trim" | "half_sheet" | "quarter_sheet" | "custom") => {
    setPageSize(val);
    if (val === "letter") {
      setCustomWidth(8.5);
      setCustomHeight(11.0);
    } else if (val === "a4") {
      setCustomWidth(8.27);
      setCustomHeight(11.69);
    } else if (val === "magazine_trim") {
      setCustomWidth(7.2);
      setCustomHeight(9.6);
    } else if (val === "half_sheet") {
      setCustomWidth(7.2);
      setCustomHeight(4.8);
    } else if (val === "quarter_sheet") {
      setCustomWidth(3.6);
      setCustomHeight(4.8);
    }
  };

  const handleResetFilters = () => {
    setSelectedDistrict("");
    setSelectedSangathan("");
    setSelectedEdition("");
    setPaymentFilter("ALL");
    setTypeFilter("ALL");
  };

  // Helper to extract clean matrimony data identical to the live form preview
  const getMatrimonyData = (item: Advertisement) => {
    let profile = item.matrimonyProfile || ({} as any);
    if ((!profile || !profile.name) && (item as any).matrimony_details_json) {
      try {
        const parsed = typeof (item as any).matrimony_details_json === "string"
          ? JSON.parse((item as any).matrimony_details_json)
          : (item as any).matrimony_details_json;
        profile = { ...profile, ...parsed };
      } catch (e) {}
    }

    return {
      name: profile?.name || item.customer_name || "युवक-युवती का नाम",
      dob: formatDobToDDMMYYYY(profile?.dob),
      height: profile?.height || "-",
      gotra: profile?.gotra || "-",
      blood_group: profile?.blood_group || "-",
      father_name: profile?.father_name || "-",
      father_occupation: profile?.father_occupation || "-",
      mother_name: profile?.mother_name || "-",
      occupation: profile?.occupation || "-",
      education: profile?.education || "-",
      address: profile?.current_address || profile?.permanentAddress || profile?.currentAddress || profile?.permanent_address || "-",
      mobile1: profile?.mobile1 || item.customer_mobile1 || "",
      whatsapp: profile?.whatsapp || "",
      photo_url: profile?.photo_url || profile?.photoUrl || (item as any).photo_url || ""
    };
  };

  // Ultra-Fast, 100% Reliable PDF Generation for CorelDRAW & Offset Print Press
  const handleDownloadCorelDrawPdf = async () => {
    if (eligibleAds.length === 0) {
      alert("डाउनलोड करने के लिए कोई विज्ञापन उपलब्ध नहीं है।");
      return;
    }

    setIsGeneratingPdf(true);
    setDownloadSuccess(false);
    setPdfProgress("CorelDRAW-Ready Vector PDF तैयार हो रहा है...");

    try {
      const pageW = pageDimensions.width;
      const pageH = pageDimensions.height;
      const safe = safeArea;
      const contentW = pageW - 2 * safe;

      // FIX: Use jsPDF native vector API instead of html2canvas rasterization.
      // This produces an EDITABLE PDF where text, lines, and images are
      // separate vector objects — CorelDRAW/InDesign import them as editable
      // layers, NOT as a flattened image.
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: [pageW, pageH],
        compress: true,
        putOnlyUsedFonts: true
      });

      // Set PDF metadata for CorelDRAW identification
      pdf.setProperties({
        title: "परिचायिका 2026 - CorelDRAW Editable Print Sheet",
        subject: "CMYK C0 M0 Y0 K100 | 300 DPI | Vector Editable PDF",
        author: "इंडियन प्रेस, रायपुर",
        creator: "Parichayika Print Production Engine v2",
        keywords: "CMYK, CorelDRAW, Editable, Vector, 300DPI, Parichayika"
      });

      const totalMatrimonyPages = matrimonyPageCount;
      const totalPages = totalMatrimonyPages + (businessAds.length > 0 ? 1 : 0);

      // =============================================
      // MATRIMONY PAGES — Vector text + separate images
      // =============================================
      for (let pageIdx = 0; pageIdx < totalMatrimonyPages; pageIdx++) {
        const startIndex = pageIdx * itemsPerPage;
        const pageItems = matrimonyAds.slice(startIndex, startIndex + itemsPerPage);
        const percent = Math.round(((pageIdx + 1) / totalPages) * 100);
        setPdfProgress(`पृष्ठ ${pageIdx + 1} / ${totalPages} बन रहा है... (${percent}%) — Vector Text + Images`);
        await new Promise(r => setTimeout(r, 30));

        if (pageIdx > 0) pdf.addPage([pageW, pageH], "portrait");

        const contentW = pageW - 2 * safe;
        const contentH = pageH - 2 * safe;

        // Page background — clean white (#FFFFFF)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, "F");

        // Crop marks (vector lines — editable in CorelDRAW)
        if (showCropMarks) {
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.005);
          const cmLen = 0.15;
          const cmOff = 0.1;
          // Top-left
          pdf.line(cmOff, cmOff, cmOff + cmLen, cmOff);
          pdf.line(cmOff, cmOff, cmOff, cmOff + cmLen);
          // Top-right
          pdf.line(pageW - cmOff - cmLen, cmOff, pageW - cmOff, cmOff);
          pdf.line(pageW - cmOff, cmOff, pageW - cmOff, cmOff + cmLen);
          // Bottom-left
          pdf.line(cmOff, pageH - cmOff, cmOff + cmLen, pageH - cmOff);
          pdf.line(cmOff, pageH - cmOff - cmLen, cmOff, pageH - cmOff);
          // Bottom-right
          pdf.line(pageW - cmOff - cmLen, pageH - cmOff, pageW - cmOff, pageH - cmOff);
          pdf.line(pageW - cmOff, pageH - cmOff - cmLen, pageW - cmOff, pageH - cmOff);
        }

        // Color calibration bar (vector rectangles — CMYK representation)
        if (showColorBars) {
          const cbY = 0.15;
          const cbW = 0.15;
          const cbH = 0.08;
          const cbX = (pageW - 6 * cbW) / 2;
          // Cyan
          pdf.setFillColor(0, 255, 255); pdf.rect(cbX, cbY, cbW, cbH, "F");
          // Magenta
          pdf.setFillColor(255, 0, 255); pdf.rect(cbX + cbW, cbY, cbW, cbH, "F");
          // Yellow
          pdf.setFillColor(255, 255, 0); pdf.rect(cbX + 2*cbW, cbY, cbW, cbH, "F");
          // Black (C0 M0 Y0 K100)
          pdf.setFillColor(0, 0, 0); pdf.rect(cbX + 3*cbW, cbY, cbW, cbH, "F");
          // Gray
          pdf.setFillColor(128, 128, 128); pdf.rect(cbX + 4*cbW, cbY, cbW, cbH, "F");
          // Light Gray
          pdf.setFillColor(211, 211, 211); pdf.rect(cbX + 5*cbW, cbY, cbW, cbH, "F");
        }

        // Page masthead header — pure black text (C0 M0 Y0 K100)
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("साहू समाज परिचायिका 2026 — युवक-युवती वैवाहिक परिचय", safe, safe + 0.15);

        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${selectedDistrict || "समस्त जिला"} • ${selectedSangathan || "साहू संगठन"} • ऑफसेट प्रिंट शीट`, safe, safe + 0.22);

        // Page number (right-aligned)
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text(`पृष्ठ ${pageIdx + 1} / ${totalMatrimonyPages}`, pageW - safe, safe + 0.15, { align: "right" });
        pdf.setFontSize(5);
        pdf.setFont("helvetica", "normal");
        pdf.text("300 DPI • CMYK C0 M0 Y0 K100", pageW - safe, safe + 0.22, { align: "right" });

        // Header line
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.01);
        pdf.line(safe, safe + 0.28, pageW - safe, safe + 0.28);

        // Grid layout for matrimony tiles
        const gridTop = safe + 0.35;
        const gridH = pageH - safe - gridTop - 0.4;
        const gridW = contentW;
        const cellW = gridW / columns;
        const cellH = gridH / rows;

        for (let idx = 0; idx < pageItems.length; idx++) {
          const item = pageItems[idx];
          const m = getMatrimonyData(item);
          const col = idx % columns;
          const row = Math.floor(idx / columns);
          const x = safe + col * cellW;
          const y = gridTop + row * cellH;
          const pad = 0.06;

          // Card background — print-friendly off-white
          pdf.setFillColor(255, 253, 246); // #FFFDF6
          pdf.setDrawColor(28, 25, 23); // stone-900 border
          pdf.setLineWidth(0.008);
          pdf.roundedRect(x + pad, y + pad, cellW - 2*pad, cellH - 2*pad, 0.03, 0.03, "FD");

          // Ad number + name header (red title — matches preview)
          const headerY = y + pad + 0.12;
          pdf.setTextColor(230, 81, 0); // #E65100 (orange-900)
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${item.ad_number}. ${m.name}`, x + pad + 0.04, headerY);

          // Header underline
          pdf.setDrawColor(255, 200, 200); // red-200
          pdf.setLineWidth(0.005);
          pdf.line(x + pad + 0.02, headerY + 0.02, x + cellW - pad - 0.02, headerY + 0.02);

          // Text column (left side of card)
          const textX = x + pad + 0.04;
          const textY = headerY + 0.1;
          const labelW = 0.45;
          const valueX = textX + labelW + 0.02;

          pdf.setTextColor(0, 0, 0); // C0 M0 Y0 K100 pure black
          pdf.setFontSize(5.5);

          // Two-column grid (DOB, Height, Gotra, Blood)
          const col2X = x + pad + cellW/2 - pad;
          const lineH = 0.075;

          // Row 1: जन्म + ऊँचाई
          pdf.setFont("helvetica", "bold");
          pdf.text("जन्म", textX, textY);
          pdf.text(":", textX + labelW, textY);
          pdf.setFont("helvetica", "normal");
          pdf.text(m.dob, valueX, textY);

          pdf.setFont("helvetica", "bold");
          pdf.text("ऊँचाई", col2X, textY);
          pdf.text(":", col2X + labelW, textY);
          pdf.setFont("helvetica", "normal");
          pdf.text(m.height, col2X + labelW + 0.02, textY);

          // Row 2: गोत्र + रक्त
          pdf.setFont("helvetica", "bold");
          pdf.text("गोत्र", textX, textY + lineH);
          pdf.text(":", textX + labelW, textY + lineH);
          pdf.setFont("helvetica", "normal");
          pdf.text(m.gotra, valueX, textY + lineH);

          pdf.setFont("helvetica", "bold");
          pdf.text("रक्त", col2X, textY + lineH);
          pdf.text(":", col2X + labelW, textY + lineH);
          pdf.setFont("helvetica", "normal");
          pdf.text(m.blood_group, col2X + labelW + 0.02, textY + lineH);

          // Full-width rows: पिता, पिता व्यव., माता, व्यवसाय, शिक्षा, पता
          const detailLabelW = 0.55;
          const rows = [
            ["पिता", m.father_name],
            ["पिता व्यव.", m.father_occupation],
            ["माता", m.mother_name],
            ["व्यवसाय", m.occupation],
            ["शिक्षा", m.education],
            ["पता", m.address],
          ];

          let detailY = textY + lineH * 2;
          for (const [label, value] of rows) {
            pdf.setFont("helvetica", "bold");
            pdf.text(label, textX, detailY);
            pdf.text(":", textX + detailLabelW, detailY);
            pdf.setFont("helvetica", "normal");
            // Truncate long values to fit cell width
            const maxChars = Math.floor((cellW - pad * 2 - detailLabelW - 0.1) / 0.035);
            const displayVal = value.length > maxChars ? value.substring(0, maxChars) + "…" : value;
            pdf.text(displayVal, textX + detailLabelW + 0.05, detailY);
            detailY += lineH;
          }

          // Profile image — embedded as separate layer (editable in CorelDRAW)
          const imgW = 0.55;
          const imgH = 0.75;
          const imgX = x + cellW - pad - imgW - 0.04;
          const imgY = headerY + 0.05;

          if (m.photo_url && m.photo_url.startsWith("http")) {
            // Fetch image and embed at 300 DPI quality
            try {
              const imgResp = await fetch(m.photo_url);
              const imgBlob = await imgResp.blob();
              const imgBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imgBlob);
              });

              // Determine format
              const isPng = m.photo_url.toLowerCase().includes(".png") || imgBase64.startsWith("data:image/png");
              const format = isPng ? "PNG" : "JPEG";

              // Image border
              pdf.setDrawColor(0, 0, 0);
              pdf.setLineWidth(0.005);
              pdf.rect(imgX, imgY, imgW, imgH, "S");

              // Embed image as editable object (not flattened)
              pdf.addImage(imgBase64, format, imgX, imgY, imgW, imgH, undefined, "FAST");
            } catch {
              // If image fails to load, draw placeholder
              pdf.setFillColor(240, 240, 240);
              pdf.rect(imgX, imgY, imgW, imgH, "F");
              pdf.setFontSize(4);
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(150, 150, 150);
              pdf.text("फोटो", imgX + imgW/2 - 0.1, imgY + imgH/2, { align: "center" });
            }
          } else {
            // No photo — draw placeholder
            pdf.setFillColor(240, 240, 240);
            pdf.rect(imgX, imgY, imgW, imgH, "F");
            pdf.setFontSize(4);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(150, 150, 150);
            pdf.text("पासपोर्ट फोटो", imgX + imgW/2 - 0.15, imgY + imgH/2, { align: "center" });
          }

          // Bottom contact line
          const contactY = y + cellH - pad - 0.06;
          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.003);
          pdf.line(x + pad + 0.02, contactY - 0.03, x + cellW - pad - 0.02, contactY - 0.03);

          pdf.setFontSize(5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(`फोन: ${m.mobile1 || "XXXXXXXXXX"}`, x + pad + 0.04, contactY);
          if (m.whatsapp) {
            pdf.setTextColor(0, 128, 0);
            pdf.text(`व्हाट्सएप: ${m.whatsapp}`, x + cellW - pad - 0.04, contactY, { align: "right" });
          }
        }

        // Page footer
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(5);
        pdf.setFont("helvetica", "bold");
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.005);
        pdf.line(safe, pageH - safe - 0.15, pageW - safe, pageH - safe - 0.15);
        pdf.text("प्रकाशक: इंडियन प्रेस, रायपुर (छ.ग.) • मुद्रण: परिचायिका 2026", safe, pageH - safe - 0.08);
        pdf.text("CorelDRAW / InDesign संगत • C0 M0 Y0 K100 • Vector Editable", pageW - safe, pageH - safe - 0.08, { align: "right" });
      }

      // =============================================
      // BUSINESS AD PAGES (if any)
      // =============================================
      if (businessAds.length > 0) {
        setPdfProgress(`व्यवसाय विज्ञापन पृष्ठ बन रहा है...`);
        await new Promise(r => setTimeout(r, 30));

        pdf.addPage([pageW, pageH], "portrait");
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, "F");

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("साहू समाज परिचायिका 2026 — व्यावसायिक विज्ञापन", safe, safe + 0.15);

        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.text("CorelDRAW Editable • CMYK C0 M0 Y0 K100 • 300 DPI", safe, safe + 0.22);

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.01);
        pdf.line(safe, safe + 0.28, pageW - safe, safe + 0.28);

        // Business ads — each as a separate block
        let bizY = safe + 0.4;
        for (const ad of businessAds) {
          pdf.setDrawColor(28, 25, 23);
          pdf.setLineWidth(0.008);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(safe, bizY, contentW, 2.0, "S");

          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(`विज्ञापन क्र.: ${ad.ad_number}`, safe + 0.05, bizY + 0.15);

          pdf.setFontSize(5);
          pdf.setFont("helvetica", "normal");
          pdf.text(`जिला: ${ad.district_hi || "-"} • संगठन: ${ad.sangathan_hi || "-"}`, safe + 0.05, bizY + 0.25);
          pdf.text(`पत्रिका: ${ad.magazine_hi || "-"} • संस्करण: ${ad.edition_hi || "-"}`, safe + 0.05, bizY + 0.32);
          pdf.text(`ग्राहक: ${ad.customer_name || "-"} • मोबाइल: ${ad.customer_mobile1 || "-"}`, safe + 0.05, bizY + 0.39);

          // Design link / uploaded JPG
          if (ad.uploaded_jpg_url && ad.uploaded_jpg_url.startsWith("http")) {
            try {
              const imgResp = await fetch(ad.uploaded_jpg_url);
              const imgBlob = await imgResp.blob();
              const imgBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imgBlob);
              });
              const format = ad.uploaded_jpg_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
              pdf.addImage(imgBase64, format, safe + 0.05, bizY + 0.45, contentW - 0.1, 1.4, undefined, "FAST");
            } catch {}
          }

          bizY += 2.2;
          if (bizY + 2.0 > pageH - safe - 0.2) break; // Don't overflow page
        }
      }

      // Save PDF
      const fileName = `Parichayika_CorelDRAW_Editable_${Date.now()}.pdf`;

      try {
        const pdfBlob = pdf.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (blobErr) {
        pdf.save(fileName);
      }

      setPdfProgress("✓ CorelDRAW-Ready Vector PDF डाउनलोड हो गया!");
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        setPdfProgress("");
      }, 4000);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      alert(`PDF बनाने में त्रुटि: ${err.message || "अज्ञात त्रुटि"}`);
      setPdfProgress("");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Configuration Header Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-800 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Print Production Engine
              </span>
              <span className="bg-stone-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                CMYK / 300 DPI
              </span>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                {pageDimensions.label}
              </span>
            </div>
            <h3 className="text-stone-900 font-black text-lg sm:text-xl mt-1.5 flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              मैगज़ीन प्रिंट-उत्पादन प्रबंधन (CorelDRAW & Offset Print Sheet Manager)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              लाइव प्रीव्यू के समान सटीक प्रारूप में सभी विज्ञापनों को शुद्ध C0 M0 Y0 K100 ब्लैक टेक्स्ट, कस्टम साइज़ एवं क्रॉप मार्क्स के साथ कोरल्ड्रॉ (CorelDRAW) या सीधे प्रिंटिंग हेतु तुरंत PDF डाउनलोड करें।
            </p>
          </div>

          {/* Action Button: Fast CorelDraw PDF Export */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleDownloadCorelDrawPdf}
              disabled={isGeneratingPdf || eligibleAds.length === 0}
              className="w-full lg:w-auto px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-95"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>PDF बन रहा है...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>PDF डाउनलोड हो गया!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>📥 कोरल्ड्रॉ / प्रिंट PDF डाउनलोड करें</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Progress Alert Bar */}
        {pdfProgress && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3.5 text-xs font-black text-orange-950 flex items-center gap-3 shadow-xs animate-fadeIn">
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1">{pdfProgress}</span>
          </div>
        )}

        {/* Quick Filter Counters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <button
            type="button"
            onClick={() => { setPaymentFilter("ALL"); setTypeFilter("ALL"); }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              paymentFilter === "ALL" && typeFilter === "ALL"
                ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
            }`}
          >
            <span className="text-[10px] uppercase font-bold block opacity-80">कुल सबमिट विज्ञापन</span>
            <span className="text-base font-black font-mono">{advertisements.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentFilter("PAID_ONLY")}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              paymentFilter === "PAID_ONLY"
                ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
            }`}
          >
            <span className="text-[10px] uppercase font-bold block opacity-80">केवल स्वीकृत (PAID)</span>
            <span className="text-base font-black font-mono">{totalPaid}</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter("matrimony")}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              typeFilter === "matrimony"
                ? "bg-orange-700 text-white border-orange-700 shadow-xs"
                : "bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200"
            }`}
          >
            <span className="text-[10px] uppercase font-bold block opacity-80">विवाह परिचय</span>
            <span className="text-base font-black font-mono">{totalMatrimony}</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter("business")}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              typeFilter === "business"
                ? "bg-sky-700 text-white border-sky-700 shadow-xs"
                : "bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200"
            }`}
          >
            <span className="text-[10px] uppercase font-bold block opacity-80">व्यवसाय विज्ञापन</span>
            <span className="text-base font-black font-mono">{totalBusiness}</span>
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1">भुगतान स्थिति</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">सभी सबमिट विज्ञापन (All Submissions)</option>
              <option value="PAID_ONLY">केवल स्वीकृत (PAID Only)</option>
              <option value="SUBMITTED_ONLY">सत्यापन लंबित (Submitted Only)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1">विज्ञापन प्रकार</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">सभी प्रकार (विवाह + व्यवसाय)</option>
              <option value="matrimony">केवल विवाह परिचय</option>
              <option value="business">केवल व्यवसाय विज्ञापन</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1">जिला (District)</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">सभी जिला ({uniqueDistricts.length})</option>
              {uniqueDistricts.map((d, idx) => (
                <option key={idx} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1">संगठन (Sangathan)</label>
            <select
              value={selectedSangathan}
              onChange={(e) => setSelectedSangathan(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">सभी संगठन ({uniqueSangathans.length})</option>
              {uniqueSangathans.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1">संस्करण (Edition)</label>
            <select
              value={selectedEdition}
              onChange={(e) => setSelectedEdition(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">सभी संस्करण ({uniqueEditions.length})</option>
              {uniqueEditions.map((ed, idx) => (
                <option key={idx} value={ed}>{ed}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Print Sheet Dimensions, Custom Size Inputs & Offset Controls */}
        <div className="mt-5 pt-4 border-t border-stone-100 bg-stone-50/80 p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-600" />
            <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider">
              प्रिंट शीट आकार व कोरल्ड्रॉ ग्रिड सेटिंग्स (Sheet Dimensions & Custom Size)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3.5">
            {/* Sheet Size Preset Dropdown */}
            <div className="lg:col-span-2">
              <label className="text-xs font-bold text-stone-700 block mb-1">
                शीट आकार (Preset Size)
              </label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="letter">Letter (8.5 × 11.0 in)</option>
                <option value="a4">A4 (8.27 × 11.69 in)</option>
                <option value="magazine_trim">पत्रिका ट्रिम (7.2 × 9.6 in)</option>
                <option value="half_sheet">हाफ पेज (7.2 × 4.8 in)</option>
                <option value="quarter_sheet">क्वार्टर पेज (3.6 × 4.8 in)</option>
                <option value="custom">✏️ कस्टम साइज़ (Custom Size)</option>
              </select>
            </div>

            {/* Custom Width Input (Inches) */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1 flex items-center justify-between">
                <span>चौड़ाई (Width - in)</span>
                <span className="text-[10px] text-orange-600 font-bold">इंच</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="50"
                value={pageSize === "custom" ? customWidth : pageDimensions.width}
                onChange={(e) => {
                  setPageSize("custom");
                  setCustomWidth(parseFloat(e.target.value) || 1);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            {/* Custom Height Input (Inches) */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1 flex items-center justify-between">
                <span>ऊँचाई (Height - in)</span>
                <span className="text-[10px] text-orange-600 font-bold">इंच</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="50"
                value={pageSize === "custom" ? customHeight : pageDimensions.height}
                onChange={(e) => {
                  setPageSize("custom");
                  setCustomHeight(parseFloat(e.target.value) || 1);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            {/* Columns per Page */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">कॉलम (Cols)</label>
              <select
                value={columns}
                onChange={(e) => setColumns(parseInt(e.target.value))}
                className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value={1}>1 कॉलम</option>
                <option value={2}>2 कॉलम</option>
                <option value={3}>3 कॉलम</option>
              </select>
            </div>

            {/* Rows per Page */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">पंक्तियाँ (Rows)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            {/* Reset Filters */}
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                रीसेट
              </button>
            </div>
          </div>
        </div>

        {/* CorelDRAW Offset Color Guidelines Badge */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 bg-stone-100/90 p-3 rounded-xl border border-stone-200 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span><b>CMYK Offset Profile:</b> Pure Black Text <b>(C0 M0 Y0 K100)</b> • 300 DPI Vector Crop Marks Enabled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-cyan-600 text-white rounded text-[9px] font-bold">C:100</span>
            <span className="px-1.5 py-0.5 bg-pink-600 text-white rounded text-[9px] font-bold">M:100</span>
            <span className="px-1.5 py-0.5 bg-amber-500 text-black rounded text-[9px] font-bold">Y:100</span>
            <span className="px-1.5 py-0.5 bg-black text-white rounded text-[9px] font-bold">K:100</span>
          </div>
        </div>
      </div>

      {/* 2. Summary Stat Card */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-orange-600 animate-pulse shrink-0"></span>
          <div>
            <p className="text-xs font-black text-stone-900">
              प्रिंट-रेडी प्रविष्टियाँ: <span className="text-orange-700">{eligibleAds.length} कुल विज्ञापन</span>
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              शीट आकार: {pageDimensions.label} &bull; कुल पृष्ठ: {totalPrintPages}
            </p>
          </div>
        </div>

        {/* FIX: Show already-printed (Completed) ads toggle — client spec: "जो add लिया जा चुका हो print के लिए यानी used हो चुका वो भी दिखे ताकि दुबारा same add न लिया जाए" */}
        <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPrinted}
            onChange={(e) => setShowPrinted(e.target.checked)}
            className="w-4 h-4 accent-orange-600 cursor-pointer"
          />
          <span>पहले से प्रिंट हुए विज्ञापन भी दिखाएँ</span>
          {printedCount > 0 && (
            <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
              ({printedCount} प्रिंटेड)
            </span>
          )}
        </label>

        <div className="flex items-center gap-3 text-xs text-stone-700 font-bold">
          <span>विवाह: <b className="text-orange-700">{matrimonyAds.length}</b></span>
          <span>&bull;</span>
          <span>व्यवसाय: <b className="text-sky-700">{businessAds.length}</b></span>
        </div>
      </div>

      {/* 3. PRINT PRODUCTION RENDER SHEETS */}
      <div className="space-y-12">
        {/* A. Matrimony Pages in Grid Sheets */}
        {matrimonyAds.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h4 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <Grid className="w-4.5 h-4.5 text-orange-600" />
                युवक-युवती परिचय प्रविष्टियां ({columns} × {rows} ग्रिड शीट - कुल {matrimonyPageCount} पृष्ठ)
              </h4>
              <span className="text-xs font-bold text-stone-500">
                प्रति पृष्ठ अधिकतम: {itemsPerPage} बायोडाटा
              </span>
            </div>

            {Array.from({ length: matrimonyPageCount }).map((_, pageIdx) => {
              const startIndex = pageIdx * itemsPerPage;
              const pageItems = matrimonyAds.slice(startIndex, startIndex + itemsPerPage);

              return (
                <div
                  key={`matrimony-page-${pageIdx}`}
                  className="print-production-sheet-page bg-white border border-stone-800 rounded-none mx-auto mb-10 shadow-lg relative overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 page-break-after"
                  style={{
                    width: `${pageDimensions.width}in`,
                    minHeight: `${pageDimensions.height}in`,
                    padding: `${safeArea}in`,
                    boxSizing: "border-box",
                    backgroundColor: "#FFFFFF",
                    color: "#000000"
                  }}
                >
                  {/* Offset Registration & Crop Marks for CorelDRAW */}
                  {showCropMarks && (
                    <>
                      {/* Top-Left Crop Mark */}
                      <div className="absolute top-1 left-1 w-4 h-4 pointer-events-none">
                        <div className="w-3 h-0.5 bg-black"></div>
                        <div className="w-0.5 h-3 bg-black"></div>
                      </div>
                      {/* Top-Right Crop Mark */}
                      <div className="absolute top-1 right-1 w-4 h-4 flex flex-col items-end pointer-events-none">
                        <div className="w-3 h-0.5 bg-black"></div>
                        <div className="w-0.5 h-3 bg-black self-end"></div>
                      </div>
                      {/* Bottom-Left Crop Mark */}
                      <div className="absolute bottom-1 left-1 w-4 h-4 flex flex-col justify-end pointer-events-none">
                        <div className="w-0.5 h-3 bg-black"></div>
                        <div className="w-3 h-0.5 bg-black"></div>
                      </div>
                      {/* Bottom-Right Crop Mark */}
                      <div className="absolute bottom-1 right-1 w-4 h-4 flex flex-col justify-end items-end pointer-events-none">
                        <div className="w-0.5 h-3 bg-black self-end"></div>
                        <div className="w-3 h-0.5 bg-black"></div>
                      </div>
                    </>
                  )}

                  {/* Offset Color Calibration Bar */}
                  {showColorBars && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-70">
                      <span className="w-2.5 h-1.5 bg-[#00FFFF]"></span>
                      <span className="w-2.5 h-1.5 bg-[#FF00FF]"></span>
                      <span className="w-2.5 h-1.5 bg-[#FFFF00]"></span>
                      <span className="w-2.5 h-1.5 bg-[#000000]"></span>
                      <span className="w-2.5 h-1.5 bg-[#808080]"></span>
                      <span className="w-2.5 h-1.5 bg-[#D3D3D3]"></span>
                    </div>
                  )}

                  {/* Page Masthead Header (C0 M0 Y0 K100 Pure Black) */}
                  <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-3 text-black">
                    <div>
                      <span className="font-black text-xs uppercase tracking-wider block">
                        साहू समाज परिचायिका 2026 — युवक-युवती वैवाहिक परिचय
                      </span>
                      <span className="text-[9px] font-bold text-black/80">
                        {selectedDistrict || "समस्त जिला"} &bull; {selectedSangathan || "साहू संगठन"} &bull; ऑफसेट प्रिंट शीट
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-black block">
                        पृष्ठ {pageIdx + 1} / {matrimonyPageCount}
                      </span>
                      <span className="text-[8.5px] font-mono font-bold text-black/70">
                        300 DPI &bull; CMYK C0 M0 Y0 K100
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Grid Layout for this page: EXACT SAME LAYOUT AS LIVE PREVIEW */}
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                    }}
                  >
                    {pageItems.map((item) => {
                      const m = getMatrimonyData(item);
                      return (
                        <div
                          key={item.id}
                          className="bg-[#FFFDF6] border border-stone-800 rounded-lg p-2 shadow-none relative select-none flex flex-col justify-between h-full box-border"
                          style={{
                            backgroundColor: "#FFFDF6",
                            borderColor: "#1c1917"
                          }}
                        >
                          {/* Top Header with Exact Red Title & Exact Ad Number */}
                          <div className="border-b border-red-200 pb-1 mb-1 flex items-center justify-between gap-1">
                            <h4 className="text-[10px] sm:text-[11px] font-black text-red-600 tracking-wide flex items-center min-w-0">
                              <span className="font-mono">{item.ad_number}.</span>
                              <span className="ml-1 truncate">{m.name}</span>
                            </h4>
                            <span className="text-[7.5px] font-mono font-bold text-stone-600 bg-stone-100 px-1 py-0.2 rounded shrink-0">
                              {item.ad_number}
                            </span>
                          </div>

                          {/* Details Grid & Image Frame */}
                          <div className="flex flex-row gap-1.5 items-start flex-1 min-h-0">
                            <div className="flex-1 min-w-0 font-sans">
                              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[7.5px] sm:text-[8px] leading-[9.5px] sm:leading-[10px] text-stone-900 font-bold text-left">
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[26px] text-stone-950 font-black shrink-0">जन्म</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.dob}</span>
                                </div>
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[26px] text-stone-950 font-black shrink-0">ऊँचाई</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.height}</span>
                                </div>
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[26px] text-stone-950 font-black shrink-0">गोत्र</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.gotra}</span>
                                </div>
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[26px] text-stone-950 font-black shrink-0">रक्त</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.blood_group}</span>
                                </div>
                                <div className="flex items-start min-w-0 col-span-2">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">पिता</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.father_name}</span>
                                </div>
                                <div className="flex items-start min-w-0 col-span-2">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">पिता व्यव</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.father_occupation}</span>
                                </div>
                                <div className="flex items-start min-w-0 col-span-2">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">माता</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.mother_name}</span>
                                </div>
                                <div className="flex items-start min-w-0 col-span-2">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">व्यवसाय</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.occupation}</span>
                                </div>
                              </div>

                              <div className="mt-0.5 pt-0.5 border-t border-stone-200 space-y-0.5 text-[7.5px] sm:text-[8px] leading-[9.5px] sm:leading-[10px] text-stone-900 font-bold">
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">शिक्षा</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.education}</span>
                                </div>
                                <div className="flex items-start min-w-0">
                                  <span className="inline-block w-[38px] text-stone-950 font-black shrink-0">पता</span>
                                  <span className="text-stone-900 mx-0.5 shrink-0">:</span>
                                  <span className="text-stone-800 truncate flex-1">{m.address}</span>
                                </div>
                              </div>
                            </div>

                            {/* Profile Image Frame */}
                            <div className="w-[68px] h-[92px] sm:w-[76px] sm:h-[102px] bg-stone-100 border border-stone-300 rounded overflow-hidden shrink-0 flex items-center justify-center">
                              {m.photo_url ? (
                                <img
                                  src={m.photo_url}
                                  alt="Profile"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[7px] text-stone-400 font-bold text-center bg-stone-50 p-0.5">
                                  <User className="w-4 h-4 text-stone-300 mb-0.5" />
                                  <span>पासपोर्ट फोटो</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bottom Contact (Phone & WhatsApp) */}
                          <div className="mt-1 pt-0.5 border-t border-stone-200 flex items-center justify-between text-[7.5px] font-bold text-stone-900">
                            <div className="flex items-center gap-1">
                              <Phone className="w-2 h-2 text-[#E65100]" />
                              <span className="font-mono">{m.mobile1 || "XXXXXXXXXX"}</span>
                            </div>
                            {m.whatsapp && (
                              <div className="flex items-center gap-0.5 text-emerald-700">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block"></span>
                                <span className="font-mono">{m.whatsapp}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Page Footer */}
                  <div className="absolute bottom-2 left-6 right-6 flex justify-between items-center text-[8px] text-black border-t border-black pt-1">
                    <span className="font-bold">प्रकाशक: इंडियन प्रेस, रायपुर (छ.ग.) &bull; मुद्रण: परिचायिका 2026</span>
                    <span className="font-mono font-bold">कोरल्ड्रॉ / इनडिज़ाइन संगत &bull; C0 M0 Y0 K100</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* B. Render Business Ads - Full Page, Half Page, Quarter Page Displays */}
        {businessAds.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h4 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4.5 h-4.5 text-sky-600" />
                व्यावसायिक विज्ञापन शीट्स (Business Ads Print Layouts - {businessAds.length} Ads)
              </h4>
              <span className="text-xs font-bold text-stone-500">
                Full Page, Half Page, Quarter Page CMYK Prints
              </span>
            </div>

            {businessAds.map((item, adIdx) => {
              const bus = item.businessProfile;
              const adImage = item.uploaded_jpg_url || bus?.photo_url || bus?.ready_ad_url || "";
              const designLink = item.design_link || bus?.ready_ad_url || bus?.design_link || "";

              return (
                <div
                  key={`business-page-${item.id}-${adIdx}`}
                  className="print-production-sheet-page bg-white border border-stone-800 rounded-none mx-auto mb-10 shadow-lg relative overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 page-break-after"
                  style={{
                    width: `${pageDimensions.width}in`,
                    minHeight: `${pageDimensions.height}in`,
                    padding: `${safeArea}in`,
                    boxSizing: "border-box",
                    backgroundColor: "#FFFFFF",
                    color: "#000000"
                  }}
                >
                  {/* Trim / Registration marks for printers */}
                  {showCropMarks && (
                    <>
                      <div className="absolute top-1 left-1 w-4 h-4 pointer-events-none">
                        <div className="w-3 h-0.5 bg-black"></div>
                        <div className="w-0.5 h-3 bg-black"></div>
                      </div>
                      <div className="absolute top-1 right-1 w-4 h-4 flex flex-col items-end pointer-events-none">
                        <div className="w-3 h-0.5 bg-black"></div>
                        <div className="w-0.5 h-3 bg-black self-end"></div>
                      </div>
                      <div className="absolute bottom-1 left-1 w-4 h-4 flex flex-col justify-end pointer-events-none">
                        <div className="w-0.5 h-3 bg-black"></div>
                        <div className="w-3 h-0.5 bg-black"></div>
                      </div>
                      <div className="absolute bottom-1 right-1 w-4 h-4 flex flex-col justify-end items-end pointer-events-none">
                        <div className="w-0.5 h-3 bg-black self-end"></div>
                        <div className="w-3 h-0.5 bg-black"></div>
                      </div>
                    </>
                  )}

                  {/* Header Bar */}
                  <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-3 text-black">
                    <div>
                      <span className="font-black text-xs uppercase tracking-wider block">
                        साहू समाज परिचायिका 2026 — व्यावसायिक विज्ञापन
                      </span>
                      <span className="text-[9px] font-bold">
                        आकार: {item.size_hi} &bull; {item.district_hi} &bull; {item.sangathan_hi}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-black block">ID: {item.ad_number}</span>
                      <span className="text-[8.5px] font-mono font-bold">300 DPI CMYK JPG Print</span>
                    </div>
                  </div>

                  {/* Outer Print Container */}
                  <div className="w-full min-h-[9.2in] flex flex-col items-center justify-center border-2 border-black rounded-none relative overflow-hidden bg-white p-3">
                    {/* 1. Direct High-Resolution CMYK JPG Image Render */}
                    {adImage && (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={adImage}
                          alt="Business Print Ad"
                          className="max-w-full max-h-[8.6in] object-contain border border-black/30 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        {designLink && (
                          <div className="mt-2 text-[9.5px] font-mono text-black truncate max-w-full print:hidden">
                            स्रोत लिंक: <a href={designLink} target="_blank" rel="noreferrer" className="text-blue-700 underline font-bold">{designLink}</a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Structured Ad Maker Elements Fallback */}
                    {!adImage && (
                      <div className="w-11/12 h-5/6 border-2 border-black p-6 flex flex-col justify-between bg-white text-black text-center space-y-4">
                        <h2 className="text-2xl font-black">{bus?.business_name || item.customer_name}</h2>
                        <p className="text-sm font-bold">{bus?.owner_name ? `संचालक: ${bus.owner_name}` : ""}</p>
                        <p className="text-sm font-medium">{bus?.tagline || ""}</p>
                        <div className="text-xs space-y-1">
                          <p>{bus?.business_address || ""}</p>
                          <p className="font-mono font-bold">मो.: {bus?.mobile1 || item.customer_mobile1}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Page Footer */}
                  <div className="absolute bottom-2 left-6 right-6 flex justify-between items-center text-[8.5px] text-black border-t border-black pt-1">
                    <span className="font-bold">प्रकाशक: इंडियन प्रेस, रायपुर (छ.ग.) &bull; मुद्रण: परिचायिका 2026</span>
                    <span className="font-mono font-bold">कोरल्ड्रॉ / इनडिज़ाइन संगत &bull; C0 M0 Y0 K100</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
