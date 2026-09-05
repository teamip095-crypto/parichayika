import React, { useState, useEffect } from "react";
import {
  Heart,
  Building,
  ArrowLeft,
  ShoppingCart,
  CheckCircle,
  FileText,
  HelpCircle,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Hash,
  Loader2,
  Trash2,
  User,
  Plus,
  Send,
  Upload as UploadIcon,
  Sparkles,
  ChevronRight,
  BookOpen,
  CreditCard,
  Phone,
  Eye,
  EyeOff,
  Smartphone,
  Printer,
  Maximize2,
  Store,
  Gift,
  MessageSquare,
  Camera,
  AlertCircle,
  Info,
  X,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ArrowRight,
  Pencil
} from "lucide-react";
import TransliteratedInput from "./components/TransliteratedInput";
import DateOfBirthInput from "./components/DateOfBirthInput";
import PaymentGatewayModal from "./components/PaymentGatewayModal";
import InvoicePDF from "./components/InvoicePDF";
import AdminPanel from "./components/AdminPanel";
import { formatDobToDDMMYYYY } from "./dateUtils";
import {
  District,
  Sangathan,
  Magazine,
  Edition,
  AdvertisementSize,
  Publication,
  MatrimonyFormState,
  BusinessFormState,
  CartItem,
  Order
} from "./types";

export function formatDegreesToHindi(text: string): string {
  if (!text) return text;
  let result = text;
  
  const mappings = [
    { keys: ["b\\.com", "bcom", "बीकॉम", "बी\\. कॉम", "बी\\. कॉम\\."], hindi: "बी.कॉम." },
    { keys: ["m\\.a", "ma", "एमए", "एम\\. ए", "एम\\. ए\\."], hindi: "एम.ए." },
    { keys: ["b\\.a", "ba", "बीए", "बी\\. ए", "बी\\. ए\\."], hindi: "बी.ए." },
    { keys: ["bca", "बीसीए"], hindi: "बीसीए" },
    { keys: ["mca", "एमसीए"], hindi: "एमसीए" },
    { keys: ["mba", "एमबीए"], hindi: "एमबीए" },
    { keys: ["b\\.sc", "bsc", "बीएससी", "बी\\. एससी", "बी\\. एससी\\."], hindi: "बी.एससी." },
    { keys: ["m\\.sc", "msc", "एमएससी", "एम\\. एससी", "एम\\. एससी\\."], hindi: "एम.एससी." },
    { keys: ["b\\.tech", "btech", "बीटेक", "बी\\. टेक", "बी\\. टेक\\."], hindi: "बी.टेक." },
    { keys: ["m\\.tech", "mtech", "एमटेक", "एम\\. टेक", "एम\\. टेक\\."], hindi: "एम.टेक." },
    { keys: ["ph\\.d", "phd", "पीएचडी", "पीएच\\. डी", "पीएच\\. डी\\."], hindi: "पीएच.डी." },
    { keys: ["b\\.ed", "bed", "बीएड", "बी\\. एड", "बी\\. एड\\."], hindi: "बी.एड." }
  ];

  for (const map of mappings) {
    for (const key of map.keys) {
      const regex = new RegExp(`(?<=^|[^a-zA-Z\\u0900-\\u097F])${key}(?=$|[^a-zA-Z\\u0900-\\u097F])`, "gi");
      result = result.replace(regex, map.hindi);
    }
  }

  return result;
}

export default function App() {
  // Navigation Screens: 'home' | 'matrimony_form' | 'business_form' | 'cart' | 'checkout' | 'invoice' | 'admin'
  const [screen, setScreen] = useState<"home" | "matrimony_form" | "business_form" | "cart" | "checkout" | "invoice" | "admin">(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path === "/admin" ||
        path.startsWith("/admin/") ||
        hash === "#admin" ||
        search.includes("screen=admin") ||
        search.includes("token=")
      ) {
        return "admin";
      }
    }
    return "home";
  });

  // Masters State loaded from Server
  const [masters, setMasters] = useState<{
    districts: District[];
    sangathans: Sangathan[];
    magazines: Magazine[];
    editions: Edition[];
    sizes: AdvertisementSize[];
    publications: Publication[];
    pricings: any[];
  }>({
    districts: [],
    sangathans: [],
    magazines: [],
    editions: [],
    sizes: [],
    publications: [],
    pricings: []
  });

  const [userConfigs, setUserConfigs] = useState<any[]>([]);

  // Client Session ID for Persistent Shopping Cart
  const [sessionId, setSessionId] = useState("");

  const getEffectiveSessionId = () => {
    let sId = sessionId;
    if (!sId || typeof sId !== "string" || sId.trim() === "") {
      sId = localStorage.getItem("parichayika_session_id") || "";
    }
    if (!sId || sId.trim() === "") {
      sId = `SESS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        localStorage.setItem("parichayika_session_id", sId);
      } catch {}
      setSessionId(sId);
    }
    return sId.trim();
  };

  // Cart State (loaded from server + local fallback)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  // Form selections and data structures
  const [selectedPubId, setSelectedPubId] = useState("");
  const [selectedSizeCode, setSelectedSizeCode] = useState("");

  // Files upload loading helpers
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // 1. Matrimony Form Initial State
  const [matrimonyForm, setMatrimonyForm] = useState<MatrimonyFormState>({
    name: "",
    dob: "",
    height: "",
    blood_group: "",
    gotra: "",
    education: "",
    occupation: "",
    father_name: "",
    father_occupation: "",
    mother_name: "",
    mobile1: "",
    mobile2: "",
    whatsapp: "",
    currentAddress: "",
    permanentAddress: "",
    photoUrl: "",
    biodataUrl: "",
    district_id: "",
    sangathan_id: "",
    magazine_id: "",
    edition_id: ""
  });

  // 2. Business Form Initial State
  const [businessForm, setBusinessForm] = useState<BusinessFormState>({
    businessName: "",
    ownerName: "",
    category: "",
    businessDesc: "",
    productsServices: "",
    specialOffer: "",
    keyFeatures: "",
    mobile1: "",
    mobile2: "",
    whatsapp: "",
    email: "",
    businessAddress: "",
    otherAddress: "",
    logoUrl: "",
    photoUrl: "",
    readyAdUrl: "",
    district_id: "",
    sangathan_id: "",
    magazine_id: "",
    edition_id: "",
    size_code: ""
  });

  // Active form previews / Ad Maker states
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isAdMakerOpen, setIsAdMakerOpen] = useState(false);

  const uniqueDistricts = Array.from(new Set([
    ...userConfigs.map(c => c.district),
    ...masters.publications.map(p => p.district_hi)
  ])).filter(Boolean);

  const uniqueSangathans = Array.from(new Set([
    ...userConfigs.map(c => c.sangathan),
    ...masters.publications.map(p => p.sangathan_hi)
  ])).filter(Boolean);

  // New step-by-step wizard states with saved Ad IDs & numbers
  const [matrimonyStep, setMatrimonyStep] = useState<number>(1);
  const [businessStep, setBusinessStep] = useState<1 | 2 | 3>(1);
  const [showMatrimonyAdMaker, setShowMatrimonyAdMaker] = useState(false);
  const [savedAdId, setSavedAdId] = useState<number | null>(null);
  const [savedAdNumber, setSavedAdNumber] = useState("");
  const [nextMatrimonyAdNum, setNextMatrimonyAdNum] = useState("001");
  const [nextBusinessAdNum, setNextBusinessAdNum] = useState("BUS-001 / परिचायिका");
  const [savedPrice, setSavedPrice] = useState(500);

  // In-app Toast Notification state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Business Ad Workflow States (Full / Half / Quarter + ChatGPT Prompt + Design Link + Final JPG + Shared Master + Pricing)
  const [businessSelectedSize, setBusinessSelectedSize] = useState<"business_full" | "business_half" | "business_quarter">("business_full");
  const [businessDesignLink, setBusinessDesignLink] = useState("");
  const [businessUploadedJpgUrl, setBusinessUploadedJpgUrl] = useState("");
  const [businessPublications, setBusinessPublications] = useState<{
    district_id: number | "";
    sangathan_id: number | "";
    magazine_id: number | "";
    edition_id: number | "";
  }[]>([
    { district_id: "", sangathan_id: "", magazine_id: "", edition_id: "" }
  ]);
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [isSubmittingBusiness, setIsSubmittingBusiness] = useState(false);

  // Matrimony Multi-Publication Workflow States
  const [matrimonyPublications, setMatrimonyPublications] = useState<{
    district_id: number | "";
    sangathan_id: number | "";
    magazine_id: number | "";
    edition_id: number | "";
    size_code?: string;
  }[]>([
    { district_id: "", sangathan_id: "", magazine_id: "", edition_id: "", size_code: "matrimony_standard" }
  ]);
  const [isSubmittingMatrimony, setIsSubmittingMatrimony] = useState(false);

  const BUSINESS_PROMPTS = {
    business_full: `मेरे द्वारा दी गई जानकारी, uploaded Logo और Photos को design में उचित तरीके से इस्तेमाल करें। सभी colors और images केवल CMYK में हों, कोई RGB न हो। छोटे/fine black text हमेशा C0 M0 Y0 K100 हों। Background साफ और readable हो। Text, photos, logo और fine details sharp और print-friendly हों। Final Output: केवल high-quality CMYK JPG, दिए गए exact size 7.2 × 9.6 इंच और 300 DPI में। PDF, PNG या RGB output नहीं चाहिए।`,

    business_half: `मेरे द्वारा दी गई जानकारी, uploaded Logo और Photos को design में उचित तरीके से इस्तेमाल करें। सभी colors और images केवल CMYK में हों, कोई RGB न हो। छोटे/fine black text हमेशा C0 M0 Y0 K100 हों। Background साफ और readable हो। Text, photos, logo और fine details sharp और print-friendly हों। Final Output: केवल high-quality CMYK JPG, दिए गए exact size 7.2 × 4.8 इंच और 300 DPI में। PDF, PNG या RGB output नहीं चाहिए।`,

    business_quarter: `मेरे द्वारा दी गई जानकारी, uploaded Logo और Photos को design में उचित तरीके से इस्तेमाल करें। सभी colors और images केवल CMYK में हों, कोई RGB न हो। छोटे/fine black text हमेशा C0 M0 Y0 K100 हों। Background साफ और readable हो। Text, photos, logo और fine details sharp और print-friendly हों। Final Output: केवल high-quality CMYK JPG, दिए गए exact size 3.6 × 4.8 इंच और 300 DPI में। PDF, PNG या RGB output नहीं चाहिए।`
  };

  const BUSINESS_SIZES_INFO = {
    business_full: {
      name: "FULL PAGE",
      nameHi: "FULL PAGE (पूरा पृष्ठ)",
      sizeLabel: "Size: 7.2 × 9.6 इंच | 300 DPI | CMYK JPG",
      dimensions: "7.2 × 9.6 इंच",
      uploadTitle: "CMYK JPG — 7.2 × 9.6 इंच — 300 DPI",
      description: "भव्य और संपूर्ण पत्रिका पृष्ठ, बड़े शोरूम व प्रमुख ब्रांडिंग हेतु।"
    },
    business_half: {
      name: "HALF PAGE",
      nameHi: "HALF PAGE (आधा पृष्ठ)",
      sizeLabel: "Size: 7.2 × 4.8 इंच | 300 DPI | CMYK JPG",
      dimensions: "7.2 × 4.8 इंच",
      uploadTitle: "CMYK JPG — 7.2 × 4.8 इंच — 300 DPI",
      description: "संतुलित हॉरिजॉन्टल लेआउट, उत्पादों व संपर्क विवरण के लिए उपयुक्त।"
    },
    business_quarter: {
      name: "QUARTER PAGE",
      nameHi: "QUARTER PAGE (चौथाई पृष्ठ)",
      sizeLabel: "Size: 3.6 × 4.8 इंच | 300 DPI | CMYK JPG",
      dimensions: "3.6 × 4.8 इंच",
      uploadTitle: "CMYK JPG — 3.6 × 4.8 इंच — 300 DPI",
      description: "कॉम्पैक्ट एवं प्रभावशाली, व्यापार कार्ड एवं मुख्य सेवाओं हेतु।"
    }
  };

  const handleCopyPrompt = async (key: "business_full" | "business_half" | "business_quarter") => {
    const promptText = BUSINESS_PROMPTS[key];
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = promptText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedPromptKey(key);
      showToast("✓ ChatGPT प्रॉम्ट क्लिपबोर्ड में कॉपी हो गया!", "success");
      setTimeout(() => {
        setCopiedPromptKey((curr) => (curr === key ? null : curr));
      }, 3000);
    } catch (err) {
      showToast("कॉपी करने में समस्या आई, कृपया मैन्युअली कॉपी करें।", "error");
    }
  };

  // Helper to calculate rate per publication selection for matrimony based on Admin Master Pricings
  const getMatrimonyPublicationRate = (
    districtId?: number | string,
    sangathanId?: number | string,
    magazineId?: number | string,
    editionId?: number | string,
    sizeCode?: string
  ): number => {
    // FIX: PostgreSQL NUMERIC columns return price as string; coerce to Number.
    // FIX: When admin has NOT set a price, return 0 (NOT 500 fallback) —
    // prevents false/fake pricing data from appearing. Admin must explicitly
    // set prices in dashboard for rates to show.
    const toNum = (v: any): number => {
      const n = Number(v);
      return isNaN(n) || !isFinite(n) ? 0 : n;
    };

    if (!districtId || !sangathanId) return 0;
    const targetSize = sizeCode || "matrimony_standard";
    const match = masters.pricings?.find(
      (p) =>
        p.adv_type_code === "matrimony" &&
        p.adv_size_code === targetSize &&
        p.district_id === Number(districtId) &&
        p.sangathan_id === Number(sangathanId) &&
        (!magazineId || p.magazine_id === Number(magazineId)) &&
        (!editionId || p.edition_id === Number(editionId))
    );
    if (match && toNum(match.price) > 0) return toNum(match.price);

    const matchDistSang = masters.pricings?.find(
      (p) =>
        p.adv_type_code === "matrimony" &&
        p.district_id === Number(districtId) &&
        p.sangathan_id === Number(sangathanId)
    );
    if (matchDistSang && toNum(matchDistSang.price) > 0) return toNum(matchDistSang.price);

    const def = masters.pricings?.find(
      (p) => p.adv_type_code === "matrimony" && p.adv_size_code === targetSize
    );
    if (def && toNum(def.price) > 0) return toNum(def.price);
    // FIX: Return 0 when no admin-set price exists (was returning 500 — fake default)
    return 0;
  };

  const handleAddMatrimonyPublicationRow = () => {
    const defaultDist = masters.districts[0];
    const defaultSang = defaultDist ? masters.sangathans.find(s => s.district_id === defaultDist.id) || masters.sangathans[0] : null;
    const defaultMag = masters.magazines[0];
    const defaultEd = masters.editions[0];
    setMatrimonyPublications((prev) => [
      ...prev,
      {
        district_id: defaultDist ? defaultDist.id : "",
        sangathan_id: defaultSang ? defaultSang.id : "",
        magazine_id: defaultMag ? defaultMag.id : "",
        edition_id: defaultEd ? defaultEd.id : "",
        size_code: "matrimony_standard"
      }
    ]);
  };

  const handleRemoveMatrimonyPublicationRow = (index: number) => {
    if (matrimonyPublications.length <= 1) return;
    setMatrimonyPublications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMatrimonyPublicationRow = (index: number, field: string, value: any) => {
    setMatrimonyPublications((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "district_id") {
          const firstMatchingSangathan = masters.sangathans.find((s) => s.district_id === Number(value));
          updated.sangathan_id = firstMatchingSangathan ? firstMatchingSangathan.id : "";
        } else if (field === "magazine_id") {
          const firstMatchingEdition = masters.editions.find((ed) => ed.magazine_id === Number(value));
          updated.edition_id = firstMatchingEdition ? firstMatchingEdition.id : "";
        }
        return updated;
      })
    );
  };

  // Helper to calculate rate per publication selection for business based on Admin Master Pricings
  const getBusinessPublicationRate = (sizeCode: string, districtId: number | string, sangathanId: number | string): number => {
    // FIX: PostgreSQL NUMERIC returns price as string; coerce to Number.
    // FIX: When admin has NOT set a price, return 0 (NOT hardcoded fallback) —
    // admin must set prices explicitly in dashboard.
    const toNum = (v: any): number => {
      const n = Number(v);
      return isNaN(n) || !isFinite(n) ? 0 : n;
    };

    if (!districtId || !sangathanId) return 0;
    const match = masters.pricings?.find(
      (p) =>
        p.adv_type_code === "business" &&
        p.adv_size_code === sizeCode &&
        p.district_id === Number(districtId) &&
        p.sangathan_id === Number(sangathanId)
    );
    if (match) return toNum(match.price);
    const def = masters.pricings?.find(
      (p) => p.adv_type_code === "business" && p.adv_size_code === sizeCode
    );
    if (def) return toNum(def.price);
    // FIX: Return 0 when no admin-set price exists (was returning 5000/3000/1500 — fake defaults)
    return 0;
  };

  const handleBusinessJpgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast("कृपया 20 MB से कम आकार की फ़ाइल चुनें।", "error");
      return;
    }
    setUploadingField("business_jpg");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setBusinessUploadedJpgUrl(data.url);
        showToast("✓ फ़ाइनल विज्ञापन JPG सफलतापूर्वक अपलोड हुआ!", "success");
      } else {
        const err = await res.json();
        showToast("अपलोड विफल: " + (err.error || "सर्वर त्रुटि"), "error");
      }
    } catch (err: any) {
      showToast("अपलोड त्रुटि: " + err.message, "error");
    } finally {
      setUploadingField(null);
    }
  };

  const handleAddPublicationRow = () => {
    const defaultDist = masters.districts[0];
    const defaultSang = defaultDist ? masters.sangathans.find(s => s.district_id === defaultDist.id) || masters.sangathans[0] : null;
    const defaultMag = masters.magazines[0];
    const defaultEd = masters.editions[0];
    setBusinessPublications((prev) => [
      ...prev,
      {
        district_id: defaultDist ? defaultDist.id : "",
        sangathan_id: defaultSang ? defaultSang.id : "",
        magazine_id: defaultMag ? defaultMag.id : "",
        edition_id: defaultEd ? defaultEd.id : ""
      }
    ]);
  };

  const handleRemovePublicationRow = (index: number) => {
    if (businessPublications.length <= 1) return;
    setBusinessPublications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePublicationRow = (index: number, field: string, value: any) => {
    setBusinessPublications((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "district_id") {
          const firstMatchingSangathan = masters.sangathans.find((s) => s.district_id === Number(value));
          updated.sangathan_id = firstMatchingSangathan ? firstMatchingSangathan.id : "";
        }
        return updated;
      })
    );
  };

  const handleAddBusinessToCart = async () => {
    if (!businessDesignLink.trim() && !businessUploadedJpgUrl) {
      showToast("कृपया डिज़ाइन लिंक दर्ज करें या फ़ाइनल JPG फ़ाइल अपलोड करें।", "error");
      return;
    }

    const validPubs = businessPublications.filter(
      (p) => p.district_id && p.sangathan_id && p.magazine_id && p.edition_id
    );
    if (validPubs.length === 0) {
      showToast("कृपया कम से कम एक वैध प्रकाशन संयोजन (जिला, संगठन, पत्रिका, संस्करण) चुनें।", "error");
      return;
    }

    setIsSubmittingBusiness(true);
    try {
      const currentSessionId = getEffectiveSessionId();
      const res = await fetch("/api/cart/add-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          sizeCode: businessSelectedSize,
          designLink: businessDesignLink.trim(),
          uploadedJpgUrl: businessUploadedJpgUrl,
          publications: validPubs
        })
      });

      if (res.ok) {
        await fetchCart();
        showToast("सफलता: व्यवसाय विज्ञापन कार्ट में जोड़ दिया गया है!", "success");
        setBusinessDesignLink("");
        setBusinessUploadedJpgUrl("");
        setScreen("cart");
      } else {
        const err = await res.json();
        showToast("त्रुटि: " + (err.error || "कार्ट में जोड़ने में समस्या"), "error");
      }
    } catch (err: any) {
      showToast("नेटवर्क त्रुटि: " + err.message, "error");
    } finally {
      setIsSubmittingBusiness(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Helper to fetch live next ad number from database
  const fetchNextAdNumbers = async () => {
    try {
      const rMat = await fetch("/api/advertisements/next-ad-number?type=matrimony");
      if (rMat.ok) {
        const d = await rMat.json().catch(() => null);
        if (d && d.nextAdNumber) setNextMatrimonyAdNum(d.nextAdNumber);
      }
    } catch (e) {
      console.warn("Could not fetch next matrimony ad number:", e);
    }

    try {
      const rBus = await fetch("/api/advertisements/next-ad-number?type=business");
      if (rBus.ok) {
        const d = await rBus.json().catch(() => null);
        if (d && d.nextAdNumber) setNextBusinessAdNum(d.nextAdNumber);
      }
    } catch (e) {
      console.warn("Could not fetch next business ad number:", e);
    }
  };

  // Checkout and Order Response
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    totalAmount: number;
    paymentStatus: string;
    upiPayload: string;
    recipientPhone: string;
  } | null>(null);

  // Payment proof reference input
  const [paymentRef, setPaymentRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  // Initializing Client Session & Masters
  useEffect(() => {
    // Session Setup
    let sId = localStorage.getItem("parichayika_session_id");
    if (!sId) {
      sId = `SESS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem("parichayika_session_id", sId);
    }
    setSessionId(sId);

    // Fetch Masters from Backend API
    fetch("/api/masters")
      .then((res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((data) => {
        if (!data) return;
        const districts = data.districts || [];
        const sangathans = data.sangathans || [];
        const magazines = data.magazines || [];
        const editions = data.editions || [];
        setMasters({
          districts,
          sangathans,
          magazines,
          editions,
          sizes: data.sizes || [],
          publications: data.publications || [],
          pricings: data.pricings || []
        });

        // Initialize default publication row if empty
        if (districts.length > 0) {
          const firstDist = districts[0];
          const firstSang = sangathans.find((s: any) => s.district_id === firstDist.id) || sangathans[0];
          const firstMag = magazines[0];
          const firstEd = editions[0];
          setBusinessPublications([
            {
              district_id: firstDist ? firstDist.id : "",
              sangathan_id: firstSang ? firstSang.id : "",
              magazine_id: firstMag ? firstMag.id : "",
              edition_id: firstEd ? firstEd.id : ""
            }
          ]);
          setMatrimonyPublications([
            {
              district_id: firstDist ? firstDist.id : "",
              sangathan_id: firstSang ? firstSang.id : "",
              magazine_id: firstMag ? firstMag.id : "",
              edition_id: firstEd ? firstEd.id : "",
              size_code: "matrimony_standard"
            }
          ]);
        }
      })
      .catch((err) => console.warn("Error fetching masters:", err));

    // Fetch Admin Configurations
    fetch("/api/admin/configurations")
      .then((res) => {
        if (!res.ok) return [];
        return res.json().catch(() => []);
      })
      .then((data) => {
        setUserConfigs(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.warn("Error fetching configurations:", err));

    // Fetch initial next ad numbers
    fetchNextAdNumbers();

    // Listen to browser navigation / history changes for /admin
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path === "/admin" ||
        path.startsWith("/admin/") ||
        hash === "#admin" ||
        search.includes("screen=admin") ||
        search.includes("token=")
      ) {
        setScreen("admin");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Dynamic custom fields definitions loaded from backend
  const [dynFields, setDynFields] = useState<{ matrimony: any[]; business: any[] }>({ matrimony: [], business: [] });

  useEffect(() => {
    fetch("/api/custom-fields/matrimony")
      .then(r => r.ok ? r.json().catch(() => []) : [])
      .then(d => setDynFields(prev => ({ ...prev, matrimony: Array.isArray(d) ? d : [] })))
      .catch(e => console.warn(e));

    fetch("/api/custom-fields/business")
      .then(r => r.ok ? r.json().catch(() => []) : [])
      .then(d => setDynFields(prev => ({ ...prev, business: Array.isArray(d) ? d : [] })))
      .catch(e => console.warn(e));
  }, []);

  // Fetch Cart Items whenever screen transitions to cart or sessionId loads
  useEffect(() => {
    fetchCart();
  }, [sessionId, screen]);

  const fetchCart = async () => {
    const sId = getEffectiveSessionId();
    if (!sId) return;
    setIsLoadingCart(true);
    try {
      const res = await fetch(`/api/cart?sessionId=${encodeURIComponent(sId)}`);
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setCart(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Failed to load cart:", err);
    } finally {
      setIsLoadingCart(false);
    }
  };

  // Synchronize dynamic details of publication selection into forms
  const handlePubSelectionChange = (pubId: string, formType: "matrimony" | "business") => {
    setSelectedPubId(pubId);
    if (pubId && typeof pubId === "string" && pubId.startsWith("CONF-")) {
      const conf = userConfigs.find((c) => c.configuration_id === pubId);
      if (conf) {
        if (formType === "matrimony") {
          setMatrimonyForm((prev) => ({
            ...prev,
            district_id: "999",
            sangathan_id: "999",
            magazine_id: "999",
            edition_id: "999",
            district_hi: conf.district,
            sangathan_hi: conf.sangathan,
            magazine_hi: conf.magazine,
            edition_hi: conf.edition
          }));
        } else {
          setBusinessForm((prev) => ({
            ...prev,
            district_id: "999",
            sangathan_id: "999",
            magazine_id: "999",
            edition_id: "999",
            district_hi: conf.district,
            sangathan_hi: conf.sangathan,
            magazine_hi: conf.magazine,
            edition_hi: conf.edition
          }));
        }
      }
      return;
    }

    const pub = masters.publications.find((p) => String(p.id) === pubId);
    if (pub) {
      if (formType === "matrimony") {
        setMatrimonyForm((prev) => ({
          ...prev,
          district_id: String(pub.district_id),
          sangathan_id: String(pub.sangathan_id),
          magazine_id: String(pub.magazine_id),
          edition_id: String(pub.edition_id),
          district_hi: pub.district_hi,
          sangathan_hi: pub.sangathan_hi,
          magazine_hi: pub.magazine_hi,
          edition_hi: pub.edition_hi
        }));
      } else {
        setBusinessForm((prev) => ({
          ...prev,
          district_id: String(pub.district_id),
          sangathan_id: String(pub.sangathan_id),
          magazine_id: String(pub.magazine_id),
          edition_id: String(pub.edition_id),
          district_hi: pub.district_hi,
          sangathan_hi: pub.sangathan_hi,
          magazine_hi: pub.magazine_hi,
          edition_hi: pub.edition_hi
        }));
      }
    } else {
      if (formType === "matrimony") {
        setMatrimonyForm((prev) => ({
          ...prev,
          district_id: "",
          sangathan_id: "",
          magazine_id: "",
          edition_id: "",
          district_hi: "",
          sangathan_hi: "",
          magazine_hi: "",
          edition_hi: ""
        }));
      } else {
        setBusinessForm((prev) => ({
          ...prev,
          district_id: "",
          sangathan_id: "",
          magazine_id: "",
          edition_id: "",
          district_hi: "",
          sangathan_hi: "",
          magazine_hi: "",
          edition_hi: ""
        }));
      }
    }
  };

  // Upload status and retry helpers
  const [lastSelectedFiles, setLastSelectedFiles] = useState<{ [key: string]: File }>({});
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  const [uploadSuccesses, setUploadSuccesses] = useState<{ [key: string]: boolean }>({});

  // Secure, Fail-Safe File Uploading client pipeline with instant thumbnail preview and base64 fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | null, fieldName: string, fileObject?: File) => {
    const file = fileObject || e?.target?.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file works
    if (e?.target) {
      e.target.value = "";
    }

    // Cache file for retries
    setLastSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));

    // File size validation (up to 25MB)
    if (file.size > 25 * 1024 * 1024) {
      showToast("कृपया 25 MB से कम आकार की फ़ोटो चुनें।", "error");
      return;
    }

    setUploadingField(fieldName);
    setUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));
    setUploadSuccesses((prev) => ({ ...prev, [fieldName]: false }));

    // Instant local preview via FileReader
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = (event.target?.result as string) || "";

      // Layer 1: Attempt standard multipart upload
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            if (screen === "matrimony_form") {
              setMatrimonyForm((prev) => ({ ...prev, [fieldName]: data.url }));
            } else if (screen === "business_form") {
              setBusinessForm((prev) => ({ ...prev, [fieldName]: data.url }));
            }
            setUploadSuccesses((prev) => ({ ...prev, [fieldName]: true }));
            showToast("✓ फोटो सफलतापूर्वक अपलोड हो गई!", "success");
            setUploadingField(null);
            return;
          }
        }
      } catch (uploadErr) {
        console.warn("Multipart upload network error, trying base64 fallback...", uploadErr);
      }

      // Layer 2: Attempt base64 JSON upload
      if (base64Data) {
        try {
          const resJson = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: base64Data, filename: file.name })
          });
          if (resJson.ok) {
            const data = await resJson.json();
            if (data.url) {
              if (screen === "matrimony_form") {
                setMatrimonyForm((prev) => ({ ...prev, [fieldName]: data.url }));
              } else if (screen === "business_form") {
                setBusinessForm((prev) => ({ ...prev, [fieldName]: data.url }));
              }
              setUploadSuccesses((prev) => ({ ...prev, [fieldName]: true }));
              showToast("✓ फोटो सफलतापूर्वक अपलोड हो गई!", "success");
              setUploadingField(null);
              return;
            }
          }
        } catch (jsonErr) {
          console.warn("Base64 upload endpoint also failed:", jsonErr);
        }

        // ❌ OLD Layer 3 (REMOVED): silently stored base64 data URL in form state.
        // This caused 717KB-3.7MB base64 strings to be persisted in PostgreSQL
        // (matrimony_profiles.photo_url, advertisements.uploaded_jpg_url, order_items),
        // bloating the database by 74 MB across just 9 records.
        // It also broke production — admin panel couldn't display these data URLs
        // reliably, and Supabase Storage URLs were never generated for real.
        //
        // ✅ NEW: Surface the real upload failure to the user. They can retry
        // or contact support — instead of silently proceeding with a broken
        // base64 string that masquerades as a successful upload.
        setUploadErrors((prev) => ({ ...prev, [fieldName]: "फोटो अपलोड करने में समस्या आई। कृपया पुनः प्रयास करें या सपोर्ट से संपर्क करें।" }));
        showToast("❌ फोटो अपलोड विफल। कृपया पुनः प्रयास करें।", "error");
      } else {
        setUploadErrors((prev) => ({ ...prev, [fieldName]: "फोटो अपलोड करने में समस्या आई। कृपया पुनः प्रयास करें।" }));
        showToast("फोटो अपलोड करने में समस्या आई।", "error");
      }
      setUploadingField(null);
    };

    reader.onerror = () => {
      setUploadErrors((prev) => ({ ...prev, [fieldName]: "फ़ाइल पढ़ने में त्रुटि।" }));
      showToast("फ़ाइल पढ़ने में त्रुटि।", "error");
      setUploadingField(null);
    };

    reader.readAsDataURL(file);
  };

  const handleUploadRetry = (fieldName: string) => {
    const file = lastSelectedFiles[fieldName];
    if (file) {
      handleFileUpload(null, fieldName, file);
    } else {
      showToast("कृपया फ़ाइल पुनः चुनें।", "info");
    }
  };

  const handleUploadRemove = (fieldName: string) => {
    if (screen === "matrimony_form") {
      setMatrimonyForm((prev) => ({ ...prev, [fieldName]: "" }));
    } else if (screen === "business_form") {
      setBusinessForm((prev) => ({ ...prev, [fieldName]: "" }));
    }
    setUploadSuccesses((prev) => ({ ...prev, [fieldName]: false }));
    setUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));
    setLastSelectedFiles((prev) => {
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  // Server Calculated authorative price finder
  const getCalculatedPrice = (adType: "matrimony" | "business", sizeCode?: string): number => {
    if (selectedPubId && typeof selectedPubId === "string" && selectedPubId.startsWith("CONF-")) {
      const conf = userConfigs.find((c) => c.configuration_id === selectedPubId);
      if (conf) return conf.pricing;
    }
    const pub = masters.publications.find((p) => String(p.id) === selectedPubId);
    if (!pub) return adType === "matrimony" ? 500 : 1500;

    // Search matches inside masters.pricings
    const targetSize = adType === "matrimony" ? "matrimony_standard" : (sizeCode || "business_full");
    
    // In-memory lookup based on priced combinations
    if (adType === "matrimony") return pub.district_id === 1 ? 500 : pub.district_id === 2 ? 450 : 400;
    
    // Business rates depending on full, half, quarter size
    switch (targetSize) {
      case "business_full": return pub.district_id === 1 ? 5000 : 4500;
      case "business_half": return pub.district_id === 1 ? 3000 : 2500;
      case "business_quarter": return pub.district_id === 1 ? 1500 : 1200;
      default: return pub.district_id === 1 ? 2500 : 2000;
    }
  };

  const validateMobile = (num: string): boolean => {
    const clean = num.replace(/[^0-9]/g, "");
    return clean.length === 10;
  };

  // Step-by-step navigation helpers for Matrimony Form
  const handleNextMatrimonyStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!matrimonyForm.name?.trim()) {
        showToast("कृपया युवक-युवती का नाम अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.dob?.trim()) {
        showToast("कृपया जन्म तिथि अवश्य चुनें।", "error");
        return;
      }
      if (!matrimonyForm.height?.trim()) {
        showToast("कृपया ऊँचाई अवश्य दर्ज करें (उदा. 5.4 ft)।", "error");
        return;
      }
      if (!matrimonyForm.blood_group?.trim()) {
        showToast("कृपया रक्त समूह अवश्य दर्ज करें (उदा. B+, O+)।", "error");
        return;
      }
      if (!matrimonyForm.gotra?.trim()) {
        showToast("कृपया गोत्र अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.occupation?.trim()) {
        showToast("कृपया व्यवसाय/नौकरी अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.education?.trim()) {
        showToast("कृपया विस्तृत शैक्षणिक योग्यता अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.photoUrl?.trim()) {
        showToast("कृपया युवक/युवती का पासपोर्ट फोटो अवश्य अपलोड करें।", "error");
        return;
      }
      setMatrimonyStep(2);
    } else if (currentStep === 2) {
      if (!matrimonyForm.father_name?.trim()) {
        showToast("कृपया पिता का नाम अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.father_occupation?.trim()) {
        showToast("कृपया पिता का व्यवसाय अवश्य भरें।", "error");
        return;
      }
      if (!matrimonyForm.mother_name?.trim()) {
        showToast("कृपया माता का नाम अवश्य भरें।", "error");
        return;
      }
      setMatrimonyStep(3);
    }
  };

  const handlePrevMatrimonyStep = () => {
    if (matrimonyStep > 1) {
      setMatrimonyStep(matrimonyStep - 1);
    } else {
      setScreen("home");
    }
  };

  // Matrimony Form: Validate Details and Save directly to DB -> Proceed to Step 4 (Visual Preview)
  const handleMatrimonySave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Step 1 Validation
    if (!matrimonyForm.name?.trim()) {
      showToast("कृपया युवक-युवती का नाम अवश्य भरें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.dob?.trim()) {
      showToast("कृपया जन्म तिथि अवश्य चुनें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.height?.trim()) {
      showToast("कृपया ऊँचाई अवश्य दर्ज करें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.blood_group?.trim()) {
      showToast("कृपया रक्त समूह अवश्य दर्ज करें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.gotra?.trim()) {
      showToast("कृपया गोत्र अवश्य भरें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.occupation?.trim()) {
      showToast("कृपया व्यवसाय/नौकरी अवश्य भरें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.education?.trim()) {
      showToast("कृपया शैक्षणिक योग्यता अवश्य भरें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }
    if (!matrimonyForm.photoUrl?.trim()) {
      showToast("कृपया युवक/युवती का फोटो अवश्य अपलोड करें (चरण 1)।", "error");
      setMatrimonyStep(1);
      return;
    }

    // Step 2 Validation
    if (!matrimonyForm.father_name?.trim()) {
      showToast("कृपया पिता का नाम अवश्य भरें (चरण 2)।", "error");
      setMatrimonyStep(2);
      return;
    }
    if (!matrimonyForm.father_occupation?.trim()) {
      showToast("कृपया पिता का व्यवसाय अवश्य भरें (चरण 2)।", "error");
      setMatrimonyStep(2);
      return;
    }
    if (!matrimonyForm.mother_name?.trim()) {
      showToast("कृपया माता का नाम अवश्य भरें (चरण 2)।", "error");
      setMatrimonyStep(2);
      return;
    }

    // Step 3 Validation (Only mobile2 is optional)
    if (!matrimonyForm.mobile1?.trim()) {
      showToast("कृपया प्राथमिक मोबाइल नंबर (Mobile 1) अवश्य भरें।", "error");
      return;
    }
    if (!validateMobile(matrimonyForm.mobile1)) {
      showToast("प्राथमिक मोबाइल नंबर (Mobile 1) ठीक 10 अंकों का होना आवश्यक है।", "error");
      return;
    }
    if (matrimonyForm.mobile2 && !validateMobile(matrimonyForm.mobile2)) {
      showToast("द्वितीयक मोबाइल नंबर (Mobile 2) ठीक 10 अंकों का होना आवश्यक है।", "error");
      return;
    }
    if (!matrimonyForm.whatsapp?.trim()) {
      showToast("कृपया व्हाट्सएप नंबर अवश्य भरें।", "error");
      return;
    }
    if (!validateMobile(matrimonyForm.whatsapp)) {
      showToast("व्हाट्सएप नंबर ठीक 10 अंकों का होना आवश्यक है।", "error");
      return;
    }
    if (!matrimonyForm.currentAddress?.trim()) {
      showToast("कृपया वर्तमान पता अवश्य भरें।", "error");
      return;
    }
    if (!matrimonyForm.permanentAddress?.trim()) {
      showToast("कृपया स्थायी पता अवश्य भरें।", "error");
      return;
    }

    const firstPub = matrimonyPublications[0] || { district_id: "", sangathan_id: "", magazine_id: "", edition_id: "" };
    const currentPrice = getMatrimonyPublicationRate(firstPub.district_id, firstPub.sangathan_id, firstPub.magazine_id, firstPub.edition_id);
    const distObj = masters.districts.find((d) => String(d.id) === String(firstPub.district_id));
    const sangObj = masters.sangathans.find((s) => String(s.id) === String(firstPub.sangathan_id));
    const magObj = masters.magazines.find((m) => String(m.id) === String(firstPub.magazine_id));
    const edObj = masters.editions.find((e) => String(e.id) === String(firstPub.edition_id));

    const distHi = distObj ? distObj.name_hi : (matrimonyForm.district_hi || "रायपुर");
    const sangHi = sangObj ? sangObj.name_hi : (matrimonyForm.sangathan_hi || "रायपुर साहू संगठन");
    const magHi = magObj ? magObj.name_hi : (matrimonyForm.magazine_hi || "परिचायिका");
    const edHi = edObj ? edObj.name_hi : (matrimonyForm.edition_hi || "संस्करण 2026");

    const currentSessionId = getEffectiveSessionId();

    const payload = {
      adId: savedAdId, // can be null or a pre-existing ID for edit
      sessionId: currentSessionId,
      typeCode: "matrimony",
      publicationId: selectedPubId || "CUSTOM",
      customerName: matrimonyForm.name,
      customerMobile: matrimonyForm.mobile1,
      formData: {
        ...matrimonyForm,
        sessionId: currentSessionId,
        district_hi: distHi,
        sangathan_hi: sangHi,
        magazine_hi: magHi,
        edition_hi: edHi,
        price: currentPrice
      }
    };

    try {
      const res = await fetch("/api/advertisements/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSavedAdId(data.id);
        setSavedAdNumber(data.adNumber);
        setSavedPrice(data.price || currentPrice);
        setMatrimonyForm((prev) => ({
          ...prev,
          district_hi: distHi,
          sangathan_hi: sangHi,
          magazine_hi: magHi,
          edition_hi: edHi
        }));
        setCheckoutName(matrimonyForm.name);
        setCheckoutPhone(matrimonyForm.mobile1);

        // Refresh cart immediately from server
        await fetchCart();

        showToast("विवरण सुरक्षित हो गया! सटीक प्रीव्यू एवं प्रकाशन चयन देखें।", "success");
        setMatrimonyStep(4); // Go directly to Visual Preview & Multi-Publication Selection
      } else {
        const err = await res.json();
        showToast("त्रुटि: " + (err.error || "सुरक्षित करने में विफल।"), "error");
      }
    } catch (err) {
      console.error("Save failed:", err);
      showToast("नेटवर्क त्रुटि: विज्ञापन सुरक्षित करने में असमर्थ", "error");
    }
  };

  // Matrimony Form Step 4: Add Multi-Publication Matrimony Ad to Cart
  const handleAddMatrimonyToCart = async () => {
    // 1. Validation for publication rows
    const validPubs = matrimonyPublications.filter(
      (p) => p.district_id && p.sangathan_id && p.magazine_id && p.edition_id
    );

    if (validPubs.length === 0) {
      showToast("कृपया कम से कम एक पूर्ण प्रकाशन (जिला, संगठन, पत्रिका व संस्करण) चुनें।", "error");
      return;
    }

    // Check for duplicate publication selections
    const pubKeys = validPubs.map(
      (p) => `${p.district_id}-${p.sangathan_id}-${p.magazine_id}-${p.edition_id}`
    );
    const hasDuplicates = new Set(pubKeys).size !== pubKeys.length;
    if (hasDuplicates) {
      showToast("चेतावनी: आपने एक ही प्रकाशन संयोजन दोबारा चुना है। कृपया प्रत्येक पंक्ति में अलग प्रकाशन चुनें।", "error");
      return;
    }

    setIsSubmittingMatrimony(true);
    try {
      const firstPub = validPubs[0];
      const distObj = masters.districts.find((d) => String(d.id) === String(firstPub.district_id));
      const sangObj = masters.sangathans.find((s) => String(s.id) === String(firstPub.sangathan_id));
      const magObj = masters.magazines.find((m) => String(m.id) === String(firstPub.magazine_id));
      const edObj = masters.editions.find((e) => String(e.id) === String(firstPub.edition_id));

      const distHi = distObj ? distObj.name_hi : (matrimonyForm.district_hi || "रायपुर");
      const sangHi = sangObj ? sangObj.name_hi : (matrimonyForm.sangathan_hi || "रायपुर साहू संगठन");
      const magHi = magObj ? magObj.name_hi : (matrimonyForm.magazine_hi || "परिचायिका");
      const edHi = edObj ? edObj.name_hi : (matrimonyForm.edition_hi || "संस्करण 2026");

      let adIdToUse = savedAdId;
      let adNumToUse = savedAdNumber;

      if (!adIdToUse || !adNumToUse) {
        const payload = {
          adId: null,
          typeCode: "matrimony",
          publicationId: selectedPubId || "CUSTOM",
          customerName: matrimonyForm.name || "युवक-युवती",
          customerMobile: matrimonyForm.mobile1 || "0000000000",
          formData: {
            ...matrimonyForm,
            district_hi: distHi,
            sangathan_hi: sangHi,
            magazine_hi: magHi,
            edition_hi: edHi
          }
        };
        const saveRes = await fetch("/api/advertisements/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (saveRes.ok) {
          const saveData = await saveRes.json();
          adIdToUse = saveData.id;
          adNumToUse = saveData.adNumber;
          setSavedAdId(adIdToUse);
          setSavedAdNumber(adNumToUse);
        }
      }

      const currentSessionId = getEffectiveSessionId();
      setCheckoutName(matrimonyForm.name || checkoutName);
      setCheckoutPhone(matrimonyForm.mobile1 || checkoutPhone);

      const res = await fetch("/api/cart/add-matrimony", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          matrimonyData: {
            ...matrimonyForm,
            district_hi: distHi,
            sangathan_hi: sangHi,
            magazine_hi: magHi,
            edition_hi: edHi,
            adId: adIdToUse,
            adNumber: adNumToUse
          },
          publications: validPubs
        })
      });

      if (res.ok) {
        await fetchCart();
        showToast(`✓ सफलता: वैवाहिक प्रविष्टि (${validPubs.length} प्रकाशन) सफलतापूर्वक कार्ट में जोड़ दी गई!`, "success");
        // Reset form states completely
        setMatrimonyForm({
          name: "", dob: "", height: "", blood_group: "", gotra: "",
          education: "", occupation: "", father_name: "", father_occupation: "", mother_name: "",
          mobile1: "", mobile2: "", whatsapp: "", currentAddress: "", permanentAddress: "",
          photoUrl: "", biodataUrl: "", district_hi: "रायपुर", sangathan_hi: "रायपुर साहू संगठन",
          magazine_hi: "परिचायिका", edition_hi: "संस्करण 2026"
        });
        setSelectedPubId("");
        setSelectedSizeCode("");
        setSavedAdId(null);
        setSavedAdNumber("");
        setShowMatrimonyAdMaker(false);
        setMatrimonyStep(1);
        setScreen("cart");
      } else {
        const err = await res.json();
        showToast("त्रुटि: " + (err.error || "कार्ट में जोड़ने में समस्या"), "error");
      }
    } catch (err: any) {
      console.error("Cart add failed:", err);
      showToast("कार्ट में जोड़ने में समस्या आई: " + err.message, "error");
    } finally {
      setIsSubmittingMatrimony(false);
    }
  };

  // Matrimony Form Step 4: Approve Standard Block -> Add to Cart
  const handleMatrimonyApprove = async () => {
    let adIdToUse = savedAdId;
    let adNumToUse = savedAdNumber;
    const currentPrice = getMatrimonyPublicationRate(matrimonyForm.district_id, matrimonyForm.sangathan_id);
    let priceToUse = savedPrice || currentPrice;

    const distObj = masters.districts.find((d) => String(d.id) === String(matrimonyForm.district_id));
    const sangObj = masters.sangathans.find((s) => String(s.id) === String(matrimonyForm.sangathan_id));
    const magObj = masters.magazines.find((m) => String(m.id) === String(matrimonyForm.magazine_id));
    const edObj = masters.editions.find((e) => String(e.id) === String(matrimonyForm.edition_id));

    const distHi = distObj ? distObj.name_hi : (matrimonyForm.district_hi || "रायपुर");
    const sangHi = sangObj ? sangObj.name_hi : (matrimonyForm.sangathan_hi || "रायपुर साहू संगठन");
    const magHi = magObj ? magObj.name_hi : (matrimonyForm.magazine_hi || "परिचायिका");
    const edHi = edObj ? edObj.name_hi : (matrimonyForm.edition_hi || "संस्करण 2026");

    // Auto-save safeguard: if savedAdId or savedAdNumber is not set yet, save immediately first
    if (!adIdToUse || !adNumToUse) {
      try {
        const payload = {
          adId: null,
          typeCode: "matrimony",
          publicationId: selectedPubId || "CUSTOM",
          customerName: matrimonyForm.name || "युवक-युवती",
          customerMobile: matrimonyForm.mobile1 || "0000000000",
          formData: {
            ...matrimonyForm,
            district_hi: distHi,
            sangathan_hi: sangHi,
            magazine_hi: magHi,
            edition_hi: edHi,
            price: currentPrice
          }
        };
        const res = await fetch("/api/advertisements/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          adIdToUse = data.id;
          adNumToUse = data.adNumber;
          priceToUse = data.price || currentPrice;
          setSavedAdId(adIdToUse);
          setSavedAdNumber(adNumToUse);
          setSavedPrice(priceToUse);
        } else {
          const err = await res.json();
          showToast("त्रुटि: " + (err.error || "विज्ञापन सुरक्षित नहीं हो सका।"), "error");
          return;
        }
      } catch (e) {
        console.error("Auto-save failed:", e);
        showToast("नेटवर्क त्रुटि: विज्ञापन सुरक्षित करने में असमर्थ", "error");
        return;
      }
    }

    try {
      const currentSessionId = getEffectiveSessionId();
      setCheckoutName(matrimonyForm.name || checkoutName);
      setCheckoutPhone(matrimonyForm.mobile1 || checkoutPhone);

      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          adType: "matrimony",
          data: {
            ...matrimonyForm,
            district_hi: distHi,
            sangathan_hi: sangHi,
            magazine_hi: magHi,
            edition_hi: edHi,
            adId: adIdToUse,
            adNumber: adNumToUse
          },
          price: priceToUse
        })
      });

      if (res.ok) {
        showToast("सफलता: प्रविष्टि को कार्ट में जोड़ दिया गया है।", "success");
        // Reset form states completely
        setMatrimonyForm({
          name: "", dob: "", height: "", blood_group: "", gotra: "",
          education: "", occupation: "", father_name: "", father_occupation: "", mother_name: "",
          mobile1: "", mobile2: "", whatsapp: "", currentAddress: "", permanentAddress: "",
          photoUrl: "", biodataUrl: "", district_hi: "रायपुर", sangathan_hi: "रायपुर साहू संगठन",
          magazine_hi: "परिचायिका", edition_hi: "संस्करण 2026"
        });
        setSelectedPubId("");
        setSelectedSizeCode("");
        setSavedAdId(null);
        setSavedAdNumber("");
        setShowMatrimonyAdMaker(false);
        setMatrimonyStep(1);
        fetchCart();
        setScreen("cart");
      }
    } catch (err) {
      console.error("Cart add failed:", err);
      showToast("कार्ट में जोड़ने में समस्या आई", "error");
    }
  };

  // Matrimony Form Step 3: Receive approved layout from AI Ad Maker -> Add to Cart
  const handleApproveMatrimonyAdMakerDesign = async (approvedLayout: any, dimensions?: any, readyAdFileUrl?: string) => {
    let adIdToUse = savedAdId;
    let adNumToUse = savedAdNumber;
    let priceToUse = savedPrice || 500;

    if (!adIdToUse || !adNumToUse) {
      try {
        const payload = {
          adId: null,
          typeCode: "matrimony",
          publicationId: selectedPubId || "CUSTOM",
          customerName: matrimonyForm.name || "युवक-युवती",
          customerMobile: matrimonyForm.mobile1 || "0000000000",
          formData: {
            ...matrimonyForm,
            district_hi: matrimonyForm.district_hi || "रायपुर",
            sangathan_hi: matrimonyForm.sangathan_hi || "रायपुर साहू संगठन",
            magazine_hi: matrimonyForm.magazine_hi || "परिचायिका",
            edition_hi: matrimonyForm.edition_hi || "संस्करण 2026"
          }
        };
        const res = await fetch("/api/advertisements/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          adIdToUse = data.id;
          adNumToUse = data.adNumber;
          priceToUse = data.price || 500;
          setSavedAdId(adIdToUse);
          setSavedAdNumber(adNumToUse);
          setSavedPrice(priceToUse);
        } else {
          const err = await res.json();
          showToast("त्रुटि: " + (err.error || "विज्ञापन सुरक्षित नहीं हो सका।"), "error");
          return;
        }
      } catch (e) {
        console.error("Auto-save failed:", e);
        showToast("नेटवर्क त्रुटि: विज्ञापन सुरक्षित करने में असमर्थ", "error");
        return;
      }
    }

    const updatedForm = {
      ...matrimonyForm,
      adMakerDesignJson: approvedLayout,
      customDimensions: dimensions,
      readyAdUrl: readyAdFileUrl || matrimonyForm.biodataUrl,
      adId: adIdToUse,
      adNumber: adNumToUse
    };

    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          adType: "matrimony",
          data: updatedForm,
          price: priceToUse
        })
      });

      if (res.ok) {
        showToast("सफलता: वैवाहिक प्रविष्टि को AI Ad Maker डिज़ाइन के साथ कार्ट में जोड़ दिया गया है।", "success");
        setMatrimonyForm({
          name: "", dob: "", height: "", blood_group: "", gotra: "",
          education: "", occupation: "", father_name: "", father_occupation: "", mother_name: "",
          mobile1: "", mobile2: "", whatsapp: "", currentAddress: "", permanentAddress: "",
          photoUrl: "", biodataUrl: "", district_hi: "रायपुर", sangathan_hi: "रायपुर साहू संगठन",
          magazine_hi: "परिचायिका", edition_hi: "संस्करण 2026"
        });
        setSelectedPubId("");
        setSelectedSizeCode("");
        setSavedAdId(null);
        setSavedAdNumber("");
        setShowMatrimonyAdMaker(false);
        setMatrimonyStep(1);
        fetchCart();
        setScreen("cart");
      }
    } catch (err) {
      console.error("Matrimony custom ad cart failed:", err);
      showToast("कार्ट में जोड़ने में समस्या आई", "error");
    }
  };

  // Remove from Shopping Cart API Call
  const handleRemoveCartItem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/cart/remove/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        fetchCart();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Cart Item: Pulls item out of cart, populates state, and directs to form
  const handleEditCartItem = async (item: any) => {
    try {
      const res = await fetch(`/api/cart/remove/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedAdId(item.data.adId || item.data.ad_id || null);
        setSavedAdNumber(item.data.adNumber || item.data.ad_number || "");
        setSavedPrice(item.price);
        
        if (item.adType === "matrimony") {
          setMatrimonyForm({
            name: item.data.name || "",
            dob: formatDobToDDMMYYYY(item.data.dob) || "",
            height: item.data.height || "",
            blood_group: item.data.blood_group || "",
            gotra: item.data.gotra || "",
            education: item.data.education || "",
            occupation: item.data.occupation || "",
            father_name: item.data.father_name || "",
            father_occupation: item.data.father_occupation || "",
            mother_name: item.data.mother_name || "",
            mobile1: item.data.mobile1 || "",
            mobile2: item.data.mobile2 || "",
            whatsapp: item.data.whatsapp || "",
            currentAddress: item.data.currentAddress || "",
            permanentAddress: item.data.permanentAddress || "",
            photoUrl: item.data.photoUrl || "",
            biodataUrl: item.data.biodataUrl || "",
            district_id: item.data.district_id || "",
            sangathan_id: item.data.sangathan_id || "",
            magazine_id: item.data.magazine_id || "",
            edition_id: item.data.edition_id || "",
            district_hi: item.data.district_hi || "",
            sangathan_hi: item.data.sangathan_hi || "",
            magazine_hi: item.data.magazine_hi || "परिचायिका",
            edition_hi: item.data.edition_hi || "संस्करण 2026"
          });
          setSelectedPubId(item.data.publication_id || item.data.publicationId || "");
          setMatrimonyStep(1);
          setScreen("matrimony_form");
        } else {
          const code = (item.data.size_code || item.data.sizeCode || "business_full") as "business_full" | "business_half" | "business_quarter";
          const link = item.data.readyAdUrl || item.data.designLink || "";
          const jpg = item.data.uploadedJpgUrl || item.data.photoUrl || "";
          setBusinessSelectedSize(code);
          setBusinessDesignLink(link);
          setBusinessUploadedJpgUrl(jpg);
          if (item.data.district_id || item.data.sangathan_id) {
            setBusinessPublications([
              {
                district_id: item.data.district_id || "",
                sangathan_id: item.data.sangathan_id || "",
                magazine_id: item.data.magazine_id || "",
                edition_id: item.data.edition_id || ""
              }
            ]);
          }
          setScreen("business_form");
        }
        
        fetchCart();
      }
    } catch (err) {
      console.error("Edit cart item load error:", err);
    }
  };

  // Clear entire cart
  const handleClearCart = async () => {
    try {
      const currentSessionId = getEffectiveSessionId();
      const res = await fetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId })
      });
      if (res.ok) {
        fetchCart();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Finalize order creation and fetch Dynamic UPI Payload
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutName?.trim() || !checkoutPhone?.trim()) {
      showToast("कृपया मुख्य आवेदक का नाम और मुख्य मोबाइल नंबर अवश्य भरें।", "error");
      return;
    }

    const cleanPhone = checkoutPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length !== 10) {
      showToast("मुख्य मोबाइल नंबर ठीक 10 अंकों का होना आवश्यक है।", "error");
      return;
    }

    setIsCheckingOut(true);
    try {
      const currentSessionId = getEffectiveSessionId();
      const res = await fetch("/api/order/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          customerName: checkoutName.trim(),
          customerMobile: cleanPhone
        })
      });

      if (res.ok) {
        const result = await res.json();
        setOrderResult(result);
        setScreen("checkout");
      } else {
        const err = await res.json();
        showToast(`चेकआउट विफल: ${err.error}`, "error");
      }
    } catch (err) {
      showToast("चेकआउट सर्वर त्रुटि", "error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Customer confirms payment completion
  const handleConfirmPayment = async (screenshotUrl: string) => {
    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/order/payment-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderResult?.orderId,
          paymentRef: "UPI_SCREENSHOT_ATTACHED",
          paymentScreenshot: screenshotUrl,
          customerName: checkoutName
        })
      });

      if (!res.ok) {
        const err = await res.json();
        showToast("त्रुटि: " + (err.error || "भुगतान विवरण दर्ज करने में विफल।"), "error");
        return;
      }

      // Fetch the authoritative order record persisted in database
      const orderRes = await fetch(`/api/orders/${orderResult?.orderId}`);
      if (orderRes.ok) {
        const realOrder = await orderRes.json();
        setActiveInvoiceOrder(realOrder);
      } else {
        // Fallback to submitted state payload
        const invoicePayload: Order = {
          id: Date.now(),
          order_id: orderResult?.orderId || "ORD-PENDING",
          total_amount: orderResult?.totalAmount || 0,
          payment_status: "PENDING",
          payment_ref: "UPI_SCREENSHOT_ATTACHED",
          payment_screenshot: screenshotUrl,
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          items: cart.map((it, idx) => ({
            id: idx,
            order_id: orderResult?.orderId || "ORD-PENDING",
            ad_number: it.data.adNumber || it.data.ad_number || `00${idx + 1}`,
            ad_type: it.adType,
            district_hi: it.data.district_hi || "रायपुर",
            sangathan_hi: it.data.sangathan_hi || "साहू संगठन",
            magazine_hi: it.data.magazine_hi || "परिचायिका",
            edition_hi: it.data.edition_hi || "संस्करण 2026",
            size_hi: it.adType === "matrimony" ? "विवाह मानक (3.5 × 2 इंच)" : (it.data as BusinessFormState).size_hi || "आकार",
            price: it.price,
            customer_name: checkoutName,
            customer_mobile: checkoutPhone,
            matrimonyDetails: it.adType === "matrimony" ? it.data : null,
            businessDetails: it.adType === "business" ? it.data : null
          }))
        };
        setActiveInvoiceOrder(invoicePayload);
      }

      setScreen("invoice");
      showToast("भुगतान स्क्रीनशॉट सफलतापूर्वक दर्ज हुआ! व्यवस्थापक सत्यापन लंबित है।", "success");
      // Reset checkout state
      setOrderResult(null);
      setCheckoutName("");
      setCheckoutPhone("");
      setPaymentRef("");
      setCart([]);
    } catch (err) {
      showToast("भुगतान दर्ज करने में त्रुटि", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getCartTotal = () => {
    // FIX: PostgreSQL returns price as string — coerce each price to Number
    // to prevent string concat like "0500.000500.00" in cart total.
    return cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-sans text-[#2D2D2D] relative">
      {/* Universal Floating In-App Toast Notification */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all ${
          toast.type === "success"
            ? "bg-emerald-900/95 text-emerald-50 border-emerald-700 backdrop-blur-md"
            : toast.type === "error"
            ? "bg-red-900/95 text-red-50 border-red-700 backdrop-blur-md"
            : "bg-stone-900/95 text-stone-50 border-stone-700 backdrop-blur-md"
        }`}>
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-orange-400 shrink-0" />
          )}
          <span className="flex-1 text-xs sm:text-sm font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer transition-colors text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <datalist id="district-datalist">
        {uniqueDistricts.map((d, idx) => (
          <option key={idx} value={d} />
        ))}
      </datalist>
      <datalist id="sangathan-datalist">
        {uniqueSangathans.map((s, idx) => (
          <option key={idx} value={s} />
        ))}
      </datalist>

      {/* HEADER */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 sm:px-6 py-3.5 flex justify-between items-center shrink-0 shadow-xs sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setScreen("home")}>
          <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-2 sm:p-2.5 rounded-xl shadow-md text-white">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-[#E65100] tracking-tight">
                परिचायिका
              </h1>
              <span className="hidden sm:inline-block bg-orange-100 text-[#E65100] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                2026
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-stone-400 font-bold">
              Powered by Indian Press, Raipur
            </p>
          </div>
        </div>

        {/* Desktop / Tablet Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl border border-stone-200/60">
          <button
            onClick={() => setScreen("home")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              screen === "home" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            होमपेज
          </button>
          <button
            onClick={() => {
              setSavedAdId(null);
              setSavedAdNumber("");
              setSelectedPubId("");
              setSelectedSizeCode("");
              setMatrimonyStep(1);
              fetchNextAdNumbers();
              setScreen("matrimony_form");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              screen === "matrimony_form" ? "bg-white text-[#E65100] shadow-xs" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-[#E65100]" />
            विवाह प्रविष्टि
          </button>
          <button
            onClick={() => {
              setSavedAdId(null);
              setSavedAdNumber("");
              setSelectedPubId("");
              setSelectedSizeCode("");
              setBusinessStep(1);
              fetchNextAdNumbers();
              setScreen("business_form");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              screen === "business_form" ? "bg-white text-emerald-700 shadow-xs" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Building className="w-3.5 h-3.5 text-emerald-600" />
            व्यापार विज्ञापन
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setScreen("cart")}
            className={`relative p-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer border ${
              screen === "cart"
                ? "bg-orange-50 text-[#E65100] border-orange-200"
                : "text-stone-700 hover:text-[#E65100] border-stone-200 hover:bg-stone-50"
            }`}
            title="Cart"
          >
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline text-xs font-bold">कार्ट</span>
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                {cart.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setScreen(screen === "admin" ? "home" : "admin")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border ${
              screen === "admin"
                ? "bg-stone-900 text-white border-stone-900"
                : "border-stone-200 text-stone-700 hover:text-stone-900 hover:bg-stone-50"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{screen === "admin" ? "होमपेज" : "सुपर एडमिन"}</span>
            <span className="sm:hidden">एडमिन</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 pb-28 md:pb-12">
        {/* HOMEPAGE */}
        {screen === "home" && (
          <div className="space-y-12 my-6">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 leading-tight">
                साहू समाज युवक-युवती परिचय सम्मेलन की प्रविष्टियाँ यहाँ दें
              </h2>
              <p className="text-sm text-stone-500 max-w-lg mx-auto">
                परिचायिका पत्रिका प्रकाशन एवं सम्मेलन में सहभागिता हेतु अपने विवाह विवरण या व्यापार के विज्ञापन यहाँ सीधे दर्ज करें।
              </p>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Box 1: Matrimony Entry */}
              <div
                onClick={() => {
                  setSavedAdId(null);
                  setSavedAdNumber("");
                  setSelectedPubId("");
                  setSelectedSizeCode("");
                  setMatrimonyStep(1);
                  setMatrimonyForm({
                    name: "", dob: "", height: "", blood_group: "", gotra: "",
                    education: "", occupation: "", father_name: "", father_occupation: "", mother_name: "",
                    mobile1: "", mobile2: "", whatsapp: "", currentAddress: "", permanentAddress: "",
                    photoUrl: "", biodataUrl: "", district_id: "", sangathan_id: "", magazine_id: "", edition_id: ""
                  });
                  fetchNextAdNumbers();
                  setScreen("matrimony_form");
                }}
                className="group cursor-pointer bg-white border border-stone-200 hover:border-orange-500 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl p-8 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Heart className="w-8 h-8 text-[#E65100] fill-orange-100" />
                </div>
                <h3 className="text-xl font-bold text-stone-800">विवाह विज्ञापन दें</h3>
                <p className="text-stone-500 text-xs">
                  स्वयं या परिवार के युवक-युवती परिचय सम्मेलन विवरण दर्ज करें एवं मानक ३.५ × २ इंच आकार का कॉलम बुक करें।
                </p>
                <span className="inline-flex items-center text-[#E65100] font-bold text-xs pt-2">
                  प्रविष्टि प्रारंभ करें <ChevronRight className="w-4 h-4 ml-1" />
                </span>
              </div>

              {/* Box 2: Business Entry */}
              <div
                onClick={() => {
                  setSavedAdId(null);
                  setSavedAdNumber("");
                  setSelectedPubId("");
                  setSelectedSizeCode("");
                  setBusinessStep(1);
                  setBusinessForm({
                    businessName: "", ownerName: "", category: "", businessDesc: "", productsServices: "",
                    specialOffer: "", keyFeatures: "", mobile1: "", mobile2: "", whatsapp: "", email: "",
                    businessAddress: "", otherAddress: "", logoUrl: "", photoUrl: "", readyAdUrl: "",
                    district_id: "", sangathan_id: "", magazine_id: "", edition_id: "", size_code: ""
                  });
                  fetchNextAdNumbers();
                  setScreen("business_form");
                }}
                className="group cursor-pointer bg-white border border-stone-200 hover:border-orange-600 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl p-8 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-orange-50/60 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-stone-800">व्यवसाय विज्ञापन दें</h3>
                <p className="text-stone-500 text-xs">
                  अपने व्यापार/दुकान की परिचायिका विज्ञापन बुक करें। आकर्षक डिज़ाइन बनाने हेतु AI एड-मेकर की सुविधा।
                </p>
                <span className="inline-flex items-center text-orange-600 font-bold text-xs pt-2">
                  प्रारंभ करें <ChevronRight className="w-4 h-4 ml-1" />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* MATRIMONY ENTRY FORM */}
        {screen === "matrimony_form" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <button
                onClick={handlePrevMatrimonyStep}
                className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3.5 py-2 rounded-xl shrink-0 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-stone-500" />
                {matrimonyStep > 1 ? "पिछला चरण (Back)" : "वापस होमपेज"}
              </button>

              {/* Responsive Step Progress Wizard */}
              <div className="flex items-center gap-1.5 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto py-1">
                <button
                  type="button"
                  onClick={() => setMatrimonyStep(1)}
                  className="flex items-center gap-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-all p-1 rounded-lg"
                  title="चरण 1: निजी विवरण"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    matrimonyStep === 1 ? "bg-[#E65100] text-white shadow-xs ring-2 ring-orange-200" : "bg-emerald-600 text-white"
                  }`}>
                    {matrimonyStep > 1 ? "✓" : "1"}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-bold ${matrimonyStep === 1 ? "text-[#E65100] font-extrabold" : "text-stone-500"}`}>
                    निजी विवरण
                  </span>
                </button>

                <div className="w-4 sm:w-6 h-0.5 bg-stone-200 shrink-0"></div>

                <button
                  type="button"
                  onClick={() => setMatrimonyStep(2)}
                  className="flex items-center gap-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-all p-1 rounded-lg"
                  title="चरण 2: परिवार विवरण"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    matrimonyStep === 2 ? "bg-[#E65100] text-white shadow-xs ring-2 ring-orange-200" : matrimonyStep > 2 ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"
                  }`}>
                    {matrimonyStep > 2 ? "✓" : "2"}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-bold ${matrimonyStep === 2 ? "text-[#E65100] font-extrabold" : "text-stone-500"}`}>
                    परिवार विवरण
                  </span>
                </button>

                <div className="w-4 sm:w-6 h-0.5 bg-stone-200 shrink-0"></div>

                <button
                  type="button"
                  onClick={() => setMatrimonyStep(3)}
                  className="flex items-center gap-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-all p-1 rounded-lg"
                  title="चरण 3: संपर्क विवरण"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    matrimonyStep === 3 ? "bg-[#E65100] text-white shadow-xs ring-2 ring-orange-200" : matrimonyStep > 3 ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"
                  }`}>
                    {matrimonyStep > 3 ? "✓" : "3"}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-bold ${matrimonyStep === 3 ? "text-[#E65100] font-extrabold" : "text-stone-500"}`}>
                    संपर्क विवरण
                  </span>
                </button>

                <div className="w-4 sm:w-6 h-0.5 bg-stone-200 shrink-0"></div>

                <button
                  type="button"
                  onClick={() => {
                    if (savedAdId) {
                      setMatrimonyStep(4);
                    } else {
                      showToast("कृपया पहले चरण 3 में विवरण सुरक्षित करें।", "info");
                    }
                  }}
                  className="flex items-center gap-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-all p-1 rounded-lg"
                  title="चरण 4: सटीक प्रीव्यू"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    matrimonyStep === 4 ? "bg-[#E65100] text-white shadow-xs ring-2 ring-orange-200" : "bg-stone-200 text-stone-600"
                  }`}>
                    4
                  </span>
                  <span className={`text-[11px] sm:text-xs font-bold ${matrimonyStep === 4 ? "text-[#E65100] font-extrabold" : "text-stone-400"}`}>
                    सटीक प्रीव्यू
                  </span>
                </button>
              </div>
            </div>

            {matrimonyStep <= 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Form Inputs (Left) */}
                <div className="lg:col-span-7 space-y-6">
                  <form onSubmit={handleMatrimonySave} className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
                    {/* Auto Ad Number Card (Mandatory / Auto Allocated) - Show on Step 1 */}
                    {matrimonyStep === 1 && (
                      <div className="w-full bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#E65100] text-white flex items-center justify-center font-black shadow-xs shrink-0">
                            <Hash className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900">
                                ऑटो विज्ञापन क्रमांक (Auto Ad Number)
                              </label>
                              <span className="bg-[#E65100] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> अनिवार्य / Auto Assigned
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-stone-600 mt-0.5">
                              परिचायिका पुस्तिका में आपकी प्रविष्टि का सिस्टम-आवंटित क्रमांक (Sequential ID)
                            </p>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center bg-white border border-orange-300 px-3.5 py-1.5 rounded-lg shadow-2xs shrink-0">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">आवंटित संख्या</span>
                          <span className="text-base sm:text-xl font-mono font-black text-[#E65100]">
                            {savedAdNumber || nextMatrimonyAdNum || "001"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 1 Content: Personal Details */}
                    {matrimonyStep === 1 && (
                      <div className="space-y-6">
                        <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <h3 className="text-base font-black text-stone-800">चरण 1: युवक-युवती का निजी विवरण</h3>
                            <p className="text-xs text-stone-500">सभी व्यक्तिगत जानकारी दर्ज करें जो विवाह कार्ड पर प्रदर्शित होगी।</p>
                          </div>
                          <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full w-fit">
                            * सभी फ़ील्ड अनिवार्य हैं
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <TransliteratedInput
                            value={matrimonyForm.name}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, name: val })}
                            label="युवक-युवती का नाम (Name)"
                            required
                          />

                          <DateOfBirthInput
                            value={matrimonyForm.dob}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, dob: val })}
                            required
                          />

                          <TransliteratedInput
                            value={matrimonyForm.height}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, height: val })}
                            label="ऊँचाई (Height - e.g. 5.4 ft)"
                            required
                          />

                          <div className="w-full min-w-0 flex flex-col space-y-1.5">
                            <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center gap-1">
                              <span>रक्त समूह (Blood Group)</span>
                              <span className="text-red-500 font-bold">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={matrimonyForm.blood_group}
                              onChange={(e) => setMatrimonyForm({ ...matrimonyForm, blood_group: e.target.value })}
                              className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 text-sm md:text-[15px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-medium shadow-xs"
                              placeholder="उदा. AB+, O+, B+"
                            />
                          </div>

                          <TransliteratedInput
                            value={matrimonyForm.gotra}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, gotra: val })}
                            label="गोत्र (Gotra)"
                            required
                          />

                          <TransliteratedInput
                            value={matrimonyForm.occupation}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, occupation: val })}
                            label="व्यवसाय/नौकरी (Occupation)"
                            required
                          />

                          <div className="w-full col-span-1 md:col-span-2">
                            <TransliteratedInput
                              value={matrimonyForm.education}
                              onChange={(val) => setMatrimonyForm({ ...matrimonyForm, education: val })}
                              label="विस्तृत शैक्षणिक योग्यता (Education Detail)"
                              required
                              isTextArea
                              rows={2}
                              isEducation={true}
                              placeholder="अल्पविराम ( , ) लगाकर डिग्री लिखें या नीचे से डिग्री चुनें (जैसे: 12th, B.Com, MBA...)"
                            />
                          </div>

                          {/* Dynamic Custom Fields */}
                          {dynFields.matrimony.filter(f => {
                            const norm = (f.field_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                            const banned = [
                              "name", "fullname", "applicantname", "dob", "birthdate", "dateofbirth",
                              "height", "bloodgroup", "gotra", "gothra", "education", "qualification",
                              "occupation", "profession", "fathername", "fatheroccupation", "mothername",
                              "motheroccupation", "mobile1", "mobile", "phone", "phonenumber", "mobile2",
                              "altmobile", "whatsapp", "whatsappnumber", "currentaddress", "address",
                              "permanentaddress", "photourl", "photo", "biodataurl", "biodata", "documenturl"
                            ];
                            return !banned.includes(norm);
                          }).map((f) => {
                            const fieldVal = matrimonyForm[f.field_name] || f.default_value || "";
                            const onChangeVal = (val: string) => setMatrimonyForm({ ...matrimonyForm, [f.field_name]: val });

                            return (
                              <div key={f.id} className={f.field_type === "textarea" ? "w-full col-span-1 md:col-span-2" : "w-full min-w-0"}>
                                {f.field_type === "textarea" ? (
                                  <TransliteratedInput
                                    value={fieldVal}
                                    onChange={onChangeVal}
                                    label={f.label}
                                    required={f.required === 1}
                                    isTextArea
                                    rows={2}
                                  />
                                ) : f.field_type === "select" ? (
                                  <div className="w-full min-w-0 flex flex-col space-y-1.5">
                                    <label className="text-xs md:text-sm font-bold text-stone-700 block">
                                      {f.label}{f.required ? " *" : ""}
                                    </label>
                                    <select
                                      value={fieldVal}
                                      onChange={(e) => onChangeVal(e.target.value)}
                                      required={f.required === 1}
                                      className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white text-sm md:text-[15px] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-xs"
                                    >
                                      <option value="">-- चुनें --</option>
                                      {f.select_options.split(",").map((opt: string) => (
                                        <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                                      ))}
                                    </select>
                                    {f.help_text && <p className="text-[11px] text-stone-400 mt-1">{f.help_text}</p>}
                                  </div>
                                ) : (
                                  <div className="w-full min-w-0">
                                    <TransliteratedInput
                                      value={fieldVal}
                                      onChange={onChangeVal}
                                      label={f.label}
                                      required={f.required === 1}
                                      placeholder={f.placeholder || ""}
                                    />
                                    {f.help_text && <p className="text-[11px] text-stone-400 mt-1">{f.help_text}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Document & Photo Upload Pipeline with Live Thumbnail Preview */}
                          <div className="w-full col-span-1 md:col-span-2 border border-stone-200 rounded-2xl p-4 md:p-6 bg-stone-50/80 shadow-xs">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <label className="text-xs md:text-sm font-bold text-stone-800 uppercase tracking-wider block flex items-center gap-1.5">
                                  <span>युवक/युवती का फोटो (JPG / PNG / WEBP)</span>
                                  <span className="text-red-500 font-bold">*</span>
                                </label>
                                <span className="text-[11px] text-stone-500 font-medium">
                                  पासपोर्ट साइज या स्पष्ट मुखाकृति फ़ोटो (अधिकतम: 25 MB)
                                </span>
                              </div>
                              
                              {/* Photo Preview if already uploaded */}
                              {matrimonyForm.photoUrl ? (
                                <div className="bg-white border-2 border-emerald-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                                  <div className="relative shrink-0 group">
                                    <img
                                      src={matrimonyForm.photoUrl}
                                      alt="युवक/युवती का फोटो"
                                      className="w-28 h-32 object-cover rounded-xl border-2 border-stone-200 shadow-xs bg-stone-100"
                                      onError={(e) => {
                                        // Fallback if image path fails
                                        (e.target as any).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";
                                      }}
                                    />
                                    <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white rounded-full p-1 shadow">
                                      <CheckCircle className="w-4 h-4" />
                                    </div>
                                  </div>

                                  <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>फ़ोटो सफलतापूर्वक सुरक्षित हो गई है</span>
                                    </div>
                                    <p className="text-xs text-stone-600 font-medium">
                                      यह फ़ोटो आपके वैवाहिक विज्ञापन एवं डायरेक्टरी बायोडाटा में मुद्रित की जाएगी।
                                    </p>
                                    
                                    <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                      <label
                                        htmlFor="matrimony-photoUrl-file-change"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-orange-50 text-stone-700 hover:text-orange-700 border border-stone-300 hover:border-orange-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                                      >
                                        <UploadIcon className="w-3.5 h-3.5 text-orange-600" />
                                        <span>फ़ोटो बदलें (Change Photo)</span>
                                      </label>
                                      <input
                                        id="matrimony-photoUrl-file-change"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, "photoUrl")}
                                        className="sr-only"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => handleUploadRemove("photoUrl")}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                                      >
                                        <X className="w-3.5 h-3.5 text-red-600" />
                                        <span>हटाएं (Remove)</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <input
                                    id="matrimony-photoUrl-file"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, "photoUrl")}
                                    className="sr-only"
                                  />
                                  
                                  <label
                                    htmlFor="matrimony-photoUrl-file"
                                    className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-orange-500 bg-white hover:bg-orange-50/30 rounded-2xl p-6 sm:p-8 cursor-pointer transition-all active:scale-[0.99] text-center group shadow-2xs"
                                  >
                                    {uploadingField === "photoUrl" ? (
                                      <div className="flex flex-col items-center gap-2 py-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                                        <p className="text-sm font-bold text-orange-700 animate-pulse">
                                          फ़ोटो अपलोड एवं प्रोसेस हो रही है, कृपया प्रतीक्षा करें...
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center space-y-2">
                                        <div className="w-14 h-14 rounded-full bg-orange-100 group-hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors shadow-2xs">
                                          <UploadIcon className="w-7 h-7" />
                                        </div>
                                        <span className="text-sm md:text-base font-black text-stone-800 group-hover:text-orange-600 transition-colors">
                                          फोटो चुनें या यहाँ ड्रैग करें (Click to Choose Photo)
                                        </span>
                                        <p className="text-xs text-stone-500 max-w-sm">
                                          केवल स्पष्ट, पासपोर्ट साइज या पोर्ट्रेट फ़ोटो चुनें (JPG, PNG, WEBP)
                                        </p>
                                        <span className="inline-block px-3 py-1 bg-stone-100 text-stone-600 text-[11px] font-bold rounded-full border border-stone-200">
                                          अधिकतम फ़ाइल साइज: 25 MB
                                        </span>
                                      </div>
                                    )}
                                  </label>
                                </div>
                              )}

                              {uploadErrors["photoUrl"] && (
                                <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold flex items-center justify-between gap-2">
                                  <span>⚠️ {uploadErrors["photoUrl"]}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUploadRetry("photoUrl")}
                                    className="px-2.5 py-1 bg-red-600 text-white rounded-md text-[11px] font-bold cursor-pointer hover:bg-red-700"
                                  >
                                    पुनः प्रयास करें
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleNextMatrimonyStep(1)}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow cursor-pointer transition-all active:scale-95"
                          >
                            अगला चरण (पारिवारिक विवरण) &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {matrimonyStep === 2 && (
                      <div className="space-y-6">
                        <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <h3 className="text-base font-black text-stone-800">चरण 2: पारिवारिक विवरण</h3>
                            <p className="text-xs text-stone-500">माता-पिता और उनके व्यवसाय की जानकारी भरें।</p>
                          </div>
                          <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full w-fit">
                            * सभी फ़ील्ड अनिवार्य हैं
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <TransliteratedInput
                            value={matrimonyForm.father_name}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, father_name: val })}
                            label="पिता का नाम (Father's Name)"
                            required
                          />

                          <TransliteratedInput
                            value={matrimonyForm.father_occupation}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, father_occupation: val })}
                            label="पिता का व्यवसाय (Father's Occupation)"
                            required
                          />

                          <TransliteratedInput
                            value={matrimonyForm.mother_name}
                            onChange={(val) => setMatrimonyForm({ ...matrimonyForm, mother_name: val })}
                            label="माता का नाम (Mother's Name)"
                            required
                          />
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setMatrimonyStep(1)}
                            className="border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold py-2.5 px-6 rounded-lg text-sm cursor-pointer transition-all"
                          >
                            &larr; पिछला चरण
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNextMatrimonyStep(2)}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow cursor-pointer transition-all active:scale-95"
                          >
                            अगला चरण (संपर्क विवरण) &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3 Content: Contact Details */}
                    {matrimonyStep === 3 && (
                      <div className="space-y-6">
                        <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <h3 className="text-base font-black text-stone-800">चरण 3: संपर्क एवं पता विवरण</h3>
                            <p className="text-xs text-stone-500">पता एवं फ़ोन नंबर की जानकारी भरें।</p>
                          </div>
                          <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full w-fit">
                            * मोबाइल नंबर 2 को छोड़कर सभी फ़ील्ड अनिवार्य हैं
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <div className="w-full min-w-0 flex flex-col space-y-1.5">
                            <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center gap-1">
                              <span>मोबाइल नंबर 1 (Mobile 1)</span>
                              <span className="text-red-500 font-bold">*</span>
                            </label>
                            <input
                              type="tel"
                              required
                              value={matrimonyForm.mobile1}
                              onChange={(e) => setMatrimonyForm({ ...matrimonyForm, mobile1: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                              placeholder="दस अंकों का संपर्क नंबर"
                              className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 text-sm md:text-[15px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-xs"
                            />
                            {matrimonyForm.mobile1 && !validateMobile(matrimonyForm.mobile1) && (
                              <p className="text-xs font-bold text-red-600 animate-pulse">
                                ⚠️ कृपया ठीक 10 अंकों का प्राथमिक मोबाइल नंबर दर्ज करें और सुधारें!
                              </p>
                            )}
                          </div>

                          <div className="w-full min-w-0 flex flex-col space-y-1.5">
                            <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center gap-1.5">
                              <span>मोबाइल नंबर 2 (Mobile 2)</span>
                              <span className="text-stone-400 text-[11px] font-semibold">(वैकल्पिक / Optional)</span>
                            </label>
                            <input
                              type="tel"
                              value={matrimonyForm.mobile2}
                              onChange={(e) => setMatrimonyForm({ ...matrimonyForm, mobile2: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                              placeholder="वैकल्पिक नंबर (यदि हो)"
                              className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 text-sm md:text-[15px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-xs"
                            />
                            {matrimonyForm.mobile2 && !validateMobile(matrimonyForm.mobile2) && (
                              <p className="text-xs font-bold text-red-600 animate-pulse">
                                ⚠️ द्वितीयक मोबाइल नंबर ठीक 10 अंकों का होना आवश्यक है!
                              </p>
                            )}
                          </div>

                          <div className="w-full min-w-0 flex flex-col space-y-1.5">
                            <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center gap-1">
                              <span>व्हाट्सएप नंबर (WhatsApp No.)</span>
                              <span className="text-red-500 font-bold">*</span>
                            </label>
                            <input
                              type="tel"
                              required
                              value={matrimonyForm.whatsapp}
                              onChange={(e) => setMatrimonyForm({ ...matrimonyForm, whatsapp: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                              placeholder="10 अंकों का व्हाट्सएप नंबर"
                              className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 text-sm md:text-[15px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-xs"
                            />
                            {matrimonyForm.whatsapp && !validateMobile(matrimonyForm.whatsapp) && (
                              <p className="text-xs font-bold text-red-600 animate-pulse">
                                ⚠️ कृपया ठीक 10 अंकों का व्हाट्सएप नंबर दर्ज करें और सुधारें!
                              </p>
                            )}
                          </div>

                          <div className="w-full col-span-1 md:col-span-2">
                            <TransliteratedInput
                              value={matrimonyForm.currentAddress}
                              onChange={(val) => setMatrimonyForm({ ...matrimonyForm, currentAddress: val })}
                              label="वर्तमान पता (Current Address)"
                              required
                              isTextArea
                              rows={2}
                            />
                          </div>

                          <div className="w-full col-span-1 md:col-span-2">
                            <TransliteratedInput
                              value={matrimonyForm.permanentAddress}
                              onChange={(val) => setMatrimonyForm({ ...matrimonyForm, permanentAddress: val })}
                              label="स्थायी पता (Permanent Address)"
                              required
                              isTextArea
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setMatrimonyStep(2)}
                            className="border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold py-2.5 px-6 rounded-lg text-sm cursor-pointer transition-all"
                          >
                            &larr; पिछला चरण
                          </button>
                          <button
                            type="submit"
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow cursor-pointer transition-all active:scale-95"
                          >
                            विवरण सुरक्षित करें और प्रीव्यू देखें
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                {/* Live Preview Panel (Right) - Instantly Syncs as They Type */}
                <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
                  <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-orange-600 animate-pulse" />
                        <h4 className="text-xs font-black text-stone-800 uppercase tracking-wide">लाइव विज्ञापन प्रीव्यू</h4>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        लाइव अपडेट
                      </span>
                    </div>

                    {/* Accurate real-time rendering of Matrimony Block */}
                    <div className="w-full bg-stone-50/70 rounded-xl p-3 border border-stone-150 flex flex-col items-center justify-center">
                      <div className="w-full bg-[#FFFDF6] border border-stone-800 rounded-xl p-3.5 shadow-xs relative select-none">
                        {/* Top Header */}
                        <div className="border-b-2 border-red-100 pb-1.5 mb-2 flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-red-600 tracking-wide flex items-center min-w-0">
                            <span className="font-mono">{savedAdNumber || nextMatrimonyAdNum || "001"}.</span>
                            <span className="ml-1.5 break-words">{matrimonyForm.name || "युवक-युवती का नाम"}</span>
                          </h4>
                        </div>

                        {/* Details Grid & Image */}
                        <div className="flex flex-row gap-2.5 items-start">
                          {/* FIX: Increased font size from 9px to 11px and added font-extrabold for bolder preview text */}
                          <div className="flex-1 min-w-0 font-sans space-y-1 text-[11px] leading-[15px] text-stone-900 font-extrabold">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-left">
                              <div className="flex items-center min-w-0">
                                <span className="w-9 text-stone-950 font-black shrink-0">जन्म</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{formatDobToDDMMYYYY(matrimonyForm.dob)}</span>
                              </div>
                              <div className="flex items-center min-w-0">
                                <span className="w-9 text-stone-950 font-black shrink-0">ऊँचाई</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.height || "-"}</span>
                              </div>
                              <div className="flex items-center min-w-0">
                                <span className="w-9 text-stone-950 font-black shrink-0">गोत्र</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.gotra || "-"}</span>
                              </div>
                              <div className="flex items-center min-w-0">
                                <span className="w-9 text-stone-950 font-black shrink-0">रक्त</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.blood_group || "-"}</span>
                              </div>
                            </div>

                            {/* FIX: Education + Occupation go RIGHT AFTER gotra/blood, BEFORE father — client spec */}
                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-start min-w-0">
                                <span className="w-12 text-stone-950 font-black shrink-0">शिक्षा</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.education || "-"}</span>
                              </div>
                              <div className="flex items-start min-w-0">
                                <span className="w-12 text-stone-950 font-black shrink-0">व्यवसाय</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.occupation || "-"}</span>
                              </div>
                            </div>

                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-start min-w-0">
                                <span className="w-12 text-stone-950 font-black shrink-0">पिता</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.father_name || "-"}</span>
                              </div>
                              <div className="flex items-start min-w-0">
                                <span className="w-12 text-stone-950 font-black shrink-0">पिता व्यव.</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.father_occupation || "-"}</span>
                              </div>
                              <div className="flex items-start min-w-0">
                                <span className="w-12 text-stone-950 font-black shrink-0">माता</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 break-words flex-1">{matrimonyForm.mother_name || "-"}</span>
                              </div>
                            </div>

                            <div className="pt-1 border-t border-stone-200 space-y-1">
                              {/* FIX: Show full "वर्तमान पता" not just "वर्तमान" */}
                              <div className="flex items-start min-w-0">
                                <span className="w-[60px] text-stone-950 font-black shrink-0">वर्तमान पता</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 flex-1 break-words">{matrimonyForm.currentAddress || "-"}</span>
                              </div>
                              <div className="flex items-start min-w-0">
                                <span className="w-[60px] text-stone-950 font-black shrink-0">स्थायी पता</span>
                                <span className="text-stone-400 mx-0.5 shrink-0">:</span>
                                <span className="text-stone-800 flex-1 break-words">{matrimonyForm.permanentAddress || "-"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Profile Image Frame */}
                          <div className="w-[110px] h-[145px] bg-stone-100 border border-stone-300 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                            {matrimonyForm.photoUrl ? (
                              <img src={matrimonyForm.photoUrl} alt="Live Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-stone-400 font-bold text-center bg-stone-50 p-0.5">
                                <User className="w-5 h-5 text-stone-300 mb-0.5" />
                                <span>पासपोर्ट फोटो</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Contact */}
                        {/* FIX: Increased font size from 8.5px to 10px for bolder preview */}
                        <div className="mt-2 pt-1.5 border-t border-stone-200 flex items-center justify-between text-[10px] font-extrabold text-stone-900">
                          <div className="flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 text-[#E65100]" />
                            {!matrimonyForm.mobile1 ? (
                              <span className="text-stone-400 font-normal">XXXXXXXXXX</span>
                            ) : validateMobile(matrimonyForm.mobile1) ? (
                              <span className="font-mono">{matrimonyForm.mobile1}</span>
                            ) : (
                              <span className="text-red-600 font-bold text-[7.5px]">(अमान्य)</span>
                            )}
                          </div>
                          {(matrimonyForm.whatsapp || matrimonyForm.mobile1) && (
                            <div className="flex items-center gap-1 text-emerald-700">
                              <span className="font-mono">{matrimonyForm.whatsapp || matrimonyForm.mobile1}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Prompting instruction to keep user oriented */}
                    <p className="text-[10px] text-stone-500 leading-normal text-center">
                      यह विज्ञापन परिचायिका पत्रिका में ठीक इसी प्रकार मुद्रित किया जाएगा। जैसे-जैसे आप विवरण भरेंगे, प्रीव्यू तुरंत अपडेट होगा।
                    </p>
                  </div>
                </div>
              </div>
            )}

            {matrimonyStep === 4 && (
              <div className="space-y-6">
                {/* STANDARD MATRIMONY BLOCK VIEW */}
                <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
                    {/* Header */}
                    <div className="border-b border-stone-100 pb-4">
                      <h3 className="text-base sm:text-lg font-black text-stone-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#E65100]" />
                        विवाह विज्ञापन प्रीव्यू
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        सम्मेलन परिचायिका पत्रिका हेतु मानक ब्लॉक लेआउट
                      </p>
                    </div>

                    {/* PREVIEW CONTAINER - Spacious, Clean, Proportional, No text overlap */}
                    <div className="w-full flex items-center justify-center p-3 sm:p-6 md:p-8 bg-stone-50/70 rounded-2xl border border-stone-200/80">
                      <div className="w-full max-w-[620px] bg-[#FFFDF6] border-2 border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm select-none">
                        {/* Top Header: Ad No. and Candidate Name */}
                        <div className="border-b-2 border-red-200 pb-2 mb-3.5 flex items-center justify-between gap-2">
                          <h4 className="text-base sm:text-lg font-black text-red-600 tracking-wide flex items-center min-w-0">
                            <span className="font-mono">{savedAdNumber || nextMatrimonyAdNum || "001"}.</span>
                            <span className="ml-2 font-bold break-words">{matrimonyForm.name || "युवक-युवती का नाम"}</span>
                          </h4>
                        </div>

                        {/* Main Body: Left Column (Spacious details) + Right Column (Passport Photo) */}
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                          {/* Left Column: All text info — SAME ORDER as Step 1 Live Preview */}
                        <div className="flex-1 min-w-0 w-full space-y-2 text-xs sm:text-[13px] leading-relaxed text-stone-900 font-sans">
                            {/* Row 1: DOB and Height in two balanced columns */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-16 font-black text-stone-950 shrink-0">जन्म</span>
                                <span className="text-stone-400 font-bold shrink-0">:</span>
                                <span className="font-bold text-stone-800 break-words">{formatDobToDDMMYYYY(matrimonyForm.dob) || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-16 sm:w-14 font-black text-stone-950 shrink-0">ऊँचाई</span>
                                <span className="text-stone-400 font-bold shrink-0">:</span>
                                <span className="font-bold text-stone-800 break-words">{matrimonyForm.height || "-"}</span>
                              </div>
                            </div>

                            {/* Row 2: Gotra and Blood Group */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-16 font-black text-stone-950 shrink-0">गोत्र</span>
                                <span className="text-stone-400 font-bold shrink-0">:</span>
                                <span className="font-bold text-stone-800 break-words">{matrimonyForm.gotra || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-16 sm:w-14 font-black text-stone-950 shrink-0">रक्त</span>
                                <span className="text-stone-400 font-bold shrink-0">:</span>
                                <span className="font-bold text-stone-800 break-words">{matrimonyForm.blood_group || "-"}</span>
                              </div>
                            </div>

                            {/* FIX: Education + Occupation go RIGHT AFTER gotra/blood, BEFORE father — matches Step 1 Live Preview */}
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">शिक्षा</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.education || "-"}</span>
                            </div>
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">व्यवसाय</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.occupation || "-"}</span>
                            </div>

                            {/* Row 3: Father Name */}
                            <div className="flex items-start gap-1.5 min-w-0 pt-0.5">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">पिता</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.father_name || "-"}</span>
                            </div>

                            {/* Row 4: Father Occupation */}
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">पिता व्यव.</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.father_occupation || "-"}</span>
                            </div>

                            {/* Row 5: Mother Name */}
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">माता</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.mother_name || "-"}</span>
                            </div>

                            {/* FIX: Show BOTH addresses — वर्तमान पता + स्थायी पता (separate lines) */}
                            <div className="flex items-start gap-1.5 min-w-0 pt-1 border-t border-stone-200">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">वर्तमान पता</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.currentAddress || "-"}</span>
                            </div>
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="w-16 sm:w-20 font-black text-stone-950 shrink-0">स्थायी पता</span>
                              <span className="text-stone-400 font-bold shrink-0">:</span>
                              <span className="font-bold text-stone-800 break-words flex-1">{matrimonyForm.permanentAddress || "-"}</span>
                            </div>
                          </div>

                          {/* Right Column: Candidate Photo - Well-proportioned passport layout */}
                          <div className="w-32 sm:w-40 h-44 sm:h-52 bg-stone-100 border-2 border-stone-300 rounded-xl overflow-hidden shrink-0 self-center sm:self-start shadow-xs flex items-center justify-center">
                            {matrimonyForm.photoUrl ? (
                              <img src={matrimonyForm.photoUrl} alt="Candidate Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-stone-400 font-bold text-center p-2 bg-stone-50">
                                <User className="w-7 h-7 text-stone-300 mb-1" />
                                <span>पासपोर्ट फोटो</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Contact Bar with Mobile & WhatsApp */}
                        <div className="mt-3.5 pt-2.5 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-[13px] font-bold text-stone-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-stone-900">
                              <Phone className="w-3.5 h-3.5 text-[#E65100] shrink-0" />
                              {!matrimonyForm.mobile1 ? (
                                <span className="text-stone-400 font-normal">XXXXXXXXXX</span>
                              ) : validateMobile(matrimonyForm.mobile1) ? (
                                <span className="font-mono">{matrimonyForm.mobile1}</span>
                              ) : (
                                <span className="text-red-600 font-bold text-xs">(अमान्य मोबाइल)</span>
                              )}
                              {matrimonyForm.mobile2 && (
                                validateMobile(matrimonyForm.mobile2) ? (
                                  <span className="font-mono text-stone-700">, {matrimonyForm.mobile2}</span>
                                ) : (
                                  <span className="text-red-600 font-bold text-xs">, (अमान्य मोबाइल 2)</span>
                                )
                              )}
                            </div>
                          </div>

                          {(matrimonyForm.whatsapp || matrimonyForm.mobile1) && (
                            <div className="flex items-center gap-1.5 text-emerald-800">
                              <svg className="w-3.5 h-3.5 fill-emerald-600 shrink-0" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.815 11.815 0 018.413 3.484 11.821 11.821 0 013.48 8.413c-.003 6.558-5.339 11.893-11.893 11.893h-.005a11.882 11.882 0 01-5.683-1.448L.057 24zm6.305-3.654l.361.214a9.87 9.87 0 005.031 1.378h.004c5.448 0 9.882-4.434 9.885-9.884a9.825 9.825 0 00-2.893-6.994 9.833 9.833 0 00-6.988-2.898c-5.452 0-9.887 4.434-9.888 9.884a9.86 9.86 0 001.51 5.26l.235.374-.998 3.648 3.741-.982z" />
                              </svg>
                              {validateMobile(matrimonyForm.whatsapp || matrimonyForm.mobile1) ? (
                                <span className="font-mono text-emerald-900">{matrimonyForm.whatsapp || matrimonyForm.mobile1}</span>
                              ) : (
                                <span className="text-red-600 font-bold text-xs">(अमान्य व्हाट्सएप)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STEP 4: SHARED PUBLICATION MASTER & PRICING SELECTION */}
                    <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
                      <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full">
                            चरण 4 (Step 4)
                          </span>
                          <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                            प्रकाशन संयोजन एवं दर चयन (Shared Publication Master & Pricing)
                          </h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            जिला, साहू संगठन, पत्रिका एवं संस्करण चुनें। Admin Master के अनुसार दर स्वतः लागू होगी। आप एक ही विज्ञापन को एक साथ कई जिलों / पत्रिकाओं में जोड़ सकते हैं।
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddMatrimonyPublicationRow}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-orange-200"
                        >
                          <Plus className="w-4 h-4 text-orange-600" />
                          + दूसरा प्रकाशन जोड़ें
                        </button>
                      </div>

                      {/* Publication Rows */}
                      <div className="space-y-4">
                        {matrimonyPublications.map((pub, idx) => {
                          const filteredSangathans = pub.district_id
                            ? masters.sangathans.filter((s) => s.district_id === Number(pub.district_id))
                            : masters.sangathans;

                          const filteredEditions = pub.magazine_id
                            ? masters.editions.filter((ed) => ed.magazine_id === Number(pub.magazine_id))
                            : masters.editions;

                          const rate = getMatrimonyPublicationRate(
                            pub.district_id,
                            pub.sangathan_id,
                            pub.magazine_id,
                            pub.edition_id,
                            pub.size_code || "matrimony_standard"
                          );

                          return (
                            <div
                              key={idx}
                              className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4 relative"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-700">
                                  प्रकाशन #{idx + 1}
                                </span>
                                {matrimonyPublications.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMatrimonyPublicationRow(idx)}
                                    className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    हटाएँ
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {/* 1. District */}
                                <div>
                                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                                    1. जिला (District) *
                                  </label>
                                  <select
                                    value={pub.district_id}
                                    onChange={(e) => handleUpdateMatrimonyPublicationRow(idx, "district_id", Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500"
                                  >
                                    <option value="">-- जिला चुनें --</option>
                                    {masters.districts.map((d) => (
                                      <option key={d.id} value={d.id}>{d.name_hi}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* 2. Sangathan */}
                                <div>
                                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                                    2. साहू संगठन (Sangathan) *
                                  </label>
                                  <select
                                    value={pub.sangathan_id}
                                    onChange={(e) => handleUpdateMatrimonyPublicationRow(idx, "sangathan_id", Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500"
                                  >
                                    <option value="">-- संगठन चुनें --</option>
                                    {filteredSangathans.map((s) => (
                                      <option key={s.id} value={s.id}>{s.name_hi}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* 3. Magazine */}
                                <div>
                                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                                    3. पत्रिका (Magazine) *
                                  </label>
                                  <select
                                    value={pub.magazine_id}
                                    onChange={(e) => handleUpdateMatrimonyPublicationRow(idx, "magazine_id", Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500"
                                  >
                                    <option value="">-- पत्रिका चुनें --</option>
                                    {masters.magazines.map((m) => (
                                      <option key={m.id} value={m.id}>{m.name_hi}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* 4. Edition */}
                                <div>
                                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                                    4. संस्करण (Sanskaran) *
                                  </label>
                                  <select
                                    value={pub.edition_id}
                                    onChange={(e) => handleUpdateMatrimonyPublicationRow(idx, "edition_id", Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500"
                                  >
                                    <option value="">-- संस्करण चुनें --</option>
                                    {filteredEditions.map((ed) => (
                                      <option key={ed.id} value={ed.id}>{ed.name_hi}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Individual Rate Badge */}
                              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-200 text-xs">
                                <span className="text-stone-600 font-semibold">
                                  Admin Master अनुसार व्यक्तिगत दर (Individual Rate):
                                </span>
                                <span className="text-sm font-black text-orange-800 font-mono">
                                  ₹{rate.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Calculation & Action */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <span className="text-xs text-stone-500 font-bold block">
                            कुल प्रकाशन संख्या: {matrimonyPublications.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-700">कुल देय राशि:</span>
                            <span className="text-2xl font-black text-orange-800 font-mono">
                              ₹{matrimonyPublications.reduce((sum, p) => sum + getMatrimonyPublicationRate(p.district_id, p.sangathan_id, p.magazine_id, p.edition_id, p.size_code), 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setMatrimonyStep(3)}
                            className="px-4 py-3 sm:py-3.5 border border-stone-300 hover:bg-stone-50 bg-white rounded-xl text-xs sm:text-sm font-bold text-stone-700 transition-all cursor-pointer text-center shrink-0"
                          >
                            ← विवरण संपादित करें
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingMatrimony}
                            onClick={handleAddMatrimonyToCart}
                            className="flex-1 sm:flex-none bg-[#E65100] hover:bg-orange-700 disabled:bg-stone-300 text-white font-black text-sm px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isSubmittingMatrimony ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                कार्ट में जुड़ रहा है...
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-4 h-4" />
                                स्वीकृत करें और कार्ट में जोड़ें (Add to Cart)
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            )}
          </div>
        )}

        {/* BUSINESS ADVERTISEMENT ENTRY - 3-TIER CHATGPT WORKFLOW + SHARED PUBLICATION MASTER */}
        {screen === "business_form" && (
          <div className="space-y-8 max-w-5xl mx-auto">
            {/* Navigation & Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
              <button
                onClick={() => setScreen("home")}
                className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl shrink-0 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-stone-500" />
                वापस होमपेज
              </button>

              <div className="flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  ChatGPT व्यावसायिक विज्ञापन मॉड्यूल
                </span>
              </div>
            </div>

            {/* Introductory Banner */}
            <div className="bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-xs font-bold border border-emerald-400/30 backdrop-blur-xs">
                  <Building className="w-3.5 h-3.5" />
                  व्यावसायिक पत्रिका विज्ञापन (Business Advertisements)
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  ChatGPT से विज्ञापन डिज़ाइन करवाएँ और परिचायिका में प्रकाशित करें
                </h2>
                <p className="text-sm text-emerald-100/90 leading-relaxed">
                  नीचे दिए गए ३ आकारों में से अपनी पसंद का आकार चुनें। प्रॉम्ट कॉपी करके ChatGPT में पोस्टर बनवाएँ, लिंक या फाइनल JPG अपलोड करें और इच्छित जिला-पत्रिका चुनकर कार्ट में जोड़ें।
                </p>

                {/* 4 Step Visual Flow */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center justify-center mb-1.5">1</span>
                    <h4 className="text-xs font-bold text-white">आकार चुनें</h4>
                    <p className="text-[10px] text-emerald-200 mt-0.5">फुल, हाफ या क्वार्टर पेज</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center justify-center mb-1.5">2</span>
                    <h4 className="text-xs font-bold text-white">ChatGPT में बनाएं</h4>
                    <p className="text-[10px] text-emerald-200 mt-0.5">प्रॉम्ट कॉपी कर विज्ञापन बनाएं</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center justify-center mb-1.5">3</span>
                    <h4 className="text-xs font-bold text-white">लिंक / JPG अपलोड</h4>
                    <p className="text-[10px] text-emerald-200 mt-0.5">डिज़ाइन लिंक व JPG फ़ाइल</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center justify-center mb-1.5">4</span>
                    <h4 className="text-xs font-bold text-white">प्रकाशन व पेमेंट</h4>
                    <p className="text-[10px] text-emerald-200 mt-0.5">जिला/संगठन चुनकर कार्ट</p>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 1: SIZE SELECTION TIER */}
            <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
              <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    चरण 1 (Step 1)
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                    विज्ञापन का आकार चुनें (Select Advertisement Size)
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Full Page */}
                <div
                  onClick={() => setBusinessSelectedSize("business_full")}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    businessSelectedSize === "business_full"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-200"
                      : "border-stone-200 bg-white hover:border-emerald-300"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        सर्वश्रेष्ठ प्रभाव
                      </span>
                      {businessSelectedSize === "business_full" && (
                        <CheckCircle className="w-5 h-5 text-emerald-700" />
                      )}
                    </div>
                    <h4 className="text-base font-black text-stone-900">FULL PAGE</h4>
                    <p className="text-xs text-stone-600 font-bold font-mono">Size: 7.2 × 9.6 इंच | 300 DPI | CMYK JPG</p>
                    <p className="text-[11px] text-stone-600">
                      भव्य और संपूर्ण पत्रिका पृष्ठ, बड़े शोरूम व प्रमुख ब्रांडिंग हेतु।
                    </p>
                  </div>
                  <div className="pt-4 border-t border-stone-200/60 mt-3 flex items-center justify-between">
                    <span className="text-xs text-stone-500 font-semibold">मूल्य लगभग:</span>
                    <span className="text-lg font-black text-emerald-800 font-mono">
                      ₹{Number(masters.pricings?.find(p => p.adv_size_code === "business_full")?.price || 5000).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* 2. Half Page */}
                <div
                  onClick={() => setBusinessSelectedSize("business_half")}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    businessSelectedSize === "business_half"
                      ? "border-teal-600 bg-teal-50/50 shadow-md ring-2 ring-teal-200"
                      : "border-stone-200 bg-white hover:border-teal-300"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-teal-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        लोकप्रिय फॉर्मेट
                      </span>
                      {businessSelectedSize === "business_half" && (
                        <CheckCircle className="w-5 h-5 text-teal-700" />
                      )}
                    </div>
                    <h4 className="text-base font-black text-stone-900">HALF PAGE</h4>
                    <p className="text-xs text-stone-600 font-bold font-mono">Size: 7.2 × 4.8 इंच | 300 DPI | CMYK JPG</p>
                    <p className="text-[11px] text-stone-600">
                      संतुलित हॉरिजॉन्टल लेआउट, उत्पादों व संपर्क विवरण के लिए उपयुक्त।
                    </p>
                  </div>
                  <div className="pt-4 border-t border-stone-200/60 mt-3 flex items-center justify-between">
                    <span className="text-xs text-stone-500 font-semibold">मूल्य लगभग:</span>
                    <span className="text-lg font-black text-teal-800 font-mono">
                      ₹{Number(masters.pricings?.find(p => p.adv_size_code === "business_half")?.price || 3000).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* 3. Quarter Page */}
                <div
                  onClick={() => setBusinessSelectedSize("business_quarter")}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    businessSelectedSize === "business_quarter"
                      ? "border-slate-800 bg-slate-50/70 shadow-md ring-2 ring-slate-300"
                      : "border-stone-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        किफायती
                      </span>
                      {businessSelectedSize === "business_quarter" && (
                        <CheckCircle className="w-5 h-5 text-slate-800" />
                      )}
                    </div>
                    <h4 className="text-base font-black text-stone-900">QUARTER PAGE</h4>
                    <p className="text-xs text-stone-600 font-bold font-mono">Size: 3.6 × 4.8 इंच | 300 DPI | CMYK JPG</p>
                    <p className="text-[11px] text-stone-600">
                      कॉम्पैक्ट एवं प्रभावशाली, व्यापार कार्ड एवं मुख्य सेवाओं हेतु।
                    </p>
                  </div>
                  <div className="pt-4 border-t border-stone-200/60 mt-3 flex items-center justify-between">
                    <span className="text-xs text-stone-500 font-semibold">मूल्य लगभग:</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      ₹{Number(masters.pricings?.find(p => p.adv_size_code === "business_quarter")?.price || 1500).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: CHATGPT PROMPT GENERATOR */}
            <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
              <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    चरण 2 (Step 2)
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                    CHATGPT DESIGN PROMPT
                  </h3>
                  <p className="text-xs text-stone-600 font-bold font-mono mt-0.5">
                    {BUSINESS_SIZES_INFO[businessSelectedSize].sizeLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(businessSelectedSize)}
                    className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                      copiedPromptKey === businessSelectedSize
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    {copiedPromptKey === businessSelectedSize ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        प्रॉम्ट कॉपी हो गया!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        प्रॉम्ट कॉपी करें (Copy Prompt)
                      </>
                    )}
                  </button>

                  <a
                    href="https://chatgpt.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  >
                    ChatGPT खोलें <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="bg-stone-900 text-stone-100 p-4 sm:p-5 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed border border-stone-800 select-all shadow-inner">
                {BUSINESS_PROMPTS[businessSelectedSize]}
              </div>
            </div>

            {/* STEP 3: DESIGN LINK & FINAL JPG UPLOAD */}
            <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-100 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  चरण 3 (Step 3)
                </span>
                <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                  CHATGPT LINK & FINAL DESIGN UPLOAD
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 3A. ChatGPT Link */}
                <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-3">
                  <label className="text-xs font-bold text-stone-900 block flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    CHATGPT LINK
                  </label>
                  <input
                    type="url"
                    value={businessDesignLink}
                    onChange={(e) => setBusinessDesignLink(e.target.value)}
                    placeholder="[ यहाँ ChatGPT Design Link Paste करें ]"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 rounded-xl text-xs sm:text-sm font-medium text-stone-900 outline-none transition-all placeholder:text-stone-400"
                  />
                  <p className="text-[11px] text-stone-500">
                    ChatGPT से प्राप्त शेयर लिंक, Canva, Figma या Google Drive लिंक यहाँ पेस्ट करें।
                  </p>
                </div>

                {/* 3B. Final JPG File Upload */}
                <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-900 block flex items-center gap-1.5">
                      <UploadIcon className="w-4 h-4 text-sky-600" />
                      FINAL DESIGN UPLOAD
                    </label>
                    <span className="text-[10.5px] font-mono font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded">
                      {BUSINESS_SIZES_INFO[businessSelectedSize].uploadTitle}
                    </span>
                  </div>

                  {businessUploadedJpgUrl ? (
                    <div className="bg-white p-3 rounded-xl border border-sky-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> {BUSINESS_SIZES_INFO[businessSelectedSize].uploadTitle} अपलोडेड है
                        </span>
                        <button
                          type="button"
                          onClick={() => setBusinessUploadedJpgUrl("")}
                          className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          हटाएँ / बदलें
                        </button>
                      </div>
                      <img
                        src={businessUploadedJpgUrl}
                        alt="Uploaded Ad"
                        className="max-h-32 rounded-lg border border-stone-200 object-contain mx-auto bg-stone-50 p-1"
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        id="business-jpg-file-input"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleBusinessJpgUpload}
                        className="sr-only"
                      />
                      <label
                        htmlFor="business-jpg-file-input"
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-xl cursor-pointer transition-all text-center"
                      >
                        {uploadingField === "business_jpg" ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            JPG अपलोड हो रही है...
                          </div>
                        ) : (
                          <>
                            <UploadIcon className="w-6 h-6 text-sky-600 mb-1" />
                            <span className="text-xs font-bold text-sky-900">
                              {BUSINESS_SIZES_INFO[businessSelectedSize].uploadTitle}
                            </span>
                            <span className="text-[10px] text-stone-500 mt-0.5">
                              300 DPI CMYK JPG फ़ाइल चुनें (अधिकतम: 20 MB)
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 4: SHARED PUBLICATION MASTER & PRICING SELECTION */}
            <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    चरण 4 (Step 4)
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                    प्रकाशन संयोजन एवं दर चयन (Shared Publication Master & Pricing)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    जिला, साहू संगठन, पत्रिका एवं संस्करण चुनें। Admin Master के अनुसार दर स्वतः लागू होगी।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddPublicationRow}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-stone-300"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  + दूसरा प्रकाशन जोड़ें
                </button>
              </div>

              {/* Publication Rows */}
              <div className="space-y-4">
                {businessPublications.map((pub, idx) => {
                  const filteredSangathans = pub.district_id
                    ? masters.sangathans.filter((s) => s.district_id === Number(pub.district_id))
                    : masters.sangathans;

                  const rate = getBusinessPublicationRate(businessSelectedSize, pub.district_id, pub.sangathan_id);

                  return (
                    <div
                      key={idx}
                      className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700">
                          प्रकाशन #{idx + 1}
                        </span>
                        {businessPublications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePublicationRow(idx)}
                            className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            हटाएँ
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {/* 1. District */}
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            1. जिला (District) *
                          </label>
                          <select
                            value={pub.district_id}
                            onChange={(e) => handleUpdatePublicationRow(idx, "district_id", Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- जिला चुनें --</option>
                            {masters.districts.map((d) => (
                              <option key={d.id} value={d.id}>{d.name_hi}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Sangathan */}
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            2. साहू संगठन (Sangathan) *
                          </label>
                          <select
                            value={pub.sangathan_id}
                            onChange={(e) => handleUpdatePublicationRow(idx, "sangathan_id", Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- संगठन चुनें --</option>
                            {filteredSangathans.map((s) => (
                              <option key={s.id} value={s.id}>{s.name_hi}</option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Magazine */}
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            3. पत्रिका (Magazine) *
                          </label>
                          <select
                            value={pub.magazine_id}
                            onChange={(e) => handleUpdatePublicationRow(idx, "magazine_id", Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- पत्रिका चुनें --</option>
                            {masters.magazines.map((m) => (
                              <option key={m.id} value={m.id}>{m.name_hi}</option>
                            ))}
                          </select>
                        </div>

                        {/* 4. Edition */}
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            4. संस्करण (Sanskaran) *
                          </label>
                          <select
                            value={pub.edition_id}
                            onChange={(e) => handleUpdatePublicationRow(idx, "edition_id", Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- संस्करण चुनें --</option>
                            {masters.editions.map((ed) => (
                              <option key={ed.id} value={ed.id}>{ed.name_hi}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Individual Rate Badge */}
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-200 text-xs">
                        <span className="text-stone-600 font-semibold">
                          Admin Master अनुसार व्यक्तिगत दर (Individual Rate):
                        </span>
                        <span className="text-sm font-black text-emerald-800 font-mono">
                          ₹{rate.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation & Action */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-stone-500 font-bold block">कुल प्रकाशन संख्या: {businessPublications.length}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-700">कुल देय राशि:</span>
                    <span className="text-2xl font-black text-emerald-800 font-mono">
                      ₹{businessPublications.reduce((sum, p) => sum + getBusinessPublicationRate(businessSelectedSize, p.district_id, p.sangathan_id), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmittingBusiness}
                  onClick={handleAddBusinessToCart}
                  className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 text-white font-black text-sm px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingBusiness ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      कार्ट में जोड़ा जा रहा है...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      कार्ट में जोड़ें (Add to Cart) →
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHOPPING CART VIEW */}
        {screen === "cart" && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <ShoppingCart className="text-[#E65100]" />
              आपकी विज्ञापन कार्ट (Your Shopping Cart)
            </h3>

            {isLoadingCart ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : cart.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Cart list items */}
                <div className="lg:col-span-8 space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1.5 flex-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded ${
                          item.adType === "matrimony" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {item.adType === "matrimony" ? "विवाह विज्ञापन" : "व्यावसायिक विज्ञापन"}
                        </span>
                        
                        <h4 className="text-base font-bold text-stone-800 pt-0.5">
                          {item.adType === "matrimony" 
                            ? item.data.name 
                            : (item.data.size_hi || (item.data as BusinessFormState).businessName || "व्यावसायिक विज्ञापन")}
                        </h4>

                        {(item.data.adNumber || item.data.ad_number) && (
                          <p className="text-xs font-mono font-bold text-[#E65100]">
                            विज्ञापन क्र.: {item.data.adNumber || item.data.ad_number}
                          </p>
                        )}

                        <p className="text-xs text-stone-500">
                          प्रकाशन: {item.data.district_hi} • {item.data.sangathan_hi} • {item.data.magazine_hi} ({item.data.edition_hi})
                        </p>

                        {/* Customer Submitted Link or JPG indicator */}
                        {item.adType === "business" && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {(item.data.designLink || item.data.readyAdUrl) && (
                              <a
                                href={item.data.designLink || item.data.readyAdUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> डिज़ाइन लिंक
                              </a>
                            )}
                            {(item.data.uploadedJpgUrl || item.data.photoUrl) && (
                              <a
                                href={item.data.uploadedJpgUrl || item.data.photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 hover:bg-sky-100 flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> फाइनल JPG
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div>
                          <p className="text-xs text-stone-400 font-semibold">दर (Price)</p>
                          <p className="text-lg font-mono font-black text-stone-900">₹{Number(item.price).toLocaleString("en-IN")}/-</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* FIX: Added "Edit/Back" button so user can go back to form and fix details */}
                          <button
                            onClick={() => handleEditCartItem(item)}
                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg border border-sky-200 transition-colors cursor-pointer"
                            title="विवरण संपादित करें (Edit Details)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveCartItem(item.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 transition-colors cursor-pointer"
                            title="हटाएँ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between items-center">
                    <button
                      onClick={handleClearCart}
                      className="text-xs font-semibold text-stone-500 hover:text-red-600 bg-stone-100 hover:bg-red-50 border px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      कार्ट खाली करें (Clear Cart)
                    </button>
                    <button
                      onClick={() => setScreen("home")}
                      className="text-xs font-bold text-[#E65100] hover:underline"
                    >
                      + अन्य विज्ञापन जोड़ें
                    </button>
                  </div>
                </div>

                {/* Checkout Summary Box */}
                <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
                  <h4 className="text-sm font-bold text-stone-800 border-b pb-2">आर्डर सारांश (Order Summary)</h4>

                  <div className="space-y-2 text-sm text-stone-600 font-medium">
                    <div className="flex justify-between">
                      <span>कुल विज्ञापन संख्या:</span>
                      <span className="font-bold text-stone-800">{cart.length}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-stone-900 font-bold">
                      <span>कुल देय राशि:</span>
                      {/* FIX: Format as ₹500/- (whole rupee), not ₹0500.00 — client spec */}
                      <span className="text-lg font-black text-[#E65100] font-mono">₹{getCartTotal().toLocaleString("en-IN")}/-</span>
                    </div>
                  </div>

                  {/* Customer Checkout Form */}
                  <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">मुख्य आवेदक का नाम *</label>
                      <input
                        type="text"
                        required
                        value={checkoutName}
                        onChange={(e) => setCheckoutName(e.target.value)}
                        placeholder="उदा. राम कुमार साहू"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">मुख्य मोबाइल नंबर *</label>
                      <input
                        type="tel"
                        required
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                        placeholder="10 अंकों का संपर्क नंबर"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                      />
                      {checkoutPhone && checkoutPhone.replace(/[^0-9]/g, "").length !== 10 && (
                        <p className="text-[11px] font-bold text-red-600 mt-1">
                          ⚠️ मुख्य मोबाइल नंबर ठीक 10 अंकों का होना चाहिए।
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isCheckingOut || checkoutPhone.replace(/[^0-9]/g, "").length !== 10 || !checkoutName.trim()}
                      className="w-full bg-[#E65100] hover:bg-orange-700 disabled:bg-stone-300 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 shadow cursor-pointer transition-all active:scale-98"
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          प्रविष्टि आर्डर बन रहा है...
                        </>
                      ) : (
                        "भुगतान चरण पर जाएँ (Proceed to Pay) →"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-stone-200 rounded-2xl p-8 space-y-4 max-w-lg mx-auto">
                <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto" />
                <h4 className="text-base font-bold text-stone-600">आपकी विज्ञापन कार्ट अभी खाली है</h4>
                <p className="text-xs text-stone-400">कृपया विवाह या व्यावसायिक विज्ञापन दर्ज करके शुरू करें।</p>
                <button
                  onClick={() => setScreen("home")}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-6 py-2 rounded-lg"
                >
                  विज्ञापन दर्ज करें
                </button>
              </div>
            )}
          </div>
        )}

        {/* CHECKOUT PAYMENT GATEWAY WORKFLOW SCREEN */}
        {screen === "checkout" && orderResult && (
          <PaymentGatewayModal
            orderId={orderResult.orderId}
            totalAmount={orderResult.totalAmount}
            customerName={checkoutName || "आवेदक"}
            customerMobile={checkoutPhone}
            onPaymentSuccess={(screenshot) => {
              void handleConfirmPayment(screenshot);
            }}
            onCancel={() => setScreen("cart")}
          />
        )}

        {/* INVOICE VIEW FOR USER AFTER SUBMISSION */}
        {screen === "invoice" && activeInvoiceOrder && (
          <div className="space-y-6 print:m-0">
            <div className="flex flex-col items-center gap-3 print:hidden max-w-2xl mx-auto w-full">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-4 rounded-xl flex items-center gap-2 w-full">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>आपका आवेदन सबमिट हो गया है। एडमिन द्वारा भुगतान स्क्रीनशॉट की जाँच होते ही विज्ञापन स्वीकृत हो जाएगा।</span>
              </div>

              {/* Dynamic WhatsApp dispatch card */}
              <div className="bg-orange-50 border border-orange-200 text-orange-900 p-5 rounded-xl w-full space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">📱</span>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">व्हाट्सएप (WhatsApp) रसीद प्राप्त करें / एडमिन को भेजें</h4>
                    <p className="text-xs text-stone-600 mt-1">
                      यदि आपके पास व्हाट्सएप अधिसूचना प्राप्त नहीं हुई है, तो आप इस पावती को सीधे व्हाट्सएप पर सुरक्षित रख सकते हैं या एडमिन (9301056006) को प्रेषित कर सकते हैं।
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={`https://wa.me/9301056006?text=${encodeURIComponent(
                      `*परिचायिका 2026 - डिजिटल पावती* 📝\n\n` +
                      `नमस्ते, मेरा विज्ञापन ऑर्डर सफलतापूर्वक सबमिट हो गया है।\n\n` +
                      `*ऑर्डर विवरण:*\n` +
                      `• ऑर्डर ID: ${activeInvoiceOrder.order_id}\n` +
                      `• कुल राशि: ₹${activeInvoiceOrder.total_amount}\n` +
                      `• तिथि: ${new Date(activeInvoiceOrder.payment_date || "").toLocaleDateString("hi-IN")}\n\n` +
                      `🔗 डिजिटल पावती देखें/डाउनलोड करें: ${window.location.protocol}//${window.location.host}/?order=${activeInvoiceOrder.order_id}\n\n` +
                      `कृपया भुगतान सत्यापित कर स्वीकृति प्रदान करें। धन्यवाद!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    💬 व्हाट्सएप पर रसीद भेजें / प्राप्त करें
                  </a>
                </div>
              </div>
            </div>

            <InvoicePDF
              order={activeInvoiceOrder}
              onClose={() => {
                setActiveInvoiceOrder(null);
                setScreen("home");
              }}
            />
          </div>
        )}

        {/* ADMIN LOGIN & DASHBOARD MOUNT */}
        {screen === "admin" && (
          <AdminPanel />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-stone-200 px-6 py-8 shrink-0 print:hidden mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">मुद्रण प्रकाशन कार्यालय</span>
              <p className="text-xs text-stone-600 leading-relaxed font-semibold">
                गांधी नगर, पहाड़ी चौक,<br />गुढ़ियारी, रायपुर (छत्तीसगढ़)
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">पूछताछ 1</span>
                <p className="text-xs text-stone-900 font-bold">7647924636</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">पूछताछ 2</span>
                <p className="text-xs text-stone-900 font-bold">9300717080</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">भुगतान सहायता</span>
                <p className="text-xs text-[#E65100] font-black underline decoration-orange-300">9301056006</p>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end w-full md:w-auto">
            <div className="h-9 px-4 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center mb-3">
              <span className="text-[9px] text-orange-700 font-bold tracking-widest uppercase">SECURE PAYMENT HUB</span>
            </div>
            <p className="text-[11px] text-stone-400">© 2026 परिचायिका | Powered by Indian Press, Raipur</p>
          </div>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR (Android / iOS touch optimized) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg px-2 py-1.5 safe-bottom flex justify-around items-center print:hidden">
        <button
          onClick={() => setScreen("home")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            screen === "home" ? "text-[#E65100] font-bold" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">होम</span>
        </button>

        <button
          onClick={() => {
            setSavedAdId(null);
            setSavedAdNumber("");
            setSelectedPubId("");
            setSelectedSizeCode("");
            setMatrimonyStep(1);
            fetchNextAdNumbers();
            setScreen("matrimony_form");
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            screen === "matrimony_form" ? "text-[#E65100] font-bold" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">विवाह</span>
        </button>

        <button
          onClick={() => {
            setSavedAdId(null);
            setSavedAdNumber("");
            setSelectedPubId("");
            setSelectedSizeCode("");
            setBusinessStep(1);
            fetchNextAdNumbers();
            setScreen("business_form");
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            screen === "business_form" ? "text-emerald-700 font-bold" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <Building className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">व्यापार</span>
        </button>

        <button
          onClick={() => setScreen("cart")}
          className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            screen === "cart" ? "text-[#E65100] font-bold" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                {cart.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">कार्ट</span>
        </button>

        <button
          onClick={() => setScreen(screen === "admin" ? "home" : "admin")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            screen === "admin" ? "text-stone-900 font-bold" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">एडमिन</span>
        </button>
      </nav>
    </div>
  );
}
