const DataService = {
    // --- 1. QUẢN LÝ HẠ TẦNG (LIÊN CỤM) ---
    async getClusters() {
        return [
             {
                tenLienCum: "TÂN CHÂU",
                truongLienCum: "Nguyễn Minh Hoài",
                sdtLienCum: "0909.111.222",
                cums: [
                    {
                        tenCum: "TÂN CHÂU",
                        phuTrach: "Lê Thanh Khiết",
                        phuongXas: [
                            { id: "PX01", ten: "Thị Trấn Tân Châu", vlr: 2654, danSo: 24072, tram: 9, lanhDao: [] },
                            { id: "PX02", ten: "Xã Tân Đông", vlr: 1240, danSo: 27582, tram: 12, lanhDao: [] }
                        ]
                    },
                    {
                        tenCum: "TÂN THÀNH",
                        phuTrach: "Trần Văn A",
                        phuongXas: [
                            { id: "PX03", ten: "Xã Tân Thành", vlr: 3209, danSo: 35878, tram: 21, lanhDao: [] }
                        ]
                    }
                ]
            },
            {
                tenLienCum: "TÂN BIÊN",
                truongLienCum: "Trần Tiến Lâm",
                sdtLienCum: "0937.123.456",
                cums: [
                    {
                        tenCum: "TÂN BIÊN",
                        phuTrach: "Trần Tiến Lâm",
                        phuongXas: [
                            { id: "PX04", ten: "Xã Tân Biên", vlr: 4399, danSo: 27783, tram: 13, lanhDao: [] }
                        ]
                    }
                ]
            }
        ];
    },

    // --- 2. KÊNH TRỰC TIẾP ---

    // a. Cửa hàng
    async getStores() {
        return [
            { 
                stt: 1, id: "CH001", ten: "MobiFone Tân Châu", 
                lienCum: "Tân Châu", cum: "Tân Châu",
                diaChi: "123 Tôn Đức Thắng, TT. Tân Châu", lat: 11.575, lng: 106.068,
                cht: "Nguyễn Văn A", sdt: "0909.111.222", gioMo: "07:30 - 20:00", trangThai: "Hoạt động"
            },
            { 
                stt: 2, id: "CH002", ten: "MobiFone Tân Biên", 
                lienCum: "Tân Biên", cum: "Tân Biên",
                diaChi: "45 Phạm Hùng, TT. Tân Biên", lat: 11.602, lng: 105.952,
                cht: "Trần Thị B", sdt: "0933.444.555", gioMo: "07:30 - 18:00", trangThai: "Hoạt động"
            },
            { 
                stt: 3, id: "CH003", ten: "MobiFone Châu Thành", 
                lienCum: "Tân Châu", cum: "Châu Thành",
                diaChi: "Khu phố 3, TT. Châu Thành", lat: 11.300, lng: 106.100,
                cht: "Lê Văn C", sdt: "0933.666.777", gioMo: "07:30 - 20:00", trangThai: "Sửa chữa"
            }
        ];
    },

    // b. Giao dịch viên
    async getGDVs() {
        return [
            { stt: 1, ma: "GDV01", ten: "Lê Thị Lan", maCH: "CH001", tenCH: "CH Tân Châu", lienCum: "Tân Châu", cum: "Tân Châu", vung: "Vùng 1", sdt: "0901.234.567", trangThai: "Làm việc", ngayNghi: "" },
            { stt: 2, ma: "GDV02", ten: "Phạm Văn Minh", maCH: "CH001", tenCH: "CH Tân Châu", lienCum: "Tân Châu", cum: "Tân Châu", vung: "Vùng 1", sdt: "0902.345.678", trangThai: "Nghỉ việc", ngayNghi: "2024-12-01" },
            { stt: 3, ma: "GDV03", ten: "Nguyễn Thị Hoa", maCH: "CH002", tenCH: "CH Tân Biên", lienCum: "Tân Biên", cum: "Tân Biên", vung: "Vùng 2", sdt: "0903.456.789", trangThai: "Làm việc", ngayNghi: "" }
        ];
    },

    // c. Nhân viên Bán hàng (Có Vùng & Phường xã)
    async getSalesStaff() {
        return [
            { 
                stt: 1, ma: "BH01", ten: "Nguyễn Tuấn Tú", 
                lienCum: "Tân Châu", cum: "Tân Châu", vung: "Vùng 1",
                phuongXas: ["TT Tân Châu", "Xã Tân Đông"], 
                sdt: "0903.456.789", trangThai: "Làm việc", ngayNghi: "" 
            },
            { 
                stt: 2, ma: "BH02", ten: "Trần Mai Anh", 
                lienCum: "Tân Biên", cum: "Tân Biên", vung: "Vùng 2",
                phuongXas: ["TT Tân Biên", "Xã Thạnh Tây"], 
                sdt: "0904.567.890", trangThai: "Nghỉ việc", ngayNghi: "2024-10-15" 
            },
            { 
                stt: 3, ma: "BH03", ten: "Lê Hữu Phúc", 
                lienCum: "Tân Châu", cum: "Tân Thành", vung: "Vùng 1",
                phuongXas: ["Xã Tân Thành"], 
                sdt: "0905.678.910", trangThai: "Làm việc", ngayNghi: "" 
            }
        ];
    },

    // d. Khách hàng Doanh nghiệp
    async getB2BStaff() {
        return [
            { stt: 1, ma: "DN01", ten: "Hoàng Văn Thái", lienCum: "Tân Châu", cum: "Tân Châu", vung: "Vùng 1", sdt: "0905.678.901", trangThai: "Làm việc", ngayNghi: "" },
            { stt: 2, ma: "DN02", ten: "Đỗ Thị Thu", lienCum: "Hòa Thành", cum: "Hòa Thành", vung: "Vùng 2", sdt: "0906.789.012", trangThai: "Làm việc", ngayNghi: "" }
        ];
    },

    // --- 3. KÊNH GIÁN TIẾP ---
    async getIndirectChannels() {
        return [
            { 
                stt: 1, maDL: "DL001", ten: "Đại lý Minh Tuấn", maNV: "NV005", 
                loai: "Đại lý UQ", lienCum: "Tân Châu", cum: "Tân Châu", 
                diaChi: "Khu phố 1, TT Tân Châu", lat: 11.575, lng: 106.068 
            },
            { 
                stt: 2, maDL: "DB002", ten: "Tạp hóa Cô Bảy", maNV: "NV008", 
                loai: "C2C", lienCum: "Tân Biên", cum: "Tân Biên", 
                diaChi: "Ấp Thạnh Tây, Xã Thạnh Tây", lat: 11.602, lng: 105.952 
            },
            { 
                stt: 3, maDL: "DL003", ten: "Viễn Thông A", maNV: "NV012", 
                loai: "Đại lý Chuỗi", lienCum: "Hòa Thành", cum: "Hòa Thành", 
                diaChi: "Ngã 3 Mít Một", lat: 11.300, lng: 106.100 
            }
        ];
    },

    // --- 4. TRẠM BTS ---
    async getBTS() {
        return [
            { 
                stt: 1, maTram: "TNI001", tenTram: "BTS Tân Châu 1", 
                lienCum: "Tân Châu", cum: "Tân Châu",
                lat: 11.575, lng: 106.068, diaChi: "Ấp 1, TT Tân Châu", ghiChu: "Cột cao 45m" 
            },
            { 
                stt: 2, maTram: "TNI005", tenTram: "BTS Thạnh Tây", 
                lienCum: "Tân Biên", cum: "Tân Biên",
                lat: 11.602, lng: 105.952, diaChi: "Gần UBND Xã", ghiChu: "Trạm ngụy trang" 
            }
        ];
    },

    // --- 5. SỐ LIỆU KINH DOANH (KPI) ---
    
    // a. Cấu trúc chỉ tiêu
    async getKPIStructure() {
        return [
            { stt: 1, ma: "KPI_DT", ten: "Tổng Doanh Thu", dvt: "Triệu đồng", ngayApDung: "2024-01-01", active: true },
            { stt: 2, ma: "KPI_TB_MOI", ten: "Thuê bao PTM", dvt: "Thuê bao", ngayApDung: "2024-01-01", active: true },
            { stt: 3, ma: "KPI_4G", ten: "Gói cước 4G", dvt: "Lượt", ngayApDung: "2024-02-01", active: true },
            { stt: 4, ma: "KPI_CSKH", ten: "Điểm CSKH", dvt: "Điểm", ngayApDung: "2024-01-01", active: true }
        ];
    },

    // b. Số liệu thực hiện (Mock SQL)
    async getKPIActual(monthFrom, monthTo, keyword) {
        // Sau này thay bằng fetch API từ SQL Server
        return [
            { lienCum: "Tân Châu", cum: "Tân Châu", phuong: "TT Tân Châu", KPI_DT: 500, KPI_TB_MOI: 120, KPI_4G: 300, KPI_CSKH: 9.5 },
            { lienCum: "Tân Châu", cum: "Tân Châu", phuong: "Xã Tân Đông", KPI_DT: 350, KPI_TB_MOI: 80, KPI_4G: 150, KPI_CSKH: 9.0 },
            { lienCum: "Tân Biên", cum: "Tân Biên", phuong: "Xã Tân Biên", KPI_DT: 420, KPI_TB_MOI: 100, KPI_4G: 200, KPI_CSKH: 8.8 }
        ];
    },

    // c. User ghi nhận
    async getKPIUserLogs() {
        return [
            { stt: 1, lienCum: "Tân Châu", cum: "Tân Châu", user: "CH001 (CH Tân Châu)", kenh: "Cửa hàng", time: "2024-03-20 10:30" },
            { stt: 2, lienCum: "Tân Biên", cum: "Tân Biên", user: "BH02 (Trần Mai Anh)", kenh: "NVBH", time: "2024-03-20 11:15" }
        ];
    }
};