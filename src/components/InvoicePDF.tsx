import React, { useState } from "react";
import {
  Printer,
  Download,
  CheckCircle,
  Clock,
  ShieldAlert,
  FileText,
  Loader2,
  Check,
  Eye,
  Building,
  Phone,
  Calendar,
  Sparkles
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Order } from "../types";

interface InvoicePDFProps {
  order: Order & { [key: string]: any };
  onClose?: () => void;
}

export default function InvoicePDF({ order, onClose }: InvoicePDFProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);

  // If order is not yet paid and user hasn't explicitly opened draft preview
  if (order.payment_status !== "PAID" && !showDraftPreview) {
    return (
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-600 animate-pulse">
          <Clock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-black text-stone-900 tracking-tight">सत्यापन लंबित (Verification Pending) ⏳</h3>
          <p className="text-xs text-stone-600 mt-2 font-bold leading-relaxed">
            आपका विज्ञापन आवेदन और भुगतान स्क्रीनशॉट सफलतापूर्वक प्राप्त हो गए हैं।
          </p>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            सुरक्षा एवं सत्यापन मानकों के कारण, आधिकारिक रसीद (Official Invoice) एडमिन द्वारा आपके भुगतान का सत्यापन (PAID) होने के पश्चात जारी की जाती है। आप नीचे दिए बटन से ड्राफ्ट PDF पूर्वावलोकन देख सकते हैं।
          </p>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-700 text-left space-y-2">
          <p><span className="font-bold">ऑर्डर क्रमांक:</span> <span className="font-mono font-bold text-stone-900">{order.order_id}</span></p>
          <p><span className="font-bold">कुल भुगतान राशि:</span> ₹{(order.total_amount || 0).toLocaleString("en-IN")}.00</p>
          {order.payment_screenshot && (
            <div className="pt-2 border-t border-stone-200 mt-1">
              <span className="font-bold block mb-1">अपलोडेड स्क्रीनशॉट (Payment Screenshot):</span>
              <img src={order.payment_screenshot} alt="Payment Receipt" className="h-32 w-auto rounded object-contain border bg-white p-0.5" referrerPolicy="no-referrer" />
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setShowDraftPreview(true)}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Eye className="w-4 h-4" />
            ड्राफ्ट इनवॉइस / PDF फ़ॉर्मेट देखें
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
            >
              होमपेज पर जाएँ
            </button>
          )}
        </div>
      </div>
    );
  }

  // Generate 300 DPI High-Quality A4 PDF
  const handleDownloadPdf = async () => {
    const content = document.getElementById("printable-invoice-content");
    if (!content) return;

    setIsGeneratingPdf(true);
    setPdfDownloaded(false);

    try {
      // High-resolution canvas capture at 3x scale (300 DPI equivalent)
      const canvas = await html2canvas(content, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const printableWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", margin, margin, printableWidth, Math.min(imgHeight, pdfHeight - (margin * 2)), undefined, "FAST");

      pdf.setProperties({
        title: `परिचायिका - Invoice ${order.order_id}`,
        subject: "विज्ञापन भुगतान पावती / Official Invoice",
        author: "Indian Press, Raipur",
        creator: "Parichayika Invoicing Engine"
      });

      pdf.save(`Parichayika_Invoice_${order.order_id}.pdf`);
      setPdfDownloaded(true);
      setTimeout(() => setPdfDownloaded(false), 4000);
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      alert(`PDF डाउनलोड करने में त्रुटि: ${err.message || "अज्ञात त्रुटि"}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById("printable-invoice-content");
    if (!content) {
      window.print();
      return;
    }
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>परिचायिका - Invoice ${order.order_id}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #1c1917; padding: 24px; }
              @media print {
                body { padding: 0; margin: 0; }
                @page { size: A4 portrait; margin: 12mm; }
              }
            </style>
          </head>
          <body>
            <div class="max-w-3xl mx-auto">
              ${content.innerHTML}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3.5 py-1.5 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
            <CheckCircle className="w-4 h-4 text-emerald-700" />
            भुगतान सफल एवं सत्यापित (PAID)
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            सत्यापन प्रक्रियाधीन (Verification Pending)
          </span>
        );
      case "REJECTED":
        return (
          <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1.5 rounded-full border border-red-200">
            अस्वीकृत (REJECTED)
          </span>
        );
      default:
        return (
          <span className="bg-stone-100 text-stone-800 text-xs font-bold px-3 py-1.5 rounded-full border border-stone-200">
            ड्राफ्ट पूर्वावलोकन (DRAFT)
          </span>
        );
    }
  };

  // Safe parsing helper
  const parseDetails = (details: any, jsonStr?: string) => {
    if (details && typeof details === "object") return details;
    if (jsonStr && typeof jsonStr === "string") {
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const items = order.items || [];

  return (
    <div className="space-y-4">
      {/* Top Header Actions (Hidden in print) */}
      <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shadow-lg print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
              Official Invoice
            </span>
            <span className="text-stone-300 text-xs font-mono">
              {order.order_id}
            </span>
          </div>
          <h3 className="text-white font-black text-base sm:text-lg mt-0.5">
            विज्ञापन भुगतान पावती / Official Invoice
          </h3>
          <p className="text-xs text-stone-400">
            हाई-क्वालिटी A4 PDF डाउनलोड करें अथवा डायरेक्ट प्रिंट निकालें।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 border border-stone-700 rounded-xl text-stone-300 text-xs font-bold hover:bg-stone-800 transition-all cursor-pointer text-center"
            >
              वापस जाएँ
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-stone-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-95"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                PDF बन रहा है...
              </>
            ) : pdfDownloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                PDF डाउनलोड हो गया!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                📥 A4 PDF डाउनलोड करें
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            प्रिंट / Print
          </button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div
        id="printable-invoice-container"
        className="bg-white border border-stone-300 rounded-2xl p-4 sm:p-6 md:p-8 max-w-3xl mx-auto shadow-xl print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {/* Dynamic Print CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-invoice-container, #printable-invoice-container * {
              visibility: visible !important;
            }
            #printable-invoice-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}} />

        {/* Invoice Printable Content Area */}
        <div id="printable-invoice-content" className="space-y-6 bg-white p-2">
          {/* Invoice Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b-2 border-stone-900">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#E65100]"></span>
                <span className="text-3xl font-black text-stone-900 tracking-wider">परिचायिका</span>
              </div>
              <p className="text-xs font-bold text-stone-600 uppercase tracking-widest mt-1">
                Powered by Indian Press, Raipur
              </p>
              <p className="text-xs text-stone-500 mt-1 font-medium">
                गांधी नगर, पहाड़ी चौक, गुढ़ियारी, रायपुर (छ.ग.) | मो. 9301056006, 7647924636
              </p>
            </div>
            <div className="md:text-right bg-stone-50 border border-stone-200 rounded-xl p-3">
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">INVOICE / पावती</h2>
              <p className="text-xs text-stone-700 mt-1 font-bold">
                ऑर्डर क्रमांक: <span className="font-mono font-black text-orange-700">{order.order_id}</span>
              </p>
              <p className="text-xs text-stone-600">
                दिनांक: {order.created_at ? new Date(order.created_at).toLocaleDateString("hi-IN") : new Date().toLocaleDateString("hi-IN")}
              </p>
            </div>
          </div>

          {/* Customer & Payment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50 border border-stone-200 rounded-2xl p-5">
            <div>
              <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-wider mb-2.5">
                बिल प्राप्तकर्ता (Customer Details)
              </h4>
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((it: any, idx: number) => {
                    const mDetails = parseDetails(it.matrimonyDetails, it.matrimony_details_json);
                    const bDetails = parseDetails(it.businessDetails, it.business_details_json);

                    const displayName = mDetails?.name || bDetails?.businessName || bDetails?.ownerName || it.customer_name || order.customer_name || "आवेदक";
                    const displayMobile = mDetails?.mobile1 || bDetails?.mobile1 || it.customer_mobile || order.customer_mobile || order.customer_phone || "-";
                    const displayAddress = mDetails?.currentAddress || mDetails?.permanentAddress || bDetails?.businessAddress || "-";

                    return (
                      <div key={idx} className={idx > 0 ? "border-t border-stone-200 pt-2.5" : ""}>
                        <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${it.ad_type === "matrimony" ? "text-[#E65100]" : "text-emerald-700"}`}>
                          {it.ad_type === "matrimony" ? "विवाह परिचय प्रविष्टि (Matrimony)" : "व्यावसायिक विज्ञापन (Business)"}
                        </p>
                        <p className="text-sm font-black text-stone-900">
                          {it.ad_type === "matrimony" ? "नाम: " : "व्यवसाय/संस्था: "}
                          {displayName}
                        </p>
                        {it.ad_type === "business" && bDetails?.ownerName && (
                          <p className="text-xs text-stone-700 mt-0.5 font-medium">संचालक: {bDetails.ownerName}</p>
                        )}
                        <p className="text-xs text-stone-700 mt-0.5">
                          मोबाइल नंबर: <span className="font-mono font-bold text-stone-900">{displayMobile}</span>
                        </p>
                        {(mDetails?.whatsapp || bDetails?.whatsapp) && (
                          <p className="text-xs text-stone-700">
                            व्हाट्सएप: <span className="font-mono font-bold text-stone-900">{mDetails?.whatsapp || bDetails?.whatsapp}</span>
                          </p>
                        )}
                        {displayAddress !== "-" && (
                          <p className="text-xs text-stone-600 mt-0.5">पता: {displayAddress}</p>
                        )}
                        <p className="text-xs text-stone-700 mt-1">
                          विज्ञापन नंबर: <span className="font-mono font-black text-[#E65100] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{it.ad_number}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : order.customer_name || order.customer_mobile ? (
                <div className="space-y-1">
                  <p className="text-sm font-black text-stone-900">नाम: {order.customer_name || "आवेदक"}</p>
                  <p className="text-xs text-stone-700">मोबाइल: <span className="font-mono font-bold">{order.customer_mobile || order.customer_phone || "-"}</span></p>
                </div>
              ) : (
                <p className="text-sm text-stone-800 font-medium">विवरण दर्ज</p>
              )}
            </div>

            <div className="md:border-l md:border-stone-200 md:pl-6">
              <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-wider mb-2.5">
                भुगतान स्थिति (Payment Status)
              </h4>
              <div className="flex flex-col gap-2 items-start">
                {getStatusBadge(order.payment_status)}
                <div className="text-xs text-stone-600 space-y-1 mt-1.5">
                  <p>माध्यम: <strong className="text-stone-900">आधिकारिक UPI QR कोड</strong></p>
                  <p>भुगतान प्राप्तकर्ता: <strong className="text-stone-900">9301056006@paytm (Indian Press)</strong></p>
                  <p className="text-stone-500 text-[11px]">
                    दिनांक व समय: {order.payment_date ? new Date(order.payment_date).toLocaleString("hi-IN") : new Date().toLocaleString("hi-IN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Itemised Billing Table */}
          <div>
            <h4 className="text-xs font-black text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-600" />
              विज्ञापन प्रविष्टियों का विवरण (Billing Items)
            </h4>
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-xs font-black text-stone-700">
                    <th className="px-4 py-3 w-12 text-center">क्र.</th>
                    <th className="px-4 py-3">विवरण (Details)</th>
                    <th className="px-4 py-3 text-right">दर (Price)</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-stone-200 text-stone-800 bg-white">
                  {items.map((it: any, idx: number) => {
                    const mDetails = parseDetails(it.matrimonyDetails, it.matrimony_details_json);
                    const bDetails = parseDetails(it.businessDetails, it.business_details_json);
                    const itemName = it.ad_type === "matrimony" 
                      ? (mDetails?.name || it.customer_name || "विवाह प्रविष्टि")
                      : (bDetails?.businessName || it.customer_name || "व्यापार विज्ञापन");

                    return (
                      <tr key={it.id || idx}>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-center text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <p className="font-black text-stone-900 text-sm">
                              {it.ad_type === "matrimony" ? "विवाह परिचय प्रविष्टि" : "व्यवसाय विज्ञापन"}
                            </p>
                            <p className="text-xs font-bold text-stone-700">
                              नाम/संस्था: {itemName}
                            </p>
                            <div className="flex flex-wrap gap-1.5 items-center mt-1">
                              <span className="text-xs font-mono text-[#E65100] font-black bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                विज्ञापन क्र.: {it.ad_number}
                              </span>
                              <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                                आकार: {it.size_hi || (it.ad_type === "matrimony" ? "3.5 × 2 इंच" : "मानक")}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium">
                              प्रकाशन: {it.district_hi || "रायपुर"} • {it.sangathan_hi || "साहू संगठन"} • {it.magazine_hi || "परिचायिका"} ({it.edition_hi || "2026"})
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-stone-900 whitespace-nowrap">
                          ₹{(it.price || 0).toLocaleString("en-IN")}.00
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 font-black border-t-2 border-stone-200 text-stone-900">
                    <td colSpan={2} className="px-4 py-3.5 text-right text-stone-600 uppercase text-xs tracking-wider">
                      कुल योग (Total Amount):
                    </td>
                    <td className="px-4 py-3.5 text-right text-base font-black text-[#E65100] font-mono whitespace-nowrap">
                      ₹{(order.total_amount || 0).toLocaleString("en-IN")}.00
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Indian Press Terms Disclaimer */}
          <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-black text-amber-900 uppercase tracking-wider block mb-1">
                  आवश्यक सूचना / Disclaimer
                </span>
                <p className="text-xs text-amber-800 leading-relaxed font-bold">
                  १) आपके द्वारा उपलब्ध कराई गई जानकारी कृपया पुस्तक प्रकाशन के संपादक मंडल को जरूर प्रेषित करें एवं किसी भी त्रुटि सुधार हेतु संपादक मंडल को संपर्क करें।
                </p>
                <p className="text-xs text-amber-800 leading-relaxed font-bold mt-1.5">
                  २) यह ऑनलाइन फॉर्म आपकी किसी भी त्रुटि के लिए जिम्मेदार नहीं है।
                </p>
              </div>
            </div>
          </div>

          {/* Footer Watermark / Signature area */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-center text-xs text-stone-400 gap-2">
            <span>© 2026 परिचायिका | इंडियन प्रेस, रायपुर</span>
            <span className="font-mono text-[11px]">System Generated Digital Tax Invoice</span>
          </div>
        </div>
      </div>
    </div>
  );
}
