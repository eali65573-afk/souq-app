import React, { useState } from 'react';

// ==== إعدادات Cloudinary — استبدل بقيمك الفعلية ====
const CLOUDINARY_CLOUD_NAME = "tqvxulwr";
const CLOUDINARY_UPLOAD_PRESET = "souq_uploads";

// مصفوفة التصنيفات الثابتة
const categories = ["الكل", "الثروة الحيوانية", "المنتجات والمحاصيل الزراعية | Produits Agricoles"];

// أسعار الصرف الثابتة مقارنة بالدولار (تحديث 2026)
const exchangeRates = {
  "LYD": 4.80, // دينار ليبي
  "XAF": 600,  // فرنك وسط أفريقيا (تشاد)
  "SDG": 650   // جنيه سوداني
};

// البيانات الأولية لبدء التطبيق
const initialProducts = [
  {
    id: 1,
    title: "جمال سودانية للتصدير، قطيع مدرب على السفر البري",
    category: "الثروة الحيوانية",
    location: "نيالا، السودان",
    desc: "قطيع من الإبل السودانية بحالة صحية جيدة، جاهز للنقل عبر الجنينة نحو الحدود التشادية.",
    price: 9000,
    currency: "SDG",
    unit: "رأس",
    contact: "+249912345678",
    seller: "أبو بكر الصديق لشحن الماشية",
    date: "منذ يومين",
    media: []
  },
  {
    id: 2,
    title: "فول سوداني تشادي ممتاز (خام)",
    category: "المنتجات والمحاصيل الزراعية | Produits Agricoles",
    location: "أبشي، تشاد",
    desc: "فول سوداني نقي وعالي الجودة، معبأ في أكياس ومتوفر للبيع بالجملة والتصدير الإقليمي الكلي.",
    price: 35000,
    currency: "XAF",
    unit: "شوال",
    contact: "+23566123456",
    seller: "شركة أبشي للإنتاج الزراعي",
    date: "منذ 5 أيام",
    media: []
  }
];

export default function App() {
  // 1. قاعدة البيانات المحلية للمنتجات
  const [products, setProducts] = useState(initialProducts);

  // 2. حالة منتقي العملة الافتراضية للعرض
  const [selectedCurrency, setSelectedCurrency] = useState("ORIGINAL");

  // حالات الفلترة والبحث
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("كل الدول");

  // حالات نافذة "إضافة عرض جديد"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("الثروة الحيوانية");
  const [newLocation, setNewLocation] = useState("السودان");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("LYD");
  const [newDesc, setNewDesc] = useState("");
  const [newSeller, setNewSeller] = useState("");
  const [newContact, setNewContact] = useState("");

  // === حالات رفع الصور والفيديو ===
  const [selectedFiles, setSelectedFiles] = useState([]); // ملفات مختارة قبل الرفع
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // دالة تحويل العملة الديناميكية بداخل قاعدة البيانات
  const formatPrice = (price, fromCurrency) => {
    if (selectedCurrency === "ORIGINAL" || !exchangeRates[selectedCurrency]) {
      return `${price} ${fromCurrency === "XAF" ? "ف.س" : fromCurrency === "SDG" ? "ج.س" : "د.ل"}`;
    }
    const priceInUSD = price / exchangeRates[fromCurrency];
    const convertedPrice = priceInUSD * exchangeRates[selectedCurrency];
    const label = selectedCurrency === "XAF" ? "ف.س" : selectedCurrency === "SDG" ? "ج.س" : "د.ل";
    return `${Math.round(convertedPrice).toLocaleString()} ${label}`;
  };

  // عند اختيار المستخدم لملفات (صور/فيديو) من الجهاز
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    // حد أقصى 5 ملفات، وحجم أقصى 20 ميغابايت لكل ملف (حماية بسيطة من جانب العميل)
    const validFiles = files.filter(f => f.size <= 20 * 1024 * 1024).slice(0, 5);
    if (validFiles.length < files.length) {
      alert("تم تجاهل بعض الملفات: الحد الأقصى 5 ملفات، وحجم كل ملف لا يتجاوز 20 ميغابايت.");
    }
    setSelectedFiles(validFiles);
  };

  // رفع ملف واحد إلى Cloudinary عبر التحميل غير الموقّع (unsigned upload)
  const uploadSingleFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    // "auto" يحدد تلقائياً إن كان صورة أو فيديو
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("فشل رفع الملف: " + file.name);
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      type: data.resource_type // "image" أو "video"
    };
  };

  // رفع كل الملفات المختارة بالتوازي
  const uploadAllFiles = async () => {
    if (selectedFiles.length === 0) return [];

    setIsUploading(true);
    setUploadProgress(`جاري رفع ${selectedFiles.length} ملف...`);

    try {
      const uploadPromises = selectedFiles.map(file => uploadSingleFileToCloudinary(file));
      const results = await Promise.all(uploadPromises);
      setUploadProgress("");
      return results; // [{ url, type }, ...]
    } catch (err) {
      alert("حدث خطأ أثناء رفع الوسائط. تأكد من اتصالك بالإنترنت وحاول مجدداً.\n" + err.message);
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  // معالج إضافة العرض الجديد وحفظه في قاعدة البيانات (أصبح async بسبب الرفع)
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newTitle || !newPrice || !newSeller || !newContact) {
      alert("الرجاء ملء الحقول الأساسية!");
      return;
    }

    // رفع الوسائط أولاً (إن وُجدت) قبل إنشاء العرض
    const uploadedMedia = await uploadAllFiles();

    const newProduct = {
      id: Date.now(),
      title: newTitle,
      category: newCategory,
      location: newLocation,
      desc: newDesc || "لا توجد تفاصيل إضافية.",
      price: parseFloat(newPrice),
      currency: newCurrency,
      unit: newCategory === "الثروة الحيوانية" ? "رأس" : "شوال",
      contact: newContact,
      seller: newSeller,
      date: "الآن",
      media: uploadedMedia
    };

    setProducts([newProduct, ...products]);
    setIsModalOpen(false);

    // تصفير المدخلات
    setNewTitle("");
    setNewPrice("");
    setNewDesc("");
    setNewSeller("");
    setNewContact("");
    setSelectedFiles([]);
  };

  // تصفية المنتجات حسب الاختيارات
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = countryFilter === "كل الدول" || p.location.includes(countryFilter);
    return matchesCategory && matchesSearch && matchesCountry;
  });

  return (
    <div style={styles.container}>
      {/* الهيدر العلوي المطور مع منتقي العملات التفاعلي */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>السوق المفتوح الاقليمي</h1>
          <div style={styles.logoIcon}>⚖️</div>
        </div>
        <p style={styles.subtitle}>
          الثروة الحيوانية والمحاصيل الزراعية | Élevage et Cultures <br/>
          <small style={{ fontSize: '11px', opacity: 0.9 }}>ليبيا · تشاد · السودان</small>
        </p>

        <div style={styles.currencyBar}>
          <button onClick={() => setSelectedCurrency("ORIGINAL")} style={{...styles.badge, backgroundColor: selectedCurrency === "ORIGINAL" ? "#FFF" : "#E9B824", color: "#000"}}>الأساسية</button>
          <button onClick={() => setSelectedCurrency("LYD")} style={{...styles.badge, backgroundColor: selectedCurrency === "LYD" ? "#FFF" : "#E9B824", color: "#000"}}>د.ل</button>
          <button onClick={() => setSelectedCurrency("XAF")} style={{...styles.badge, backgroundColor: selectedCurrency === "XAF" ? "#FFF" : "#E9B824", color: "#000"}}>ف.س</button>
          <button onClick={() => setSelectedCurrency("SDG")} style={{...styles.badge, backgroundColor: selectedCurrency === "SDG" ? "#FFF" : "#E9B824", color: "#000"}}>ج.س</button>
        </div>
      </header>

      <div style={styles.catToggleRow}>
        {categories.map((cat, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.catToggleBtn,
              backgroundColor: selectedCategory === cat ? "#16213A" : "#fff",
              color: selectedCategory === cat ? "#fff" : "#000"
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.filterRow}>
        <select style={styles.select} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option>كل الدول</option>
          <option>السودان</option>
          <option>تشاد</option>
          <option>ليبيا</option>
        </select>
        <input
          type="text"
          placeholder="ابحث عن سلعة أو موقع..."
          style={styles.input}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <main style={styles.productList}>
        {filteredProducts.length === 0 ? (
          <p style={{textAlign:'center', color:'#777', marginTop:20}}>لا توجد عروض تطابق بحثك حالياً.</p>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.timeBadge}>{product.date}</span>
                <span style={styles.catLabel}>{product.category.split(' ')[0]}</span>
              </div>

              {/* === عرض الصور والفيديو المرفقة (إن وُجدت) === */}
              {product.media && product.media.length > 0 && (
                <div style={styles.mediaRow}>
                  {product.media.map((m, idx) => (
                    m.type === "video" ? (
                      <video key={idx} src={m.url} controls style={styles.mediaThumb} />
                    ) : (
                      <img key={idx} src={m.url} alt={product.title} style={styles.mediaThumb} />
                    )
                  ))}
                </div>
              )}

              <h3 style={styles.productTitle}>{product.title}</h3>
              <p style={styles.locationText}>📍 {product.location}</p>
              <p style={styles.descText}>{product.desc}</p>
              <div style={styles.divider}></div>
              <div style={styles.priceRow}>
                <span style={styles.mainPrice}>{formatPrice(product.price, product.currency)} <small style={{fontSize:11, fontWeight:400, color:'#555'}}>({product.unit})</small></span>
              </div>
              <div style={styles.cardFooter}>
                <span style={styles.sellerName}>👤 {product.seller}</span>
                <a href={`tel:${product.contact}`} style={styles.contactBtn}>📞 اتصال: {product.contact}</a>
              </div>
            </div>
          ))
        )}
      </main>

      <button onClick={() => setIsModalOpen(true)} style={styles.fab}>+ أضف عرضك التصديري</button>

      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{margin:0, fontSize:18, color:'#16213A'}}>إضافة عرض تجاري جديد</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>❌</button>
            </div>
            <form onSubmit={handleAddProduct} style={styles.modalBody}>
              <label style={styles.label}>عنوان العرض (مثال: شحنة صمغ عربي نقي للبيع)</label>
              <input type="text" required style={styles.modalInput} value={newTitle} onChange={e => setNewTitle(e.target.value)} />

              <label style={styles.label}>التصنيف الرئيسي</label>
              <select style={styles.modalInput} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                <option value="الثروة الحيوانية">الثروة الحيوانية</option>
                <option value="المنتجات والمحاصيل الزراعية | Produits Agricoles">المنتجات والمحاصيل الزراعية</option>
              </select>

              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1}}>
                  <label style={styles.label}>السعر الرقمي</label>
                  <input type="number" required style={styles.modalInput} value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <label style={styles.label}>عملة العرض</label>
                  <select style={styles.modalInput} value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
                    <option value="LYD">دينار ليبي (LYD)</option>
                    <option value="XAF">فرنك تشادي (XAF)</option>
                    <option value="SDG">جنيه سوداني (SDG)</option>
                  </select>
                </div>
              </div>

              <label style={styles.label}>الموقع الحالي والبلد (مثال: الخرطوم، السودان)</label>
              <input type="text" required placeholder="المدينة، الدولة" style={styles.modalInput} value={newLocation} onChange={e => setNewLocation(e.target.value)} />

              <label style={styles.label}>اسم التاجر / الشركة</label>
              <input type="text" required style={styles.modalInput} value={newSeller} onChange={e => setNewSeller(e.target.value)} />

              <label style={styles.label}>رقم الهاتف (واتساب أو اتصال مع رمز الدولة)</label>
              <input type="text" required placeholder="+249..." style={styles.modalInput} value={newContact} onChange={e => setNewContact(e.target.value)} />

              <label style={styles.label}>تفاصيل السلعة ومواصفاتها</label>
              <textarea rows="3" style={styles.modalInput} value={newDesc} onChange={e => setNewDesc(e.target.value)}></textarea>

              {/* === حقل رفع الصور والفيديو الجديد === */}
              <label style={styles.label}>صور أو فيديو للسلعة (اختياري، حتى 5 ملفات)</label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                style={styles.modalInput}
                onChange={handleFileSelect}
              />
              {selectedFiles.length > 0 && (
                <p style={{fontSize: 12, color: '#16213A', margin: '2px 0'}}>
                  تم اختيار {selectedFiles.length} ملف/ملفات
                </p>
              )}
              {uploadProgress && (
                <p style={{fontSize: 12, color: '#A87C11', margin: '2px 0'}}>{uploadProgress}</p>
              )}

              <button type="submit" style={styles.submitBtn} disabled={isUploading}>
                {isUploading ? "⏳ جاري الرفع..." : "🚀 نشر العرض فوراً في السوق"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { backgroundColor: "#F5EFE6", minHeight: "100vh", padding: "12px", direction: "rtl", fontFamily: "sans-serif" },
  header: { backgroundColor: "#16213A", color: "#fff", borderRadius: "12px", padding: "16px", marginBottom: "14px", textAlign: "center" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  title: { fontSize: "20px", margin: 0, fontWeight: "bold", color: "#F4F6F9" },
  logoIcon: { fontSize: "24px" },
  subtitle: { fontSize: "13px", margin: "0 0 12px 0", color: "#d9cba3", lineHeight: "1.4" },
  currencyBar: { display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" },
  badge: { border: "none", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" },
  catToggleRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "6px", paddingLeft: "16px", paddingRight: "16px" },
  catToggleBtn: { flexShrink: 0, border: "1px solid #d9cba3", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 },
  filterRow: { display: "flex", gap: "8px", marginBottom: "14px" },
  select: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#fff", fontSize: "14px" },
  input: { flex: 2, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px" },
  productList: { display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "80px" },
  card: { backgroundColor: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #e2dcd0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  timeBadge: { fontSize: "11px", color: "#999" },
  catLabel: { backgroundColor: "#F5EFE6", color: "#786c5f", padding: "2px 8px", borderRadius: "12px", fontSize: "11px" },
  // === ستايل صف الوسائط (صور/فيديو) ===
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
  submitBtn: { backgroundColor: "#16213A", color: "#FFF", border: "none", padding: "12px", borderRadius: "8px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" }
};
