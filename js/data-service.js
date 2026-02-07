/* ==========================================================================
 * data-service.js — SECURE & OPTIMIZED VERSION (V1323)
 * Update: Tích hợp xác thực Token & Đăng nhập bảo mật
 * ========================================================================== */


const API_URL = "https://script.google.com/macros/s/AKfycbx2uS6t-bgOGEJ64h-Hg3xx8ncurJbuHAKp5os3rWFQ1YZTamSR_OZiCjsTLZUQJ2snEg/exec";

const DataService = {
  _cache: null,          // Core data
  _loadingPromise: null, // Promise khóa tải trùng
  _kpiCache: new Map(),  // LRU cache
  _lastMeta: null,
  
  // --- BẢO MẬT: Token lưu trữ ---
  _token: localStorage.getItem("MIS_TOKEN") || null,

  // ============================================================
  // 1. AUTHENTICATION (ĐĂNG NHẬP & ĐĂNG XUẤT)
  // ============================================================

  async login(username, password) {
    try {
      console.log("🔐 Đang đăng nhập...");
      
      // Gửi request POST (Bảo mật hơn GET)
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'login', 
          username: username, 
          password: password 
        })
      });

      const json = await res.json();

      if (json.error) throw new Error(json.error);

      // Đăng nhập thành công
      this._token = json.token;
      
      // Lưu vào LocalStorage để F5 không bị mất
      localStorage.setItem("MIS_TOKEN", this._token);
      localStorage.setItem("MIS_USER", JSON.stringify(json.user));

      return json.user;

    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      throw err;
    }
  },

  logout() {
    console.log("👋 Đang đăng xuất...");
    this._token = null;
    this._cache = null;
    
    // Xóa sạch dấu vết trong LocalStorage
    localStorage.removeItem("MIS_TOKEN");
    localStorage.removeItem("MIS_USER");
    localStorage.removeItem("MIS_LOCAL_DATA"); // Xóa cache dữ liệu cũ
    localStorage.removeItem("MIS_LAST_FETCH");
    
    // Chuyển về trang login
    window.location.href = 'login.html';
  },

  // ============================================================
  // 2. FETCHING ENGINE (CỐT LÕI BẢO MẬT)
  // ============================================================

  async _fetchJson(url, options = {}) {
    // 1. Kiểm tra Token trước khi gọi
    if (!this._token) {
      console.warn("⛔ Chưa có Token, chuyển hướng đăng nhập.");
      window.location.href = 'login.html';
      // Trả về promise treo để code phía sau không chạy tiếp gây lỗi
      return new Promise(() => {}); 
    }

    // 2. Đính kèm Token vào URL
    const separator = url.includes('?') ? '&' : '?';
    const authUrl = `${url}${separator}token=${this._token}`;

    const res = await fetch(authUrl);
    
    // Xử lý lỗi HTTP cơ bản
    if (!res.ok) {
        // Nếu lỗi 401 (Unauthorized) từ server -> Token chết -> Logout
        if (res.status === 401) {
            this.logout();
            throw new Error("Phiên đăng nhập hết hạn");
        }
        throw new Error(`HTTP ${res.status}`);
    }
    
    let json;
    try { json = await res.json(); } 
    catch (e) { throw new Error("Response không phải JSON"); }

    // Xử lý lỗi Logic từ Backend (Backend trả về json có key 'error')
    if (json.error) {
        // Nếu Backend báo lỗi liên quan xác thực
        if (String(json.error).includes("Unauthorized") || json.code === 401) {
            alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
            this.logout();
            return;
        }
        throw new Error(json.error);
    }

    // Tự động unwrap data (nếu backend trả về dạng { status: 'success', data: [...] })
    if (!options.raw && json && !Array.isArray(json) && "data" in json) {
      return json.data;
    }
    return json;
  },

  // ============================================================
  // 3. CORE LOADER (QUẢN LÝ DỮ LIỆU NỀN)
  // ============================================================
  
  async ensureData(forceReload = false) {
    if (!forceReload && this._cache) return;
    if (!forceReload && this._loadingPromise) return this._loadingPromise;

    // 1. Thử đọc LocalStorage (Cache dữ liệu)
    if (!forceReload) {
      try {
        const local = localStorage.getItem("MIS_LOCAL_DATA");
        const lastFetch = parseInt(localStorage.getItem("MIS_LAST_FETCH") || "0", 10);
        
        // Cache dữ liệu tĩnh 15 phút
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

    // 2. Fetch mới từ API (Sẽ tự động đi qua _fetchJson có kèm Token)
    this._loadingPromise = this._fetchCore(forceReload).finally(() => { this._loadingPromise = null; });
    return this._loadingPromise;
  },

  async _fetchCore(forceReload) {
    try {
      console.log("🌐 [Data] Fetching Core...");
      let data = await this._fetchJson(`${API_URL}?type=core`);

      if (data?.error) {
        data = await this._fetchJson(`${API_URL}?type=all`);
      }

      this._cache = data || {};
      this._lastMeta = data?.__meta || null;

      try {
        localStorage.setItem("MIS_LOCAL_DATA", JSON.stringify(this._cache));
        localStorage.setItem("MIS_LAST_FETCH", String(Date.now()));
      } catch (e) { console.warn("Quota LocalStorage exceeded"); }

    } catch (err) {
      console.error("❌ [Data] Load Core Failed:", err);
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
  // 4. GETTERS (CORE DATA)
  // ============================================================

  async _getData(key) {
    await this.ensureData();
    return this._cache?.[key] || [];
  },

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

  // Lazy Load Sheets
  async _getLazy(key, aliases = []) {
    await this.ensureData();
    if (this._cache?.[key]?.length) return this._cache[key];
    
    try {
      console.log(`🌐 Lazy fetching: ${key}`);
      // _fetchJson sẽ tự thêm Token
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
  // 5. LOGIC NGHIỆP VỤ PHỨC TẠP (KPI, CLUSTERS)
  // ============================================================

  async getKPIActual(monthFrom, monthTo, keyword = "") {
    const { from, to } = this._coerceRange(monthFrom, monthTo);
    const kw = keyword?.trim() || "";
    const cacheKey = `${from}|${to}|${kw}`;
    
    const cached = this._kpiCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts < 600000)) {
      this._kpiCache.delete(cacheKey);
      this._kpiCache.set(cacheKey, cached);
      return cached.data;
    }

    let allData = [];
    let offset = 0;
    const BATCH_SIZE = 2000;

    while (true) {
      const qs = new URLSearchParams({
        type: 'kpi_data',
        from: from,
        to: to,
        offset: offset,
        limit: BATCH_SIZE,
        keyword: kw
      });

      // _fetchJson tự thêm Token
      const resp = await this._fetchJson(`${API_URL}?${qs}`, { raw: true });

      if (Array.isArray(resp)) {
        allData = this._filterLegacy(resp, from, to, kw);
        break;
      }

      const rows = resp?.data || [];
      allData = allData.concat(rows);

      const total = resp?.totalMatched ?? resp?.totalInRange ?? 0;
      offset += rows.length;

      if (rows.length === 0 || offset >= total || offset > 500000) break;
    }

    this._kpiCache.set(cacheKey, { ts: Date.now(), data: allData });
    if (this._kpiCache.size > 5) this._kpiCache.delete(this._kpiCache.keys().next().value);

    return allData;
  },

  // ============================================================
  // [NEW] HÀM HỖ TRỢ PHÂN TRANG CHO BUSINESS DATA (Client-side)
  // ============================================================
  async getKPIActualPaginated(from, to, offset, limit) {
    try {
      // 1. Tận dụng hàm getKPIActual có sẵn để lấy toàn bộ dữ liệu (đã cache)
      // Truyền keyword rỗng '' để lấy hết
      const allRows = await this.getKPIActual(from, to, '');

      // 2. Tính toán tổng số dòng
      const total = allRows.length;

      // 3. Cắt dữ liệu (Slice) theo trang
      // Nếu offset quá lớn thì trả về mảng rỗng
      if (offset >= total) {
        return { data: [], total: total };
      }

      const pagedRows = allRows.slice(offset, offset + limit);

      // 4. Trả về cấu trúc chuẩn: { data, total }
      return {
        data: pagedRows,
        total: total
      };
    } catch (error) {
      console.error("Lỗi phân trang data:", error);
      return { data: [], total: 0 };
    }
  },

  
  /* ============================================================
 * [DATA-SERVICE] getClusters (Phiên bản Clean Key Tuyệt đối)
 * ============================================================ */
  async getClusters() {
      await this.ensureData();
      const raw = this._cache?.clusters || [];
      if (!raw.length) return [];

      const map = new Map();

      // Helper: Loại bỏ mọi khoảng trắng và viết hoa (VD: "LC - DHO " -> "LC-DHO")
      const cleanKey = (k) => String(k || 'KHAC').toUpperCase().replace(/\s+/g, '');

      for (const r of raw) {
          // Ưu tiên lấy maLienCum/maCum chuẩn, nếu không có thì fallback
          const lcRaw = r.maLienCum || r.lienCum || "KHAC";
          const cumRaw = r.maCum || r.cum || "KHAC";
          
          const lcCode = cleanKey(lcRaw);
          const cumCode = cleanKey(cumRaw);

          if (!map.has(lcCode)) {
              map.set(lcCode, {
                  maLienCum: lcCode,
                  tenLienCum: (r.tenLienCum || r.lienCum || lcCode).trim(),
                  truongLienCum: (r.truongLienCum || "").trim(),
                  sdtLienCum: (r.sdtLienCum || "").trim(),
                  cums: [],
                  _cumMap: new Map()
              });
          }
          const lc = map.get(lcCode);

          if (!lc._cumMap.has(cumCode)) {
              const cumObj = {
                  maCum: cumCode,
                  tenCum: (r.tenCum || r.cum || cumCode).trim(),
                  sdtCum: (r.sdtCum || "").trim(),
                  phuTrach: (r.phuTrach || "").trim(),
                  phuongXas: []
              };
              lc._cumMap.set(cumCode, cumObj);
              lc.cums.push(cumObj);
          }
          const cum = lc._cumMap.get(cumCode);

          if (r.tenPX) {
              let lanhDao = [];
              try {
                  if (Array.isArray(r.lanhDao)) lanhDao = r.lanhDao;
                  else if (typeof r.lanhDao === 'string' && r.lanhDao.startsWith("[")) lanhDao = JSON.parse(r.lanhDao);
                  else if (r.ld_Ten) lanhDao = [{ ten: r.ld_Ten, chucVu: r.ld_ChucVu || "Lãnh đạo", sdt: r.ld_Sdt }];
              } catch(e) { console.warn("Lỗi parse lanhDao:", e); }

              // Xử lý diện tích (chuyển dấu phẩy thành chấm)
              const area = Number(String(r.dienTich || 0).replace(',', '.')) || 0;

              cum.phuongXas.push({
                  id: r.idPX || `${lcCode}_${cumCode}_${r.tenPX}`,
                  ten: String(r.tenPX).trim(),
                  vlr: Number(r.vlr) || 0,
                  danSo: Number(r.danSo) || 0,
                  dienTich: area,
                  tram: Number(r.tram) || 0,
                  lanhDao: lanhDao
              });
          }
      }

      return Array.from(map.values()).map(lc => {
          delete lc._cumMap; 
          return lc;
      });
  },

  // ============================================================
  // 6. UTILS
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
    const isM = s => /^\d{4}-\d{2}$/.test(s);
    let from = a, to = b;
    if (isM(a)) from = `${a}-01`;
    if (isM(b)) to = lastDay(b);
    if (!from || !to) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        from = `${ym}-01`; 
        to = lastDay(ym);
    }
    return { from, to };
  },

  async refreshAllData() {
    this.logout(); // Refresh data đồng nghĩa với logout để lấy token mới
  }
};

window.DataService = DataService;
