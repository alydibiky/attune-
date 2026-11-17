// Held-out for tests/listing/verify.mjs — products, stores and hotels written AFTER the check, never tuned on.
let s = 31; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }, int = (a, b) => a + Math.floor(r() * (b - a + 1));
export const H = {
  products: [
    ["Samsung Galaxy Buds3 Pro", "Samsung Galaxy Buds3 Pro, AI Noise Cancelling, Silver", "Samsung Galaxy Buds3, White", [6000, 9000]],
    ["Apple Watch Series 10 46mm", "Apple Watch Series 10 GPS 46mm Jet Black Aluminium Case with Sport Band", "Apple Watch SE 44mm Midnight", [18000, 26000]],
    ["Dyson V15 Detect", "Dyson V15 Detect Absolute Cordless Vacuum Cleaner", "Charger Adapter for Dyson V15 Detect", [30000, 45000]],
    ["Nintendo Switch OLED", "Nintendo Switch OLED Model – White Joy-Con", "Nintendo Switch Lite – Turquoise", [14000, 20000]],
    ["iPad Air 11 M2 128GB", "Apple iPad Air 11-inch (M2) Wi-Fi 128GB – Space Grey", "Apple iPad 10.9-inch Wi-Fi 64GB", [28000, 38000]],
    ["Philips Airfryer XXL HD9650", "Philips Airfryer XXL Premium HD9650/91, 7.3L, Black", "Philips Airfryer Essential Compact HD9200", [9000, 14000]],
  ],
  stores: [
    ["Carrefour", "EGP", () => ({ own: `https://www.carrefouregypt.com/mafegy/en/product/p/${int(100000, 999999)}?utm_source=x`, search: "https://www.carrefouregypt.com/mafegy/en/search?keyword=buds3", hop: null })],
    ["2B", "EGP", () => ({ own: `https://2b.com.eg/en/samsung-galaxy-buds3-pro-${int(1000, 9999)}.html`, search: "https://2b.com.eg/en/catalogsearch/result/?q=buds", hop: null })],
    ["Raya", "EGP", () => ({ own: `https://www.rayashop.com/en/product-${int(10000, 99999)}`, search: "https://www.rayashop.com/en/search?q=buds", hop: null })],
    ["Amazon.ae", "AED", () => { const a = "B0" + int(10000000, 99999999); return { own: `https://www.amazon.ae/gp/product/${a}?th=1&psc=1`, clean: `https://www.amazon.ae/dp/${a}`, search: "https://www.amazon.ae/s?k=buds3+pro", hop: (u) => `https://www.amazon.ae/gp/slredirect/picassoRedirect.html?url=${encodeURIComponent(u.replace("https://www.amazon.ae", ""))}` }; }],
  ],
  hotels: [["Four Seasons Hotel Cairo at Nile Plaza", "four-seasons-cairo-at-nile-plaza", "Four Seasons Hotel Cairo at The First Residence"],
    ["Pullman Zamzam Makkah", "pullman-zamzam-makkah", "Mövenpick Hotel & Residences Hajar Tower Makkah"], ["Steigenberger Al Dau Beach", "steigenberger-al-dau-beach", "Steigenberger Aqua Magic"]],
};
