/* =========================================
 * data-service.js — OPTIMIZED VERSION
 * Tương thích hoàn hảo với Backend Indexing V10
 * ========================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbx1lnwJs5fBqRb54WzX37KZLplkdGf6rbLXc11vUGoQeF4YWpvTQLQFnriyNC77pM4Fug/exec";

const DataService = {
  _cache: null,          // Core data (Clusters, Staff, Stores...)
  _loadingPromise: null, // Promise khóa tải trùng
  _kpiCache: new Map(),  // LRU cache cho KPI (Range + Keyword)
  _lastMeta: null,

  // ============================================================
  // 1. CORE LOADER (QUẢN LÝ DỮ LIỆU NỀN)
  // ============================================================
  
  async ensureData(forceReload = false) {
    if (!forceReload && this._cache) return;
    if (!forceReload && this._loadingPromise) return this._loadingPromise;

    // 1. Thử đọc LocalStorage
    if (!forceReload) {
      try {
        const local = localStorage.getItem("MIS_LOCAL_DATA");
        const lastFetch = parseInt(localStorage.getItem("MIS_LAST_FETCH") || "0", 10);
        // Cache 15 phút
        if (local && (Date.now() - lastFetch < 15 * 60 * 1000)) {
          const parsed = JSON.parse(local);
          if (parsed && Object.keys(parsed).length > 0) {
            this._cache = parsed;
            this._lastMeta = parsed.__meta || null;
            console.log("⚡ [Data] Loaded from LocalStorage");
            return;
          }
        }
      } catch (e) { console.warn("Lỗi đọc LocalStorage:", e); }
    }

    // 2. Fetch mới từ API
    this._loadingPromise = this._fetchCore(forceReload).finally(() => { this._loadingPromise = null; });
    return this._loadingPromise;
  },

  async _fetchCore(forceReload) {
    try {
      console.log("🌐 [Data] Fetching Core...");
      // Ưu tiên gọi type=core, fallback type=all
      let data = await this._fetchJson(`${API_URL}?type=core`);

      if (data?.error) {
        console.warn("⚠️ Backend chưa hỗ trợ type=core, fallback type=all");
        data = await this._fetchJson(`${API_URL}?type=all`);
      }

      if (data?.error) throw new Error(data.error);

      this._cache = data || {};
      this._lastMeta = data?.__meta || null;

      try {
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
        localStorage.setItem("MIS_LAST_FETCH", String(Date.now()));
      } catch (e) { console.warn("Quota LocalStorage exceeded"); }

    } catch (err) {
      console.error("❌ [Data] Load Core Failed:", err);
      // Fallback: Dùng cache cũ nếu mạng lỗi
      const local = localStorage.getItem("MIS_LOCAL_DATA");
      if (local) {
        console.warn("⚠️ Offline Mode: Dùng dữ liệu cũ.");
        this._cache = JSON.parse(local);
      } else {
        throw err;
      }
    }
  },

  // ============================================================
  // 2. HELPER FETCHING
  // ============================================================

  async _fetchJson(url, options = {}) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    let json;
    try { json = await res.json(); } 
    catch (e) { throw new Error("Response không phải JSON"); }

    // Tự động unwrap data nếu cấu trúc { status: 'success', data: [...] }
    // Trừ khi gọi options.raw = true (dùng cho KPI phân trang)
    if (!options.raw && json && !Array.isArray(json) && "data" in json) {
      return json.data;
    }
    return json;
  },

  // ============================================================
  // 3. GETTERS (CORE DATA)
  // ============================================================

  async _getData(key) {
    await this.ensureData();
    return this._cache?.[key] || [];
  },

  // Getter shortcuts
  getUsers() { return this._getData("users"); },
  getStores() { return this._getData("stores"); },
  getGDVs() { return this._getData("gdvs"); },
  getSalesStaff() { return this._getData("sales"); },
  getB2BStaff() { return this._getData("b2b"); },
  getIndirectChannels() { return this._getData("indirect"); },
  getBTS() { return this._getData("bts"); },
  getKPIStructure() { return this._getData("kpi_structure"); },
  getKPILogs() { return this._getData("kpi_logs"); },
  getKPIPlanning() { return this._getData("kpi_planning"); },
  getKPIEmpPlans() { return this._getData("kpi_emp"); },

  // Lazy Load Sheets (Chỉ tải khi cần)
  async _getLazy(key, aliases = []) {
    await this.ensureData();
    // 1. Check RAM
    if (this._cache?.[key]?.length) return this._cache[key];
    
    // 2. Fetch lẻ
    try {
      console.log(`🌐 Lazy fetching: ${key}`);
      const res = await this._fetchJson(`${API_URL}?type=${key}`);
      const data = Array.isArray(res) ? res : (res?.[key] || []);
      
      if (data.length) {
        this._cache[key] = data;
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
        return data;
      }
    } catch (e) { console.warn(`Lazy fetch ${key} failed`, e); }
    return [];
  },

  getVlrPsc() { return this._getLazy("vlr_psc"); },
  getDoanhThu() { return this._getLazy("doanhthu", ["doanh_thu"]); },

  // ============================================================
  // 4. LOGIC NGHIỆP VỤ PHỨC TẠP
  // ============================================================

  // --- Xử lý KPI (Optimization Heart) ---
  async getKPIActual(monthFrom, monthTo, keyword = "") {
    const { from, to } = this._coerceRange(monthFrom, monthTo);
    const kw = keyword?.trim() || "";
    const cacheKey = `${from}|${to}|${kw}`;
    
    // 1. Check LRU Cache (10 phút)
    const cached = this._kpiCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts < 600000)) {
      // Refresh LRU order
      this._kpiCache.delete(cacheKey);
      this._kpiCache.set(cacheKey, cached);
      return cached.data;
    }

    // 2. Fetch Loop (Server-side Pagination)
    let allData = [];
    let offset = 0;
    const BATCH_SIZE = 2000; // Khớp với Backend limit để tối ưu

    while (true) {
      const qs = new URLSearchParams({
        type: 'kpi_data',
        from: from,
        to: to,
        offset: offset,
        limit: BATCH_SIZE,
        keyword: kw
      });

      // raw=true để lấy cả metadata (totalMatched, error...)
      const resp = await this._fetchJson(`${API_URL}?${qs}`, { raw: true });

      // Support Backend Cũ (Trả về mảng trực tiếp)
      if (Array.isArray(resp)) {
        allData = this._filterLegacy(resp, from, to, kw);
        break;
      }

      if (resp?.error) throw new Error(resp.error);

      const rows = resp?.data || [];
      allData = allData.concat(rows);

      // Kiểm tra điều kiện dừng
      const total = resp?.totalMatched ?? resp?.totalInRange ?? 0;
      offset += rows.length;

      // Dừng nếu: Hết data HOẶC Đã lấy đủ số lượng backend báo HOẶC quá limit an toàn
      if (rows.length === 0 || offset >= total || offset > 500000) break;
    }

    // 3. Save Cache
    this._kpiCache.set(cacheKey, { ts: Date.now(), data: allData });
    // Giữ cache size nhỏ (max 5 query)
    if (this._kpiCache.size > 5) this._kpiCache.delete(this._kpiCache.keys().next().value);

    return allData;
  },

  // --- Xử lý Clusters (Tree Structure) ---
  async getClusters() {
    await this.ensureData();
    const raw = this._cache?.clusters || [];
    if (!raw.length) return [];

    const map = new Map();

    for (const r of raw) {
      const lcCode = r.maLienCum || r.lienCum || "UNK";
      const cumCode = r.maCum || r.cum || "UNK";

      // Tạo Liên Cụm
      if (!map.has(lcCode)) {
        map.set(lcCode, {
          maLienCum: lcCode,
          tenLienCum: r.tenLienCum || r.lienCum,
          truongLienCum: r.truongLienCum || "",
          sdtLienCum: r.sdtLienCum || "",
          cums: [],
          _cumMap: new Map()
        });
      }
      const lc = map.get(lcCode);

      // Tạo Cụm
      if (!lc._cumMap.has(cumCode)) {
        const cumObj = {
          maCum: cumCode,
          tenCum: r.tenCum || r.cum,
          sdtCum: r.sdtCum || "",
          phuTrach: r.phuTrach || "",
          phuongXas: []
        };
        lc._cumMap.set(cumCode, cumObj);
        lc.cums.push(cumObj);
      }
      const cum = lc._cumMap.get(cumCode);

      // Thêm Phường Xã
      if (r.tenPX) {
        // Parse Lãnh đạo an toàn
        let lanhDao = [];
        try {
            if (Array.isArray(r.lanhDao)) lanhDao = r.lanhDao;
            else if (r.lanhDao?.startsWith("[")) lanhDao = JSON.parse(r.lanhDao);
            else if (r.ld_Ten) lanhDao = [{ ten: r.ld_Ten, chucVu: r.ld_ChucVu || "Lãnh đạo", sdt: r.ld_Sdt }];
        } catch(e) {}

        // Parse Diện tích (Thử nhiều key)
        const areaKeys = ['dienTich', 'dientich', 'dien_tich', 'dien tich', 'area', 'km2'];
        const rawArea = areaKeys.reduce((found, k) => found ?? r[k], null);
        const areaVal = rawArea ? parseFloat(String(rawArea).replace(',', '.')) : 0;

        cum.phuongXas.push({
          id: r.idPX || `${lcCode}_${cumCode}_${r.tenPX}`,
          ten: r.tenPX,
          vlr: Number(r.vlr) || 0,
          danSo: Number(r.danSo) || 0,
          dienTich: isNaN(areaVal) ? 0 : areaVal,
          tram: Number(r.tram) || 0,
          lanhDao: lanhDao
        });
      }
    }

    return Array.from(map.values()).map(lc => {
        delete lc._cumMap; // Cleanup
        return lc;
    });
  },

  // ============================================================
  // 5. UTILS
  // ============================================================

  _filterLegacy(arr, from, to, kw) {
    const k = kw.toLowerCase();
    return (arr || []).filter(r => {
      const d = String(r.date||r.ngay||"").substring(0, 10);
      if (d < from || d > to) return false;
      if (!k) return true;
      return [r.maNV, r.maCum, r.maKpi].some(v => String(v).toLowerCase().includes(k));
    });
  },

  _coerceRange(a, b) {
    const lastDay = (ym) => {
        const [y, m] = ym.split("-");
        return `${y}-${m}-${new Date(y, m, 0).getDate()}`;
    };
    
    // Auto detect format: YYYY-MM or YYYY-MM-DD
    const isM = s => /^\d{4}-\d{2}$/.test(s);
    
    let from = a, to = b;
    if (isM(a)) from = `${a}-01`;
    if (isM(b)) to = lastDay(b);
    
    // Default current month if missing
    if (!from || !to) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        from = `${ym}-01`; 
        to = lastDay(ym);
    }
    return { from, to };
  },

  async refreshAllData() {
    console.log("🔄 Reset Data");
    this._cache = null;
    this._kpiCache.clear();
    localStorage.removeItem("MIS_LOCAL_DATA");
    localStorage.removeItem("MIS_LAST_FETCH");
    await this.ensureData(true);
  }
};

window.DataService = DataService;
