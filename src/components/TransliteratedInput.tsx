import React, { useState, useEffect, useRef } from "react";
import { Languages, Loader2, Mic, MicOff, Sparkles, Plus } from "lucide-react";

export function formatDegreesToHindi(text: string): string {
  if (!text) return text;
  let res = text;

  // Clean replacements using safe word boundaries & regexes
  const replacements: [RegExp, string][] = [
    // Schooling
    [/\b(10th\s*pass|10th\s*class|10th|दसवीं\s*पास|दसवीं|10\s*वीं\s*पास|10\s*वीं)\b/gi, "10वीं"],
    [/\b(12th\s*pass|12th\s*class|12th|बारहवीं\s*पास|बारहवीं|12\s*वीं\s*पास|12\s*वीं)\b/gi, "12वीं"],
    
    // Commerce
    [/\b(m\.?\s*com\.?|mcom|एम\.?\s*कॉम\.?|म\.?\s*कॉम\.?|एमकॉम)\b/gi, "एम.कॉम."],
    [/\b(b\.?\s*com\.?|bcom|बी\.?\s*कॉम\.?|बीकॉम)\b/gi, "बी.कॉम."],
    
    // Arts
    [/\b(m\.?\s*a\.?|ma|एम\.?\s*ए\.?|एमए)\b/gi, "एम.ए."],
    [/\b(b\.?\s*a\.?|ba|बी\.?\s*ए\.?|बीए)\b/gi, "बी.ए."],
    
    // Science
    [/\b(m\.?\s*sc\.?|msc|एम\.?\s*एससी\.?|एमएससी|एम\.?\s*एस\.?\s*सी\.?)\b/gi, "एम.एससी."],
    [/\b(b\.?\s*sc\.?|bsc|बी\.?\s*एससी\.?|बीएससी|बी\.?\s*एस\.?\s*सी\.?)\b/gi, "बी.एससी."],
    
    // Engineering & Technology
    [/\b(m\.?\s*tech\.?|mtech|एम\.?\s*टेक\.?|एमटेक)\b/gi, "एम.टेक."],
    [/\b(b\.?\s*tech\.?|btech|बी\.?\s*टेक\.?|बीटेक)\b/gi, "बी.टेक."],
    [/\b(m\.?\s*e\.?|me|एम\.?\s*ई\.?|एमई)\b/gi, "एम.ई."],
    [/\b(b\.?\s*e\.?|be|बी\.?\s*ई\.?|बीई)\b/gi, "बी.ई."],
    
    // Computer Applications & Management
    [/\b(m\.?\s*c\.?\s*a\.?|mca|एम\.?\s*सी\.?\s*ए\.?|एमसीए)\b/gi, "एमसीए"],
    [/\b(b\.?\s*c\.?\s*a\.?|bca|बी\.?\s*सी\.?\s*ए\.?|बीसीए)\b/gi, "बीसीए"],
    [/\b(m\.?\s*b\.?\s*a\.?|mba|एम\.?\s*बी\.?\s*ए\.?|एमबीए)\b/gi, "एमबीए"],
    [/\b(b\.?\s*b\.?\s*a\.?|bba|बी\.?\s*बी\.?\s*ए\.?|बीबीए)\b/gi, "बीबीए"],
    
    // Medical & Paramedical
    [/\b(m\.?\s*b\.?\s*b\.?\s*s\.?|mbbs|एम\.?\s*बी\.?\s*बी\.?\s*एस\.?|एमबीबीएस)\b/gi, "एमबीबीएस"],
    [/\b(b\.?\s*d\.?\s*s\.?|bds|बी\.?\s*डी\.?\s*एस\.?|बीडीएस)\b/gi, "बीडीएस"],
    [/\b(b\.?\s*a\.?\s*m\.?\s*s\.?|bams|बी\.?\s*ए\.?\s*एम\.?\s*एस\.?|बीएएमएस)\b/gi, "बीएएमएस"],
    [/\b(b\.?\s*h\.?\s*m\.?\s*s\.?|bhms|बी\.?\s*एच\.?\s*एम\.?\s*एस\.?|बीएचएमएस)\b/gi, "बीएचएमएस"],
    [/\b(m\.?\s*d\.?|md|एम\.?\s*डी\.?|एमडी)\b/gi, "एम.डी."],
    [/\b(m\.?\s*s\.?|ms|एम\.?\s*एस\.?|एमएस)\b/gi, "एम.एस."],
    
    // Law
    [/\b(l\.?\s*l\.?\s*m\.?|llm|एल\.?\s*एल\.?\s*एम\.?|एलएलएम)\b/gi, "एलएलएम"],
    [/\b(l\.?\s*l\.?\s*b\.?|llb|एल\.?\s*एल\.?\s*बी\.?|एलएलबी)\b/gi, "एलएलबी"],
    
    // Education & Teaching
    [/\b(m\.?\s*ed\.?|med|एम\.?\s*एड\.?|एमएड)\b/gi, "एम.एड."],
    [/\b(b\.?\s*ed\.?|bed|बी\.?\s*एड\.?|बीएड)\b/gi, "बी.एड."],
    [/\b(d\.?\s*el\.?\s*ed\.?|deled|डी\.?\s*एल\.?\s*एड\.?|डीएलएड)\b/gi, "डी.एल.एड."],
    [/\b(d\.?\s*ed\.?|ded|डी\.?\s*एड\.?|डीएड)\b/gi, "डी.एड."],
    [/\b(c\s*tet|ctet|सीटेट|सी\.?\s*टैट)\b/gi, "सीटेट"],
    [/\b(t\s*et|tet|टेट|टी\.?\s*टैट)\b/gi, "टीईटी"],
    
    // Doctorate & Higher Research
    [/\b(ph\.?\s*d\.?|phd|पी\.?\s*एच\.?\s*डी\.?|पीएचडी|पीएच\.?\s*डी\.?)\b/gi, "पीएच.डी."],
    [/\b(post\s*doctorate|पोस्ट\s*डॉक्टरेट)\b/gi, "पोस्ट डॉक्टरेट"],
    
    // Professional / Finance
    [/\b(c\.?\s*a\.?|ca|सी\.?\s*ए\.?|सीए)\b/gi, "सीए"],
    [/\b(c\.?\s*s\.?|cs|सी\.?\s*एस\.?|सीएस)\b/gi, "सीएस"],
    [/\b(c\.?\s*m\.?\s*a\.?|cma|icwa|सीएमए|सी\.?\s*एम\.?\s*ए\.?)\b/gi, "सीएमए"],
    
    // Pharmacy
    [/\b(m\.?\s*pharm\.?|mpharm|m\s*pharma|एम\.?\s*फार्मा|एमफार्मा|एम\.?\s*फार्म)\b/gi, "एम.फार्मा"],
    [/\b(b\.?\s*pharm\.?|bpharm|b\s*pharma|बी\.?\s*फार्मा|बीफार्मा|बी\.?\s*फार्म)\b/gi, "बी.फार्मा"],
    [/\b(d\.?\s*pharm\.?|dpharm|d\s*pharma|डी\.?\s*फार्मा|डीफार्मा|डी\.?\s*फार्म)\b/gi, "डी.फार्मा"],
    
    // Computer & Technical Diplomas
    [/\b(pgdca|पीजीडीसीए|पी\.?\s*जी\.?\s*डी\.?\s*सी\.?\s*ए\.?)\b/gi, "पीजीडीसीए"],
    [/\b(dca|डीसीए|डी\.?\s*सी\.?\s*ए\.?)\b/gi, "डीसीए"],
    [/\b(iti|आईटीआई|आई\.?\s*टी\.?\s*आई\.?)\b/gi, "आईटीआई"],
    [/\b(polytechnic|पॉलिटेक्निक|पोलिटेक्निक)\b/gi, "पॉलिटेक्निक"],
    [/\b(diploma|डिप्लोमा)\b/gi, "डिप्लोमा"],
    
    // General degree terms
    [/\b(post\s*graduat(e|ion)|पोस्ट\s*ग्रेजुएशन|पोस्ट\s*ग्रेजुएट|स्नातकोत्तर)\b/gi, "स्नातकोत्तर"],
    [/\b(graduat(e|ion)|ग्रेजुएशन|ग्रेजुएट|स्नातक)\b/gi, "स्नातक"],
    [/\b(honours|hons|ऑनर्स)\b/gi, "ऑनर्स"],
    [/\b(pursuing|running|adhyayanrat|studying)\b/gi, "अध्ययनरत"],
    [/\b(pass|passed|passed\s*out|completed|passedout)\b/gi, "उत्तीर्ण"],
    [/\b(first\s*division|1st\s*division|1st\s*div|first\s*class)\b/gi, "प्रथम श्रेणी"],
    [/\b(second\s*division|2nd\s*division|2nd\s*div|second\s*class)\b/gi, "द्वितीय श्रेणी"],
    [/\b(third\s*division|3rd\s*division|3rd\s*div)\b/gi, "तृतीय श्रेणी"],
    [/\b(gold\s*medalist|gold\s*medal)\b/gi, "स्वर्ण पदक विजेता"],
    
    // Common Streams & Subjects
    [/\b(computer\s*science|cse|comp\s*sci)\b/gi, "कंप्यूटर साइंस"],
    [/\b(information\s*technology)\b/gi, "सूचना प्रौद्योगिकी"],
    [/\b(commerce)\b/gi, "वाणिज्य"],
    [/\b(science)\b/gi, "विज्ञान"],
    [/\b(arts)\b/gi, "कला"],
    [/\b(maths|mathematics)\b/gi, "गणित"],
    [/\b(biology)\b/gi, "जीव विज्ञान"],
    [/\b(chemistry)\b/gi, "रसायन शास्त्र"],
    [/\b(physics)\b/gi, "भौतिक विज्ञान"],
    [/\b(economics)\b/gi, "अर्थशास्त्र"],
    [/\b(english)\b/gi, "अंग्रेजी"],
    [/\b(hindi)\b/gi, "हिंदी"],
    [/\b(sanskrit)\b/gi, "संस्कृत"]
  ];

  for (const [pat, rep] of replacements) {
    res = res.replace(pat, rep);
  }

  return res;
}

const COMMON_QUALIFICATIONS = [
  "10वीं",
  "12वीं",
  "बी.कॉम.",
  "एम.कॉम.",
  "बी.एससी.",
  "एम.एससी.",
  "बी.ए.",
  "एम.ए.",
  "बी.टेक.",
  "बी.ई.",
  "बीसीए",
  "एमसीए",
  "बीबीए",
  "एमबीए",
  "बी.एड.",
  "डी.एल.एड.",
  "आईटीआई",
  "पीजीडीसीए",
  "डीसीए",
  "स्नातक",
  "स्नातकोत्तर"
];

interface TransliteratedInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  isTextArea?: boolean;
  rows?: number;
  isEducation?: boolean;
}

export default function TransliteratedInput({
  id,
  value,
  onChange,
  label,
  placeholder = "",
  required = false,
  isTextArea = false,
  rows = 2,
  isEducation = false
}: TransliteratedInputProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const [isTransliterating, setIsTransliterating] = useState(false);
  const [autoHindi, setAutoHindi] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isEducationField = isEducation || label.includes("शैक्षणिक") || label.includes("Education");

  // Keep local value in sync when value changes from outside (e.g. form reset or prefill)
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || "");
    }
  }, [value]);

  const performTransliteration = async (textToConvert: string) => {
    if (!textToConvert || !textToConvert.trim() || !autoHindi) return;

    // Step 1: Format known degrees first
    let processedText = formatDegreesToHindi(textToConvert);

    // Step 2: If the text is already completely in Hindi / punctuation / numbers, just set it
    const isHindiOnly = /^[\u0900-\u097F\s\d+\-.,()/@#&]+$/.test(processedText);
    if (isHindiOnly) {
      setLocalValue(processedText);
      onChange(processedText);
      return;
    }

    setIsTransliterating(true);
    try {
      // Split by comma if multiple items
      if (processedText.includes(",")) {
        const parts = processedText.split(",");
        const convertedParts = await Promise.all(
          parts.map(async (part) => {
            const trimmed = part.trim();
            if (!trimmed) return part;

            const partFormatted = formatDegreesToHindi(trimmed);
            const isPartHindi = /^[\u0900-\u097F\s\d+\-.,()/@#&]+$/.test(partFormatted);
            if (isPartHindi) return partFormatted;

            try {
              const res = await fetch("/api/transliterate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: partFormatted })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.result) {
                  return formatDegreesToHindi(data.result);
                }
              }
            } catch (err) {
              console.error("Part transliteration failed:", err);
            }
            return partFormatted;
          })
        );
        const finalResult = formatDegreesToHindi(convertedParts.join(", "));
        setLocalValue(finalResult);
        onChange(finalResult);
        return;
      }

      // Single item transliteration
      const res = await fetch("/api/transliterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: processedText })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const finalResult = formatDegreesToHindi(data.result);
          setLocalValue(finalResult);
          onChange(finalResult);
        }
      }
    } catch (err) {
      console.error("Transliteration request failed:", err);
    } finally {
      setIsTransliterating(false);
    }
  };

  // While user is actively typing, DO NOT overwrite or mess up their cursor!
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const rawVal = e.target.value;
    setLocalValue(rawVal);
    onChange(rawVal);
  };

  // Convert to Hindi only when focus leaves this input field (onBlur)
  const handleBlur = () => {
    if (autoHindi && localValue.trim().length > 0) {
      performTransliteration(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !isTextArea) {
      if (autoHindi && localValue.trim().length > 0) {
        performTransliteration(localValue);
      }
    }
  };

  // Add degree chip directly into education field
  const handleAddDegreeChip = (degree: string) => {
    const currentVal = localValue.trim();
    let newVal = "";
    if (!currentVal) {
      newVal = degree;
    } else if (currentVal.endsWith(",")) {
      newVal = `${currentVal} ${degree}`;
    } else {
      newVal = `${currentVal}, ${degree}`;
    }
    setLocalValue(newVal);
    onChange(newVal);
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("⚠️ आपका ब्राउज़र वॉयस टाइपिंग का समर्थन नहीं करता है। कृपया गूगल क्रोम का उपयोग करें।");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "hi-IN";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const space = localValue.trim() ? (isEducationField ? ", " : " ") : "";
          const newVal = formatDegreesToHindi(localValue + space + transcript);
          setLocalValue(newVal);
          onChange(newVal);
        }
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition failed to start:", err);
      setIsListening(false);
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col space-y-1.5" id={id}>
      <div className="w-full flex flex-wrap items-center justify-between gap-1.5 min-w-0">
        <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center gap-1 min-w-0 break-words">
          <span>{label}</span>
          {required && <span className="text-red-500 font-bold shrink-0">*</span>}
        </label>
        
        <div className="flex items-center gap-1.5">
          {/* Quick Convert Button */}
          {localValue && /[a-zA-Z]/.test(localValue) && (
            <button
              type="button"
              onClick={() => performTransliteration(localValue)}
              className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              title="हिंदी में बदलें"
            >
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>हिंदी करें</span>
            </button>
          )}

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`shrink-0 p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
              isListening
                ? "bg-red-500 text-white border-red-600 animate-pulse"
                : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
            }`}
            title={isListening ? "सुनना बंद करें" : "बोलकर टाइप करें (Voice Typing)"}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setAutoHindi(!autoHindi)}
            className={`shrink-0 text-[11px] md:text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer select-none border ${
              autoHindi
                ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 shadow-2xs"
                : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
            }`}
            title="रोमन में टाइप करने पर फ़ील्ड छोड़ने पर स्वतः हिंदी में बदलने की व्यवस्था (क्लिक करके भाषा बदलें)"
          >
            <Languages className="w-3.5 h-3.5 shrink-0 text-orange-600" />
            <span>{autoHindi ? "हिन्दी" : "English"}</span>
            <span className="text-[10px] text-stone-400 font-normal">| {autoHindi ? "English" : "हिन्दी"}</span>
            {isTransliterating && <Loader2 className="w-3 h-3 animate-spin text-orange-600 shrink-0" />}
          </button>
        </div>
      </div>

      {isTextArea ? (
        <textarea
          rows={rows}
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder || `${label} रोमन में लिखें (उदा. 12th, B.Com, MBA), फ़ील्ड छोड़ते ही हिंदी में बदल जायेगा...`}
          className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm md:text-[15px] shadow-xs"
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || `${label} रोमन में लिखें, फ़ील्ड छोड़ते ही हिंदी में बदल जायेगा...`}
          className="w-full block box-border min-w-0 px-3.5 py-2.5 border border-stone-300 rounded-xl text-stone-800 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm md:text-[15px] shadow-xs"
        />
      )}

      {/* Quick Degree Selection Chips for Education Field */}
      {isEducationField && (
        <div className="pt-1">
          <p className="text-[11px] font-bold text-stone-500 mb-1.5 flex items-center gap-1">
            <Plus className="w-3 h-3 text-orange-600" />
            <span>त्वरित डिग्री चुनें (क्लिक करके जोड़ें):</span>
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {COMMON_QUALIFICATIONS.map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => handleAddDegreeChip(deg)}
                className="text-[11px] font-semibold px-2 py-0.5 bg-stone-100 hover:bg-orange-100 hover:text-orange-900 hover:border-orange-300 text-stone-700 border border-stone-200 rounded-md transition-colors cursor-pointer active:scale-95"
              >
                + {deg}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
