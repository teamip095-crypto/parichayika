// ==============================================================================
// PARICHAYIKA 2026 — PRODUCTION ENGLISH -> HINDI TRANSLITERATION & PHONETIC ENGINE
// ==============================================================================

// Helper to convert Hindi numerals to English ASCII digits
export function convertHindiNumeralsToEnglish(str: string): string {
  const mapping: { [key: string]: string } = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9"
  };
  return str.replace(/[०-९]/g, (m) => mapping[m] || m);
}

// 1. High-Frequency Hindi Dictionary for Names, Surnames, Locations, Relationships, and Terms
const PHONETIC_DICTIONARY: Record<string, string> = {
  // Surnames & Castes
  "sahu": "साहू",
  "sharma": "शर्मा",
  "verma": "वर्मा",
  "gupta": "गुप्ता",
  "patel": "पटेल",
  "dewangan": "देवांगन",
  "yadav": "यादव",
  "singh": "सिंह",
  "agrawal": "अग्रवाल",
  "agarwal": "अग्रवाल",
  "jain": "जैन",
  "soni": "सोनी",
  "mishra": "मिश्रा",
  "pandey": "पाण्डेय",
  "shukla": "शुक्ला",
  "dubey": "दुबे",
  "tiwari": "तिवारी",
  "joshi": "जोशी",
  "bhat": "भट्ट",
  "bhatt": "भट्ट",
  "kashyap": "कश्यप",
  "chandrakar": "चंद्राकर",
  "sahuu": "साहू",
  "kumari": "कुमारी",
  "kumar": "कुमार",
  "lal": "लाल",
  "prasad": "प्रसाद",
  "choudhary": "चौधरी",
  "chowdhury": "चौधरी",
  "deshmukh": "देशमुख",
  "rathore": "राठौर",
  "nayak": "नायक",
  "sen": "सेन",
  "bisen": "बिसेन",

  // Popular First Names
  "ramesh": "रमेश",
  "suresh": "सुरेश",
  "rajesh": "राजेश",
  "mahesh": "महेश",
  "dinesh": "दिनेश",
  "mukesh": "मुकेश",
  "rakesh": "राकेश",
  "anil": "अनिल",
  "sunil": "सुनील",
  "sanjay": "संजय",
  "vijay": "विजय",
  "ajay": "अजय",
  "vinod": "विनोद",
  "manoj": "मनोज",
  "pankaj": "पंकज",
  "neeraj": "नीरज",
  "rahul": "राहुल",
  "rohit": "रोहित",
  "amit": "अमित",
  "sumit": "सुमित",
  "ashwani": "अश्विनी",
  "ashwini": "अश्विनी",
  "ashwin": "अश्विन",
  "vikas": "विकास",
  "vikram": "विक्रम",
  "deepak": "दीपक",
  "pradeep": "प्रदीप",
  "sandeep": "संदीप",
  "kuldeep": "कुलदीप",
  "santosh": "संतोष",
  "alok": "आलोक",
  "anand": "आनंद",
  "ashok": "अशोक",
  "bharat": "भरत",
  "chetna": "चेतना",
  "divya": "दिव्या",
  "geeta": "गीता",
  "hemant": "हेमंत",
  "kamal": "कमल",
  "kiran": "किरण",
  "laxmi": "लक्ष्मी",
  "mamta": "ममता",
  "manju": "मंजू",
  "meena": "मीना",
  "mohan": "मोहन",
  "neha": "नेहा",
  "pooja": "पूजा",
  "poonam": "पूनम",
  "priya": "प्रिया",
  "priyanka": "प्रियंका",
  "pushpa": "पुष्पा",
  "radha": "राधा",
  "rajni": "रजनी",
  "rekha": "रेखा",
  "ritu": "रितु",
  "roshni": "रोशनी",
  "rupa": "रूपा",
  "sarita": "सरिता",
  "seema": "सीमा",
  "shashi": "शशि",
  "shobha": "शोभा",
  "sneha": "स्नेहा",
  "sonam": "सोनम",
  "sudha": "सुधा",
  "sunita": "सुनीता",
  "sushma": "सुषमा",
  "swati": "स्वाति",
  "tanu": "तनु",
  "uma": "उमा",
  "vandana": "वंदना",
  "varsha": "वर्षा",

  // Towns & Districts (Chhattisgarh & Central India)
  "raipur": "रायपुर",
  "bilaspur": "बिलासपुर",
  "durg": "दुर्ग",
  "bhilai": "भिलाई",
  "rajnandgaon": "राजनांदगांव",
  "korba": "कोरबा",
  "raigarh": "रायगढ़",
  "jagdalpur": "जगदलपुर",
  "ambikapur": "अंबिकापुर",
  "dhamtari": "धमतरी",
  "mahasamund": "महासमुंद",
  "kanker": "कांकेर",
  "kawardha": "कवर्धा",
  "kabirdham": "कबीरधाम",
  "janjgir": "जांजगीर",
  "champa": "चांपा",
  "bemetara": "बेमेतरा",
  "balod": "बालोद",
  "balodabazar": "बलौदाबाजार",
  "gariaband": "गरियाबंद",
  "mungeli": "मुंगेली",
  "surajpur": "सूरजपुर",
  "balrampur": "बलरामपुर",
  "jashpur": "जशपुर",
  "korea": "कोरिया",
  "bastar": "बस्तर",
  "dantewada": "दंतेवाड़ा",
  "sukma": "सुकमा",
  "bijapur": "बीजापुर",
  "narayanpur": "नारायणपुर",
  "kondagaon": "कोंडागांव",
  "khairagarh": "खैरागढ़",
  "sarangarh": "सारंगढ़",
  "chhattisgarh": "छत्तीसगढ़",
  "cg": "छ.ग.",
  "india": "भारत",

  // Occupations & Relationships
  "father": "पिता",
  "mother": "माता",
  "brother": "भाई",
  "sister": "बहन",
  "son": "पुत्र",
  "daughter": "पुत्री",
  "husband": "पति",
  "wife": "पत्नी",
  "service": "सेवा",
  "business": "व्यवसाय",
  "job": "नौकरी",
  "teacher": "शिक्षक",
  "engineer": "इंजीनियर",
  "doctor": "डॉक्टर",
  "lawyer": "अधिवक्ता",
  "advocate": "अधिवक्ता",
  "farmer": "कृषक",
  "agriculture": "कृषि",
  "retired": "सेवानिवृत्त",
  "student": "छात्र",
  "self": "स्वयं",
  "shop": "दुकान",
  "store": "स्टोर",
  "private": "निजी",
  "government": "शासकीय",
  "housewife": "गृहणी"
};

// 2. Comprehensive Pre-Transliteration Fixes (Titles, Degrees, Occupations)
export function applyPreTransliterationFixes(text: string): { processed: string; hasOnlyKnownTerms: boolean } {
  if (!text) return { processed: text, hasOnlyKnownTerms: false };

  let processed = text.trim();

  // Honorifics & Titles
  processed = processed.replace(/(^|\s)(smt\.?|shrimati|shreemati|mrs\.?)(?=\s|$)/gi, "$1श्रीमती ");
  processed = processed.replace(/(^|\s)(shri\.?|shree|mr\.?|sri)(?=\s|$)/gi, "$1श्री ");
  processed = processed.replace(/(^|\s)(late\.?|lt\.?|sw\.?|swargiya|swargiye|expired|deceased|passed\s*away)(?=\s|$)/gi, "$1स्व. ");
  processed = processed.replace(/(^|\s)(dr\.?|doctor)(?=\s|$)/gi, "$1डॉ. ");
  processed = processed.replace(/(^|\s)(adv\.?|advocate|vakeel|vakil|lawyer)(?=\s|$)/gi, "$1अधिवक्ता ");
  processed = processed.replace(/(^|\s)(er\.?|engineer)(?=\s|$)/gi, "$1इंजी. ");
  processed = processed.replace(/(^|\s)(prof\.?|professor)(?=\s|$)/gi, "$1प्रो. ");
  processed = processed.replace(/(^|\s)(pt\.?|pandit)(?=\s|$)/gi, "$1पं. ");
  processed = processed.replace(/(^|\s)(ku\.?|kumari|ms\.?|sushri)(?=\s|$)/gi, "$1कु. ");

  // Degree & Educational Qualifications
  processed = processed.replace(/\b(10th\s*pass|10th\s*class|10th|10\s*th|दसवीं\s*पास|दसवीं|10\s*वीं\s*पास|10\s*वीं)\b/gi, "10वीं");
  processed = processed.replace(/\b(12th\s*pass|12th\s*class|12th|12\s*th|बारहवीं\s*पास|बारहवीं|12\s*वीं\s*पास|12\s*वीं)\b/gi, "12वीं");
  processed = processed.replace(/\b(m\.?\s*com\.?|mcom|एम\.?\s*कॉम\.?|म\.?\s*कॉम\.?|एमकॉम)\b/gi, "एम.कॉम.");
  processed = processed.replace(/\b(b\.?\s*com\.?|bcom|बी\.?\s*कॉम\.?|बीकॉम)\b/gi, "बी.कॉम.");
  processed = processed.replace(/\b(m\.?\s*a\.?|ma|एम\.?\s*ए\.?|एमए)\b/gi, "एम.ए.");
  processed = processed.replace(/\b(b\.?\s*a\.?|ba|बी\.?\s*ए\.?|बीए)\b/gi, "बी.ए.");
  processed = processed.replace(/\b(m\.?\s*sc\.?|msc|एम\.?\s*एससी\.?|एमएससी|एम\.?\s*एस\.?\s*सी\.?)\b/gi, "एम.एससी.");
  processed = processed.replace(/\b(b\.?\s*sc\.?|bsc|बी\.?\s*एससी\.?|बीएससी|बी\.?\s*एस\.?\s*सी\.?)\b/gi, "बी.एससी.");
  processed = processed.replace(/\b(m\.?\s*tech\.?|mtech|एम\.?\s*टेक\.?|एमटेक)\b/gi, "एम.टेक.");
  processed = processed.replace(/\b(b\.?\s*tech\.?|btech|बी\.?\s*टेक\.?|बीटेक)\b/gi, "बी.टेक.");
  processed = processed.replace(/\b(m\.?\s*e\.?|me|एम\.?\s*ई\.?|एमई)\b/gi, "एम.ई.");
  processed = processed.replace(/\b(b\.?\s*e\.?|be|बी\.?\s*ई\.?|बीई)\b/gi, "बी.ई.");
  processed = processed.replace(/\b(m\.?\s*c\.?\s*a\.?|mca|एम\.?\s*सी\.?\s*ए\.?|एमसीए)\b/gi, "एमसीए");
  processed = processed.replace(/\b(b\.?\s*c\.?\s*a\.?|bca|बी\.?\s*सी\.?\s*ए\.?|बीसीए)\b/gi, "बीसीए");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*a\.?|mba|एम\.?\s*बी\.?\s*ए\.?|एमबीए)\b/gi, "एमबीए");
  processed = processed.replace(/\b(b\.?\s*b\.?\s*a\.?|bba|बी\.?\s*बी\.?\s*ए\.?|बीबीए)\b/gi, "बीबीए");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*b\.?\s*s\.?|mbbs|एम\.?\s*बी\.?\s*बी\.?\s*एस\.?|एमबीबीएस)\b/gi, "एमबीबीएस");
  processed = processed.replace(/\b(b\.?\s*d\.?\s*s\.?|bds|बी\.?\s*डी\.?\s*एस\.?|बीडीएस)\b/gi, "बीडीएस");
  processed = processed.replace(/\b(b\.?\s*a\.?\s*m\.?\s*s\.?|bams|बी\.?\s*ए\.?\s*एम\.?\s*एस\.?|बीएएमएस)\b/gi, "बीएएमएस");
  processed = processed.replace(/\b(b\.?\s*h\.?\s*m\.?\s*s\.?|bhms|बी\.?\s*एच\.?\s*एम\.?\s*एस\.?|बीएचएमएस)\b/gi, "बीएचएमएस");
  processed = processed.replace(/\b(m\.?\s*d\.?|md|एम\.?\s*डी\.?|एमडी)\b/gi, "एम.डी.");
  processed = processed.replace(/\b(m\.?\s*s\.?|ms|एम\.?\s*एस\.?|एमएस)\b/gi, "एम.एस.");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*m\.?|llm|एल\.?\s*एल\.?\s*एम\.?|एलएलएम)\b/gi, "एलएलएम");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*b\.?|llb|एल\.?\s*एल\.?\s*बी\.?|एलएलबी)\b/gi, "एलएलबी");
  processed = processed.replace(/\b(m\.?\s*ed\.?|med|एम\.?\s*एड\.?|एमएड)\b/gi, "एम.एड.");
  processed = processed.replace(/\b(b\.?\s*ed\.?|bed|बी\.?\s*एड\.?|बीएड)\b/gi, "बी.एड.");
  processed = processed.replace(/\b(d\.?\s*el\.?\s*ed\.?|deled|डी\.?\s*एल\.?\s*एड\.?|डीएलएड)\b/gi, "डी.एल.एड.");
  processed = processed.replace(/\b(d\.?\s*ed\.?|ded|डी\.?\s*एड\.?|डीएड)\b/gi, "डी.एड.");
  processed = processed.replace(/\b(c\s*tet|ctet|सीटेट|सी\.?\s*टैट)\b/gi, "सीटेट");
  processed = processed.replace(/\b(t\s*et|tet|टेट|टी\.?\s*टैट)\b/gi, "टीईटी");
  processed = processed.replace(/\b(ph\.?\s*d\.?|phd|पी\.?\s*एच\.?\s*डी\.?|पीएचडी|पीएच\.?\s*डी\.?)\b/gi, "पीएच.डी.");
  processed = processed.replace(/\b(post\s*doctorate|पोस्ट\s*डॉक्टरेट)\b/gi, "पोस्ट डॉक्टरेट");
  processed = processed.replace(/\b(c\.?\s*a\.?|ca|सी\.?\s*ए\.?|सीए)\b/gi, "सीए");
  processed = processed.replace(/\b(c\.?\s*s\.?|cs|सी\.?\s*एस\.?|सीएस)\b/gi, "सीएस");
  processed = processed.replace(/\b(c\.?\s*m\.?\s*a\.?|cma|icwa|सीएमए|सी\.?\s*एम\.?\s*ए\.?)\b/gi, "सीएमए");
  processed = processed.replace(/\b(m\.?\s*pharm\.?|mpharm|m\s*pharma|एम\.?\s*फार्मा|एमफार्मा|एम\.?\s*फार्म)\b/gi, "एम.फार्मा");
  processed = processed.replace(/\b(b\.?\s*pharm\.?|bpharm|b\s*pharma|बी\.?\s*फार्मा|बीफार्मा|बी\.?\s*फार्म)\b/gi, "बी.फार्मा");
  processed = processed.replace(/\b(d\.?\s*pharm\.?|dpharm|d\s*pharma|डी\.?\s*फार्मा|डीफार्मा|डी\.?\s*फार्म)\b/gi, "डी.फार्मा");
  processed = processed.replace(/\b(pgdca|पीजीडीसीए|पी\.?\s*जी\.?\s*डी\.?\s*सी\.?\s*ए\.?)\b/gi, "पीजीडीसीए");
  processed = processed.replace(/\b(dca|डीसीए|डी\.?\s*सी\.?\s*ए\.?)\b/gi, "डीसीए");
  processed = processed.replace(/\b(iti|आईटीआई|आई\.?\s*टी\.?\s*आई\.?)\b/gi, "आईटीआई");
  processed = processed.replace(/\b(polytechnic|पॉलिटेक्निक|पोलिटेक्निक)\b/gi, "पॉलिटेक्निक");
  processed = processed.replace(/\b(diploma|डिप्लोमा)\b/gi, "डिप्लोमा");
  processed = processed.replace(/\b(post\s*graduat(e|ion)|पोस्ट\s*ग्रेजुएशन|पोस्ट\s*ग्रेजुएट|स्नातकोत्तर)\b/gi, "स्नातकोत्तर");
  processed = processed.replace(/\b(graduat(e|ion)|ग्रेजुएशन|ग्रेजुएट|स्नातक)\b/gi, "स्नातक");
  processed = processed.replace(/\b(honours|hons|ऑनर्स)\b/gi, "ऑनर्स");
  processed = processed.replace(/\b(pursuing|running|adhyayanrat|studying)\b/gi, "अध्ययनरत");
  processed = processed.replace(/\b(pass|passed|passed\s*out|completed|passedout)\b/gi, "उत्तीर्ण");
  processed = processed.replace(/\b(first\s*division|1st\s*division|1st\s*div|first\s*class)\b/gi, "प्रथम श्रेणी");
  processed = processed.replace(/\b(second\s*division|2nd\s*division|2nd\s*div|second\s*class)\b/gi, "द्वितीय श्रेणी");
  processed = processed.replace(/\b(third\s*division|3rd\s*division|3rd\s*div)\b/gi, "तृतीय श्रेणी");
  processed = processed.replace(/\b(gold\s*medalist|gold\s*medal)\b/gi, "स्वर्ण पदक विजेता");

  // Occupations
  processed = processed.replace(/(^|\s)(govt\.?\s*teacher|government\s*teacher|shaskiya\s*shikshak|sarkari\s*teacher|sarkari\s*master)(?=\s|$)/gi, "$1शासकीय शिक्षक");
  processed = processed.replace(/(^|\s)(govt\.?\s*service|govt\.?\s*job|government\s*service|government\s*job|shaskiya\s*seva|sarkari\s*naukri|govt\.?\s*employee|government\s*employee|govt\.?\s*servant|shaskiya\s*karmachari)(?=\s|$)/gi, "$1शासकीय सेवा");
  processed = processed.replace(/(^|\s)(pvt\.?\s*job|private\s*job|private\s*service|pvt\.?\s*service|private\s*naukri|private\s*company|pvt\.?\s*ltd|company\s*job)(?=\s|$)/gi, "$1निजी सेवा");
  processed = processed.replace(/(^|\s)(housewife|house\s*wife|homemaker|home\s*maker|grahini|grihini)(?=\s|$)/gi, "$1गृहणी");
  processed = processed.replace(/(^|\s)(farmer|farming|agriculture|kisan|krishak|kheti|krishi|kisani|khetibadi)\b/gi, "$1कृषि");
  processed = processed.replace(/(^|\s)(business|vyavasay|vyapar|dhandha|trade|trading)\b/gi, "$1व्यवसाय");
  processed = processed.replace(/(^|\s)(shopkeeper|shop\s*keeper|shop\s*owner|kirana\s*store|kirana\s*shop|general\s*store|kirana\s*vyapar|dukan|dukandar)\b/gi, "$1व्यवसाय (दुकान)");
  processed = processed.replace(/(^|\s)(teacher|shikshak|adhyapak|master|masterji|school\s*teacher)\b/gi, "$1शिक्षक");
  processed = processed.replace(/(^|\s)(lecturer|vyakhyata)\b/gi, "$1व्याख्याता");
  processed = processed.replace(/(^|\s)(professor|pradhyapak)\b/gi, "$1प्राध्यापक");
  processed = processed.replace(/(^|\s)(retired|retd\.?|sewanivritt|sevanivritt|pensioner)\b/gi, "$1सेवानिवृत्त");
  processed = processed.replace(/(^|\s)(ex\s*-?\s*serviceman|ex\s*army|retd\s*army|retd\s*fauj)\b/gi, "$1सेवानिवृत्त सैनिक");
  processed = processed.replace(/(^|\s)(self\s*employed|swarojgar|swarozgar|own\s*business|apna\s*kaam)\b/gi, "$1स्वरोजगार");
  processed = processed.replace(/(^|\s)(contractor|thekedar|thekedari|civil\s*contractor)\b/gi, "$1ठेकेदार");
  processed = processed.replace(/(^|\s)(civil\s*engineer)\b/gi, "$1सिविल इंजीनियर");
  processed = processed.replace(/(^|\s)(software\s*engineer|software\s*developer|it\s*engineer)\b/gi, "$1सॉफ्टवेयर इंजीनियर");
  processed = processed.replace(/(^|\s)(electrician|vidyut\s*karmi)\b/gi, "$1इलेक्ट्रीशियन");
  processed = processed.replace(/(^|\s)(plumber)\b/gi, "$1प्लंबर");
  processed = processed.replace(/(^|\s)(carpenter|badhai)\b/gi, "$1बढ़ई");
  processed = processed.replace(/(^|\s)(mason|mistri|rajmistri|rajgir)\b/gi, "$1राजमिस्त्री");
  processed = processed.replace(/(^|\s)(driver|chalak|auto\s*driver|car\s*driver)\b/gi, "$1चालक");
  processed = processed.replace(/(^|\s)(police|police\s*service|police\s*constable|inspector|sub\s*inspector|si|asi|ti)\b/gi, "$1पुलिस");
  processed = processed.replace(/(^|\s)(army|defence|defense|fauj|military|soldier|jawan)\b/gi, "$1भारतीय सेना");
  processed = processed.replace(/(^|\s)(accountant|lekhakar|munim)\b/gi, "$1लेखाकार");
  processed = processed.replace(/(^|\s)(bank\s*manager|branch\s*manager)\b/gi, "$1बैंक प्रबंधक");
  processed = processed.replace(/(^|\s)(bank\s*employee|banker|bank\s*clerk|bank\s*po)\b/gi, "$1बैंक कर्मचारी");
  processed = processed.replace(/(^|\s)(manager|prabandhak)\b/gi, "$1प्रबंधक");
  processed = processed.replace(/(^|\s)(doctor|chikitsak|vaidya)\b/gi, "$1चिकित्सक");
  processed = processed.replace(/(^|\s)(pharmacist|chemist|medical\s*store)\b/gi, "$1फार्मासिस्ट (मेडिकल)");
  processed = processed.replace(/(^|\s)(clerk|lipik|babu)\b/gi, "$1लिपिक");
  processed = processed.replace(/(^|\s)(mechanic)\b/gi, "$1मैकेनिक");
  processed = processed.replace(/(^|\s)(tailor|darji|silai)\b/gi, "$1दर्जी");
  processed = processed.replace(/(^|\s)(labour|labor|majduri|daily\s*wages|khetihar\s*majdoor|majdoor)\b/gi, "$1दैनिक मजदूरी");
  processed = processed.replace(/(^|\s)(security\s*guard|guard|chowkidar)\b/gi, "$1सुरक्षा गार्ड");
  processed = processed.replace(/(^|\s)(patwari)\b/gi, "$1पटवारी");
  processed = processed.replace(/(^|\s)(panchayat\s*sachiv|sachiv)\b/gi, "$1पंचायत सचिव");
  processed = processed.replace(/(^|\s)(sarpanch)\b/gi, "$1सरपंच");
  processed = processed.replace(/(^|\s)(kotwar)\b/gi, "$1कोटवार");
  processed = processed.replace(/(^|\s)(postman|dakpal|post\s*master)\b/gi, "$1डाकपाल");
  processed = processed.replace(/(^|\s)(and|aur|&|\+)\b/gi, "$1एवं");

  processed = processed.replace(/\s+/g, " ").trim();
  const isAllHindi = /^[\u0900-\u097F\s\d+\-.,()/@#&]+$/.test(processed);

  return { processed, hasOnlyKnownTerms: isAllHindi };
}

// 3. Post-Transliteration Fixes
export function applyPostTransliterationFixes(text: string): string {
  if (!text) return text;
  let fixed = text;

  // Surnames & Titles
  fixed = fixed.replace(/सहु\b/g, "साहू");
  fixed = fixed.replace(/\bसहु\b/g, "साहू");
  fixed = fixed.replace(/सहु/g, "साहू");
  fixed = fixed.replace(/शाहू/g, "साहू");
  fixed = fixed.replace(/सहू/g, "साहू");
  fixed = fixed.replace(/अश्वनी/g, "अश्विनी");
  fixed = fixed.replace(/अश्विनि/g, "अश्विनी");
  fixed = fixed.replace(/साहूू/g, "साहू");
  fixed = fixed.replace(/राम कुमार/g, "रामकुमार");
  fixed = fixed.replace(/राज कुमार/g, "राजकुमार");

  return fixed;
}

// 4. Rule-Based Offline Phonetic Roman-to-Devanagari Transliterator
export function phoneticTransliterateWord(word: string): string {
  const lower = word.toLowerCase().trim();
  if (!lower) return word;

  // Check dictionary first
  if (PHONETIC_DICTIONARY[lower]) {
    return PHONETIC_DICTIONARY[lower];
  }

  // If already Hindi or numeric, return as-is
  if (/^[\u0900-\u097F\d+\-.,()/@#&]+$/.test(word)) {
    return word;
  }

  // Tokenize Roman word phonetically into Devanagari characters
  let i = 0;
  let result = "";
  const len = lower.length;

  const CONSONANTS: [string, string][] = [
    ["shh", "ष्"], ["chh", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"],
    ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"],
    ["sh", "श"], ["tr", "त्र"], ["gy", "ज्ञ"], ["gn", "ज्ञ"], ["ksh", "क्ष"],
    ["ng", "ं"], ["nk", "ंक"], ["nd", "ंद"], ["nt", "ंत"], ["mp", "ंप"], ["mb", "ंब"],
    ["k", "क"], ["g", "ग"], ["j", "ज"], ["t", "त"], ["d", "द"],
    ["n", "न"], ["p", "प"], ["f", "फ"], ["b", "ब"], ["m", "म"],
    ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"],
    ["s", "स"], ["h", "ह"], ["x", "क्स"], ["z", "ज़"], ["c", "क"], ["q", "क"]
  ];

  const VOWEL_MATRAS: [string, string, string][] = [
    // [pattern, standalone, matra]
    ["aa", "आ", "ा"],
    ["ai", "ऐ", "ै"],
    ["au", "औ", "ौ"],
    ["ee", "ई", "ी"],
    ["ii", "ई", "ी"],
    ["oo", "ऊ", "ू"],
    ["uu", "ऊ", "ू"],
    ["a", "अ", ""],
    ["i", "इ", "ि"],
    ["u", "उ", "ु"],
    ["e", "ए", "े"],
    ["o", "ओ", "ो"]
  ];

  let prevWasConsonant = false;

  while (i < len) {
    const sub = lower.slice(i);

    // 1. Try Vowels
    let matchedVowel = false;
    for (const [pat, standalone, matra] of VOWEL_MATRAS) {
      if (sub.startsWith(pat)) {
        if (prevWasConsonant) {
          result += matra;
        } else {
          result += standalone;
        }
        i += pat.length;
        prevWasConsonant = false;
        matchedVowel = true;
        break;
      }
    }
    if (matchedVowel) continue;

    // 2. Try Consonants
    let matchedConsonant = false;
    for (const [pat, devanagari] of CONSONANTS) {
      if (sub.startsWith(pat)) {
        if (prevWasConsonant) {
          // Add halant if previous consonant was not followed by a vowel
          result += "्";
        }
        result += devanagari;
        i += pat.length;
        prevWasConsonant = true;
        matchedConsonant = true;
        break;
      }
    }
    if (matchedConsonant) continue;

    // 3. Fallback character (punctuation, numbers, unknown)
    result += lower[i];
    prevWasConsonant = false;
    i++;
  }

  return result;
}

// 5. Offline Fallback Sentence Transliterator
export function offlineTransliterateSentence(text: string): string {
  const words = text.split(" ");
  const converted = words.map((w) => {
    if (!w.trim()) return w;
    return phoneticTransliterateWord(w);
  });
  return converted.join(" ");
}

// 6. Multi-tier Production Transliteration Handler
export async function transliterateText(text: string): Promise<{ result: string; method: string }> {
  if (!text || typeof text !== "string") {
    return { result: "", method: "EMPTY" };
  }

  const trimmed = text.trim();
  // Numbers, URLs, dates skip translation
  const isExcluded = /^[0-9+\-:\s@.]+$|^(https?:\/\/|www\.)|^\d{10}$/.test(trimmed);
  if (isExcluded) {
    return { result: text, method: "EXCLUDED" };
  }

  // Step A: Pre-translation dictionary / honorifics
  const preProcessed = applyPreTransliterationFixes(text);
  if (preProcessed.hasOnlyKnownTerms) {
    const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(preProcessed.processed));
    return { result: res, method: "PRE_TRANSLATION_MAP" };
  }

  const textToTranslate = preProcessed.processed;

  // Step B: Google Input Tools (Primary - Full Phrase)
  try {
    const gitUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(
      textToTranslate
    )}&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const gitRes = await fetch(gitUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    clearTimeout(timeoutId);

    if (gitRes.ok) {
      const gitData = await gitRes.json();
      if (gitData[0] === "SUCCESS" && Array.isArray(gitData[1]) && gitData[1].length > 0) {
        const fullPhonetic = gitData[1]
          .map((entry: any) => entry?.[1]?.[0] || entry?.[0] || "")
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullPhonetic && /[\u0900-\u097F]/.test(fullPhonetic)) {
          const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(fullPhonetic));
          return { result: res, method: "GOOGLE_INPUT_TOOLS" };
        }
      }
    }
  } catch {
    // Continue to next tier
  }

  // Step C: Google Translate API (Fallback for full sentences)
  try {
    const gtUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(
      textToTranslate
    )}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const gtRes = await fetch(gtUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    clearTimeout(timeoutId);

    if (gtRes.ok) {
      const data = await gtRes.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((item: any) => item[0])
          .filter(Boolean)
          .join("");
        if (translated && /[\u0900-\u097F]/.test(translated)) {
          const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(translated.trim()));
          return { result: res, method: "GOOGLE_TRANSLATE" };
        }
      }
    }
  } catch {
    // Continue to next tier
  }

  // Step D: High-Accuracy Offline Rule-Based Phonetic Engine (Guaranteed fallback)
  const offlineResult = offlineTransliterateSentence(textToTranslate);
  const finalResult = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(offlineResult));
  return { result: finalResult, method: "PHONETIC_RULE_ENGINE" };
}
