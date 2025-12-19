

const API_URL = "https://script.google.com/macros/s/AKfycbwctFpLYXbvgeNotRuq8Rb0BebFoGRBrFZP4rsDEJqEE_2mz0pkx8w9owtaIDNPMw65/exec"; 

const DataService = {
    _cache: null, // Biến lưu trữ dữ liệu tạm thời (RAM)

    // --- CORE: HÀM TẢI DỮ LIỆU THÔNG MINH ---
    // Hàm này sẽ kiểm tra: Có Cache RAM chưa? -> Có LocalStorage chưa? -> Mới gọi Server
    async ensureData() {
        // 1. Nếu đã có trong RAM (do vừa tải xong) -> Dùng ngay
        if (this._cache) return;

        // 2. Kiểm tra LocalStorage (Dữ liệu cũ trong máy người dùng)
        try {
            const localData = localStorage.getItem('MIS_LOCAL_DATA');
            const lastFetch = localStorage.getItem('MIS_LAST_FETCH');
            const now = new Date().getTime();
            const CACHE_TIME = 10 * 60 * 1000; // Cache 10 phút

            // Nếu có dữ liệu cũ và chưa quá hạn -> Dùng tạm để hiển thị ngay
            if (localData && lastFetch && (now - lastFetch < CACHE_TIME)) {
                console.log("⚡ Dùng dữ liệu Offline (LocalStorage)");
                this._cache = JSON.parse(localData);
                return;
            }
        } catch (e) {
            console.log("Lỗi đọc LocalStorage", e);
        }

        // 3. Nếu không có gì hoặc đã cũ -> Gọi Server tải mới
        await this.fetchAndSave();
    },

    // Gọi lên Google Sheet lấy toàn bộ dữ liệu (Type=all)
    async fetchAndSave() {
        if (!API_URL || API_URL.includes("...")) {
            console.error("❌ LỖI: CHƯA CẤU HÌNH API URL!");
            return;
        }

        try {
            console.log("🌐 Đang tải mới từ Google Sheet...");
            const response = await fetch(`${API_URL}?type=all`);
            const data = await response.json();
            
            if (data.error) {
                console.error("Lỗi Server:", data.error);
                return;
            }

            // Lưu vào RAM
            this._cache = data;
            
            // Lưu xuống máy người dùng
            localStorage.setItem('MIS_LOCAL_DATA', JSON.stringify(data));
            localStorage.setItem('MIS_LAST_FETCH', new Date().getTime());
            console.log("✅ Đã tải và lưu dữ liệu thành công!");

        } catch (error) {
            console.error("❌ Lỗi kết nối mạng:", error);
            // Nếu lỗi mạng, cố gắng khôi phục dữ liệu cũ nếu có
            const local = localStorage.getItem('MIS_LOCAL_DATA');
            if (local) this._cache = JSON.parse(local);
            else this._cache = {}; // Tránh crash app
        }
    },

    // --- 1. QUẢN LÝ HẠ TẦNG (LOGIC MỚI: GOM NHÓM THEO MÃ ID) ---
    async getClusters() {
        await this.ensureData(); 
        const rawData = this._cache.clusters || [];
        if (rawData.length === 0) return [];

        const result = [];

        rawData.forEach(row => {
            // A. Xử lý Liên Cụm (Ưu tiên dùng maLienCum làm khóa chính)
            // Nếu cột maLienCum trống, fallback về dùng cột tenLienCum (để tránh lỗi)
            const codeLC = row.maLienCum || row.lienCum; 
            
            let cluster = result.find(c => c.maLienCum === codeLC);
            if (!cluster) {
                cluster = {
                    maLienCum: codeLC,                 // KEY: Dùng để code logic
                    tenLienCum: row.tenLienCum || row.lienCum, // DISPLAY: Dùng để hiển thị
                    truongLienCum: row.truongLienCum || "",
                    sdtLienCum: row.sdtLienCum || "",
                    cums: []
                };
                result.push(cluster);
            }

            // B. Xử lý Cụm (Ưu tiên dùng maCum làm khóa chính)
            const codeCum = row.maCum || row.cum;

            let cum = cluster.cums.find(c => c.maCum === codeCum);
            if (!cum) {
                cum = {
                    maCum: codeCum,              // KEY
                    tenCum: row.tenCum || row.cum, // DISPLAY
                    sdtCum: row.sdtCum || "",
                    phuTrach: row.phuTrach || "",
                    phuongXas: []
                };
                cluster.cums.push(cum);
            }

            // C. Xử lý Lãnh đạo (Hỗ trợ cả 2 kiểu dữ liệu: JSON gộp hoặc Cột rời)
            let listLanhDao = [];
            if (Array.isArray(row.lanhDao)) {
                listLanhDao = row.lanhDao; // Nếu Apps Script đã xử lý sẵn
            } 
            else if (row.ld_Ten) {
                // Nếu dùng 3 cột rời: ld_Ten, ld_ChucVu, ld_Sdt
                listLanhDao.push({
                    ten: row.ld_Ten,
                    chucVu: row.ld_ChucVu || "Lãnh đạo",
                    sdt: row.ld_Sdt || ""
                });
            }

            // D. Đẩy Xã vào Cụm
            cum.phuongXas.push({
                id: row.idPX || Math.random().toString(36).substr(2, 5),
                ten: row.tenPX,
                vlr: Number(row.vlr) || 0,
                danSo: Number(row.danSo) || 0,
                tram: Number(row.tram) || 0,
                lanhDao: listLanhDao
            });
        });

        return result;
    },

    // --- 2. CÁC HÀM GET DỮ LIỆU CƠ BẢN ---
    async getStores() { await this.ensureData(); return this._cache.stores || []; },
    async getGDVs() { await this.ensureData(); return this._cache.gdvs || []; },
    async getSalesStaff() { await this.ensureData(); return this._cache.sales || []; },
    async getB2BStaff() { await this.ensureData(); return this._cache.b2b || []; },
    async getIndirectChannels() { await this.ensureData(); return this._cache.indirect || []; },
    async getBTS() { await this.ensureData(); return this._cache.bts || []; },
    async getKPIStructure() { await this.ensureData(); return this._cache.kpi_structure || []; },
    async getKPILogs() { await this.ensureData(); return this._cache.kpi_logs || []; },
    async getKPIActual(monthFrom, monthTo, keyword) { await this.ensureData(); return this._cache.kpi_data || []; },
    async getKPIPlanning() { await this.ensureData(); return this._cache.kpi_planning || []; },
    async getKPIEmpPlans() { 
        await this.ensureData(); 
        return this._cache.kpi_emp || []; 
    },
    async getUsers() { await this.ensureData(); return this._cache.users || []; },
    
    async getKPIUserLogs() { 
        await this.ensureData(); 
        return this._cache.kpi_logs || []; 
    }
};
