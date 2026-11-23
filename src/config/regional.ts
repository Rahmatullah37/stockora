/**
 * Regional reference lists used by registration and settings forms:
 * countries, currencies, time zones and date formats.
 *
 * To support another country, add one line to COUNTRIES (and its currency to
 * CURRENCIES if it is new). No other code needs to change.
 */

export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. "PK" */
  code: string;
  name: string;
  /** Suggested default currency (ISO 4217) */
  currency: string;
  /** Suggested default time zone (IANA name) */
  timezone: string;
}

export const COUNTRIES: Country[] = [
  { code: "PK", name: "Pakistan", currency: "PKR", timezone: "Asia/Karachi" },
  { code: "AF", name: "Afghanistan", currency: "AFN", timezone: "Asia/Kabul" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", timezone: "Asia/Riyadh" },
  { code: "QA", name: "Qatar", currency: "QAR", timezone: "Asia/Qatar" },
  { code: "KW", name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait" },
  { code: "OM", name: "Oman", currency: "OMR", timezone: "Asia/Muscat" },
  { code: "BH", name: "Bahrain", currency: "BHD", timezone: "Asia/Bahrain" },
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  { code: "BD", name: "Bangladesh", currency: "BDT", timezone: "Asia/Dhaka" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", timezone: "Asia/Colombo" },
  { code: "NP", name: "Nepal", currency: "NPR", timezone: "Asia/Kathmandu" },
  { code: "IR", name: "Iran", currency: "IRR", timezone: "Asia/Tehran" },
  { code: "IQ", name: "Iraq", currency: "IQD", timezone: "Asia/Baghdad" },
  { code: "TR", name: "Turkey", currency: "TRY", timezone: "Europe/Istanbul" },
  { code: "UZ", name: "Uzbekistan", currency: "UZS", timezone: "Asia/Tashkent" },
  { code: "TJ", name: "Tajikistan", currency: "TJS", timezone: "Asia/Dushanbe" },
  { code: "TM", name: "Turkmenistan", currency: "TMT", timezone: "Asia/Ashgabat" },
  { code: "KZ", name: "Kazakhstan", currency: "KZT", timezone: "Asia/Almaty" },
  { code: "EG", name: "Egypt", currency: "EGP", timezone: "Africa/Cairo" },
  { code: "JO", name: "Jordan", currency: "JOD", timezone: "Asia/Amman" },
  { code: "LB", name: "Lebanon", currency: "LBP", timezone: "Asia/Beirut" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London" },
  { code: "DE", name: "Germany", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "France", currency: "EUR", timezone: "Europe/Paris" },
  { code: "IT", name: "Italy", currency: "EUR", timezone: "Europe/Rome" },
  { code: "ES", name: "Spain", currency: "EUR", timezone: "Europe/Madrid" },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "RU", name: "Russia", currency: "RUB", timezone: "Europe/Moscow" },
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York" },
  { code: "CA", name: "Canada", currency: "CAD", timezone: "America/Toronto" },
  { code: "MX", name: "Mexico", currency: "MXN", timezone: "America/Mexico_City" },
  { code: "BR", name: "Brazil", currency: "BRL", timezone: "America/Sao_Paulo" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
  { code: "NZ", name: "New Zealand", currency: "NZD", timezone: "Pacific/Auckland" },
  { code: "CN", name: "China", currency: "CNY", timezone: "Asia/Shanghai" },
  { code: "JP", name: "Japan", currency: "JPY", timezone: "Asia/Tokyo" },
  { code: "MY", name: "Malaysia", currency: "MYR", timezone: "Asia/Kuala_Lumpur" },
  { code: "ID", name: "Indonesia", currency: "IDR", timezone: "Asia/Jakarta" },
  { code: "TH", name: "Thailand", currency: "THB", timezone: "Asia/Bangkok" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore" },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "ET", name: "Ethiopia", currency: "ETB", timezone: "Africa/Addis_Ababa" },
  { code: "GH", name: "Ghana", currency: "GHS", timezone: "Africa/Accra" },
  { code: "MA", name: "Morocco", currency: "MAD", timezone: "Africa/Casablanca" },
];

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "AFN", name: "Afghan Afghani" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "IRR", name: "Iranian Rial" },
  { code: "IQD", name: "Iraqi Dinar" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "UZS", name: "Uzbekistani Som" },
  { code: "TJS", name: "Tajikistani Somoni" },
  { code: "TMT", name: "Turkmenistani Manat" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "USD", name: "US Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "THB", name: "Thai Baht" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "MAD", name: "Moroccan Dirham" },
];

/** UTC plus every time zone suggested by a country above (no duplicates). */
export const TIMEZONES: string[] = [
  "UTC",
  ...Array.from(new Set(COUNTRIES.map((c) => c.timezone))),
];

/** date-fns format patterns the shop owner can choose from. */
export const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export const isCountryCode = (value: string) =>
  COUNTRIES.some((c) => c.code === value);
export const isCurrencyCode = (value: string) =>
  CURRENCIES.some((c) => c.code === value);
export const isTimezone = (value: string) => TIMEZONES.includes(value);
