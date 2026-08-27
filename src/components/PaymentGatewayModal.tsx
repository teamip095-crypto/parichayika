import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle,
  ShieldCheck,
  Smartphone,
  Download,
  Loader2,
  ArrowRight,
  Info
} from "lucide-react";

export interface PaymentGatewayProps {
  orderId: string;
  totalAmount: number;
  customerName?: string;
  customerMobile?: string;
  onPaymentSuccess: (screenshotUrl: string) => void;
  onCancel?: () => void;
}

export default function PaymentGatewayModal({
  orderId,
  totalAmount,
  customerName = "आवेदक",
  customerMobile = "",
  onPaymentSuccess,
  onCancel
}: PaymentGatewayProps) {
  // Available UPI VPAs/Handles
  const upiHandles = [
    { id: "phonepe", label: "PhonePe UPI", vpa: "9301056006@ybl", badge: "सर्वाधिक उपयुक्त", color: "text-purple-700 bg-purple-50 border-purple-200" },
    { id: "paytm", label: "Paytm UPI", vpa: "9301056006@paytm", badge: "Paytm स्पेशल", color: "text-sky-700 bg-sky-50 border-sky-200" },
    { id: "bhim", label: "BHIM / Yes Bank", vpa: "9301056006@ibl", badge: "ऑल बैंक सपोर्ट", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { id: "gpay", label: "Google Pay / Axis", vpa: "9301056006@axl", badge: "GPay रेडी", color: "text-blue-700 bg-blue-50 border-blue-200" }
  ];

  const [selectedHandleId, setSelectedHandleId] = useState<string>("phonepe");
  const selectedHandle = upiHandles.find((h) => h.id === selectedHandleId) || upiHandles[0];
  const payeeName = "IndianPress";
  const formattedAmount = totalAmount.toFixed(2);
  const cleanTxnRef = `ORD${orderId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const cleanTxnNote = `Parichayika_${orderId}`;

  // Standard NPCI Compliant UPI Pay URI
  const upiPayload = `upi://pay?pa=${selectedHandle.vpa}&pn=${payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;

  // Specific App Links
  const phonepePayload = `phonepe://pay?pa=9301056006@ybl&pn=${payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;
  const paytmPayload = `paytmmp://pay?pa=9301056006@paytm&pn=${payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;
  const gpayPayload = `gpay://upi/pay?pa=${selectedHandle.vpa}&pn=${payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;
  const bhimPayload = `bhim://pay?pa=9301056006@ibl&pn=${payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;

  // Local QR Code Data URL State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(true);

  // Troubleshooting states
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);

  // Copy state feedbacks
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Payment screenshot upload states
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setScreenshotUrl(data.url);
      } else {
        const err = await res.json();
        setUploadError(err.error || "अपलोड विफल रहा");
      }
    } catch (err) {
      setUploadError("नेटवर्क त्रुटि: फ़ाइल अपलोड करने में असमर्थ");
    } finally {
      setIsUploading(false);
    }
  };

  // Generate QR code client-side whenever payload changes
  useEffect(() => {
    setIsGeneratingQr(true);
    QRCode.toDataURL(upiPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#1A1A1A",
        light: "#FFFFFF"
      }
    })
      .then((url) => {
        setQrCodeDataUrl(url);
        setIsGeneratingQr(false);
      })
      .catch((err) => {
        console.error("QR Code Generation error:", err);
        setIsGeneratingQr(false);
      });
  }, [upiPayload]);

  // Copy helper
  const handleCopy = (text: string, type: "vpa" | "phone" | "amount" | "note") => {
    navigator.clipboard.writeText(text);
    if (type === "vpa") {
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2500);
    } else if (type === "phone") {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    } else if (type === "amount") {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2500);
    } else if (type === "note") {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2500);
    }
  };

  // Launch UPI App with top-level navigation safety
  const handleLaunchUpi = (customPayload?: string) => {
    setShowTroubleshooting(true);
    const targetUrl = customPayload || upiPayload;
    try {
      window.location.href = targetUrl;
    } catch (e) {
      window.open(targetUrl, "_top");
    }
  };

  // Download QR Code image
  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `parichayika-upi-qr-${orderId}.png`;
    link.click();
  };

  // Submit confirmation
  const handleConfirm = () => {
    if (!screenshotUrl) {
      alert("त्रुटि: कृपया भुगतान सफलता की पुष्टि का स्क्रीनशॉट (Payment Screenshot) अवश्य अपलोड करें।");
      return;
    }
    setIsSubmitting(true);
    onPaymentSuccess(screenshotUrl);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl shadow-xl overflow-hidden my-4">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-5 sm:p-6 text-white text-center relative">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-2.5 shadow-inner">
          <QrCode className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black tracking-tight">
          आधिकारिक सुरक्षित यूपीआई भुगतान
        </h3>
        <p className="text-xs sm:text-sm text-orange-100 font-medium mt-1">
          Indian Press / Parichayika • Payee: 9301056006
        </p>

        <div className="mt-3 inline-flex items-center gap-2 bg-black/25 px-3.5 py-1 rounded-full text-xs font-mono text-orange-50 border border-white/20">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>सुरक्षित 256-Bit NPCI UPI गेटवे</span>
        </div>
      </div>

      <div className="p-4 sm:p-7 space-y-6">
        {/* Billing Amount Card */}
        <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-2xs">
          <div>
            <span className="text-xs font-bold text-stone-500 block uppercase tracking-wider">
              आर्डर संख्या (Order ID): <span className="font-mono text-stone-900 font-black">{orderId}</span>
            </span>
            <span className="text-xs text-stone-600 mt-0.5 block">
              मुख्य आवेदक: <span className="font-bold text-stone-900">{customerName}</span> {customerMobile && `(${customerMobile})`}
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-end">
            <span className="text-xs font-bold text-orange-800">देय कुल राशि:</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl sm:text-4xl font-mono font-black text-stone-950">
                ₹{totalAmount.toLocaleString("en-IN")}.00
              </span>
              <button
                type="button"
                onClick={() => handleCopy(totalAmount.toString(), "amount")}
                className="p-1.5 bg-white hover:bg-stone-100 text-stone-600 rounded-lg border border-stone-200 shadow-2xs cursor-pointer text-xs flex items-center gap-1"
                title="राशि कॉपी करें"
              >
                {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* UPI VPA Handles Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-orange-600" />
              UPI आईडी / बैंक हैंडल चुनें (Select UPI Handle):
            </label>
            <span className="text-[11px] text-stone-500">यदि एक हैंडल में समस्या हो, तो दूसरा चुनें</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {upiHandles.map((handle) => (
              <button
                key={handle.id}
                type="button"
                onClick={() => setSelectedHandleId(handle.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedHandleId === handle.id
                    ? "border-orange-600 bg-orange-50/90 ring-2 ring-orange-500/20 shadow-xs"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-black text-stone-900">{handle.label}</span>
                  {selectedHandleId === handle.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </div>
                <span className="text-[10px] font-mono text-stone-600 truncate block">{handle.vpa}</span>
                <span className="text-[9px] font-bold text-orange-700 mt-1 block">{handle.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2 METHOD SECTION: DIRECT APP PAY OR QR CODE SCAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* METHOD 1: QR CODE WITH 1-CLICK COPY */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 shadow-inner">
            <div className="flex items-center gap-1 text-xs font-bold text-stone-700 uppercase tracking-wide">
              <QrCode className="w-4 h-4 text-orange-600" />
              <span>विकल्प 1: QR कोड स्कैन करें</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm relative flex items-center justify-center min-w-[190px] min-h-[190px]">
              {isGeneratingQr ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                  <span className="text-xs text-stone-500">QR बन रहा है...</span>
                </div>
              ) : (
                <img
                  src={qrCodeDataUrl}
                  alt="UPI QR Code"
                  className="w-44 h-44 rounded-lg object-contain"
                />
              )}
            </div>

            {/* Quick Copy UPI ID and Phone Number */}
            <div className="w-full space-y-1.5 text-center">
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[11px] font-mono font-bold text-stone-800 truncate">{selectedHandle.vpa}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedHandle.vpa, "vpa")}
                  className="text-xs font-bold text-orange-700 hover:text-orange-900 flex items-center gap-1 cursor-pointer"
                >
                  {copiedVpa ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold text-[10px]">कॉपी हुआ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">UPI ID कॉपी</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[11px] font-mono font-bold text-stone-800">मो.: 9301056006</span>
                <button
                  type="button"
                  onClick={() => handleCopy("9301056006", "phone")}
                  className="text-xs font-bold text-stone-700 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold text-[10px]">कॉपी हुआ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">नंबर कॉपी</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="w-full text-center text-[10.5px] font-bold text-stone-500 hover:text-orange-700 flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>QR कोड गैलरी में सेव करें (Save to Gallery)</span>
              </button>
            </div>
          </div>

          {/* METHOD 2: DIRECT 1-TAP INSTANT UPI APPS */}
          <div className="space-y-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 uppercase tracking-wide">
              <CreditCard className="w-4 h-4 text-orange-600" />
              <span>विकल्प 2: सीधे UPI एप्प से पे करें</span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              यदि आप मोबाइल पर हैं, तो नीचे दिए गए किसी भी बटन पर क्लिक करके सीधे अपना पेमेंट एप्प खोलें:
            </p>

            {/* Primary Generic Instant Pay Button */}
            <button
              type="button"
              onClick={() => handleLaunchUpi()}
              className="w-full bg-[#E65100] hover:bg-orange-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>यहाँ क्लिक कर पे करें (Pay Now ₹{totalAmount})</span>
            </button>

            {/* Dedicated App Launchers Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* PhonePe Launcher */}
              <button
                type="button"
                onClick={() => handleLaunchUpi(phonepePayload)}
                className="p-2.5 bg-purple-50 hover:bg-purple-100/90 border border-purple-200 rounded-xl flex items-center justify-center gap-2 text-purple-950 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <span>PhonePe से पे</span>
              </button>

              {/* Paytm Launcher */}
              <button
                type="button"
                onClick={() => handleLaunchUpi(paytmPayload)}
                className="p-2.5 bg-sky-50 hover:bg-sky-100/90 border border-sky-200 rounded-xl flex items-center justify-center gap-2 text-sky-950 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                <span>Paytm से पे</span>
              </button>

              {/* Google Pay Launcher */}
              <button
                type="button"
                onClick={() => handleLaunchUpi(gpayPayload)}
                className="p-2.5 bg-blue-50 hover:bg-blue-100/90 border border-blue-200 rounded-xl flex items-center justify-center gap-2 text-stone-900 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Google Pay से पे</span>
              </button>

              {/* BHIM UPI Launcher */}
              <button
                type="button"
                onClick={() => handleLaunchUpi(bhimPayload)}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-emerald-950 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span>BHIM UPI से पे</span>
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                यदि बटन से एप्प न खुले, तो ऊपर दी गई <strong>UPI ID ({selectedHandle.vpa})</strong> या <strong>मोबाइल (9301056006)</strong> को कॉपी करके अपने PhonePe/GPay में "To UPI ID/Number" पर जाकर भेजें।
              </span>
            </div>
          </div>
        </div>

        {/* PAYMENT TROUBLESHOOTING GUIDE */}
        <div className="border border-stone-200 rounded-2xl overflow-hidden bg-stone-50/50 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="w-full flex items-center justify-between p-4 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">ℹ️</span>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-stone-800">भुगतान में सहायता चाहिए? (Payment Guide)</h4>
                <p className="text-[10px] sm:text-xs text-stone-500 font-medium">मैन्युअल यूपीआई ट्रांसफर के लिए निर्देश</p>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-600 border border-orange-200 px-2.5 py-1 rounded-lg bg-white shadow-2xs transition-all">
              {showTroubleshooting ? "छुपाएं (Hide)" : "मार्गदर्शिका खोलें (Show)"}
            </span>
          </button>

          {showTroubleshooting && (
            <div className="p-4 sm:p-5 border-t border-stone-200 space-y-4 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual Copy Panel */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                    <Copy className="w-3.5 h-3.5 text-orange-600" />
                    <span>मैन्युअल भुगतान के लिए विवरण</span>
                  </h5>
                  
                  <div className="space-y-2">
                    {/* Copy UPI ID */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-500 block">यूपीआई आईडी (UPI ID / VPA):</span>
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-2.5 shadow-2xs">
                        <span className="text-xs font-mono font-black text-stone-900 flex-1 truncate">{selectedHandle.vpa}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedHandle.vpa, "vpa")}
                          className="px-3 py-1.5 bg-[#E65100] hover:bg-orange-700 text-white rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1"
                        >
                          {copiedVpa ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedVpa ? "कॉपी हुआ" : "कॉपी"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Copy Amount */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-500 block">सटीक देय राशि (Amount to Pay):</span>
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-2.5 shadow-2xs">
                        <span className="text-xs font-mono font-black text-stone-900 flex-1">₹{totalAmount.toLocaleString("en-IN")}.00</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(totalAmount.toString(), "amount")}
                          className="px-3 py-1.5 bg-[#E65100] hover:bg-orange-700 text-white rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1"
                        >
                          {copiedAmount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedAmount ? "कॉपी हुआ" : "कॉपी"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Copy Note */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-500 block">ट्रांजैक्शन रिमार्क (Transaction Note):</span>
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-2.5 shadow-2xs">
                        <span className="text-xs font-mono font-black text-stone-900 flex-1 truncate">{cleanTxnNote}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cleanTxnNote, "note")}
                          className="px-3 py-1.5 bg-[#E65100] hover:bg-orange-700 text-white rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1"
                        >
                          {copiedNote ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedNote ? "कॉपी हुआ" : "कॉपी"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clear Step-by-Step Instructions */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                    <Info className="w-3.5 h-3.5 text-orange-600" />
                    <span>मैन्युअल भुगतान प्रक्रिया</span>
                  </h5>

                  <ol className="text-xs text-stone-600 space-y-2.5 list-decimal pl-4 font-medium leading-relaxed">
                    <li>ऊपर दी गई <strong>UPI ID</strong> कॉपी करें।</li>
                    <li>अपना पसंदीदा भुगतान एप्प (जैसे PhonePe, Paytm, Google Pay) खोलें।</li>
                    <li><strong>"To UPI ID/VPA"</strong> पर जाकर कॉपी की गई UPI ID पेस्ट करें।</li>
                    <li>सटीक राशि दर्ज करें और भुगतान पूर्ण करें।</li>
                    <li>भुगतान सफलता की स्क्रीन का <strong>स्क्रीनशॉट (Payment Screenshot)</strong> लें और नीचे अपलोड करें।</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: PAYMENT CONFIRMATION & SCREENSHOT SUBMISSION */}
        <div className="border-t border-stone-200 pt-5 space-y-4">
          {/* Screenshot Upload Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>भुगतान सफलता का स्क्रीनशॉट अपलोड करें <span className="text-red-500 font-bold">*</span>:</span>
              </label>
              <span className="text-[10px] text-stone-500">JPG, PNG (अधिकतम: 15MB)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-stone-50 p-4 border border-stone-200 rounded-xl">
              <div className="relative shrink-0">
                <input
                  id="payment-screenshot-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <label
                  htmlFor="payment-screenshot-file"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-orange-500 bg-white hover:bg-orange-50/20 rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] w-40 h-28 text-center"
                >
                  <div className="flex flex-col items-center text-center space-y-1">
                    <span className="text-xl">📷</span>
                    <span className="text-[11px] font-bold text-stone-700">स्क्रीनशॉट चुनें</span>
                    <span className="text-[9px] text-stone-400">Choose Image</span>
                  </div>
                </label>
              </div>

              <div className="flex-1 w-full text-center sm:text-left">
                {isUploading && (
                  <p className="text-xs text-orange-600 font-bold flex items-center justify-center sm:justify-start gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    अपलोड हो रहा है... कृपया प्रतीक्षा करें
                  </p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-600 font-bold">
                    ⚠️ त्रुटि: {uploadError}
                  </p>
                )}
                {screenshotUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-600 font-bold flex items-center justify-center sm:justify-start gap-1">
                      ✓ स्क्रीनशॉट सफलतापूर्वक अपलोड हुआ!
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-3">
                      <img
                        src={screenshotUrl}
                        alt="Screenshot Preview"
                        className="h-16 w-auto border object-contain rounded bg-white p-0.5"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshotUrl("")}
                        className="text-[11px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        हटाएँ (Remove)
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 leading-normal">
                    भुगतान एप्प (जैसे PhonePe/GPay) में ट्रांजैक्शन पूर्ण होने के बाद स्क्रीनशॉट लें और यहाँ अपलोड करें। सत्यापन के लिए यह अत्यंत आवश्यक है।
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || isUploading}
            className="w-full bg-[#E65100] hover:bg-orange-700 disabled:bg-stone-300 text-white font-black py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                विवरण सबमिट हो रहा है...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>मैंने भुगतान कर दिया है • भुगतान सबमिट करें</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-stone-400 font-medium">
            भुगतान स्क्रीनशॉट सबमिट होने के बाद एडमिन द्वारा जांच की जाएगी। स्वीकृत होने पर डिजिटल इनवॉइस स्वतः मिल जाएगी।
          </p>
        </div>
      </div>
    </div>
  );
}
