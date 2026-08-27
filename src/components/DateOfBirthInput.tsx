import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { formatDobToDDMMYYYY, parseDateComponents, toDDMMYYYY } from "../dateUtils";

interface DateOfBirthInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  id?: string;
}

const MONTH_NAMES_HI = [
  "जनवरी (Jan)",
  "फरवरी (Feb)",
  "मार्च (Mar)",
  "अप्रैल (Apr)",
  "मई (May)",
  "जून (Jun)",
  "जुलाई (Jul)",
  "अगस्त (Aug)",
  "सितंबर (Sep)",
  "अक्टूबर (Oct)",
  "नवंबर (Nov)",
  "दिसंबर (Dec)"
];

const WEEK_DAYS_HI = ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"];

export default function DateOfBirthInput({
  value,
  onChange,
  label = "जन्म तिथि (Date of Birth)",
  required = true,
  error,
  id = "matrimony-dob-input"
}: DateOfBirthInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsed date or default to a reasonable adult year (e.g., 1998)
  const parsed = parseDateComponents(value);
  const defaultYear = 1998;
  const defaultMonth = 1;

  const [viewYear, setViewYear] = useState<number>(parsed?.year || defaultYear);
  const [viewMonth, setViewMonth] = useState<number>(parsed?.month || defaultMonth);

  // Sync view when value changes
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Handle outside clicks to close popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Direct typed input handler with automatic DD/MM/YYYY masking
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/[^\d]/g, "");

    if (rawDigits.length === 0) {
      onChange("");
      return;
    }

    let formatted = "";
    if (rawDigits.length <= 2) {
      formatted = rawDigits;
    } else if (rawDigits.length <= 4) {
      formatted = `${rawDigits.slice(0, 2)}/${rawDigits.slice(2)}`;
    } else {
      formatted = `${rawDigits.slice(0, 2)}/${rawDigits.slice(2, 4)}/${rawDigits.slice(4, 8)}`;
    }

    onChange(formatted);
  };

  const handleBlur = () => {
    if (value && value.trim()) {
      const normalized = formatDobToDDMMYYYY(value);
      if (normalized && normalized !== "-") {
        onChange(normalized);
      }
    }
  };

  // Day selection from Calendar
  const handleDaySelect = (day: number) => {
    const formatted = toDDMMYYYY(day, viewMonth, viewYear);
    onChange(formatted);
    setIsOpen(false);
  };

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayIndex = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // Monday = 0

  // Years array (1950 to 2012 in descending order)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);

  // Days array (1 to 31)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="w-full min-w-0 flex flex-col space-y-1.5 relative" ref={containerRef} id={`${id}-wrapper`}>
      <label className="text-xs md:text-sm font-bold text-stone-700 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-red-500 font-bold">*</span>}
        </span>
        <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
          DD/MM/YYYY
        </span>
      </label>

      {/* Input container */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9/]*"
          maxLength={10}
          required={required}
          value={value || ""}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY (जैसे: 24/05/1998)"
          className={`w-full block box-border min-w-0 px-3.5 py-2.5 pr-12 border ${
            error ? "border-red-400 focus:ring-red-500" : "border-stone-300 focus:ring-orange-500"
          } rounded-xl text-stone-800 bg-white placeholder-stone-400 text-sm md:text-[15px] font-medium tracking-wide focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-xs`}
        />

        {/* Toggle Calendar Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="कैलेंडर से जन्म तिथि चुनें"
          aria-label="कैलेंडर से जन्म तिथि चुनें"
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            isOpen ? "bg-orange-600 text-white" : "text-stone-500 hover:text-orange-600 hover:bg-orange-50"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-label */}
      <div className="flex items-center justify-between text-[10.5px] text-stone-500 px-0.5">
        <span>प्रारूप: दिन/माह/वर्ष (DD/MM/YYYY)</span>
        {value && value.length === 10 && (
          <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
            ✓ मान्य जन्म तिथि
          </span>
        )}
      </div>

      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}

      {/* Interactive Calendar Popover */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-full max-w-sm sm:w-80 bg-white border border-stone-200 rounded-2xl shadow-xl p-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month and Year Selection */}
          <div className="flex items-center justify-between gap-1 pb-3 mb-2 border-b border-stone-100">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-600 transition-colors"
              title="पिछला महीना"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-stone-800 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {MONTH_NAMES_HI.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-stone-800 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-600 transition-colors"
              title="अगला महीना"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Select Row (Day, Month, Year Direct Pick) */}
          <div className="bg-orange-50/70 border border-orange-100 rounded-xl p-2 mb-3">
            <span className="block text-[10px] font-bold text-orange-800 mb-1">
              त्वरित चयन (Quick Select):
            </span>
            <div className="grid grid-cols-3 gap-1">
              {/* Day pick */}
              <select
                value={parsed?.day || ""}
                onChange={(e) => {
                  const d = parseInt(e.target.value, 10);
                  if (!isNaN(d)) {
                    onChange(toDDMMYYYY(d, viewMonth, viewYear));
                  }
                }}
                className="text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded px-1.5 py-1"
              >
                <option value="">दिन (Day)</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {String(d).padStart(2, "0")}
                  </option>
                ))}
              </select>

              {/* Month pick */}
              <select
                value={parsed?.month || viewMonth}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setViewMonth(m);
                  if (parsed?.day) {
                    onChange(toDDMMYYYY(parsed.day, m, viewYear));
                  }
                }}
                className="text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded px-1.5 py-1"
              >
                {MONTH_NAMES_HI.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName.split(" ")[0]}
                  </option>
                ))}
              </select>

              {/* Year pick */}
              <select
                value={parsed?.year || viewYear}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setViewYear(y);
                  if (parsed?.day) {
                    onChange(toDDMMYYYY(parsed.day, viewMonth, y));
                  }
                }}
                className="text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded px-1.5 py-1"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEK_DAYS_HI.map((w, idx) => (
              <span key={idx} className="text-[10.5px] font-bold text-stone-400">
                {w}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                parsed &&
                parsed.day === day &&
                parsed.month === viewMonth &&
                parsed.year === viewYear;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`h-7 w-full flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-600 text-white font-bold shadow-xs scale-105"
                      : "text-stone-700 hover:bg-orange-50 hover:text-orange-600"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-stone-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
            >
              साफ़ करें (Clear)
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded-lg transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>लागू करें (Done)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
