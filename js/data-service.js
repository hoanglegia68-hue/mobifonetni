// --- CẤU HÌNH KẾT NỐI GOOGLE SHEET ---
// ⚠️ HÃY DÁN LINK APP SCRIPT CỦA BẠN VÀO GIỮA DẤU NGOẶC KÉP DƯỚI ĐÂY:
const API_URL = "https://script.google.com/macros/s/AKfycby......./exec"; 

const DataService = {
    
    // --- HÀM GỌI API DÙNG CHUNG ---
    async fetchData(sheetName) {
        if (API_URL.includes("...")) {
            console.error("CHƯA CẤU HÌNH API URL!");
            return [];
        }
        try {
            const response = await fetch(`${API_URL}?type=${sheetName}`);
            const data = await response.json();
            if(data.error) {
                console.warn(`Lỗi Sheet '${sheetName}':`, data.error);
                return [];
            }
            return data;
        } catch (error) {
            console.error("Lỗi kết nối:", error);
            return [];
        }
    },

    // --- 1. QUẢN LÝ HẠ TẦNG (Xử lý thông minh từ Sheet phẳng sang Cây phân cấp) ---
    async getClusters() {
        // Lấy dữ liệu phẳng từ Sheet 'clusters'
        const rawData = await this.fetchData('clusters');
        if (!rawData || rawData.length === 0) return [];

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

            // C. TẠO THÔNG TIN LÃNH ĐẠO (Tách từ 3 cột ld_Ten, ld_ChucVu, ld_Sdt)
            let listLanhDao = [];
            if (row.ld_Ten) {
                listLanhDao.push({
                    ten: row.ld_Ten,
                    chucVu: row.ld_ChucVu || "Lãnh đạo",
                    sdt: row.ld_Sdt || ""
                });
            }

            // D. ĐẨY XÃ VÀO CỤM
            cum.phuongXas.push({
                id: row.idPX || Math.random().toString(36).substr(2, 5), // Tạo ID giả nếu thiếu
                ten: row.tenPX,
                vlr: Number(row.vlr) || 0,
                danSo: Number(row.danSo) || 0,
                tram: Number(row.tram) || 0,
                lanhDao: listLanhDao
            });
        });

        return result;
    },

    // --- 2. KÊNH TRỰC TIẾP ---
    async getStores() { return await this.fetchData('stores'); },
    
    async getGDVs() { return await this.fetchData('gdvs'); },
    
    async getSalesStaff() { 
        // Lưu ý: Cột phuongXas trong Sheet 'sales' nên nhập: "Xã A, Xã B" 
        // Apps Script sẽ tự tách thành mảng ["Xã A", "Xã B"] cho UI
        return await this.fetchData('sales'); 
    },
    
    async getB2BStaff() { return await this.fetchData('b2b'); },

    // --- 3. KÊNH GIÁN TIẾP ---
    async getIndirectChannels() { return await this.fetchData('indirect'); },

    // --- 4. TRẠM BTS ---
    async getBTS() { return await this.fetchData('bts'); },

    // --- 5. SỐ LIỆU KINH DOANH & KPI ---
    async getKPIStructure() { return await this.fetchData('kpi_structure'); },

    async getKPIActual(monthFrom, monthTo, keyword) {
        // Tạm thời lấy hết dữ liệu về để hiển thị, sau này nâng cấp lọc phía Server sau
        return await this.fetchData('kpi_data');
    },

    async getKPIUserLogs() { 
        // Tính năng nâng cao: Có thể tạo thêm sheet 'logs' nếu cần
        return []; 
    }
};