/* =========================================
 * data-service.js — FINAL VERSION
 * Quản lý kết nối Google Sheets, Caching & Xử lý dữ liệu
 * ========================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbwwbKgV-v8tAeh9iEcNz1tznbZ9GR3RyJsn71_EBD_5YLeyN6Wr0UsmoFtH6hFzeaJgQQ/exec";

const DataService = {
  _cache: null,                 // Core data trong RAM (Clusters, Staff, Stores...)
  _loadingPromise: null,        // Promise khóa tải tránh gọi trùng
  _kpiCache: new Map(),         // LRU cache cho KPI Actual (theo range ngày)
  _lastMeta: null,
  _metaPromise: null,

  // ============================================================
  // 1. CORE LOADER (Tải dữ liệu nền tảng)
  // ============================================================
  
  async ensureData(forceReload = false) {
    if (!forceReload && this._cache) return;

    // Nếu đang có request chạy mà không force -> chờ request đó xong
    if (!forceReload && this._loadingPromise) return this._loadingPromise;

    // 1. Thử đọc từ localStorage trước (để load trang nhanh)
    if (!forceReload) {
      try {
        const localData = localStorage.getItem("MIS_LOCAL_DATA");
        const lastFetch = parseInt(localStorage.getItem("MIS_LAST_FETCH") || "0", 10);
        const now = Date.now();
        const CACHE_TIME = 15 * 60 * 1000; // Cache 15 phút

        if (localData && lastFetch && (now - lastFetch < CACHE_TIME)) {
          const parsed = JSON.parse(localData);
          if (parsed && Object.keys(parsed).length > 0) {
            this._cache = parsed;
            this._lastMeta = parsed.__meta || null;
            console.log("⚡ Dùng dữ liệu CORE từ LocalStorage");
            return;
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc LocalStorage, sẽ tải mới...", e);
      }
    }

    // 2. Nếu không có cache hoặc hết hạn -> Tải từ API
    this._loadingPromise = this.fetchAndSaveCore(forceReload)
      .finally(() => { this._loadingPromise = null; });

    return this._loadingPromise;
  },

  async fetchAndSaveCore(forceReload = false) {
    if (!API_URL || API_URL.includes("...")) throw new Error("API URL chưa được cấu hình chính xác");

    try {
      console.log("🌐 Đang tải CORE từ Google Sheet...");
      
      // Ưu tiên gọi type=core (gói dữ liệu nhẹ: clusters, stores, staff...)
      let data = await this._fetchJson(`${API_URL}?type=core`, { unwrapData: true });

      // Fallback: Nếu backend chưa hỗ trợ type=core, gọi type=all
      if (data && data.error) {
        const msg = String(data.error || "");
        if (msg.toLowerCase().includes("sheet") || msg.toLowerCase().includes("core")) {
          console.warn("Backend chưa hỗ trợ type=core, fallback type=all");
          data = await this._fetchJson(`${API_URL}?type=all`, { unwrapData: true });
        }
      }

      if (data && data.error) throw new Error(data.error);

      this._cache = data || {};
      this._lastMeta = (data && data.__meta) ? data.__meta : null;

      // Lưu xuống localStorage
      try {
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
        localStorage.setItem("MIS_LAST_FETCH", String(Date.now()));
        console.log("✅ Đã tải và lưu CORE thành công!");
      } catch (e) {
        console.warn("Không thể lưu LocalStorage (Quota exceeded?)", e);
      }

    } catch (error) {
      console.error("❌ Lỗi tải CORE:", error);

      // Nếu lỗi mạng, cố gắng dùng lại cache cũ dù đã hết hạn
      const local = localStorage.getItem("MIS_LOCAL_DATA");
      if (local) {
        console.warn("⚠️ Mất kết nối. Dùng CORE cũ trong LocalStorage.");
        this._cache = JSON.parse(local);
        this._lastMeta = this._cache.__meta || null;
      } else {
        this._cache = {};
        throw error;
      }
    }
  },

  /**
   * Helper fetch JSON
   * @param {string} url 
   * @param {object} options { unwrapData: boolean }
   * - unwrapData=true: Trả về result.data (hành vi cũ)
   * - unwrapData=false: Trả về full result (dùng cho kpi_data cần phân trang/total)
   */
  async _fetchJson(url, { unwrapData = true } = {}) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    let result;
    try {
      result = await res.json();
    } catch (e) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Response không phải JSON. Body: ${txt.slice(0, 200)}`);
    }

    if (!unwrapData) return result;

    // Unwrap: nếu cấu trúc là { status: 'success', data: [...] }
    if (result && typeof result === "object" && !Array.isArray(result) && ("data" in result)) {
      return result.data;
    }
    return result;
  },

  // ============================================================
  // 2. DATA GETTERS (CORE)
  // ============================================================

  async _getData(key) {
    await this.ensureData();
    return (this._cache && this._cache[key]) ? this._cache[key] : [];
  },

  // Cơ chế Lazy Loading: Chỉ tải sheet nặng (như vlr_psc, doanhthu) khi cần
  async _getOrFetchSheet(primaryKey, aliases = []) {
    await this.ensureData();

    const keys = [primaryKey, ...(aliases || [])].filter(Boolean);

    // 1. Kiểm tra Cache RAM
    for (const k of keys) {
      const d = this._cache && this._cache[k];
      if (Array.isArray(d) && d.length) return d;
    }

    // 2. Fetch riêng sheet đó từ API
    try {
      console.log(`🌐 Fetching lazy sheet: ${primaryKey}...`);
      const res = await this._fetchJson(`${API_URL}?type=${encodeURIComponent(primaryKey)}`, { unwrapData: true });

      let arr = null;
      if (Array.isArray(res)) arr = res;
      else if (res && typeof res === "object") {
        // Support trả về { vlr_psc: [...] } hoặc { data: [...] }
        if (Array.isArray(res[primaryKey])) arr = res[primaryKey];
        else {
          for (const k of keys) {
            if (Array.isArray(res[k])) { arr = res[k]; break; }
          }
        }
      }

      if (Array.isArray(arr)) {
        this._cache[primaryKey] = arr;
        // Cập nhật lại localStorage để lần sau không phải tải lại
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
        return arr;
      }
    } catch (e) {
      console.warn(`Fetch lazy sheet ${primaryKey} failed, trying fallback type=all`, e);
    }

    // 3. Fallback: Tải type=all nếu backend chưa hỗ trợ fetch lẻ
    try {
      const payload = await this._fetchJson(`${API_URL}?type=all`, { unwrapData: true });
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        this._cache = { ...this._cache, ...payload };
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
      }
    } catch (e) {
      console.warn(`Fallback type=all failed`, e);
    }

    // 4. Trả về kết quả sau cùng
    for (const k of keys) {
      const d = this._cache && this._cache[k];
      if (Array.isArray(d)) return d;
    }
    return [];
  },

  // Public Getters cho Main.js sử dụng
  async getUsers() { return this._getData("users"); },
  async getStores() { return this._getData("stores"); },
  async getGDVs() { return this._getData("gdvs"); },
  async getSalesStaff() { return this._getData("sales"); },
  async getB2BStaff() { return this._getData("b2b"); },
  async getIndirectChannels() { return this._getData("indirect"); },
  async getBTS() { return this._getData("bts"); },
  
  async getKPIStructure() { return this._getData("kpi_structure"); },
  async getKPILogs() { return this._getData("kpi_logs"); },
  async getKPIPlanning() { return this._getData("kpi_planning"); },
  async getKPIEmpPlans() { return this._getData("kpi_emp"); },

  // Lazy sheets (cho các tab mở rộng nếu cần dùng lại sau này)
  async getVlrPsc() { return this._getOrFetchSheet("vlr_psc", ["vlrpsc", "vlrPsc"]); },
  async getDoanhThu() { return this._getOrFetchSheet("doanhthu", ["doanh_thu", "DoanhThu"]); },

  // ============================================================
  // 3. SPECIAL DATA HANDLERS (CLUSTERS & KPI)
  // ============================================================

  // Chuyển đổi dữ liệu phẳng (flat) thành cấu trúc cây: Liên Cụm -> Cụm -> Phường Xã
  async getClusters() {
    await this.ensureData();
    const rawData = this._cache.clusters || [];
    if (!rawData.length) return [];

    const clusterMap = new Map();

    rawData.forEach(row => {
      const codeLC = row.maLienCum || row.lienCum || "UNKNOWN_LC";
      const codeCum = row.maCum || row.cum || "UNKNOWN_CUM";

      if (!clusterMap.has(codeLC)) {
        clusterMap.set(codeLC, {
          maLienCum: codeLC,
          tenLienCum: row.tenLienCum || row.lienCum,
          truongLienCum: row.truongLienCum || "",
          sdtLienCum: row.sdtLienCum || "",
          cums: [],
          __cumMap: new Map()
        });
      }
      const cluster = clusterMap.get(codeLC);

      if (!cluster.__cumMap.has(codeCum)) {
        const cum = {
          maCum: codeCum,
          tenCum: row.tenCum || row.cum,
          sdtCum: row.sdtCum || "",
          phuTrach: row.phuTrach || "",
          phuongXas: []
        };
        cluster.__cumMap.set(codeCum, cum);
        cluster.cums.push(cum);
      }
      const cum = cluster.__cumMap.get(codeCum);

      // Xử lý thông tin Lãnh đạo
      let listLanhDao = [];
      if (Array.isArray(row.lanhDao)) {
        listLanhDao = row.lanhDao;
      } else if (typeof row.lanhDao === "string" && row.lanhDao.trim().startsWith("[")) {
        try { listLanhDao = JSON.parse(row.lanhDao); } catch (_) {}
      } else if (row.ld_Ten) {
        listLanhDao = [{
          ten: row.ld_Ten,
          chucVu: row.ld_ChucVu || "Lãnh đạo",
          sdt: row.ld_Sdt || ""
        }];
      }

      // Thông tin Phường/Xã
      if (row.tenPX) {
        const stableId = row.idPX || `${codeLC}_${codeCum}_${String(row.tenPX).trim()}`;
        cum.phuongXas.push({
          id: stableId,
          ten: row.tenPX,
          vlr: Number(row.vlr) || 0,
          danSo: Number(row.danSo) || 0,
          dienTich: (() => { const v = row.dienTich ?? row.dientich ?? row.dien_tich ?? row.area ?? row.dienTichKm2 ?? row.km2; if (v === null || v === undefined || v === '') return 0; const n = parseFloat(String(v).replace(/\s/g,'').replace(',', '.')); return isNaN(n) ? 0 : n; })(),
          tram: Number(row.tram) || 0,
          lanhDao: listLanhDao
        });
      }
    });

    const out = Array.from(clusterMap.values());
    // Xóa map tạm để object sạch sẽ
    out.forEach(lc => delete lc.__cumMap);
    return out;
  },

  // Lấy dữ liệu KPI Thực hiện (Hỗ trợ phân trang & LRU Cache)
  async getKPIActual(monthFrom, monthTo, keyword = "") {
    const { from, to } = this._coerceRange(monthFrom, monthTo);
    const kw = (keyword == null) ? "" : String(keyword).trim();

    const key = `${from}|${to}|${kw}`;
    const now = Date.now();

    // 1. Kiểm tra Memory Cache (LRU - 10 phút)
    if (this._kpiCache.has(key)) {
      const hit = this._kpiCache.get(key);
      if (hit && (now - hit.ts < 10 * 60 * 1000)) {
        // Refresh vị trí key (Most Recently Used)
        this._kpiCache.delete(key);
        this._kpiCache.set(key, { ts: now, data: hit.data });
        return hit.data;
      }
      this._kpiCache.delete(key);
    }

    // 2. Fetch dữ liệu (Phân trang nếu backend hỗ trợ)
    let all = [];
    let offset = 0;
    const limit = 10000;
    let totalExpected = null;

    while (true) {
      const url =
        `${API_URL}?type=kpi_data&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
        `&offset=${offset}&limit=${limit}` +
        (kw ? `&keyword=${encodeURIComponent(kw)}` : "");

      // Gọi API, không unwrap để lấy meta phân trang
      const resp = await this._fetchJson(url, { unwrapData: false });

      // Trường hợp Backend cũ: Trả về mảng trực tiếp -> Lọc client-side
      if (Array.isArray(resp)) {
        const filtered = this._filterKpiArrayLegacy(resp, from, to, kw);
        all = filtered;
        break;
      }

      // Trường hợp Backend mới: { data: [], totalMatched: ... }
      if (resp && resp.error) throw new Error(resp.error);

      const rows = (resp && Array.isArray(resp.data)) ? resp.data : [];
      all = all.concat(rows);

      totalExpected = (resp.totalMatched != null) ? resp.totalMatched : resp.totalInRange;

      offset += rows.length;
      
      // Điều kiện dừng
      if (rows.length === 0) break;
      if (totalExpected != null && offset >= totalExpected) break;
      if (offset > 500000) break; // Safety break
    }

    // 3. Lưu vào Cache LRU (Giữ tối đa 5 query gần nhất)
    this._kpiCache.set(key, { ts: now, data: all });
    while (this._kpiCache.size > 5) {
      const oldestKey = this._kpiCache.keys().next().value;
      this._kpiCache.delete(oldestKey);
    }

    return all;
  },

  // Helper lọc client-side cho backend cũ
  _filterKpiArrayLegacy(arr, from, to, keyword) {
    const kw = (keyword || "").toLowerCase();
    return (arr || []).filter(r => {
      const d = String(r.date || r.ngay || r.thoiGian || "").substring(0, 10);
      if (!d) return false;
      if (d < from || d > to) return false;
      if (!kw) return true;
      const hay = [r.maNV, r.maLienCum, r.maCum, r.maKpi].map(x => String(x || "")).join(" ").toLowerCase();
      return hay.includes(kw);
    });
  },

  // Helper chuẩn hóa range ngày tháng
  _coerceRange(a, b) {
    const isMonth = (s) => typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
    const isDay   = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

    let from, to;

    if (isDay(a) && isDay(b)) { from = a; to = b; }
    else if (isMonth(a) && isMonth(b)) { from = `${a}-01`; to = this._lastDayOfMonth(b); }
    else if (isMonth(a) && isDay(b)) { from = `${a}-01`; to = b; }
    else if (isDay(a) && isMonth(b)) { from = a; to = this._lastDayOfMonth(b); }
    else {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      from = `${ym}-01`; to = this._lastDayOfMonth(ym);
    }
    return { from, to };
  },

  _lastDayOfMonth(ym) {
    const [y, m] = ym.split("-").map(n => parseInt(n, 10));
    const d = new Date(y, m, 0);
    const mm = String(m).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  },

  // Xóa cache và tải lại toàn bộ
  async refreshAllData() {
    console.log("🔄 Refresh ALL (core + clear kpi cache)");
    this._cache = null;
    this._lastMeta = null;
    this._kpiCache.clear();
    localStorage.removeItem("MIS_LOCAL_DATA");
    localStorage.removeItem("MIS_LAST_FETCH");
    await this.ensureData(true);
  }
};

// Expose ra global window để main.js có thể gọi được
window.DataService = DataService;
