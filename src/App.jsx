import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, setDoc, getDoc, updateDoc, deleteDoc, where, limit, arrayUnion, arrayRemove
} from 'firebase/firestore';

// ==== إعدادات Cloudinary ====
const CLOUDINARY_CLOUD_NAME = "tqvxulwr";
const CLOUDINARY_UPLOAD_PRESET = "souq_uploads";

// ==== صور الهوية البصرية للتطبيق ====
// ملاحظة: هذه الصور تُقرأ من نفس حساب Cloudinary الخاص بالتطبيق (تحت public_id ثابت)
// لرفعها: Cloudinary Console → Media Library → Upload → استخدم بالضبط أسماء public_id التالية
const cld = (publicId, w) => `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,w_${w}/${publicId}`;

const BRAND_IMAGES = {
  heroBanner: cld("hero-banner", 1200),       // صورة بانورامية: سوق ماشية/محاصيل بأجواء صحراوية
  catLivestock: cld("cat-livestock", 200),     // أيقونة تصنيف الثروة الحيوانية (جِمال/أغنام)
  catAgri: cld("cat-agri", 200),               // أيقونة تصنيف المحاصيل الزراعية (أكياس/حبوب)
  fallbackLivestock: cld("fallback-livestock", 500), // صورة افتراضية لبطاقة منتج بلا صور (ثروة حيوانية)
  fallbackAgri: cld("fallback-agri", 500),           // صورة افتراضية لبطاقة منتج بلا صور (محاصيل)
};

const fallbackImageFor = (category) =>
  category === "الثروة الحيوانية" ? BRAND_IMAGES.fallbackLivestock : BRAND_IMAGES.fallbackAgri;

// ==== التصنيفات الفرعية لكل قسم رئيسي ====
const SUBCATEGORIES = {
  "الثروة الحيوانية": ["الإبل", "الأبقار", "الأغنام"],
  "المنتجات والمحاصيل الزراعية | Produits Agricoles": ["السمسم", "الدخن", "الصمغ العربي", "الفول السوداني", "أخرى"]
};

// ==== ترجمة أسماء التصنيفات الفرعية للفرنسية ====
const SUBCATEGORY_FR = {
  "الإبل": "Chameaux",
  "الأبقار": "Bovins",
  "الأغنام": "Ovins",
  "السمسم": "Sésame",
  "الدخن": "Mil",
  "الصمغ العربي": "Gomme arabique",
  "الفول السوداني": "Arachide",
  "أخرى": "Autre"
};

const displaySubcategory = (sub, language) =>
  language === 'ar' ? sub : (SUBCATEGORY_FR[sub] || sub);

// ==== نظام الترجمة لواجهة التطبيق ====
const translations = {
  ar: {
    appTitle: "السوق المفتوح الاقليمي",
    appSubtitle: "الثروة الحيوانية والمحاصيل الزراعية | Élevage et Cultures",
    countries: "ليبيا · تشاد · السودان",
    currencyDefault: "الأساسية",
    catAll: "الكل",
    catLivestock: "الثروة الحيوانية",
    catAgri: "المنتجات والمحاصيل الزراعية | Produits Agricoles",
    countryAll: "كل الدول",
    countrySudan: "السودان",
    countryChad: "تشاد",
    countryLibya: "ليبيا",
    searchPlaceholder: "ابحث عن سلعة أو موقع...",
    noResults: "لا توجد عروض تطابق بحثك حالياً.",
    locationPrefix: "📍",
    sellerPrefix: "👤",
    contactPrefix: "📞 اتصال:",
    fabButton: "+ أضف عرضك التصديري",
    modalTitle: "إضافة عرض تجاري جديد",
    labelTitle: "عنوان العرض (مثال: شحنة صمغ عربي نقي للبيع)",
    labelCategory: "التصنيف الرئيسي",
    labelSubcategory: "التصنيف الفرعي",
    subAll: "الكل",
    sponsoredTitle: "إعلانات مموّلة",

    // === مميزات إضافية ===
    favoritesTitle: "المفضلة",
    noFavorites: "لا توجد عروض محفوظة في المفضلة بعد.",
    addToFavorites: "أضف للمفضلة",
    removeFromFavorites: "إزالة من المفضلة",
    shareWhatsapp: "مشاركة عبر واتساب",
    sortLabel: "الترتيب",
    sortNewest: "الأحدث",
    sortPriceLow: "السعر: الأقل أولاً",
    sortPriceHigh: "السعر: الأعلى أولاً",
    reportBtn: "🚩 الإبلاغ عن هذا العرض",
    reportReasonPrompt: "ما سبب الإبلاغ عن هذا العرض؟",
    reportSentMsg: "تم إرسال بلاغك، شكرًا لمساعدتك في حماية السوق.",
    reportRequiresLogin: "يجب تسجيل الدخول أولاً للإبلاغ عن عرض.",
    markSoldBtn: "✅ تحديد كـ: تم البيع",
    markActiveBtn: "🔄 إعادة تفعيل العرض",
    soldBadge: "تم البيع",
    editListingBtn: "✏️ تعديل العرض",
    deleteListingBtn: "🗑️ حذف العرض",
    deleteConfirmMsg: "هل أنت متأكد من حذف هذا العرض نهائيًا؟",
    editModalTitle: "تعديل العرض",
    saveChangesBtn: "حفظ التعديلات",
    verifiedBadge: "✅ بائع موثّق",
    labelPrice: "السعر الرقمي",
    labelCurrency: "عملة العرض",
    labelLocation: "الموقع الحالي والبلد (مثال: الخرطوم، السودان)",
    useMyLocationBtn: "📍 استخدم موقعي الحالي (GPS)",
    locatingMsg: "جاري تحديد موقعك...",
    locationCapturedMsg: "✅ تم تحديد إحداثيات موقعك بدقة",
    geoUnsupportedAlert: "متصفحك لا يدعم تحديد الموقع الجغرافي.",
    geoErrorAlert: "تعذّر تحديد موقعك. تأكد من السماح بالوصول للموقع من إعدادات المتصفح.",
    viewOnMapBtn: "🗺️ عرض الموقع على الخريطة",
    labelSeller: "اسم التاجر / الشركة",
    labelContact: "رقم الهاتف (واتساب أو اتصال مع رمز الدولة)",
    labelDesc: "تفاصيل السلعة ومواصفاتها",
    labelMedia: "صور أو فيديو للسلعة (اختياري، حتى 5 ملفات)",
    filesSelected: "تم اختيار",
    filesUnit: "ملف/ملفات",
    uploading: "جاري رفع",
    uploadingSuffix: "ملف...",
    submitBtn: "🚀 نشر العرض فوراً في السوق",
    submitting: "⏳ جاري الرفع...",
    requiredAlert: "الرجاء ملء الحقول الأساسية!",
    uploadErrorAlert: "حدث خطأ أثناء رفع الوسائط. تأكد من اتصالك بالإنترنت وحاول مجدداً.",
    filesIgnoredAlert: "تم تجاهل بعض الملفات: الحد الأقصى 5 ملفات، وحجم كل ملف لا يتجاوز 20 ميغابايت.",
    currencyLYD: "دينار ليبي (LYD)",
    currencyXAF: "فرنك تشادي (XAF)",
    currencySDG: "جنيه سوداني (SDG)",
    langToggle: "Français",

    // === نصوص تسجيل الدخول الجديدة ===
    loginBtn: "تسجيل الدخول",
    logoutBtn: "تسجيل الخروج",
    loggedInAs: "مرحباً",
    authModalTitleLogin: "تسجيل الدخول",
    authModalTitleSignup: "إنشاء حساب جديد",
    authMethodEmail: "البريد الإلكتروني",
    authMethodPhone: "رقم الهاتف",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    phoneLabel: "رقم الهاتف (مع رمز الدولة، مثال: 249...+)",
    otpLabel: "رمز التحقق المُرسل عبر SMS",
    sendOtpBtn: "إرسال رمز التحقق",
    verifyOtpBtn: "تأكيد الرمز والدخول",
    submitLoginBtn: "دخول",
    submitSignupBtn: "إنشاء الحساب",
    switchToSignup: "ليس لديك حساب؟ أنشئ حساباً جديداً",
    switchToLogin: "لديك حساب بالفعل؟ سجّل الدخول",
    authRequiredAlert: "يجب تسجيل الدخول أولاً لنشر عرض جديد.",
    authErrorGeneric: "حدث خطأ. تأكد من صحة البيانات وحاول مجدداً.",
    otpSentMsg: "تم إرسال رمز التحقق إلى هاتفك.",
    closeBtn: "إغلاق",

    // === الشريط السفلي والدردشات والإشعارات ===
    navHome: "الرئيسية",
    navChats: "دردشاتي",
    navNotifications: "إشعاراتي",
    navAccount: "حسابي",
    chatsTitle: "دردشاتي",
    notifTitle: "إشعاراتي",
    noChats: "لا توجد محادثات بعد.",
    noNotifs: "لا توجد إشعارات جديدة.",
    messagePlaceholder: "اكتب رسالتك...",
    sendBtn: "إرسال",
    contactSellerBtn: "💬 راسل البائع",
    callSellerBtn: "📞 اتصال",
    noOwnerAlert: "لا يمكن مراسلة صاحب هذا العرض حالياً، جرّب الاتصال المباشر.",
    chatRequiresLogin: "يجب تسجيل الدخول أولاً للتواصل مع البائع.",
    backBtn: "رجوع",
    newMsgNotif: "رسالة جديدة بخصوص",
    accountGreeting: "مرحباً"
  },
  fr: {
    appTitle: "Souq Al-Maftouh Régional",
    appSubtitle: "الثروة الحيوانية والمحاصيل الزراعية | Élevage et Cultures",
    countries: "Libye · Tchad · Soudan",
    currencyDefault: "Par défaut",
    catAll: "Tout",
    catLivestock: "Bétail (élevage)",
    catAgri: "Produits agricoles",
    countryAll: "Tous les pays",
    countrySudan: "Soudan",
    countryChad: "Tchad",
    countryLibya: "Libye",
    searchPlaceholder: "Rechercher un produit ou un lieu...",
    noResults: "Aucune offre ne correspond à votre recherche.",
    locationPrefix: "📍",
    sellerPrefix: "👤",
    contactPrefix: "📞 Appeler :",
    fabButton: "+ Ajouter votre offre",
    modalTitle: "Ajouter une nouvelle offre",
    labelTitle: "Titre de l'offre (ex : Lot de gomme arabique pure à vendre)",
    labelCategory: "Catégorie principale",
    labelSubcategory: "Sous-catégorie",
    subAll: "Toutes",
    sponsoredTitle: "Annonces sponsorisées",

    // === Fonctionnalités supplémentaires ===
    favoritesTitle: "Favoris",
    noFavorites: "Aucune annonce enregistrée dans les favoris.",
    addToFavorites: "Ajouter aux favoris",
    removeFromFavorites: "Retirer des favoris",
    shareWhatsapp: "Partager via WhatsApp",
    sortLabel: "Trier par",
    sortNewest: "Plus récent",
    sortPriceLow: "Prix : du plus bas",
    sortPriceHigh: "Prix : du plus haut",
    reportBtn: "🚩 Signaler cette annonce",
    reportReasonPrompt: "Pourquoi signalez-vous cette annonce ?",
    reportSentMsg: "Votre signalement a été envoyé, merci de nous aider à protéger la place de marché.",
    reportRequiresLogin: "Vous devez vous connecter pour signaler une annonce.",
    markSoldBtn: "✅ Marquer comme : Vendu",
    markActiveBtn: "🔄 Réactiver l'annonce",
    soldBadge: "Vendu",
    editListingBtn: "✏️ Modifier l'annonce",
    deleteListingBtn: "🗑️ Supprimer l'annonce",
    deleteConfirmMsg: "Voulez-vous vraiment supprimer définitivement cette annonce ?",
    editModalTitle: "Modifier l'annonce",
    saveChangesBtn: "Enregistrer les modifications",
    verifiedBadge: "✅ Vendeur vérifié",
    labelPrice: "Prix",
    labelCurrency: "Devise de l'offre",
    labelLocation: "Emplacement actuel et pays (ex : Khartoum, Soudan)",
    useMyLocationBtn: "📍 Utiliser ma position actuelle (GPS)",
    locatingMsg: "Localisation en cours...",
    locationCapturedMsg: "✅ Votre position a été enregistrée avec précision",
    geoUnsupportedAlert: "Votre navigateur ne prend pas en charge la géolocalisation.",
    geoErrorAlert: "Impossible de déterminer votre position. Vérifiez l'autorisation de localisation dans votre navigateur.",
    viewOnMapBtn: "🗺️ Voir sur la carte",
    labelSeller: "Nom du vendeur / entreprise",
    labelContact: "Numéro de téléphone (WhatsApp ou appel, avec indicatif pays)",
    labelDesc: "Détails et spécifications du produit",
    labelMedia: "Photos ou vidéo du produit (optionnel, jusqu'à 5 fichiers)",
    filesSelected: "Fichiers sélectionnés :",
    filesUnit: "",
    uploading: "Téléversement de",
    uploadingSuffix: "fichier(s)...",
    submitBtn: "🚀 Publier l'offre immédiatement",
    submitting: "⏳ Téléversement en cours...",
    requiredAlert: "Veuillez remplir les champs obligatoires !",
    uploadErrorAlert: "Erreur lors du téléversement. Vérifiez votre connexion et réessayez.",
    filesIgnoredAlert: "Certains fichiers ont été ignorés : maximum 5 fichiers, 20 Mo par fichier.",
    currencyLYD: "Dinar libyen (LYD)",
    currencyXAF: "Franc tchadien (XAF)",
    currencySDG: "Livre soudanaise (SDG)",
    langToggle: "العربية",

    loginBtn: "Connexion",
    logoutBtn: "Déconnexion",
    loggedInAs: "Bonjour",
    authModalTitleLogin: "Connexion",
    authModalTitleSignup: "Créer un compte",
    authMethodEmail: "E-mail",
    authMethodPhone: "Téléphone",
    emailLabel: "Adresse e-mail",
    passwordLabel: "Mot de passe",
    phoneLabel: "Numéro de téléphone (avec indicatif, ex : +249...)",
    otpLabel: "Code de vérification reçu par SMS",
    sendOtpBtn: "Envoyer le code",
    verifyOtpBtn: "Vérifier et se connecter",
    submitLoginBtn: "Se connecter",
    submitSignupBtn: "Créer le compte",
    switchToSignup: "Pas de compte ? Créez-en un",
    switchToLogin: "Déjà un compte ? Connectez-vous",
    authRequiredAlert: "Vous devez vous connecter avant de publier une offre.",
    authErrorGeneric: "Une erreur est survenue. Vérifiez vos informations et réessayez.",
    otpSentMsg: "Le code de vérification a été envoyé à votre téléphone.",
    closeBtn: "Fermer",

    navHome: "Accueil",
    navChats: "Messages",
    navNotifications: "Notifications",
    navAccount: "Compte",
    chatsTitle: "Mes messages",
    notifTitle: "Notifications",
    noChats: "Aucune conversation pour le moment.",
    noNotifs: "Aucune nouvelle notification.",
    messagePlaceholder: "Écrivez votre message...",
    sendBtn: "Envoyer",
    contactSellerBtn: "💬 Contacter le vendeur",
    callSellerBtn: "📞 Appeler",
    noOwnerAlert: "Impossible de contacter ce vendeur pour le moment, essayez l'appel direct.",
    chatRequiresLogin: "Vous devez vous connecter pour contacter le vendeur.",
    backBtn: "Retour",
    newMsgNotif: "Nouveau message concernant",
    accountGreeting: "Bonjour"
  }
};

// أسعار الصرف الثابتة مقارنة بالدولار (تحديث 2026)
const exchangeRates = { "LYD": 4.80, "XAF": 600, "SDG": 650 };

// ==== رموز العملات الصحيحة (مصححة) وأعلام الدول المرتبطة بها ====
const CURRENCY_FLAG = { LYD: "🇱🇾", XAF: "🇹🇩", SDG: "🇸🇩" };
const CURRENCY_LABEL = {
  ar: { LYD: "د.ل", XAF: "ف.ت", SDG: "ج.س" },   // دينار ليبي، فرنك تشادي، جنيه سوداني
  fr: { LYD: "DL", XAF: "FCFA", SDG: "SDG" }
};
const currencyLabel = (code, language) => `${CURRENCY_FLAG[code]} ${CURRENCY_LABEL[language][code]}`;

// ==== أعلام الدول الثلاث ====
const COUNTRY_FLAG = { "السودان": "🇸🇩", "تشاد": "🇹🇩", "ليبيا": "🇱🇾" };

// البيانات الأولية لبدء التطبيق
const initialProducts = [
  {
    id: 1,
    title: "جمال سودانية للتصدير، قطيع مدرب على السفر البري",
    category: "الثروة الحيوانية",
    subcategory: "الإبل",
    location: "نيالا، السودان",
    desc: "قطيع من الإبل السودانية بحالة صحية جيدة، جاهز للنقل عبر الجنينة نحو الحدود التشادية.",
    price: 9000, currency: "SDG", unit: "رأس",
    contact: "+249912345678", seller: "أبو بكر الصديق لشحن الماشية",
    date: "منذ يومين", media: []
  },
  {
    id: 2,
    title: "فول سوداني تشادي ممتاز (خام)",
    category: "المنتجات والمحاصيل الزراعية | Produits Agricoles",
    subcategory: "الفول السوداني",
    location: "أبشي، تشاد",
    desc: "فول سوداني نقي وعالي الجودة، معبأ في أكياس ومتوفر للبيع بالجملة والتصدير الإقليمي الكلي.",
    price: 35000, currency: "XAF", unit: "شوال",
    contact: "+23566123456", seller: "شركة أبشي للإنتاج الزراعي",
    date: "منذ 5 أيام", media: []
  }
];

export default function App() {
  const [language, setLanguage] = useState('ar');
  const t = translations[language];

  const [products, setProducts] = useState(initialProducts);
  const [selectedCurrency, setSelectedCurrency] = useState("ORIGINAL");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [selectedSubcategory, setSelectedSubcategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("كل الدول");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("الثروة الحيوانية");
  const [newSubcategory, setNewSubcategory] = useState(SUBCATEGORIES["الثروة الحيوانية"][0]);
  const [newLocation, setNewLocation] = useState("السودان");
  const [newGeo, setNewGeo] = useState(null); // { lat, lng } أو null
  const [isLocating, setIsLocating] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("LYD");
  const [newDesc, setNewDesc] = useState("");
  const [newSeller, setNewSeller] = useState("");
  const [newContact, setNewContact] = useState("");

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // ==================== حالات المصادقة (Auth) ====================
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' أو 'signup'
  const [authMethod, setAuthMethod] = useState('email'); // 'email' أو 'phone'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ==================== حالات الدردشات والإشعارات ====================
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // ==================== حالة الإعلانات المموّلة ====================
  const [sponsoredAds, setSponsoredAds] = useState([]);

  // ==================== حالات المفضلة، الترتيب، التعديل، الإبلاغ ====================
  const [favoriteIds, setFavoriteIds] = useState([]); // مصفوفة معرّفات العروض المحفوظة
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortOption, setSortOption] = useState("newest"); // newest | priceLow | priceHigh
  const [editingProduct, setEditingProduct] = useState(null); // المنتج الجاري تعديله أو null
  const [reportingProduct, setReportingProduct] = useState(null); // المنتج الجاري الإبلاغ عنه أو null
  const [reportReasonText, setReportReasonText] = useState("");

  // متابعة حالة تسجيل الدخول تلقائياً عند تحميل التطبيق
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // مزامنة الإعلانات المموّلة النشطة (تُدار يدوياً من Firebase Console حالياً)
  useEffect(() => {
    const q = query(collection(db, "ads"), where("active", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSponsoredAds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Ads sync error:", err));
    return () => unsubscribe();
  }, []);

  // مزامنة قائمة المفضلة الخاصة بالمستخدم الحالي
  useEffect(() => {
    if (!currentUser) { setFavoriteIds([]); return; }
    const unsubscribe = onSnapshot(doc(db, "favorites", currentUser.uid), (snap) => {
      setFavoriteIds(snap.exists() ? (snap.data().productIds || []) : []);
    }, (err) => console.error("Favorites sync error:", err));
    return () => unsubscribe();
  }, [currentUser]);

  // مزامنة العروض المنشورة مع Firestore فور تحميل التطبيق (تحديث فوري + حفظ دائم)
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts([...liveProducts, ...initialProducts]);
    }, (err) => {
      console.error("Firestore sync error:", err);
    });
    return () => unsubscribe();
  }, []);

  // مزامنة قائمة المحادثات الخاصة بالمستخدم الحالي
  useEffect(() => {
    if (!currentUser) { setConversations([]); return; }
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));
      setConversations(list);
    }, (err) => console.error("Conversations sync error:", err));
    return () => unsubscribe();
  }, [currentUser]);

  // مزامنة إشعارات المستخدم الحالي
  useEffect(() => {
    if (!currentUser) { setNotifications([]); return; }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Notifications sync error:", err));
    return () => unsubscribe();
  }, [currentUser]);

  // مزامنة رسائل المحادثة المفتوحة حالياً
  useEffect(() => {
    if (!activeConversation) { setChatMessages([]); return; }
    const q = query(
      collection(db, "conversations", activeConversation.id, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Messages sync error:", err));
    return () => unsubscribe();
  }, [activeConversation]);

  const unreadChatsCount = conversations.reduce((sum, c) => sum + (currentUser && c.unread ? (c.unread[currentUser.uid] || 0) : 0), 0);
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  const categoryKeys = ["الكل", "الثروة الحيوانية", "المنتجات والمحاصيل الزراعية | Produits Agricoles"];
  const countryKeys = ["كل الدول", "السودان", "تشاد", "ليبيا"];

  const displayCategory = (key) => {
    if (key === "الكل") return t.catAll;
    if (key === "الثروة الحيوانية") return t.catLivestock;
    return t.catAgri;
  };
  const displayCountry = (key) => {
    if (key === "كل الدول") return t.countryAll;
    if (key === "السودان") return `${COUNTRY_FLAG["السودان"]} ${t.countrySudan}`;
    if (key === "تشاد") return `${COUNTRY_FLAG["تشاد"]} ${t.countryChad}`;
    return `${COUNTRY_FLAG["ليبيا"]} ${t.countryLibya}`;
  };

  const formatPrice = (price, fromCurrency) => {
    if (selectedCurrency === "ORIGINAL" || !exchangeRates[selectedCurrency]) {
      return `${price} ${currencyLabel(fromCurrency, language)}`;
    }
    const priceInUSD = price / exchangeRates[fromCurrency];
    const convertedPrice = priceInUSD * exchangeRates[selectedCurrency];
    return `${Math.round(convertedPrice).toLocaleString()} ${currencyLabel(selectedCurrency, language)}`;
  };

  // ==================== دوال المصادقة ====================

  const resetAuthFields = () => {
    setAuthEmail(""); setAuthPassword(""); setAuthPhone("");
    setOtpCode(""); setOtpSent(false); setConfirmationResult(null);
    setAuthError("");
  };

  const openAuthModal = () => {
    resetAuthFields();
    setAuthMode('login');
    setAuthMethod('email');
    setIsAuthModalOpen(true);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setIsAuthModalOpen(false);
      resetAuthFields();
    } catch (err) {
      setAuthError(t.authErrorGeneric);
    } finally {
      setAuthLoading(false);
    }
  };

  // إعداد reCAPTCHA غير المرئي (مرة واحدة فقط)
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
    }
    return window.recaptchaVerifier;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, authPhone, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err) {
      setAuthError(t.authErrorGeneric);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await confirmationResult.confirm(otpCode);
      setIsAuthModalOpen(false);
      resetAuthFields();
    } catch (err) {
      setAuthError(t.authErrorGeneric);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // ==================== دوال الدردشة والإشعارات ====================

  // البحث عن محادثة موجودة بين المستخدم الحالي وصاحب العرض حول هذا المنتج، أو إنشاء واحدة جديدة
  const getOrCreateConversation = async (product) => {
    const existing = conversations.find(
      c => c.productId === String(product.id) && c.participants.includes(product.ownerUid)
    );
    if (existing) return existing;

    const convRef = doc(collection(db, "conversations"));
    const newConv = {
      participants: [currentUser.uid, product.ownerUid],
      productId: String(product.id),
      productTitle: product.title,
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      unread: { [currentUser.uid]: 0, [product.ownerUid]: 0 }
    };
    await setDoc(convRef, newConv);
    return { id: convRef.id, ...newConv };
  };

  // فتح نافذة الدردشة مع صاحب عرض معيّن (يُستدعى من زر "راسل البائع" على بطاقة المنتج)
  const handleContactSeller = async (product) => {
    if (!currentUser) {
      alert(t.chatRequiresLogin);
      openAuthModal();
      return;
    }
    if (!product.ownerUid || product.ownerUid === currentUser.uid) {
      alert(t.noOwnerAlert);
      return;
    }
    const conv = await getOrCreateConversation(product);
    openConversation(conv);
  };

  // فتح محادثة من القائمة وتصفير عداد غير المقروء الخاص بالمستخدم الحالي فيها
  const openConversation = async (conv) => {
    setActiveConversation(conv);
    setIsChatListOpen(true);
    if (currentUser && conv.unread && conv.unread[currentUser.uid]) {
      try {
        await updateDoc(doc(db, "conversations", conv.id), { [`unread.${currentUser.uid}`]: 0 });
      } catch (err) {
        console.error("Failed to reset unread count:", err);
      }
    }
  };

  const closeActiveConversation = () => {
    setActiveConversation(null);
  };

  // إرسال رسالة جديدة داخل المحادثة النشطة + تحديث آخر رسالة وعداد غير المقروء + إنشاء إشعار للطرف الآخر
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeConversation || !currentUser) return;
    const otherUid = activeConversation.participants.find(uid => uid !== currentUser.uid);
    const textToSend = newMessageText.trim();
    setNewMessageText("");
    try {
      await addDoc(collection(db, "conversations", activeConversation.id, "messages"), {
        senderId: currentUser.uid,
        text: textToSend,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "conversations", activeConversation.id), {
        lastMessage: textToSend,
        lastMessageAt: serverTimestamp(),
        [`unread.${otherUid}`]: (activeConversation.unread?.[otherUid] || 0) + 1
      });
      if (otherUid) {
        await addDoc(collection(db, "notifications"), {
          userId: otherUid,
          type: "message",
          text: `${t.newMsgNotif} ${activeConversation.productTitle}`,
          conversationId: activeConversation.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const markNotificationRead = async (notif) => {
    try {
      await updateDoc(doc(db, "notifications", notif.id), { read: true });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
    if (notif.conversationId) {
      const conv = conversations.find(c => c.id === notif.conversationId);
      if (conv) {
        setIsNotifOpen(false);
        openConversation(conv);
      }
    }
  };

  // ==================== المفضلة ====================

  const toggleFavorite = async (productId) => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    const isFav = favoriteIds.includes(productId);
    const favRef = doc(db, "favorites", currentUser.uid);
    try {
      const snap = await getDoc(favRef);
      if (!snap.exists()) {
        await setDoc(favRef, { productIds: isFav ? [] : [productId] });
      } else {
        await updateDoc(favRef, {
          productIds: isFav ? arrayRemove(productId) : arrayUnion(productId)
        });
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // ==================== مشاركة عبر واتساب ====================

  const shareOnWhatsapp = (product) => {
    const text = `${product.title} - ${formatPrice(product.price, product.currency)} - ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ==================== الإبلاغ عن عرض ====================

  const submitReport = async (reason) => {
    if (!currentUser) {
      alert(t.reportRequiresLogin);
      openAuthModal();
      return;
    }
    if (!reportingProduct || !reason || !reason.trim()) { setReportingProduct(null); return; }
    try {
      await addDoc(collection(db, "reports"), {
        productId: String(reportingProduct.id),
        productTitle: reportingProduct.title,
        reason: reason.trim(),
        reportedBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      alert(t.reportSentMsg);
    } catch (err) {
      console.error("Failed to submit report:", err);
    }
    setReportingProduct(null);
  };

  // ==================== تحديد كـ"تم البيع" / إعادة تفعيل ====================

  const toggleSoldStatus = async (product) => {
    try {
      await updateDoc(doc(db, "products", product.id), { sold: !product.sold });
    } catch (err) {
      console.error("Failed to update sold status:", err);
    }
  };

  // ==================== حذف عرض ====================

  const deleteListing = async (product) => {
    if (!window.confirm(t.deleteConfirmMsg)) return;
    try {
      await deleteDoc(doc(db, "products", product.id));
    } catch (err) {
      console.error("Failed to delete listing:", err);
    }
  };

  // ==================== تعديل عرض ====================

  const openEditModal = (product) => {
    setEditingProduct({ ...product });
  };

  const saveEditedListing = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await updateDoc(doc(db, "products", editingProduct.id), {
        title: editingProduct.title,
        desc: editingProduct.desc,
        price: parseFloat(editingProduct.price),
        currency: editingProduct.currency,
        location: editingProduct.location
      });
      setEditingProduct(null);
    } catch (err) {
      console.error("Failed to save edited listing:", err);
      alert(language === 'ar' ? "تعذّر حفظ التعديلات، حاول مجددًا." : "Impossible d'enregistrer les modifications.");
    }
  };

  // ==================== تحديد الموقع عبر GPS الجهاز (مجاني، بدون Google Maps API) ====================

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert(t.geoUnsupportedAlert);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewGeo({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert(t.geoErrorAlert);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ==================== دوال رفع الوسائط (Cloudinary) ====================

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.size <= 20 * 1024 * 1024).slice(0, 5);
    if (validFiles.length < files.length) {
      alert(t.filesIgnoredAlert);
    }
    setSelectedFiles(validFiles);
  };

  // ضغط الصور قبل الرفع لتقليل استهلاك البيانات على شبكات الإنترنت الضعيفة/المكلفة
  const compressImage = (file, maxDimension = 1280, quality = 0.72) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) { resolve(file); return; } // لا تضغط الفيديوهات
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => resolve(file);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = Math.round(height * (maxDimension / width)); width = maxDimension; }
          else { width = Math.round(width * (maxDimension / height)); height = maxDimension; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", quality);
      };
      img.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const uploadSingleFileToCloudinary = async (file) => {
    const compressedFile = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const response = await fetch(endpoint, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Upload failed: " + file.name);
    const data = await response.json();
    return { url: data.secure_url, type: data.resource_type };
  };

  const uploadAllFiles = async () => {
    if (selectedFiles.length === 0) return [];
    setIsUploading(true);
    setUploadProgress(`${t.uploading} ${selectedFiles.length} ${t.uploadingSuffix}`);
    try {
      const uploadPromises = selectedFiles.map(file => uploadSingleFileToCloudinary(file));
      const results = await Promise.all(uploadPromises);
      setUploadProgress("");
      return results;
    } catch (err) {
      alert(t.uploadErrorAlert + "\n" + err.message);
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  // فتح نافذة إضافة عرض — يتطلب تسجيل دخول أولاً
  const handleOpenAddProduct = () => {
    if (!currentUser) {
      alert(t.authRequiredAlert);
      openAuthModal();
      return;
    }
    setIsModalOpen(true);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newTitle || !newPrice || !newSeller || !newContact) {
      alert(t.requiredAlert);
      return;
    }
    const uploadedMedia = await uploadAllFiles();
    const newProduct = {
      title: newTitle,
      category: newCategory,
      subcategory: newSubcategory,
      location: newLocation,
      geo: newGeo || null,
      desc: newDesc || "-",
      price: parseFloat(newPrice),
      currency: newCurrency,
      unit: newCategory === "الثروة الحيوانية" ? "رأس" : "شوال",
      contact: newContact,
      seller: newSeller,
      date: language === 'ar' ? "الآن" : "à l'instant",
      media: uploadedMedia,
      ownerUid: currentUser ? currentUser.uid : null,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, "products"), newProduct);
    } catch (err) {
      console.error("Failed to publish product:", err);
      alert(language === 'ar' ? "حدث خطأ أثناء نشر العرض، حاول مجددًا." : "Une erreur est survenue lors de la publication.");
      return;
    }
    setIsModalOpen(false);
    setNewTitle(""); setNewPrice(""); setNewDesc(""); setNewSeller(""); setNewContact(""); setSelectedFiles([]);
    setNewSubcategory(SUBCATEGORIES[newCategory][0]);
    setNewGeo(null);
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === "الكل" || p.subcategory === selectedSubcategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = countryFilter === "كل الدول" || p.location.includes(countryFilter);
    const matchesFavorites = !showFavoritesOnly || favoriteIds.includes(p.id);
    return matchesCategory && matchesSubcategory && matchesSearch && matchesCountry && matchesFavorites;
  }).sort((a, b) => {
    if (sortOption === "priceLow") return (a.price || 0) - (b.price || 0);
    if (sortOption === "priceHigh") return (b.price || 0) - (a.price || 0);
    return 0; // "newest" — الترتيب الأصلي من Firestore (الأحدث أولاً) يبقى كما هو
  });

  const userDisplayLabel = currentUser ? (currentUser.email || currentUser.phoneNumber || "") : "";

  return (
    <div style={{...styles.container, direction: language === 'ar' ? 'rtl' : 'ltr'}}>
      {/* حاوية reCAPTCHA غير المرئية المطلوبة لتسجيل الدخول بالهاتف */}
      <div id="recaptcha-container"></div>

      <header style={{...styles.header, backgroundImage: `linear-gradient(180deg, rgba(22,33,58,0.55) 0%, rgba(22,33,58,0.88) 75%, #16213A 100%), url(${BRAND_IMAGES.heroBanner})`}}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>{t.appTitle}</h1>
          <div style={styles.headerRight}>
            <button onClick={() => setLanguage(language === 'ar' ? 'fr' : 'ar')} style={styles.langBtn}>
              🌐 {t.langToggle}
            </button>
            <div style={styles.logoIcon}>⚖️</div>
          </div>
        </div>
        <p style={styles.subtitle}>
          {t.appSubtitle} <br/>
          <small style={{ fontSize: '11px', opacity: 0.9 }}>{t.countries}</small>
        </p>

        {/* شريط حالة تسجيل الدخول */}
        <div style={styles.authBar}>
          {currentUser ? (
            <>
              <span style={styles.authBarText}>{t.loggedInAs} {userDisplayLabel}</span>
              <button onClick={handleLogout} style={styles.authBarBtn}>{t.logoutBtn}</button>
            </>
          ) : (
            <button onClick={openAuthModal} style={styles.authBarBtn}>{t.loginBtn}</button>
          )}
        </div>

        <div style={styles.currencyBar}>
          <button onClick={() => setSelectedCurrency("ORIGINAL")} style={{...styles.badge, backgroundColor: selectedCurrency === "ORIGINAL" ? "#FFF" : "#E9B824", color: "#000"}}>{t.currencyDefault}</button>
          <button onClick={() => setSelectedCurrency("LYD")} style={{...styles.badge, backgroundColor: selectedCurrency === "LYD" ? "#FFF" : "#E9B824", color: "#000"}}>{currencyLabel("LYD", language)}</button>
          <button onClick={() => setSelectedCurrency("XAF")} style={{...styles.badge, backgroundColor: selectedCurrency === "XAF" ? "#FFF" : "#E9B824", color: "#000"}}>{currencyLabel("XAF", language)}</button>
          <button onClick={() => setSelectedCurrency("SDG")} style={{...styles.badge, backgroundColor: selectedCurrency === "SDG" ? "#FFF" : "#E9B824", color: "#000"}}>{currencyLabel("SDG", language)}</button>
        </div>
      </header>

      {/* ==================== الإعلانات المموّلة (بنفس تصميم بطاقات الأقسام) ==================== */}
      {sponsoredAds.length > 0 && (
        <div style={{marginBottom: "14px"}}>
          <h3 style={styles.sponsoredTitle}>{t.sponsoredTitle}</h3>
          <div style={styles.sponsoredRow}>
            {sponsoredAds.map(ad => {
              const CardTag = ad.linkUrl ? "a" : "div";
              const linkProps = ad.linkUrl ? { href: ad.linkUrl, target: "_blank", rel: "noopener noreferrer" } : {};
              return (
                <CardTag key={ad.id} {...linkProps} style={styles.sponsoredCard}>
                  <img src={ad.imageUrl} alt={ad.title || ""} style={styles.sponsoredImg} />
                  <span style={styles.sponsoredLabel}>{ad.title}</span>
                </CardTag>
              );
            })}
          </div>
        </div>
      )}

      <div style={styles.catCircleRow}>
        {categoryKeys.map((cat, idx) => (
          <button
            key={idx}
            onClick={() => { setSelectedCategory(cat); setSelectedSubcategory("الكل"); }}
            style={styles.catCircleBtn}
          >
            <div style={{
              ...styles.catCircleImgWrap,
              borderColor: selectedCategory === cat ? "#A64B2A" : "#d9cba3"
            }}>
              {cat === "الكل" && <span style={styles.catCircleEmoji}>🗂️</span>}
              {cat === "الثروة الحيوانية" && <img src={BRAND_IMAGES.catLivestock} alt="" style={styles.catCircleImg} />}
              {cat === "المنتجات والمحاصيل الزراعية | Produits Agricoles" && <img src={BRAND_IMAGES.catAgri} alt="" style={styles.catCircleImg} />}
            </div>
            <span style={{
              ...styles.catCircleLabel,
              color: selectedCategory === cat ? "#A64B2A" : "#555",
              fontWeight: selectedCategory === cat ? "bold" : "normal"
            }}>
              {displayCategory(cat)}
            </span>
          </button>
        ))}
      </div>

      {selectedCategory !== "الكل" && (
        <div style={styles.subChipRow}>
          <button
            onClick={() => setSelectedSubcategory("الكل")}
            style={{
              ...styles.subChip,
              backgroundColor: selectedSubcategory === "الكل" ? "#16213A" : "#fff",
              color: selectedSubcategory === "الكل" ? "#fff" : "#16213A"
            }}
          >
            {t.subAll}
          </button>
          {SUBCATEGORIES[selectedCategory].map((sub, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSubcategory(sub)}
              style={{
                ...styles.subChip,
                backgroundColor: selectedSubcategory === sub ? "#16213A" : "#fff",
                color: selectedSubcategory === sub ? "#fff" : "#16213A"
              }}
            >
              {displaySubcategory(sub, language)}
            </button>
          ))}
        </div>
      )}

      <div style={styles.filterRow}>
        <select style={styles.select} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          {countryKeys.map((c, i) => <option key={i} value={c}>{displayCountry(c)}</option>)}
        </select>
        <div style={styles.searchWrap}>
          <span style={{...styles.searchIcon, [language === 'ar' ? 'right' : 'left']: "10px"}}>🔍</span>
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            style={{...styles.input, [language === 'ar' ? 'paddingRight' : 'paddingLeft']: "34px", [language === 'ar' ? 'paddingLeft' : 'paddingRight']: "12px"}}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.filterRow}>
        <select style={styles.select} value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
          <option value="newest">{t.sortNewest}</option>
          <option value="priceLow">{t.sortPriceLow}</option>
          <option value="priceHigh">{t.sortPriceHigh}</option>
        </select>
        <button
          onClick={() => currentUser ? setShowFavoritesOnly(v => !v) : openAuthModal()}
          style={{
            ...styles.favToggleBtn,
            backgroundColor: showFavoritesOnly ? "#C84B31" : "#fff",
            color: showFavoritesOnly ? "#fff" : "#C84B31"
          }}
        >
          {showFavoritesOnly ? "❤️" : "🤍"} {t.favoritesTitle}
        </button>
      </div>

      <main style={styles.productList}>
        {filteredProducts.length === 0 ? (
          <p style={{textAlign:'center', color:'#777', marginTop:20}}>{t.noResults}</p>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} style={{...styles.card, opacity: product.sold ? 0.6 : 1}}>
              <div style={styles.cardHeader}>
                <span style={styles.timeBadge}>{product.date}</span>
                <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                  {product.sold && <span style={styles.soldBadge}>{t.soldBadge}</span>}
                  <span style={styles.catLabel}>
                    {product.category === "الثروة الحيوانية" ? t.catLivestock : t.catAgri}
                    {product.subcategory ? ` · ${displaySubcategory(product.subcategory, language)}` : ""}
                  </span>
                  <button onClick={() => toggleFavorite(product.id)} style={styles.heartBtn} aria-label={t.addToFavorites}>
                    {favoriteIds.includes(product.id) ? "❤️" : "🤍"}
                  </button>
                </div>
              </div>

              <div style={styles.mediaRow}>
                {product.media && product.media.length > 0 ? (
                  product.media.map((m, idx) => (
                    m.type === "video" ? (
                      <video key={idx} src={m.url} controls style={styles.mediaThumb} />
                    ) : (
                      <img key={idx} src={m.url} alt={product.title} style={styles.mediaThumb} />
                    )
                  ))
                ) : (
                  <img src={fallbackImageFor(product.category)} alt={product.title} style={styles.mediaThumb} />
                )}
              </div>

              <h3 style={styles.productTitle}>{product.title}</h3>
              <p style={styles.locationText}>
                {t.locationPrefix} {product.location}
                {product.geo && (
                  <a
                    href={`https://www.google.com/maps?q=${product.geo.lat},${product.geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.mapLink}
                  >
                    {t.viewOnMapBtn}
                  </a>
                )}
              </p>
              <p style={styles.descText}>{product.desc}</p>
              <div style={styles.divider}></div>
              <div style={styles.priceRow}>
                <span style={styles.mainPrice}>{formatPrice(product.price, product.currency)} <small style={{fontSize:11, fontWeight:400, color:'#555'}}>({product.unit})</small></span>
              </div>
              <div style={styles.cardFooter}>
                <span style={styles.sellerName}>{t.sellerPrefix} {product.seller}</span>
                <div style={{display: "flex", gap: "6px"}}>
                  <button onClick={() => handleContactSeller(product)} style={styles.chatBtn}>{t.contactSellerBtn}</button>
                  <a href={`tel:${product.contact}`} style={styles.contactBtn}>{t.callSellerBtn}</a>
                </div>
              </div>

              <div style={styles.secondaryActionsRow}>
                <button onClick={() => shareOnWhatsapp(product)} style={styles.secondaryActionBtn}>{t.shareWhatsapp}</button>
                <button onClick={() => { if (!currentUser) { alert(t.reportRequiresLogin); openAuthModal(); return; } setReportingProduct(product); }} style={styles.secondaryActionBtn}>{t.reportBtn}</button>
              </div>

              {currentUser && product.ownerUid === currentUser.uid && (
                <div style={styles.ownerActionsRow}>
                  <button onClick={() => openEditModal(product)} style={styles.ownerActionBtn}>{t.editListingBtn}</button>
                  <button onClick={() => toggleSoldStatus(product)} style={styles.ownerActionBtn}>
                    {product.sold ? t.markActiveBtn : t.markSoldBtn}
                  </button>
                  <button onClick={() => deleteListing(product)} style={{...styles.ownerActionBtn, color: '#C84B31', borderColor: '#C84B31'}}>{t.deleteListingBtn}</button>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* ==================== الزر العائم لإضافة عرض (كاميرا) ==================== */}
      <button onClick={handleOpenAddProduct} style={styles.fabCamera} aria-label={t.fabButton}>📷</button>

      {/* ==================== الشريط السفلي الثابت ==================== */}
      <nav style={styles.bottomNav}>
        <button
          onClick={() => { setSelectedCategory("الكل"); setSearchQuery(""); setCountryFilter("كل الدول"); window.scrollTo({top:0, behavior:'smooth'}); }}
          style={styles.navItem}
        >
          <span style={styles.navIcon}>🏠</span>
          <span style={styles.navLabel}>{t.navHome}</span>
        </button>

        <button onClick={() => { if (!currentUser) { openAuthModal(); } else { setIsChatListOpen(true); } }} style={styles.navItem}>
          <span style={{position: "relative"}}>
            <span style={styles.navIcon}>💬</span>
            {unreadChatsCount > 0 && <span style={styles.navBadge}>{unreadChatsCount}</span>}
          </span>
          <span style={styles.navLabel}>{t.navChats}</span>
        </button>

        <button onClick={() => { if (!currentUser) { openAuthModal(); } else { setIsNotifOpen(true); } }} style={styles.navItem}>
          <span style={{position: "relative"}}>
            <span style={styles.navIcon}>🔔</span>
            {unreadNotifsCount > 0 && <span style={styles.navBadge}>{unreadNotifsCount}</span>}
          </span>
          <span style={styles.navLabel}>{t.navNotifications}</span>
        </button>

        <button onClick={() => currentUser ? handleLogout() : openAuthModal()} style={styles.navItem}>
          <span style={styles.navIcon}>👤</span>
          <span style={styles.navLabel}>{currentUser ? t.logoutBtn : t.navAccount}</span>
        </button>
      </nav>

      {/* ==================== نافذة قائمة الدردشات / المحادثة النشطة ==================== */}
      {isChatListOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            {!activeConversation ? (
              <>
                <div style={styles.modalHeader}>
                  <h2 style={{margin:0, fontSize:18, color:'#16213A'}}>{t.chatsTitle}</h2>
                  <button onClick={() => setIsChatListOpen(false)} style={styles.closeBtn}>❌</button>
                </div>
                {conversations.length === 0 ? (
                  <p style={{textAlign:'center', color:'#777', padding: '20px 0'}}>{t.noChats}</p>
                ) : (
                  <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                    {conversations.map(conv => (
                      <button key={conv.id} onClick={() => openConversation(conv)} style={styles.convListItem}>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', flex:1}}>
                          <strong style={{fontSize:14, color:'#16213A'}}>{conv.productTitle}</strong>
                          <span style={{fontSize:12, color:'#777'}}>{conv.lastMessage || ""}</span>
                        </div>
                        {currentUser && conv.unread && conv.unread[currentUser.uid] > 0 && (
                          <span style={styles.navBadge}>{conv.unread[currentUser.uid]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={styles.modalHeader}>
                  <button onClick={closeActiveConversation} style={styles.closeBtn}>{language === 'ar' ? '→' : '←'} {t.backBtn}</button>
                  <strong style={{fontSize:14, color:'#16213A'}}>{activeConversation.productTitle}</strong>
                  <button onClick={() => { setIsChatListOpen(false); setActiveConversation(null); }} style={styles.closeBtn}>❌</button>
                </div>
                <div style={styles.chatMessagesArea}>
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.chatBubble,
                        alignSelf: currentUser && msg.senderId === currentUser.uid ? (language === 'ar' ? 'flex-start' : 'flex-end') : (language === 'ar' ? 'flex-end' : 'flex-start'),
                        backgroundColor: currentUser && msg.senderId === currentUser.uid ? '#16213A' : '#F5EFE6',
                        color: currentUser && msg.senderId === currentUser.uid ? '#fff' : '#16213A'
                      }}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChatMessage} style={{display:'flex', gap:'8px', marginTop:'8px'}}>
                  <input
                    type="text"
                    style={{...styles.modalInput, flex:1}}
                    placeholder={t.messagePlaceholder}
                    value={newMessageText}
                    onChange={e => setNewMessageText(e.target.value)}
                  />
                  <button type="submit" style={{...styles.submitBtn, marginTop:0, padding:'10px 16px'}}>{t.sendBtn}</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== نافذة الإشعارات ==================== */}
      {isNotifOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:18, color:'#16213A'}}>{t.notifTitle}</h2>
              <button onClick={() => setIsNotifOpen(false)} style={styles.closeBtn}>❌</button>
            </div>
            {notifications.length === 0 ? (
              <p style={{textAlign:'center', color:'#777', padding: '20px 0'}}>{t.noNotifs}</p>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                {notifications.map(notif => (
                  <button key={notif.id} onClick={() => markNotificationRead(notif)} style={{...styles.convListItem, opacity: notif.read ? 0.55 : 1}}>
                    <span style={{fontSize:13, color:'#16213A', textAlign: language === 'ar' ? 'right' : 'left'}}>{notif.text}</span>
                    {!notif.read && <span style={styles.unreadDot}></span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== نافذة الإبلاغ عن عرض ==================== */}
      {reportingProduct && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:16, color:'#16213A'}}>{t.reportBtn}</h2>
              <button onClick={() => { setReportingProduct(null); setReportReasonText(""); }} style={styles.closeBtn}>❌</button>
            </div>
            <p style={{fontSize:13, color:'#555', margin:'4px 0 10px'}}>{t.reportReasonPrompt}</p>
            <textarea
              style={{...styles.modalInput, minHeight: '80px'}}
              value={reportReasonText}
              onChange={e => setReportReasonText(e.target.value)}
            />
            <button
              onClick={async () => { await submitReport(reportReasonText); setReportReasonText(""); }}
              style={styles.submitBtn}
            >
              {t.sendBtn}
            </button>
          </div>
        </div>
      )}

      {/* ==================== نافذة تعديل عرض ==================== */}
      {editingProduct && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:16, color:'#16213A'}}>{t.editModalTitle}</h2>
              <button onClick={() => setEditingProduct(null)} style={styles.closeBtn}>❌</button>
            </div>
            <form onSubmit={saveEditedListing}>
              <label style={styles.label}>{t.labelTitle}</label>
              <input
                type="text" required style={styles.modalInput}
                value={editingProduct.title}
                onChange={e => setEditingProduct({...editingProduct, title: e.target.value})}
              />
              <label style={styles.label}>{t.labelDesc}</label>
              <textarea
                style={{...styles.modalInput, minHeight: '70px'}}
                value={editingProduct.desc}
                onChange={e => setEditingProduct({...editingProduct, desc: e.target.value})}
              />
              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelPrice}</label>
                  <input
                    type="number" required style={styles.modalInput}
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                  />
                </div>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelCurrency}</label>
                  <select
                    style={styles.modalInput}
                    value={editingProduct.currency}
                    onChange={e => setEditingProduct({...editingProduct, currency: e.target.value})}
                  >
                    <option value="LYD">🇱🇾 {t.currencyLYD}</option>
                    <option value="XAF">🇹🇩 {t.currencyXAF}</option>
                    <option value="SDG">🇸🇩 {t.currencySDG}</option>
                  </select>
                </div>
              </div>
              <label style={styles.label}>{t.labelLocation}</label>
              <input
                type="text" required style={styles.modalInput}
                value={editingProduct.location}
                onChange={e => setEditingProduct({...editingProduct, location: e.target.value})}
              />
              <button type="submit" style={styles.submitBtn}>{t.saveChangesBtn}</button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== نافذة إضافة عرض ==================== */}
      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:18, color:'#16213A'}}>{t.modalTitle}</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>❌</button>
            </div>
            <form onSubmit={handleAddProduct} style={styles.modalBody}>
              <label style={styles.label}>{t.labelTitle}</label>
              <input type="text" required style={styles.modalInput} value={newTitle} onChange={e => setNewTitle(e.target.value)} />

              <label style={styles.label}>{t.labelCategory}</label>
              <select
                style={styles.modalInput}
                value={newCategory}
                onChange={e => { setNewCategory(e.target.value); setNewSubcategory(SUBCATEGORIES[e.target.value][0]); }}
              >
                <option value="الثروة الحيوانية">{t.catLivestock}</option>
                <option value="المنتجات والمحاصيل الزراعية | Produits Agricoles">{t.catAgri}</option>
              </select>

              <label style={styles.label}>{t.labelSubcategory}</label>
              <select style={styles.modalInput} value={newSubcategory} onChange={e => setNewSubcategory(e.target.value)}>
                {SUBCATEGORIES[newCategory].map((sub, idx) => (
                  <option key={idx} value={sub}>{displaySubcategory(sub, language)}</option>
                ))}
              </select>

              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelPrice}</label>
                  <input type="number" required style={styles.modalInput} value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelCurrency}</label>
                  <select style={styles.modalInput} value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
                    <option value="LYD">🇱🇾 {t.currencyLYD}</option>
                    <option value="XAF">🇹🇩 {t.currencyXAF}</option>
                    <option value="SDG">🇸🇩 {t.currencySDG}</option>
                  </select>
                </div>
              </div>

              <label style={styles.label}>{t.labelLocation}</label>
              <input type="text" required style={styles.modalInput} value={newLocation} onChange={e => setNewLocation(e.target.value)} />
              <button type="button" onClick={handleUseMyLocation} disabled={isLocating} style={styles.geoBtn}>
                {isLocating ? t.locatingMsg : t.useMyLocationBtn}
              </button>
              {newGeo && <p style={{fontSize: 12, color: '#54B435', margin: '2px 0'}}>{t.locationCapturedMsg}</p>}

              <label style={styles.label}>{t.labelSeller}</label>
              <input type="text" required style={styles.modalInput} value={newSeller} onChange={e => setNewSeller(e.target.value)} />

              <label style={styles.label}>{t.labelContact}</label>
              <input type="text" required placeholder="+249..." style={styles.modalInput} value={newContact} onChange={e => setNewContact(e.target.value)} />

              <label style={styles.label}>{t.labelDesc}</label>
              <textarea rows="3" style={styles.modalInput} value={newDesc} onChange={e => setNewDesc(e.target.value)}></textarea>

              <label style={styles.label}>{t.labelMedia}</label>
              <input type="file" accept="image/*,video/*" multiple style={styles.modalInput} onChange={handleFileSelect} />
              {selectedFiles.length > 0 && (
                <p style={{fontSize: 12, color: '#16213A', margin: '2px 0'}}>
                  {t.filesSelected} {selectedFiles.length} {t.filesUnit}
                </p>
              )}
              {uploadProgress && (
                <p style={{fontSize: 12, color: '#A87C11', margin: '2px 0'}}>{uploadProgress}</p>
              )}

              <button type="submit" style={styles.submitBtn} disabled={isUploading}>
                {isUploading ? t.submitting : t.submitBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== نافذة تسجيل الدخول / إنشاء حساب ==================== */}
      {isAuthModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:18, color:'#16213A'}}>
                {authMode === 'login' ? t.authModalTitleLogin : t.authModalTitleSignup}
              </h2>
              <button onClick={() => { setIsAuthModalOpen(false); resetAuthFields(); }} style={styles.closeBtn}>❌</button>
            </div>

            {/* تبديل طريقة الدخول: بريد / هاتف */}
            <div style={{display:'flex', gap:8, marginBottom:12}}>
              <button
                onClick={() => { setAuthMethod('email'); resetAuthFields(); }}
                style={{...styles.authMethodBtn, backgroundColor: authMethod === 'email' ? '#16213A' : '#F5EFE6', color: authMethod === 'email' ? '#fff' : '#16213A'}}
              >
                {t.authMethodEmail}
              </button>
              <button
                onClick={() => { setAuthMethod('phone'); resetAuthFields(); }}
                style={{...styles.authMethodBtn, backgroundColor: authMethod === 'phone' ? '#16213A' : '#F5EFE6', color: authMethod === 'phone' ? '#fff' : '#16213A'}}
              >
                {t.authMethodPhone}
              </button>
            </div>

            {/* === نموذج البريد الإلكتروني === */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} style={styles.modalBody}>
                <label style={styles.label}>{t.emailLabel}</label>
                <input type="email" required style={styles.modalInput} value={authEmail} onChange={e => setAuthEmail(e.target.value)} />

                <label style={styles.label}>{t.passwordLabel}</label>
                <input type="password" required minLength={6} style={styles.modalInput} value={authPassword} onChange={e => setAuthPassword(e.target.value)} />

                {authError && <p style={{color:'#C84B31', fontSize:12}}>{authError}</p>}

                <button type="submit" style={styles.submitBtn} disabled={authLoading}>
                  {authMode === 'login' ? t.submitLoginBtn : t.submitSignupBtn}
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(""); }}
                  style={styles.switchAuthBtn}
                >
                  {authMode === 'login' ? t.switchToSignup : t.switchToLogin}
                </button>
              </form>
            )}

            {/* === نموذج الهاتف (OTP) === */}
            {authMethod === 'phone' && (
              <div style={styles.modalBody}>
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} style={styles.modalBody}>
                    <label style={styles.label}>{t.phoneLabel}</label>
                    <input type="tel" required placeholder="+249..." style={styles.modalInput} value={authPhone} onChange={e => setAuthPhone(e.target.value)} />
                    {authError && <p style={{color:'#C84B31', fontSize:12}}>{authError}</p>}
                    <button type="submit" style={styles.submitBtn} disabled={authLoading}>
                      {t.sendOtpBtn}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} style={styles.modalBody}>
                    <p style={{fontSize:12, color:'#54B435'}}>{t.otpSentMsg}</p>
                    <label style={styles.label}>{t.otpLabel}</label>
                    <input type="text" required style={styles.modalInput} value={otpCode} onChange={e => setOtpCode(e.target.value)} />
                    {authError && <p style={{color:'#C84B31', fontSize:12}}>{authError}</p>}
                    <button type="submit" style={styles.submitBtn} disabled={authLoading}>
                      {t.verifyOtpBtn}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { backgroundColor: "#F5EFE6", minHeight: "100vh", padding: "12px", paddingBottom: "78px", fontFamily: "sans-serif" },
  header: { backgroundColor: "#16213A", backgroundSize: "cover", backgroundPosition: "center", color: "#fff", borderRadius: "12px", padding: "16px", marginBottom: "14px", textAlign: "center" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  langBtn: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "16px", padding: "5px 10px", fontSize: "11px", cursor: "pointer" },
  title: { fontSize: "20px", margin: 0, fontWeight: "bold", color: "#F4F6F9" },
  logoIcon: { fontSize: "24px" },
  subtitle: { fontSize: "13px", margin: "0 0 10px 0", color: "#d9cba3", lineHeight: "1.4" },
  authBar: { display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "10px" },
  authBarText: { fontSize: "12px", color: "#d9cba3" },
  authBarBtn: { background: "#E9B824", color: "#16213A", border: "none", padding: "5px 14px", borderRadius: "16px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },
  currencyBar: { display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" },
  badge: { border: "none", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" },
  catToggleRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "6px" },
  catToggleBtn: { flexShrink: 0, display: "flex", alignItems: "center", gap: "6px", border: "1px solid #d9cba3", borderRadius: 8, padding: "8px 16px", fontSize: 13.5, fontWeight: 600 },
  catIcon: { width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" },
  filterRow: { display: "flex", gap: "8px", marginBottom: "14px" },
  select: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#fff", fontSize: "14px" },
  favToggleBtn: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #C84B31", fontSize: "13px", fontWeight: "bold", cursor: "pointer" },
  input: { flex: 2, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  searchWrap: { position: "relative", flex: 2, display: "flex", alignItems: "center" },
  searchIcon: { position: "absolute", fontSize: "14px", opacity: 0.6, pointerEvents: "none" },
  productList: { display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px" },
  card: { backgroundColor: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #e2dcd0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  timeBadge: { fontSize: "11px", color: "#999" },
  catLabel: { backgroundColor: "#F5EFE6", color: "#786c5f", padding: "2px 8px", borderRadius: "12px", fontSize: "11px" },
  mediaRow: { display: "flex", gap: "8px", overflowX: "auto", marginBottom: "10px", paddingBottom: "4px" },
  mediaThumb: { width: "90px", height: "90px", objectFit: "cover", borderRadius: "8px", flexShrink: 0, backgroundColor: "#eee" },
  productTitle: { fontSize: "16px", margin: "0 0 6px 0", color: "#16213A", fontWeight: "bold" },
  locationText: { fontSize: "12px", color: "#C84B31", margin: "0 0 8px 0" },
  descText: { fontSize: "13px", color: "#555", margin: "0 0 12px 0", lineHeight: "1.5" },
  divider: { height: "1px", backgroundColor: "#eee", margin: "8px 0" },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  mainPrice: { fontSize: "18px", fontWeight: "bold", color: "#A87C11" },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },

  // ==== المفضلة، الحالة، الأزرار الثانوية ====
  heartBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: 0, lineHeight: 1 },
  soldBadge: { backgroundColor: "#C84B31", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "3px 8px", borderRadius: "6px" },
  secondaryActionsRow: { display: "flex", gap: "6px", marginTop: "8px", borderTop: "1px solid #eee", paddingTop: "8px" },
  secondaryActionBtn: { flex: 1, background: "none", border: "1px solid #d9cba3", borderRadius: "6px", padding: "6px", fontSize: "11.5px", color: "#555", cursor: "pointer" },
  ownerActionsRow: { display: "flex", gap: "6px", marginTop: "6px" },
  ownerActionBtn: { flex: 1, backgroundColor: "#F5EFE6", border: "1px solid #d9cba3", borderRadius: "6px", padding: "6px", fontSize: "11.5px", fontWeight: "bold", color: "#16213A", cursor: "pointer" },
  sellerName: { fontSize: "13px", fontWeight: "bold", color: "#555" },
  contactBtn: { backgroundColor: "#54B435", color: "#fff", textDecoration: 'none', padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" },
  fab: { position: "fixed", bottom: "20px", left: "20px", right: "20px", backgroundColor: "#A64B2A", color: "#fff", border: "none", padding: "14px", borderRadius: "30px", fontSize: "15px", fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 90, cursor: 'pointer', textAlign: 'center' },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "12px" },
  modal: { backgroundColor: "#FFF", borderRadius: "16px", width: "100%", maxWidth: "460px", maxHeight: "90vh", overflowY: "auto", padding: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #EEE", paddingBottom: "10px", marginBottom: "12px" },
  closeBtn: { background: "none", border: "none", fontSize: "16px", cursor: "pointer" },
  modalBody: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "12px", fontWeight: "bold", color: "#444" },
  modalInput: { padding: "10px", borderRadius: "8px", border: "1px solid #CCC", fontSize: "14px", fontFamily: "sans-serif" },
  submitBtn: { backgroundColor: "#16213A", color: "#FFF", border: "none", padding: "12px", borderRadius: "8px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" },
  authMethodBtn: { flex: 1, border: "1px solid #d9cba3", borderRadius: "8px", padding: "8px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" },
  switchAuthBtn: { background: "none", border: "none", color: "#16213A", fontSize: "12px", textDecoration: "underline", cursor: "pointer", marginTop: "4px" },

  // ==== موقع GPS ====
  geoBtn: { backgroundColor: "#F5EFE6", color: "#16213A", border: "1px dashed #A87C11", borderRadius: "8px", padding: "8px", fontSize: "12.5px", fontWeight: "bold", cursor: "pointer", marginTop: "2px" },
  mapLink: { marginInlineStart: "8px", color: "#16213A", fontWeight: "bold", textDecoration: "underline", fontSize: "12px" },

  // ==== الأيقونات الدائرية للأقسام ====
  catCircleRow: { display: "flex", gap: "16px", marginBottom: "14px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "4px" },
  catCircleBtn: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0, cursor: "pointer", width: "62px" },
  catCircleImgWrap: { width: "56px", height: "56px", borderRadius: "50%", border: "2px solid #d9cba3", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  catCircleImg: { width: "100%", height: "100%", objectFit: "cover" },
  catCircleEmoji: { fontSize: "22px" },
  catCircleLabel: { fontSize: "11px", textAlign: "center", lineHeight: "1.2" },

  // ==== شريط التصنيفات الفرعية ====
  subChipRow: { display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "4px" },
  subChip: { flexShrink: 0, border: "1px solid #d9cba3", borderRadius: "16px", padding: "6px 14px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },

  // ==== الإعلانات المموّلة ====
  sponsoredTitle: { fontSize: "14px", fontWeight: "bold", color: "#16213A", margin: "0 0 8px 0" },
  sponsoredRow: { display: "flex", gap: "10px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "4px" },
  sponsoredCard: {
    flexShrink: 0, width: "110px", backgroundColor: "#fff", borderRadius: "14px",
    border: "1px solid #e2dcd0", boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    padding: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
    textDecoration: "none", cursor: "pointer"
  },
  sponsoredImg: { width: "94px", height: "70px", objectFit: "cover", borderRadius: "10px", backgroundColor: "#F5EFE6" },
  sponsoredLabel: { fontSize: "12px", fontWeight: 600, color: "#16213A", textAlign: "center", lineHeight: "1.3" },

  // ==== أزرار المراسلة والاتصال على بطاقة المنتج ====
  chatBtn: { backgroundColor: "#16213A", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },

  // ==== الزر العائم (كاميرا) ====
  fabCamera: {
    position: "fixed", bottom: "46px", left: "50%", transform: "translateX(-50%)",
    width: "58px", height: "58px", borderRadius: "50%",
    backgroundColor: "#E9702A", color: "#fff", border: "3px solid #fff",
    fontSize: "24px", boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 95, cursor: "pointer"
  },

  // ==== الشريط السفلي ====
  bottomNav: {
    position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
    backgroundColor: "#fff", borderTop: "1px solid #eee",
    display: "flex", justifyContent: "space-around", alignItems: "center",
    boxShadow: "0 -2px 8px rgba(0,0,0,0.06)", zIndex: 90, padding: "0 6px"
  },
  navItem: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", cursor: "pointer", color: "#16213A", flex: 1 },
  navIcon: { fontSize: "20px" },
  navLabel: { fontSize: "10px" },
  navBadge: {
    position: "absolute", top: "-6px", insetInlineEnd: "-8px",
    backgroundColor: "#C84B31", color: "#fff", borderRadius: "50%",
    minWidth: "16px", height: "16px", fontSize: "10px", fontWeight: "bold",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px"
  },

  // ==== الدردشات والإشعارات ====
  convListItem: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", backgroundColor: "#F5EFE6", border: "1px solid #e2dcd0", borderRadius: "10px", padding: "10px 12px", cursor: "pointer", textAlign: "start" },
  chatMessagesArea: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "50vh", overflowY: "auto", padding: "6px 2px" },
  chatBubble: { maxWidth: "75%", padding: "8px 12px", borderRadius: "14px", fontSize: "13.5px", lineHeight: "1.4" },
  unreadDot: { width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#C84B31", flexShrink: 0 }
};
