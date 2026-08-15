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
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

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
    labelPrice: "السعر الرقمي",
    labelCurrency: "عملة العرض",
    labelLocation: "الموقع الحالي والبلد (مثال: الخرطوم، السودان)",
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
    closeBtn: "إغلاق"
  },
  fr: {
    appTitle: "Souq Al-Maftouh Régional",
    appSubtitle: "الثروة الحيوانية والمحاصيل الزراعية | Élevage et Cultures",
    countries: "Libye · Tchad · Soudan",
    currencyDefault: "Par défaut",
    catAll: "Tout",
    catLivestock: "الثروة الحيوانية",
    catAgri: "المنتجات والمحاصيل الزراعية | Produits Agricoles",
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
    labelPrice: "Prix",
    labelCurrency: "Devise de l'offre",
    labelLocation: "Emplacement actuel et pays (ex : Khartoum, Soudan)",
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
    closeBtn: "Fermer"
  }
};

// أسعار الصرف الثابتة مقارنة بالدولار (تحديث 2026)
const exchangeRates = { "LYD": 4.80, "XAF": 600, "SDG": 650 };

// البيانات الأولية لبدء التطبيق
const initialProducts = [
  {
    id: 1,
    title: "جمال سودانية للتصدير، قطيع مدرب على السفر البري",
    category: "الثروة الحيوانية",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("كل الدول");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("الثروة الحيوانية");
  const [newLocation, setNewLocation] = useState("السودان");
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

  // متابعة حالة تسجيل الدخول تلقائياً عند تحميل التطبيق
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

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

  const categoryKeys = ["الكل", "الثروة الحيوانية", "المنتجات والمحاصيل الزراعية | Produits Agricoles"];
  const countryKeys = ["كل الدول", "السودان", "تشاد", "ليبيا"];

  const displayCategory = (key) => {
    if (key === "الكل") return t.catAll;
    if (key === "الثروة الحيوانية") return t.catLivestock;
    return t.catAgri;
  };
  const displayCountry = (key) => {
    if (key === "كل الدول") return t.countryAll;
    if (key === "السودان") return t.countrySudan;
    if (key === "تشاد") return t.countryChad;
    return t.countryLibya;
  };

  const formatPrice = (price, fromCurrency) => {
    if (selectedCurrency === "ORIGINAL" || !exchangeRates[selectedCurrency]) {
      return `${price} ${fromCurrency === "XAF" ? "ف.س" : fromCurrency === "SDG" ? "ج.س" : "د.ل"}`;
    }
    const priceInUSD = price / exchangeRates[fromCurrency];
    const convertedPrice = priceInUSD * exchangeRates[selectedCurrency];
    const label = selectedCurrency === "XAF" ? "ف.س" : selectedCurrency === "SDG" ? "ج.س" : "د.ل";
    return `${Math.round(convertedPrice).toLocaleString()} ${label}`;
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

  // ==================== دوال رفع الوسائط (Cloudinary) ====================

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.size <= 20 * 1024 * 1024).slice(0, 5);
    if (validFiles.length < files.length) {
      alert(t.filesIgnoredAlert);
    }
    setSelectedFiles(validFiles);
  };

  const uploadSingleFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
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
      location: newLocation,
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
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = countryFilter === "كل الدول" || p.location.includes(countryFilter);
    return matchesCategory && matchesSearch && matchesCountry;
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
          <button onClick={() => setSelectedCurrency("LYD")} style={{...styles.badge, backgroundColor: selectedCurrency === "LYD" ? "#FFF" : "#E9B824", color: "#000"}}>د.ل</button>
          <button onClick={() => setSelectedCurrency("XAF")} style={{...styles.badge, backgroundColor: selectedCurrency === "XAF" ? "#FFF" : "#E9B824", color: "#000"}}>ف.س</button>
          <button onClick={() => setSelectedCurrency("SDG")} style={{...styles.badge, backgroundColor: selectedCurrency === "SDG" ? "#FFF" : "#E9B824", color: "#000"}}>ج.س</button>
        </div>
      </header>

      <div style={styles.catToggleRow}>
        {categoryKeys.map((cat, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.catToggleBtn,
              backgroundColor: selectedCategory === cat ? "#16213A" : "#fff",
              color: selectedCategory === cat ? "#fff" : "#000"
            }}
          >
            {cat === "الثروة الحيوانية" && <img src={BRAND_IMAGES.catLivestock} alt="" style={styles.catIcon} />}
            {cat === "المنتجات والمحاصيل الزراعية | Produits Agricoles" && <img src={BRAND_IMAGES.catAgri} alt="" style={styles.catIcon} />}
            {displayCategory(cat)}
          </button>
        ))}
      </div>

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

      <main style={styles.productList}>
        {filteredProducts.length === 0 ? (
          <p style={{textAlign:'center', color:'#777', marginTop:20}}>{t.noResults}</p>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.timeBadge}>{product.date}</span>
                <span style={styles.catLabel}>
                  {product.category === "الثروة الحيوانية" ? t.catLivestock : t.catAgri}
                </span>
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
              <p style={styles.locationText}>{t.locationPrefix} {product.location}</p>
              <p style={styles.descText}>{product.desc}</p>
              <div style={styles.divider}></div>
              <div style={styles.priceRow}>
                <span style={styles.mainPrice}>{formatPrice(product.price, product.currency)} <small style={{fontSize:11, fontWeight:400, color:'#555'}}>({product.unit})</small></span>
              </div>
              <div style={styles.cardFooter}>
                <span style={styles.sellerName}>{t.sellerPrefix} {product.seller}</span>
                <a href={`tel:${product.contact}`} style={styles.contactBtn}>{t.contactPrefix} {product.contact}</a>
              </div>
            </div>
          ))
        )}
      </main>

      <button onClick={handleOpenAddProduct} style={styles.fab}>{t.fabButton}</button>

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
              <select style={styles.modalInput} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                <option value="الثروة الحيوانية">{t.catLivestock}</option>
                <option value="المنتجات والمحاصيل الزراعية | Produits Agricoles">{t.catAgri}</option>
              </select>

              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelPrice}</label>
                  <input type="number" required style={styles.modalInput} value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <label style={styles.label}>{t.labelCurrency}</label>
                  <select style={styles.modalInput} value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
                    <option value="LYD">{t.currencyLYD}</option>
                    <option value="XAF">{t.currencyXAF}</option>
                    <option value="SDG">{t.currencySDG}</option>
                  </select>
                </div>
              </div>

              <label style={styles.label}>{t.labelLocation}</label>
              <input type="text" required style={styles.modalInput} value={newLocation} onChange={e => setNewLocation(e.target.value)} />

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
  container: { backgroundColor: "#F5EFE6", minHeight: "100vh", padding: "12px", fontFamily: "sans-serif" },
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
  input: { flex: 2, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  searchWrap: { position: "relative", flex: 2, display: "flex", alignItems: "center" },
  searchIcon: { position: "absolute", fontSize: "14px", opacity: 0.6, pointerEvents: "none" },
  productList: { display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "80px" },
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
  switchAuthBtn: { background: "none", border: "none", color: "#16213A", fontSize: "12px", textDecoration: "underline", cursor: "pointer", marginTop: "4px" }
};
