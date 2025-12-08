// --- CẤU HÌNH KẾT NỐI ---
// ⚠️ QUAN TRỌNG: Thay Link App Script (đuôi /exec) của bạn vào bên dưới:
const API_URL = "https://script.google.com/macros/s/AKfycby......./exec"; 

const DataService = {
    _cache: null, // Biến lưu trữ dữ liệu tạm thời (RAM)

    // --- CORE: HÀM TẢI DỮ LIỆU THÔNG MINH ---
    // Hàm này sẽ kiểm tra: Có Cache chưa? -> Có LocalStorage chưa? -> Mới gọi Server
    async ensureData() {
        // 1. Nếu đã có trong RAM (do vừa tải xong) -> Dùng ngay
        if (this._cache) return;
https://script.google.com/macros/s/AKfycbxeQFIwXST7R7dtLMlBfDR3jI5NGplXbM5BiyplByS3oFLYOq_aHzZ3XUDJswTOCKde7g/exec
        // 2. Kiểm tra LocalStorage (Dữ liệu cũ trong máy người dùng)
        const localData = localStorage.getItem('MIS_LOCAL_DATA');
        const lastFetch = localStorage.getItem('MIS_LAST_FETCH');
        const now = new Date().getTime();
        const CACHE_TIME = 10 * 60 * 1000; // 10 phút

        // Nếu có dữ liệu cũ và chưa quá hạn 10 phút -> Dùng tạm để hiển thị ngay (Siêu nhanh)
        if (localData && lastFetch && (now - lastFetch < CACHE_TIME)) {
            console.log("⚡ Dùng dữ liệu Offline (LocalStorage)");
            this._cache = JSON.parse(localData);
            return;
        }

        // 3. Nếu không có gì -> Gọi Server tải mới
        await this.fetchAndSave();
    },

    // Gọi lên Google Sheet lấy toàn bộ dữ liệu (Type=all)
    async fetchAndSave() {
        if (API_URL.includes("...")) {
            console.error("❌ CHƯA CẤU HÌNH API URL TRONG FILE DATA-SERVICE.JS!");
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
            
            // Lưu xuống máy người dùng (để lần sau vào nhanh hơn)
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

    // --- 1. QUẢN LÝ HẠ TẦNG (Xử lý logic cây phân cấp từ dữ liệu phẳng) ---
    async getClusters() {
        await this.ensureData(); // Đảm bảo đã có dữ liệu
        
        // Lấy danh sách phẳng từ cache (nếu không có thì trả về rỗng)
        const rawData = this._cache.clusters || [];
        if (rawData.length === 0) return [];

        const result = [];

        rawData.forEach(row => {
            // A. TÌM HOẶC TẠO LIÊN CỤM
            let cluster = result.find(c => c.tenLienCum === row.lienCum);
            if (!cluster) {
                cluster = {
                    tenLienCum: row.lienCum,
                    truongLienCum: row.truongLienCum || "",
                    sdtLienCum: row.sdtLienCum || "",
                    cums: []
                };
                result.push(cluster);
            }

            // B. TÌM HOẶC TẠO CỤM
            let cum = cluster.cums.find(c => c.tenCum === row.cum);
            if (!cum) {
                cum = {
                    tenCum: row.cum,
                    phuTrach: row.phuTrach || "",
                    phuongXas: []
                };
                cluster.cums.push(cum);
            }

            // C. TẠO THÔNG TIN LÃNH ĐẠO (Logic tách 3 cột của bạn)
            let listLanhDao = [];
            // Trường hợp 1: Dữ liệu đã là Array (do App Script xử lý JSON sẵn)
            if (Array.isArray(row.lanhDao)) {
                listLanhDao = row.lanhDao;
            } 
            // Trường hợp 2: Dữ liệu là 3 cột rời (như file Excel mẫu)
            else if (row.ld_Ten) {
                listLanhDao.push({
                    ten: row.ld_Ten,
                    chucVu: row.ld_ChucVu || "Lãnh đạo",
                    sdt: row.ld_Sdt || ""
                });
            }

            // D. ĐẨY XÃ VÀO CỤM
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

    // --- 2. KÊNH TRỰC TIẾP (Lấy từ Cache) ---
    async getStores() {
        await this.ensureData();
        return this._cache.stores || [];
    },

    async getGDVs() {
        await this.ensureData();
        return this._cache.gdvs || [];
    },

    async getSalesStaff() {
        await this.ensureData();
        // Dữ liệu Sheet 'sales' cột phuongXas sẽ được App Script trả về dạng mảng
        return this._cache.sales || [];
    },

    async getB2BStaff() {
        await this.ensureData();
        return this._cache.b2b || [];
    },

    // --- 3. KÊNH GIÁN TIẾP ---
    async getIndirectChannels() {
        await this.ensureData();
        return this._cache.indirect || [];
    },

    // --- 4. TRẠM BTS ---
    async getBTS() {
        await this.ensureData();
        return this._cache.bts || [];
    },

    // --- 5. SỐ LIỆU KINH DOANH ---
    async getKPIStructure() {
        await this.ensureData();
        return this._cache.kpi_structure || [];
    },

    async getKPIActual(monthFrom, monthTo, keyword) {
        await this.ensureData();
        // Sau này có thể thêm logic lọc theo tháng ở đây nếu cần
        return this._cache.kpi_data || [];
    },

    async getKPIUserLogs() {
        // Chưa có sheet logs nên trả về rỗng
        return [];
    }
};
