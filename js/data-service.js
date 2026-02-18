/* ==========================================================================
 * data-service.js — SECURE & OPTIMIZED VERSION (Final)
 * Update: Tích hợp xác thực Token, Caching thông minh & Xử lý lỗi
 * ========================================================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbzNNN5bdZINb3UzQTAh3QirGMBG_5wuCftteyUs4eqAWnAAU0pKYDsSoJQrojJASHCZ/exec";

const DataService = {
    _cache: null,          // Core data (Users, Stores, BTS...)
    _loadingPromise: null, // Promise để tránh gọi API nhiều lần cùng lúc
    _kpiCache: new Map(),  // Cache riêng cho dữ liệu KPI (nặng)
    _lastMeta: null,
    
    // --- BẢO MẬT: Lấy Token từ LocalStorage ---
    _token: localStorage.getItem("MIS_TOKEN") || null,

    // ============================================================
    // 1. AUTHENTICATION (ĐĂNG NHẬP & ĐĂNG XUẤT)
    // ============================================================

    async login(username, password) {
        try {
            console.log("🔐 Đang đăng nhập...");
            
            // Gửi request POST
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
            
            // Lưu session
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
        
        // Xóa sạch dấu vết
        localStorage.removeItem("MIS_TOKEN");
        localStorage.removeItem("MIS_USER");
        localStorage.removeItem("MIS_LOCAL_DATA");
        localStorage.removeItem("MIS_LAST_FETCH");
        
        // Chuyển về trang login
        window.location.href = 'login.html';
    },

    // ============================================================
    // 2. FETCHING ENGINE (CORE)
    // ============================================================

    async _fetchJson(url, options = {}) {
        // 1. Kiểm tra Token
        if (!this._token) {
            console.warn("⛔ Chưa có Token, chuyển hướng login.");
            window.location.href = 'login.html';
            return new Promise(() => {}); // Treo promise để chặn code chạy tiếp
        }

        // 2. Đính kèm Token vào URL
        const separator = url.includes('?') ? '&' : '?';
        const authUrl = `${url}${separator}token=${this._token}`;

        const res = await fetch(authUrl);
        
        // 3. Xử lý lỗi HTTP
        if (!res.ok) {
            if (res.status === 401) {
                this.logout();
                throw new Error("Phiên đăng nhập hết hạn");
            }
            throw new Error(`HTTP ${res.status}`);
        }
        
        let json;
        try { json = await res.json(); } 
        catch (e) { throw new Error("Response không phải JSON"); }

        // 4. Xử lý lỗi Logic từ Backend
        if (json.error) {
            if (String(json.error).includes("Unauthorized") || json.code === 401) {
                alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
                this.logout();
                return;
            }
            throw new Error(json.error);
        }

        // Unwrap data nếu backend trả về dạng { status: 'success', data: [...] }
        if (!options.raw && json && !Array.isArray(json) && "data" in json) {
            return json.data;
        }
        return json;
    },

    // ============================================================
    // 3. DATA LOADER & CACHING
    // ============================================================
    
    async ensureData(forceReload = false) {
        if (!forceReload && this._cache) return;
        if (!forceReload && this._loadingPromise) return this._loadingPromise;

        // Thử đọc LocalStorage trước (Cache 15 phút)
        if (!forceReload) {
            try {
                const local = localStorage.getItem("MIS_LOCAL_DATA");
                const lastFetch = parseInt(localStorage.getItem("MIS_LAST_FETCH") || "0", 10);
                
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

        // Fetch mới từ API
        this._loadingPromise = this._fetchCore(forceReload).finally(() => { this._loadingPromise = null; });
        return this._loadingPromise;
    },

    async _fetchCore(forceReload) {
        try {
            console.log("🌐 [Data] Fetching Core...");
            // Thử lấy gói Core (nhẹ) trước, nếu lỗi thì lấy gói All
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
            // Fallback: Dùng dữ liệu cũ nếu mạng lỗi
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
    // 4. GETTERS (Truy xuất dữ liệu)
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

    // Lazy Load (Tải khi cần)
    async _getLazy(key) {
        await this.ensureData();
        if (this._cache?.[key]?.length) return this._cache[key];
        
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
    getDoanhThu() { return this._getLazy("doanhthu"); },

    // ============================================================
    // 5. LOGIC NGHIỆP VỤ (KPI & CLUSTERS)
    // ============================================================

    async getKPIActual(monthFrom, monthTo, keyword = "") {
        const { from, to } = this._coerceRange(monthFrom, monthTo);
        const kw = keyword?.trim() || "";
        const cacheKey = `${from}|${to}|${kw}`;
        
        // Cache API KPI trong 10 phút
        const cached = this._kpiCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts < 600000)) {
            return cached.data;
        }

        let allData = [];
        let offset = 0;
        const BATCH_SIZE = 2000;

        // Loop tải phân trang từ server
        while (true) {
            const qs = new URLSearchParams({
                type: 'kpi_data',
                from: from,
                to: to,
                offset: offset,
                limit: BATCH_SIZE,
                keyword: kw
            });

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
        return allData;
    },

    async getKPIActualPaginated(from, to, offset, limit) {
        // Client-side pagination (Tải hết về rồi cắt trang)
        try {
            const allRows = await this.getKPIActual(from, to, '');
            const total = allRows.length;
            if (offset >= total) return { data: [], total: total };
            
            return {
                data: allRows.slice(offset, offset + limit),
                total: total
            };
        } catch (error) {
            console.error("Lỗi phân trang data:", error);
            return { data: [], total: 0 };
        }
    },

    // Xử lý dữ liệu Cụm/Liên Cụm phức tạp
    async getClusters() {
        await this.ensureData();
        const raw = this._cache?.clusters || [];
        if (!raw.length) return [];

        const map = new Map();
        const cleanKey = (k) => String(k || 'KHAC').toUpperCase().replace(/\s+/g, '');

        for (const r of raw) {
            const lcCode = cleanKey(r.maLienCum || r.lienCum || "KHAC");
            const cumCode = cleanKey(r.maCum || r.cum || "KHAC");

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
        // 6. GHI DỮ LIỆU (WRITE)
    // ============================================================

    // [NEW] Hàm cập nhật cửa hàng
    async updateStore(data) {
        // Gọi hàm postData chung
        return this.postData({
            action: 'update_store', // Đảm bảo trong doPost (GAS) bạn đã có case 'update_store' gọi đến handleUpdateStore_
            data: data
        });
    },

    // Cập nhật điểm bán (Kênh gián tiếp)
    async updateIndirect(data) {
        return this.postData({
            action: 'update_indirect',
            data: data
        });
    },

    // Hàm POST chung cho mọi thao tác ghi
    async postData(payload) {
        if (!this._token) {
            console.error("⛔ Chưa đăng nhập");
            return { error: "Vui lòng đăng nhập lại." };
        }

        // Tự động đính kèm token
        payload.token = this._token;

        console.log("📤 Sending POST:", payload);

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            
            // Nếu ghi thành công, xóa cache để lần sau tải lại dữ liệu mới
            if (json.status === 'success' || json.result === 'success') {
                if (payload.action === 'update_indirect' && this._cache) {
                    console.log("♻️ Clearing indirect cache...");
                    delete this._cache.indirect; 
                    localStorage.removeItem("MIS_LOCAL_DATA");
                }
            }
            
            return json;
        } catch (e) {
            console.error("❌ Post Data Error:", e);
            return { error: e.message };
        }
    },

    // ============================================================
    // 7. UTILS (HÀM HỖ TRỢ)
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
        this.logout(); 
    }
};

// Export ra window để main.js gọi được
window.DataService = DataService;
