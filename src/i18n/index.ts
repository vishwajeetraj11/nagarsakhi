import type { IssueStatus, UserRole } from "../lib/domain/types";

export type Language = "en" | "hi";

const english = {
  appName: "NagarSakhi",
  demoDisclosure: "This is a synthetic demo. People, records, and contact details are not real.",
  demoMode: "Demo mode",
  loading: "Loading…",
  saving: "Saving…",
  error: "Something went wrong. Please try again.",
  networkError: "We could not connect. Please check your connection and try again.",
  notFound: "We could not find that record.",
  retry: "Try again",
  close: "Close",
  cancel: "Cancel",
  save: "Save",
  back: "Back",
  continue: "Continue",
  reportIssue: "Report an issue",
  supportIssue: "Support this issue",
  withdrawSupport: "Remove support",
  updateStatus: "Update status",
  addUpdate: "Add an update",
  escalate: "Escalate",
  submit: "Submit",
  viewDetails: "View details",
  viewAll: "View all",
  signIn: "Sign in",
  signOut: "Sign out",
  switchLanguage: "Switch language",
  languageEnglish: "English",
  languageHindi: "हिन्दी",
  roleCitizen: "Resident",
  roleParshad: "Ward councillor",
  roleCorporationAdmin: "Municipal administrator",
  ward: "Ward",
  wards: "Wards",
  selectWard: "Select ward",
  allWards: "All wards",
  wardOverview: "Ward overview",
  issues: "Issues",
  notices: "Notices",
  budget: "Budget",
  officials: "Officials",
  activity: "Activity",
  home: "Home",
  profile: "Profile",
  requested: "Requested",
  inProgress: "In progress",
  completed: "Completed",
  queued: "Queued",
  processing: "In progress",
  failed: "Failed",
  statusRequested: "Requested",
  statusInProgress: "In progress",
  statusCompleted: "Completed",
} as const;

export type TranslationKey = keyof typeof english;
export type Dictionary = Record<TranslationKey, string>;

const hindi: Dictionary = {
  appName: "नगरसखी",
  demoDisclosure: "यह एक सांकेतिक डेमो है। इसमें दिए गए लोग, रिकॉर्ड और संपर्क विवरण वास्तविक नहीं हैं।",
  demoMode: "डेमो मोड",
  loading: "लोड हो रहा है…",
  saving: "सहेजा जा रहा है…",
  error: "कुछ गड़बड़ हो गई। कृपया फिर प्रयास करें।",
  networkError: "कनेक्शन नहीं हो पाया। कृपया अपना कनेक्शन जाँचकर फिर प्रयास करें।",
  notFound: "यह रिकॉर्ड नहीं मिला।",
  retry: "फिर प्रयास करें",
  close: "बंद करें",
  cancel: "रद्द करें",
  save: "सहेजें",
  back: "वापस",
  continue: "आगे बढ़ें",
  reportIssue: "समस्या दर्ज करें",
  supportIssue: "इस समस्या का समर्थन करें",
  withdrawSupport: "समर्थन हटाएँ",
  updateStatus: "स्थिति बदलें",
  addUpdate: "अपडेट जोड़ें",
  escalate: "मामला आगे भेजें",
  submit: "जमा करें",
  viewDetails: "विवरण देखें",
  viewAll: "सभी देखें",
  signIn: "साइन इन करें",
  signOut: "साइन आउट करें",
  switchLanguage: "भाषा बदलें",
  languageEnglish: "English",
  languageHindi: "हिन्दी",
  roleCitizen: "निवासी",
  roleParshad: "वार्ड पार्षद",
  roleCorporationAdmin: "नगरपालिका प्रशासक",
  ward: "वार्ड",
  wards: "वार्ड",
  selectWard: "वार्ड चुनें",
  allWards: "सभी वार्ड",
  wardOverview: "वार्ड का अवलोकन",
  issues: "समस्याएँ",
  notices: "सूचनाएँ",
  budget: "बजट",
  officials: "अधिकारी",
  activity: "गतिविधि",
  home: "मुखपृष्ठ",
  profile: "प्रोफ़ाइल",
  requested: "अनुरोध प्राप्त",
  inProgress: "काम जारी है",
  completed: "काम पूरा",
  queued: "कतार में",
  processing: "प्रक्रिया जारी",
  failed: "विफल",
  statusRequested: "अनुरोध प्राप्त",
  statusInProgress: "काम जारी है",
  statusCompleted: "काम पूरा",
};

export const en = english;
export const hi = hindi;
export const dictionaries: Record<Language, Dictionary> = { en: english, hi: hindi };
export const translations = dictionaries;

/** Returns a translated label, falling back to English when a locale is incomplete. */
export function t(key: TranslationKey, language: Language = "en"): string {
  return dictionaries[language][key] ?? english[key];
}

/** Alias with an explicit language-first signature for call sites that prefer it. */
export function translate(language: Language, key: TranslationKey): string {
  return t(key, language);
}

const statusKeys: Record<IssueStatus, TranslationKey> = {
  requested: "statusRequested",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
};

export function getStatusLabel(status: IssueStatus, language: Language = "en"): string {
  return t(statusKeys[status], language);
}

export function getRoleLabel(role: UserRole, language: Language = "en"): string {
  const keys: Record<UserRole, TranslationKey> = {
    citizen: "roleCitizen",
    parshad: "roleParshad",
    corporation_admin: "roleCorporationAdmin",
  };
  return t(keys[role], language);
}
