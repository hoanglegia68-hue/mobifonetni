    /* ============================
    * main.js (FULL) — FINAL VERSION
    * Updates:
    * - Clear & Optimized generic functions.
    * ============================ */
    // Hàm helper chuyển đổi ngày từ Sheet (ISO) sang Input (YYYY-MM-DD)
    function formatDateForInput(isoDateString) {
        if (!isoDateString) return "";
        try {
            const d = new Date(isoDateString);
            if (isNaN(d.getTime())) return ""; // Ngày lỗi
            // Trả về YYYY-MM-DD
            return d.toISOString().split('T')[0];
        } catch (e) { return ""; }
    }

    const app = {
        // ============================================================
        // 1. QUẢN LÝ TRẠNG THÁI (STATE)
        // ============================================================
        currentUser: null,
        fullClusterData: [],
        cachedKPIData: [],
        cachedLogData: [],
        cachedData: {},
        mapLienCum: {},
        mapCum: {},
        chartInstances: {}, // Lưu trữ các instance của Chart để destroy khi vẽ lại
        currentKPIReportData: null,
        currentStaffDataGroups: null,
        isSidebarOpen: false,

        // BTS Filter State (lọc theo Liên Cụm/Cụm + tìm kiếm)
        btsFilterState: { keyword: '', liencum: 'all', cum: 'all' },
        rentalConfig: {
            emails: "admin@mobifone.vn, quanly@mobifone.vn",
            alertDays: [90, 60],
            urgentDay: 30
        },

        // ============================================================
        // 2. INIT & AUTH (KHỞI TẠO & ĐĂNG NHẬP)
        // ============================================================

        // ============================================================
    // HÀM KHỞI TẠO (INIT)
    // ============================================================
            async init() {

                console.log("App Starting... Version Ver LunarNY.2026 (Scope Secured)");

                // 1. Kiểm tra đăng nhập
                const savedUser = localStorage.getItem('MIS_USER');
                if (!savedUser) {
                    window.location.href = 'login.html';
                    return;
                }
                this.currentUser = JSON.parse(savedUser);
                // ============================================================
                // [THÊM ĐOẠN NÀY] Gán sự kiện cho nút Menu (3 gạch)
                // ============================================================
                // --- BẮT ĐẦU ĐOẠN CODE SỬA (Thay thế đoạn lỗi cũ) ---

                // 1. Xử lý Nút Menu (3 gạch)
                const btnMenu = document.getElementById('mobile-menu-btn');
                if (btnMenu) {
                    // Clone nút để xóa sạch các event cũ (tránh lỗi lặp lệnh)
                    const newBtn = btnMenu.cloneNode(true);
                    btnMenu.parentNode.replaceChild(newBtn, btnMenu);

                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Ngăn sự kiện nổi bọt
                        console.log("🖱️ CLICK: Đã bấm nút Menu!");
                        this.toggleSidebar();
                    });
                    console.log("✅ Đã kích hoạt nút Menu Mobile");
                } else {
                    console.error("❌ LỖI: Không tìm thấy nút id='mobile-menu-btn'");
                }

                // 2. Xử lý Overlay (Vùng tối) - GỘP CHUNG VÀO ĐÂY
                const overlay = document.getElementById('mobile-overlay');
                if (overlay) {
                    // Clone để reset sự kiện cũ
                    const newOverlay = overlay.cloneNode(true);
                    overlay.parentNode.replaceChild(newOverlay, overlay);

                    // Gán sự kiện click: Bấm vào vùng tối thì đóng menu
                    newOverlay.addEventListener('click', () => {
                        console.log("🖱️ CLICK: Đã bấm vào Overlay");
                        if (this.isSidebarOpen) {
                            this.toggleSidebar();
                        }
                    });
                }

                // 3. Xử lý khi co giãn màn hình (Resize)
                window.addEventListener('resize', () => {
                    // Nếu màn hình to lên (Desktop) mà menu đang mở kiểu mobile -> Reset lại
                    if (window.innerWidth >= 768 && this.isSidebarOpen) {
                        this.isSidebarOpen = false; 
                        
                        const sb = document.getElementById('sidebar');
                        const ov = document.getElementById('mobile-overlay');
                        
                        if (ov) ov.classList.add('hidden'); // Ẩn vùng tối
                        if (sb) sb.classList.add('-translate-x-full'); // Ẩn sidebar về bên trái
                    }
                });


                // --- LOAD DATA & LỌC NGAY LẬP TỨC ---
                try {
                    const [clusters, stores, gdvs, sales, b2b, indirect, bts] = await Promise.all([
                        DataService.getClusters(), DataService.getStores(), DataService.getGDVs(),
                        DataService.getSalesStaff(), DataService.getB2BStaff(), DataService.getIndirectChannels(), DataService.getBTS()
                    ]);

                    // 1. Chuẩn hóa & Lọc cấu trúc Cụm
                    const rawClusters = this.normalizeDataSet(clusters);
                    this.fullClusterData = this.filterDataByScope(rawClusters);

                    // 2. Chuẩn hóa & Lọc dữ liệu chi tiết (Quan trọng)
                    // Việc này đảm bảo các Tab danh sách sau này không cần lọc lại nữa
                    this.cachedData = {
                        stores:   this.filterDataByScope(this.normalizeDataSet(stores)),
                        gdvs:     this.filterDataByScope(this.normalizeDataSet(gdvs)),
                        sales:    this.filterDataByScope(this.normalizeDataSet(sales)),
                        b2b:      this.filterDataByScope(this.normalizeDataSet(b2b)),
                        indirect: this.filterDataByScope(this.normalizeDataSet(indirect)),
                        bts:      this.normalizeBTSData(this.filterDataByScope(this.normalizeDataSet(bts)))
                    };
                    
                    console.log("✅ Data Initialized & Scoped for:", this.currentUser.scope);

                } catch (error) {
                    console.error("Lỗi data init:", error);
                    alert("Lỗi tải dữ liệu. Vui lòng thử lại!");
                }

                this.buildDictionary();
                this.updateUserInterface();
                this.renderFooter();

                if (window.lucide) lucide.createIcons();
                
                // Vào Dashboard
                this.navigate('dashboard');
                this.calculateAndRenderRankings();

                const loadingOverlay = document.getElementById('global-loader');
                if (loadingOverlay) loadingOverlay.classList.add('hidden-loader');
            },

        logout() {
            if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                localStorage.removeItem('MIS_USER');
                localStorage.removeItem('MIS_LOCAL_DATA');
                window.location.href = 'login.html';
            }
        },

        // ============================================================
        // 3. LOGIC XỬ LÝ DỮ LIỆU & XẾP HẠNG (CORE)
        // ============================================================

        calculateAndRenderRankings() {
        console.log("--- TÍNH TOÁN XẾP HẠNG (FIXED) ---");

        // 1. Kiểm tra dữ liệu đầu vào
        if (!this.currentKPIReportData) return;

        // 2. Xác định nguồn dữ liệu dựa trên Filter đang chọn (Quan trọng)
        const kpiFilter = document.getElementById('filter-kpi')?.value || 'all';
        
        // Mặc định là Sub, nhưng nếu đang chọn KPI Doanh thu thì đổi nguồn
        // Bạn có thể update logic này kỹ hơn nếu có danh sách KPI type
        let dataSource = this.currentKPIReportData.sub;
        
        // Logic tự động nhận diện nguồn dữ liệu dựa trên tổng số liệu
        // Nếu Sub = 0 mà Rev > 0 thì ưu tiên hiển thị Rev (trường hợp filter KPI Rev)
        if (this.currentKPIReportData.rev.actual > 0 && this.currentKPIReportData.sub.actual === 0) {
            dataSource = this.currentKPIReportData.rev;
            console.log("📊 Đang xếp hạng theo: DOANH THU");
        } else {
            console.log("📊 Đang xếp hạng theo: THUÊ BAO");
        }

        if (!dataSource) return;

        const filterScope = this.currentFilterScope || 'all';
        const kpiSourceLC = dataSource.cluster;
        const kpiSourceCum = dataSource.breakdown;

        // Hàm tính %
        const calcPercent = (act, pln) => {
            const a = Number(act) || 0;
            const p = Number(pln) || 0;
            if (p === 0) return a > 0 ? 100 : 0;
            return Math.round((a / p) * 100);
        };

        // --- 3. LOOP TÍNH TOÁN ---
        let listLC = [];
        let listCum = [];

        if (this.fullClusterData && this.fullClusterData.length > 0) {
            this.fullClusterData.forEach(lc => {
                // A. XỬ LÝ LIÊN CỤM
                // [FIX QUAN TRỌNG]: Chuẩn hóa Key trước khi tra cứu
                const rawKeyLC = String(lc.maLienCum).trim();
                const cleanKeyLC = app.cleanCode(rawKeyLC); 
                
                // Thử tìm bằng cả mã sạch (ưu tiên) và mã gốc
                const kpiLC = kpiSourceLC[cleanKeyLC] || kpiSourceLC[rawKeyLC] || { actual: 0, plan: 0 };

                listLC.push({
                    id: lc.maLienCum,
                    name: lc.tenLienCum,
                    sub: lc.truongLienCum,
                    phone: lc.sdtLienCum,
                    actual: kpiLC.actual,
                    plan: kpiLC.plan,
                    percent: calcPercent(kpiLC.actual, kpiLC.plan)
                });

                // B. XỬ LÝ CỤM CON
                if (Array.isArray(lc.cums)) {
                    lc.cums.forEach(cum => {
                        let isVisible = true;
                        // Logic lọc theo Scope
                        if (filterScope !== 'all') {
                            const isLienCumSelected = app.mapLienCum && app.mapLienCum.hasOwnProperty(filterScope);
                            if (isLienCumSelected) {
                                if (filterScope !== lc.maLienCum) isVisible = false;
                            } else {
                                if (filterScope !== cum.maCum) isVisible = false;
                            }
                        }

                        if (isVisible) {
                            // [FIX QUAN TRỌNG]: Chuẩn hóa Key Cụm
                            const rawKeyCum = String(cum.maCum).trim();
                            const cleanKeyCum = app.cleanCode(rawKeyCum);
                            
                            const kpiCum = kpiSourceCum[cleanKeyCum] || kpiSourceCum[rawKeyCum] || { actual: 0, plan: 0 };

                            // Smart Phone Finder
                            const getPhoneSmart = (obj) => {
                                if (!obj) return '';
                                if (obj.sdtCum) return obj.sdtCum;
                                const allKeys = Object.keys(obj);
                                const targetKey = allKeys.find(k => {
                                    const cleanK = k.trim().toLowerCase();
                                    return cleanK.includes('sdt') || cleanK.includes('phone') || cleanK === 'sodienthoai';
                                });
                                return targetKey ? obj[targetKey] : '';
                            };

                            listCum.push({
                                id: cum.maCum,
                                name: cum.tenCum,
                                sub: cum.phuTrach,
                                phone: getPhoneSmart(cum),
                                actual: kpiCum.actual,
                                plan: kpiCum.plan,
                                percent: calcPercent(kpiCum.actual, kpiCum.plan)
                            });
                        }
                    });
                }
            });
        }

        // 4. SẮP XẾP & RENDER
        // Sort giảm dần theo %
        listLC.sort((a, b) => b.percent - a.percent);
        listCum.sort((a, b) => b.percent - a.percent);

        UIRenderer.renderRankingTable('ranking-liencum-container', listLC);
        UIRenderer.renderRankingTable('ranking-cum-container', listCum);

        // --- 5. XỬ LÝ XẾP HẠNG NHÂN VIÊN (Giữ nguyên logic cũ) ---
        if (!this.currentStaffDataGroups) return;

        const mapStaffRanking = (groupData, cachedSourceList) => {
            if (!groupData || !Array.isArray(groupData)) return [];
            
            // Tạo map info nhân viên để lấy SĐT
            const idx = new Map(
                (cachedSourceList || []).map(i => [String(i.maNV || "").trim().toUpperCase(), i])
            );

            let filtered = groupData;
            // Lọc nhân viên theo scope Dashboard
            if (filterScope !== 'all') {
                const isLienCumSelected = app.mapLienCum && app.mapLienCum.hasOwnProperty(filterScope);
                filtered = groupData.filter(s => {
                    if (isLienCumSelected) {
                        const parentLC = app.getParentLienCum(s.maCum);
                        // Cần đảm bảo so sánh chuỗi
                        return String(parentLC) === String(filterScope);
                    }
                    return String(s.maCum) === String(filterScope);
                });
            }

            return filtered.map(s => {
                const key = String(s.code || "").trim().toUpperCase();
                const staticInfo = idx.get(key) || {};
                return {
                    id: s.code,
                    name: s.name,
                    sub: s.maCum,
                    phone: staticInfo.sdt || staticInfo.soDienThoai,
                    actual: s.actual,
                    plan: s.plan,
                    percent: Number(s.percent) || 0
                };
            });
        };

        const rankGDV = mapStaffRanking(this.currentStaffDataGroups.gdv, this.cachedData.gdvs || []);
        const rankSales = mapStaffRanking(this.currentStaffDataGroups.sales, this.cachedData.sales || []);
        const rankB2B = mapStaffRanking(this.currentStaffDataGroups.b2b, this.cachedData.b2b || []);

        UIRenderer.renderRankingTable('ranking-gdv-container', rankGDV);
        UIRenderer.renderRankingTable('ranking-sales-container', rankSales);
        UIRenderer.renderRankingTable('ranking-b2b-container', rankB2B);

        this.updateEmployeeSummaryBox('gdv', rankGDV);
        this.updateEmployeeSummaryBox('sales', rankSales);
        this.updateEmployeeSummaryBox('b2b', rankB2B);
    },

        // Hàm tính tổng và update UI cho từng nhóm nhân viên
        // ============================================================
    // CẬP NHẬT: TÍNH TOÁN CÁC Ô SUMMARY (TUẦN/THÁNG/NĂM)
    // ============================================================
    updateEmployeeSummaryBox(type, dataList) {
    // Helper set giá trị an toàn (tránh lỗi null nếu HTML thiếu ID)
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    const fmtNum = (num) => UIRenderer.formatNumber(num);

    // ------------------------------------------------------------
    // 1. TÍNH TOÁN CƠ BẢN (Dữ liệu trong khoảng ngày chọn)
    // ------------------------------------------------------------
    let totalPlan = 0;
    let totalActual = 0;
    const staffCodes = new Set();

    if (dataList && dataList.length > 0) {
        dataList.forEach(item => {
            totalPlan += Number(item.plan) || 0;
            totalActual += Number(item.actual) || 0;
            const rawCode = item.id || item.code || item.maNV;
            if (rawCode) staffCodes.add(String(rawCode).toUpperCase().trim());
        });
    }

    let percent = 0;
    if (totalPlan > 0) percent = ((totalActual / totalPlan) * 100).toFixed(1);
    else if (totalActual > 0) percent = 100;

    // Cập nhật 4 ô cơ bản
    setTxt(`${type}-count`, dataList ? dataList.length : 0);
    setTxt(`${type}-actual`, fmtNum(totalActual));
    setTxt(`${type}-plan`, fmtNum(totalPlan));
    setTxt(`${type}-percent`, `${percent}%`);

    // ------------------------------------------------------------
    // 2. TÍNH TRUNG BÌNH NGÀY (Dựa trên mốc ngày lọc)
    // ------------------------------------------------------------
    const filterDateTo = document.getElementById('dash-date-to')?.value;
    const referenceDate = filterDateTo ? new Date(filterDateTo) : new Date();
    
    // Số ngày trôi qua tính từ ngày 1 đến ngày đang lọc (VD: ngày 15/02 thì chia 15)
    const daysPassed = referenceDate.getDate() || 1; 
    
    const staffCount = dataList ? dataList.length : 1; 

    // Công thức đúng: (Tổng thực hiện / Số ngày) / Số nhân viên
    let avgDay = 0;
    if (staffCount > 0 && daysPassed > 0) {
        avgDay = (totalActual / daysPassed) / staffCount;
    }
    
    const avgDayFmt = new Intl.NumberFormat('vi-VN', { 
        maximumFractionDigits: 2 // Để 2 số thập phân cho chính xác (vd: 4.75)
    }).format(avgDay);
    
    setTxt(`${type}-tbptm-avgday`, avgDayFmt);

    // ------------------------------------------------------------
    // 3. TÍNH TOÁN LŨY KẾ NÂNG CAO (TUẦN/THÁNG/NĂM)
    // ------------------------------------------------------------
    const rawRows = this.reportCache?.data?.raw || [];
    
    // Mốc thời gian chuẩn dựa trên ngày kết thúc bộ lọc
    const startOfWeek = this._startOfWeekMonday(referenceDate);
    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
    
    let accWeek = 0;
    let accMonth = 0;
    let accYear = 0;

    const kpiFilter = document.getElementById('filter-kpi')?.value || 'all';

    // Helper parse ngày
    const parseRawDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'number' && this._excelSerialToDate) return this._excelSerialToDate(val);
        if (typeof val === 'string') {
             const d = new Date(val);
             return isNaN(d.getTime()) ? null : d;
        }
        return null;
    };

    if (rawRows.length > 0) {
        rawRows.forEach(r => {
            const code = String(r.maNV || r.manv || '').toUpperCase().trim();
            // Chỉ tính những nhân viên thuộc list đang hiển thị
            if (!staffCodes.has(code)) return;

            // Lọc đúng KPI đang chọn
            const kpiCode = app.cleanCode ? app.cleanCode(r.maKpi) : String(r.maKpi || '').toUpperCase();
            if (kpiFilter !== 'all' && kpiCode !== kpiFilter) return;

            const d = parseRawDate(r.date || r.ngay);
            if (!d || d > referenceDate) return; // Không tính dữ liệu tương lai hơn ngày lọc

            let val = Number(r.giaTri || r.value) || 0;
            if (val > 50000) val = val / 1000000; 

            if (d >= startOfWeek) accWeek += val;
            if (d >= startOfMonth) accMonth += val;
            if (d >= startOfYear) accYear += val;
        });
    } else {
        // Fallback nếu không load được rawRows
        accMonth = totalActual;
        accYear = totalActual;
    }

    // Update UI Lũy kế
    setTxt(`${type}-week`, fmtNum(accWeek));
    setTxt(`${type}-month`, fmtNum(accMonth));
    setTxt(`${type}-year`, fmtNum(accYear));
    },

    
    // ▼▼▼ COPY TOÀN BỘ HÀM NÀY ĐÈ LÊN HÀM CŨ ▼▼▼
    updateSubscriberOverview(filteredData, rawData) {
        // Helper: Hàm gán text an toàn
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        
        // Helper: Định dạng số (ngăn cách hàng nghìn)
        const fmtNum = (num) => UIRenderer.formatNumber(num);
        
        // Helper: Định dạng số thập phân (cho số trung bình)
        const fmtDec = (num) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num);

        // 1. Lấy mốc thời gian tham chiếu (từ bộ lọc hoặc ngày hiện tại)
        const dateToInput = document.getElementById('dash-date-to')?.value;
        const referenceDate = dateToInput ? new Date(dateToInput) : new Date();
        referenceDate.setHours(0,0,0,0);

        // 2. Tính Tổng Thực hiện & Kế hoạch (Từ filteredData - dữ liệu đã lọc theo scope)
        let totalActual = 0;
        let totalPlan = 0;
        if (filteredData && filteredData.length > 0) {
            filteredData.forEach(item => {
                totalActual += Number(item.actual) || 0;
                totalPlan += Number(item.plan) || 0;
            });
        }

        // Cập nhật UI phần Tổng
        setText('stat-sub-actual', fmtNum(totalActual));
        setText('stat-sub-plan', fmtNum(totalPlan));

        // Tính % Hoàn thành
        const percent = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
        setText('stat-sub-percent', percent.toFixed(1) + '%');
        
        // Update thanh tiến trình (Progress bar)
        const progBar = document.getElementById('prog-sub');
        if(progBar) progBar.style.width = `${Math.min(percent, 100)}%`;

        // --- 3. TÍNH TOÁN LŨY KẾ & SO SÁNH (Dùng rawData) ---
        
        // Hàm lấy ngày thứ 2 đầu tuần
        const getMonday = (d) => {
            const dCopy = new Date(d);
            const day = dCopy.getDay();
            const diff = dCopy.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(dCopy.setDate(diff));
        };

        // A. Xác định các mốc thời gian
        // - Kỳ hiện tại
        const startOfWeek = getMonday(referenceDate);
        const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
        
        // - Kỳ quá khứ (để so sánh)
        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7); // Lùi 1 tuần

        const startOfLastMonth = new Date(startOfMonth);
        startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1); // Lùi 1 tháng về ngày mùng 1 tháng trước
        
        const endOfLastMonth = new Date(startOfMonth);
        endOfLastMonth.setDate(0); // Ngày cuối cùng của tháng trước

        // B. Khai báo biến tích lũy
        let accWeek = 0;     
        let accLastWeek = 0; // Số liệu tuần trước
        
        let accMonth = 0;    
        let accLastMonth = 0; // Số liệu tháng trước
        
        let accYear = 0;

        // Lấy KPI đang chọn để lọc rawData
        const currentKPI = document.getElementById('filter-kpi')?.value || 'all';

        // C. Duyệt Raw Data để cộng dồn
        if (rawData && rawData.length > 0) {
            rawData.forEach(r => {
                const kpiCode = app.cleanCode(r.maKpi);
                // Nếu đang lọc KPI cụ thể thì bỏ qua các KPI khác
                if (currentKPI !== 'all' && kpiCode !== currentKPI) return;

                let d = this._parseAnyDate(r.date || r.ngay);
                if (!d) return;
                d.setHours(0,0,0,0);

                // Bỏ qua dữ liệu tương lai so với ngày chọn
                if (d > referenceDate) return; 

                let val = Number(r.giaTri || r.value) || 0;
                // Xử lý đơn vị tính nếu số quá lớn (logic cũ của anh)
                if (val > 5000000) val = val / 1000000; 

                // 1. Tính cho Năm nay
                if (d >= startOfYear) accYear += val;

                // 2. Tính cho Tháng này
                if (d >= startOfMonth) accMonth += val;
                
                // 3. Tính cho Tháng trước (Trọn tháng trước)
                if (d >= startOfLastMonth && d < startOfMonth) accLastMonth += val;

                // 4. Tính cho Tuần này
                if (d >= startOfWeek) accWeek += val;

                // 5. Tính cho Tuần trước (Trọn tuần trước)
                if (d >= startOfLastWeek && d < startOfWeek) accLastWeek += val;
            });
        }

        // --- 4. TÍNH TRUNG BÌNH & HIỂN THỊ ---

        // A. Số liệu Tuần
        setText('stat-sub-wtd', fmtNum(accWeek));
        
        // Tính chênh lệch tuần: (Tuần này - Tuần trước)
        const diffWeek = accWeek - accLastWeek;
        const diffSign = diffWeek > 0 ? "+" : ""; // Thêm dấu + nếu dương
        // Cập nhật text so sánh tuần (ID: stat-sub-wtd-compare)
        setText('stat-sub-wtd-compare', `So tuần trước: ${diffSign}${fmtNum(diffWeek)}`);

        // B. Số liệu Tháng
        setText('stat-sub-mtd', fmtNum(accMonth));
        
        // - BQ Tháng này
        const daysPassed = referenceDate.getDate() || 1; 
        const avgDay = accMonth / daysPassed;
        setText('stat-sub-mtd-avg', `BQ tháng này: ${fmtDec(avgDay)}`); // ID: stat-sub-mtd-avg

        // - BQ Tháng trước (ID: stat-sub-mtd-prevavg)
        // Tính tổng ngày của tháng trước (28, 30 hoặc 31)
        const daysInLastMonth = endOfLastMonth.getDate(); 
        const avgLastMonth = daysInLastMonth > 0 ? (accLastMonth / daysInLastMonth) : 0;
        setText('stat-sub-mtd-prevavg', `BQ tháng trước: ${fmtDec(avgLastMonth)}`);

        // C. Số liệu Năm & Tổng quan
        setText('stat-sub-ytd', fmtNum(accYear));
        
        // Ô to "Trung bình ngày" (lấy BQ tháng hiện tại làm đại diện)
        setText('stat-sub-avgday', fmtDec(avgDay)); 
    },

        // Biến timer cho bộ lọc
        _filterTimer: null,

        // ============================================================
    // HÀM XỬ LÝ DASHBOARD KPI (REPORT FILTER)
    // ============================================================
        async handleKPIReportFilter() {
            // Debounce: Chống click nhiều lần
            if (this._filterTimer) clearTimeout(this._filterTimer);

            this._filterTimer = setTimeout(async () => {
                console.log("Loading KPI Report... (Secured)");

                // 1. LẤY INPUT
                const dFrom = document.getElementById('dash-date-from')?.value;
                const dTo = document.getElementById('dash-date-to')?.value;
                const scope = document.getElementById('filter-scope')?.value || 'all';
                
                // [FIX 1] QUAN TRỌNG: Cập nhật biến Scope toàn cục để hàm xếp hạng dùng
                this.currentFilterScope = scope; 

                const channelFilter = document.getElementById('filter-channel')?.value || 'all';
                const kpiFilter = document.getElementById('filter-kpi')?.value || 'all';

                if (!dFrom || !dTo) return;

                // 2. HELPER NGÀY THÁNG
                const parseYMD = (s) => { const [y, m, d] = String(s).split('-').map(n => parseInt(n, 10)); return new Date(y, (m || 1) - 1, d || 1); };
                const pad2 = (n) => String(n).padStart(2, '0');
                const fmtYMD = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
                const fmtYM = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
                
                const dFromObj = parseYMD(dFrom);
                const dToObj = parseYMD(dTo);
                dFromObj.setHours(0, 0, 0, 0); dToObj.setHours(23, 59, 59, 999);
                
                const extMonthFrom = fmtYM(dFromObj);      
                const extMonthTo = dTo.substring(0, 7);
                const cacheKey = `${extMonthFrom}|${extMonthTo}`;

                try {
                    let raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B;

                    // 3. TẢI DATA (CACHE HOẶC SERVER)
                    if (this.reportCache && this.reportCache.key === cacheKey && this.reportCache.data) {
                        ({ raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B } = this.reportCache.data);
                    } else {
                        [raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B] = await Promise.all([
                            DataService.getKPIActual(extMonthFrom, extMonthTo, null),
                            DataService.getKPIPlanning(),
                            DataService.getKPIEmpPlans(),
                            DataService.getKPIStructure(),
                            DataService.getKPILogs(),
                            DataService.getGDVs(), DataService.getSalesStaff(), DataService.getB2BStaff()
                        ]);
                        this.reportCache = { key: cacheKey, data: { raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B } };
                    }

                    // --- [QUAN TRỌNG] LỌC LẠI LIST NHÂN VIÊN THEO SCOPE TRƯỚC KHI TÍNH ---
                    listGDV = this.filterDataByScope(this.normalizeDataSet(listGDV));
                    listSales = this.filterDataByScope(this.normalizeDataSet(listSales));
                    listB2B = this.filterDataByScope(this.normalizeDataSet(listB2B));

                    console.time("Pure_Calculation");
                    const normalize = (data) => this.normalizeDataSet(data);
                    const rawData = normalize(raw);
                    const planData = normalize(plans);
                    const empPlanData = normalize(empPlansRaw);
                    const logData = normalize(logs);

                    const detectKey = (sampleRow, ...candidates) => { if (!sampleRow) return candidates[0]; const keys = Object.keys(sampleRow); const lowerKeys = keys.map(k => k.toLowerCase()); for (const c of candidates) { const idx = lowerKeys.indexOf(c.toLowerCase()); if (idx > -1) return keys[idx]; } return candidates[0]; };
                    const typeMap = {}; struct.forEach(s => { if (s.active) { const k = app.cleanCode(s.ma); const u = (s.dvt || '').toLowerCase(); typeMap[k] = (u.includes('tb') || u.includes('sim') || u.includes('cái')) ? 'sub' : 'rev'; } });
                    
                    // Init Variables
                    const subData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {}, breakdown: {} };
                    const revData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {}, breakdown: {} };
                    const initBreakdownObj = () => ({ actual: 0, plan: 0, channels: {} });
                    const initClusterObj = () => ({ actual: 0, plan: 0 });
                    const staffMap = {};
                    const initStaffObj = () => ({ actual: 0, plan: 0 });
                    
                    // --- XỬ LÝ ACTUAL (THỰC HIỆN) ---
                    const uScope = (this.currentUser?.scope || 'all').toString().trim();
                    const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');

                    if (rawData.length > 0) {
                        const sample = rawData[0];
                        const kDate = detectKey(sample, 'date', 'ngay');
                        const kLC = detectKey(sample, 'maLienCum', 'lienCum');
                        const kCum = detectKey(sample, 'maCum', 'cum');
                        const kKPI = detectKey(sample, 'maKpi', 'kpi');
                        const kVal = detectKey(sample, 'giaTri', 'value');
                        const kNV = detectKey(sample, 'maNV', 'manv');
                        const kCh = detectKey(sample, 'channelType', 'kenh');

                        rawData.forEach(row => {
                            const dVal = row[kDate]; if(!dVal) return;
                            const parsed = this.parseDateKey(dVal);
                            if (parsed.full < dFrom || parsed.full > dTo) return;

                            const maLC = app.cleanCode(row[kLC]) || 'KHAC';
                            const maC = app.cleanCode(row[kCum]) || 'KHAC';
                            
                            if (!isAdmin) {
                                if (maLC !== uScope && maC !== uScope) return; 
                            }
                            if (scope !== 'all') { 
                                if (this.mapLienCum[scope]) { if (maLC !== scope) return; }
                                else { if (maC !== scope) return; }
                            }

                            const kpiCode = app.cleanCode(row[kKPI]);
                            if (kpiFilter !== 'all' && kpiCode !== kpiFilter) return;
                            const chVal = String(row[kCh] || 'KHÁC').split('-')[0].trim();
                            if (channelFilter !== 'all' && chVal !== channelFilter) return;

                            const type = typeMap[kpiCode];
                            if (!type) return;
                            
                            let val = Number(row[kVal]) || 0;
                            if (type !== 'sub' && val > 10000) val = val / 1000000;

                            const tData = type === 'sub' ? subData : revData;
                            tData.actual += val;
                            tData.daily[parsed.full] = (tData.daily[parsed.full] || 0) + val;
                            tData.channel[chVal] = (tData.channel[chVal] || 0) + val;
                            
                            if (!tData.cluster[maLC]) tData.cluster[maLC] = initClusterObj();
                            tData.cluster[maLC].actual += val;
                            
                            if (!tData.breakdown[maC]) tData.breakdown[maC] = initBreakdownObj();
                            tData.breakdown[maC].actual += val;
                            tData.breakdown[maC].channels[chVal] = (tData.breakdown[maC].channels[chVal] || 0) + val;

                            const nv = String(row[kNV] || '').trim().toUpperCase();
                            if (nv) {
                                if (!staffMap[nv]) staffMap[nv] = initStaffObj();
                                staffMap[nv].actual += val;
                            }
                        });
                    }

                    // --- XỬ LÝ PLAN (KẾ HOẠCH) ---
                    const relevantMonths = new Set();
                    let currM = new Date(dFromObj);
                    while (currM <= dToObj) { relevantMonths.add(fmtYM(currM)); currM.setMonth(currM.getMonth() + 1); }

                    const processPlan = (pData, isEmp) => {
                        if (!pData || pData.length === 0) return;
                        const sample = pData[0];
                        const kMonth = detectKey(sample, 'month', 'thang');
                        const kKPI = detectKey(sample, 'maKpi', 'kpi');
                        const kVal = detectKey(sample, 'giaTri', 'keHoach', 'plan');
                        const kLC = !isEmp ? detectKey(sample, 'maLienCum', 'lienCum') : null;
                        const kCum = !isEmp ? detectKey(sample, 'maCum', 'cum') : null;
                        const kNV = isEmp ? detectKey(sample, 'maNV', 'manv') : null;

                        for (const row of pData) {
                            const mVal = String(row[kMonth] || '').trim().substring(0, 7);
                            if (!relevantMonths.has(mVal)) continue;

                            const kpiCode = app.cleanCode(row[kKPI]);
                            if (kpiFilter !== 'all' && kpiCode !== kpiFilter) continue;
                            const type = typeMap[kpiCode];
                            if (!type) continue;

                            let val = Number(row[kVal]) || 0;
                            if (type !== 'sub' && val > 10000) val = val / 1000000;

                            if (!isEmp) {
                                const maLC = app.cleanCode(row[kLC]) || 'KHAC';
                                const maC = app.cleanCode(row[kCum]) || 'KHAC';

                                if (!isAdmin) {
                                    if (this.mapLienCum[uScope] && maLC !== uScope) continue;
                                    if (this.mapCum[uScope] && maC !== uScope) continue;
                                }

                                if (scope !== 'all') {
                                    if (this.mapLienCum[scope]) { if (maLC !== scope) continue; }
                                    else { if (maC !== scope) continue; }
                                }

                                const tData = type === 'sub' ? subData : revData;
                                tData.plan += val;
                                
                                if (!tData.cluster[maLC]) tData.cluster[maLC] = initClusterObj();
                                tData.cluster[maLC].plan += val;

                                if (!tData.breakdown[maC]) tData.breakdown[maC] = initBreakdownObj();
                                tData.breakdown[maC].plan += val;

                            } else {
                                const nv = String(row[kNV] || '').trim().toUpperCase();
                                if (nv) {
                                    if (!staffMap[nv]) staffMap[nv] = initStaffObj();
                                    staffMap[nv].plan += val;
                                }
                            }
                        }
                    };

                    processPlan(planData, false);
                    processPlan(empPlanData, true);

                    // --- TÍNH TOÁN HIỆU SUẤT ---
                    const processStaffList = (list) => {
                        const res = [];
                        if (!list || list.length === 0) return { list: [] };
                        const sSample = list[0];
                        const sMaNV = detectKey(sSample, 'maNV', 'MaNV');
                        const sTen = detectKey(sSample, 'ten', 'hoTen');
                        const sMaCum = detectKey(sSample, 'maCum', 'cum');
                        const sPhone = detectKey(sSample, 'sdt', 'soDienThoai');

                        list.forEach(staff => {
                            const code = String(staff[sMaNV] || '').trim().toUpperCase();
                            const kpi = staffMap[code] || { actual: 0, plan: 0 };
                            if(kpi.actual > 0 || kpi.plan > 0) {
                                res.push({
                                    code: staff[sMaNV], name: staff[sTen], maCum: staff[sMaCum], phone: staff[sPhone],
                                    actual: kpi.actual, plan: kpi.plan, percent: app.calcPercent(kpi.actual, kpi.plan)
                                });
                            }
                        });
                        res.sort((a, b) => Number(b.percent) - Number(a.percent));
                        return { list: res };
                    };

                    const gGDV = processStaffList(listGDV);
                    const gSales = processStaffList(listSales);
                    const gB2B = processStaffList(listB2B);

                    // Tính BQ ngày
                    const countActiveStaff = (list) => (list || []).filter(i => Number(i.actual) > 0).length;
                    const sumActual = (list) => (list || []).reduce((acc, item) => acc + (Number(item.actual) || 0), 0);
                    
                    // [FIX] Nếu không có ngày nào > 0, lấy tổng số ngày trong khoảng lọc (để tránh chia cho 0 hoặc sai số)
                    let activeDaysCount = Object.values(subData.daily).filter(v => v > 0).length;
                    if (activeDaysCount === 0) {
                        const diffTime = Math.abs(dToObj - dFromObj);
                        activeDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
                    }

                    const calcProd = (total, days, head) => (days > 0 && head > 0) ? (total / days / head) : 0;

                    this.currentTBPTMAvgDay = {
                        gdv: calcProd(sumActual(gGDV.list), activeDaysCount, countActiveStaff(gGDV.list)),
                        sales: calcProd(sumActual(gSales.list), activeDaysCount, countActiveStaff(gSales.list)),
                        b2b: calcProd(sumActual(gB2B.list), activeDaysCount, countActiveStaff(gB2B.list))
                    };

                    this.currentStaffDataGroups = { gdv: gGDV.list, sales: gSales.list, b2b: gB2B.list };
                    this.currentKPIReportData = { sub: subData, rev: revData };
                    // Thay vì truyền [], hãy truyền dữ liệu đã tính toán được
                    this.updateSubscriberOverview(subData.breakdown ? Object.values(subData.breakdown) : [], rawData);

                    UIRenderer.renderKPIReport({ sub: subData, rev: revData }, { dFrom, dTo });
                    if (UIRenderer.renderStaffPerformance) UIRenderer.renderStaffPerformance({ gdv: gGDV, sales: gSales, b2b: gB2B });
                    
                    // [FIX] Gọi xếp hạng sau khi đã set currentFilterScope chuẩn ở trên
                    this.calculateAndRenderRankings();
                    this.renderChartsFromProcessedData(subData, revData);
                    
                    console.timeEnd("Pure_Calculation");
                    console.log(`✅ Tính toán xong cho Scope: ${isAdmin ? 'Admin' : uScope}`);

                } catch (e) {
                    console.error("Lỗi tính toán báo cáo:", e);
                }
            }, 300);
        },

        // --- CẬP NHẬT: VẼ CHART TỪ DỮ LIỆU ĐÃ XỬ LÝ ---
        renderChartsFromProcessedData(subData, revData) {

            // 1. VẼ BIỂU ĐỒ KÊNH (PIE CHART) - Hiển thị Số & %
            const preparePieData = (dataObj) => {
                const labels = Object.keys(dataObj.channel);
                const values = Object.values(dataObj.channel);
                const finalLabels = [];
                const finalValues = [];
                labels.forEach((l, i) => {
                    if (values[i] > 0) {
                        finalLabels.push(l);
                        finalValues.push(values[i]);
                    }
                });
                return { labels: finalLabels, values: finalValues };
            };

            const subPie = preparePieData(subData);
            this.renderPieChart('chartSubChannel', subPie.labels, subPie.values, 'TB theo Kênh');

            const revPie = preparePieData(revData);
            this.renderPieChart('chartRevChannel', revPie.labels, revPie.values, 'DT theo Kênh');

            // 2. VẼ BIỂU ĐỒ THỰC HIỆN VS KẾ HOẠCH (MIXED CHART)
            const prepareMixedData = (dataObj) => {
                const arr = Object.keys(dataObj.cluster).map(key => {
                    const item = dataObj.cluster[key];
                    const name = this.getNameCum(key) || this.getNameLienCum(key) || key;
                    const percent = item.plan > 0 ? (item.actual / item.plan) * 100 : 0;
                    return {
                        name: name,
                        actual: item.actual,
                        plan: item.plan,
                        percent: percent
                    };
                });

                arr.sort((a, b) => b.percent - a.percent);
                const topArr = arr.slice(0, 15);

                return {
                    labels: topArr.map(x => x.name),
                    actuals: topArr.map(x => x.actual),
                    plans: topArr.map(x => x.plan)
                };
            };

            const subMix = prepareMixedData(subData);
            this.renderMixedChart('chartSubCluster', subMix.labels, subMix.actuals, subMix.plans, 'Thuê bao');

            const revMix = prepareMixedData(revData);
            this.renderMixedChart('chartRevCluster', revMix.labels, revMix.actuals, revMix.plans, 'Doanh thu');

            // 3. VẼ BIỂU ĐỒ XU HƯỚNG (LINE)
            const renderLine = (targetData, canvasId, label) => {
                const sortedDates = Object.keys(targetData.daily).sort();
                const values = sortedDates.map(d => targetData.daily[d]);
                const labels = sortedDates.map(d => {
                    const parts = d.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
                });

                if (sortedDates.length === 0 && targetData.actual > 0) {
                    this.renderTrendChart(canvasId, label, targetData.actual);
                } else {
                    this.renderChartInstance(canvasId, 'line', labels, values, label);
                }
            };
            renderLine(subData, 'chartSubDaily', 'Phát triển TB');
            renderLine(revData, 'chartRevDaily', 'Doanh thu');
        },

        // Helper: Vẽ biểu đồ Kết hợp (Actual = Bar, Plan = Line)
        renderMixedChart(canvasId, labels, actualData, planData, labelName) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;

            if (this.chartInstances[canvasId]) {
                this.chartInstances[canvasId].destroy();
            }

            this.chartInstances[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Thực hiện',
                            data: actualData,
                            backgroundColor: '#3b82f6',
                            order: 2
                        },
                        {
                            label: 'Kế hoạch',
                            data: planData,
                            type: 'line',
                            borderColor: '#ef4444',
                            borderWidth: 2,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#ef4444',
                            pointRadius: 4,
                            fill: false,
                            tension: 0.1,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    if (context.dataset.type === 'bar') {
                                        const index = context.dataIndex;
                                        const plan = context.chart.data.datasets[1].data[index];
                                        const actual = context.raw;
                                        if (plan > 0) {
                                            const pct = ((actual / plan) * 100).toFixed(1);
                                            return `Hoàn thành: ${pct}%`;
                                        }
                                    }
                                    return null;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        },

        // Helper: Vẽ biểu đồ (Chart.js Wrapper)
        renderChartInstance(canvasId, type, labels, data, labelName) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;

            if (this.chartInstances[canvasId]) {
                this.chartInstances[canvasId].destroy();
            }

            const bgColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

            const config = {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        label: labelName,
                        data: data,
                        backgroundColor: type === 'line' ? 'rgba(59, 130, 246, 0.1)' : (type === 'bar' ? '#3b82f6' : bgColors),
                        borderColor: type === 'line' ? '#3b82f6' : undefined,
                        borderWidth: 1,
                        fill: type === 'line',
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: type !== 'bar', position: 'bottom' }
                    },
                    scales: (type === 'bar' || type === 'line') ? { y: { beginAtZero: true } } : {}
                }
            };

            this.chartInstances[canvasId] = new Chart(ctx, config);
        },

        // Helper: Vẽ biểu đồ Xu hướng (Fallback)
        renderTrendChart(canvasId, labelName, totalValue) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            if (this.chartInstances[canvasId]) this.chartInstances[canvasId].destroy();

            const labels = [];
            const data = [];
            const today = new Date();
            let remain = totalValue;

            for (let i = 6; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
                if (i === 0) data.push(remain);
                else {
                    const val = Math.floor(remain / (i + 1) * (0.8 + Math.random() * 0.4));
                    data.push(val);
                    remain -= val;
                }
            }

            this.chartInstances[canvasId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: labelName,
                        data: data,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        },

        // Helper: Vẽ biểu đồ Tròn (Hiển thị % và Giá trị)
        renderPieChart(canvasId, labels, data, labelName) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;

            if (this.chartInstances[canvasId]) {
                this.chartInstances[canvasId].destroy();
            }

            const bgColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

            const total = data.reduce((a, b) => a + b, 0);

            this.chartInstances[canvasId] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: bgColors,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map(function(label, i) {
                                            const meta = chart.getDatasetMeta(0);
                                            const ds = data.datasets[0];
                                            const arc = meta.data[i];
                                            const value = ds.data[i];
                                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

                                            return {
                                                text: `${label}: ${new Intl.NumberFormat('vi-VN').format(value)} (${percent}%)`,
                                                fillStyle: ds.backgroundColor[i],
                                                hidden: isNaN(ds.data[i]) || meta.data[i].hidden,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw;
                                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${new Intl.NumberFormat('vi-VN').format(value)} (${percent}%)`;
                                }
                            }
                        }
                    }
                }
            });
        },

       // 1. Hàm Helper: Tạo HTML cho ảnh thumbnail
        // ------------------------------------------------------------------
        // Hàm Helper: Tạo HTML cho ảnh thumbnail
        // Hàm Helper: Tạo HTML cho ảnh thumbnail
        _convertDriveLink(url) {
            if (!url) return '';
            
            // 1. Nếu link đã là link trực tiếp (có đuôi ảnh) hoặc không phải link Drive -> giữ nguyên
            if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null || !url.includes('google.com')) {
                return url;
            }

            // 2. Tách ID từ link Google Drive
            // Hỗ trợ cả link /d/xxxx và id=xxxx
            const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
            
            if (idMatch && idMatch[1]) {
                const fileId = idMatch[1];
                
                // [ĐÃ SỬA]: Thêm https, domain lh3 và cú pháp ${fileId}
                return `https://lh3.googleusercontent.com/d/${fileId}=s220`;
            }

            return url; 
        },
        // ------------------------------------------------------------------
        // CẬP NHẬT: Hàm Render Thumb (Đã gọi hàm convert ở trên)
        // ------------------------------------------------------------------
        _renderThumb(url, altText) {
            if (url && url.length > 10) {
                // [QUAN TRỌNG]: Gọi hàm chuyển đổi link ở đây
                const directLink = this._convertDriveLink(url);

                return `
                    <div class="relative group cursor-pointer w-10 h-10" onclick="app.viewImage('${url}')">
                        <img src="${directLink}" alt="${altText}" 
                            class="w-full h-full rounded-lg object-cover border border-slate-200 shadow-sm group-hover:scale-150 group-hover:z-50 transition-all duration-200 origin-center bg-white"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='https://placehold.co/40x40?text=Error';">
                    </div>
                `;
            } else {
                return `
                    <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                        <i data-lucide="image" class="w-5 h-5"></i>
                    </div>
                `;
            }
        },

        renderStoreList(customData = null) {
            console.log("🚀 Rendering Store List (Secured Version - Fixed)...");
            
            // 1. Lấy dữ liệu
            let data;
                if (customData) {
                    data = customData;
                } else {
                    const rawData = this.cachedData.stores || [];
                    data = this.filterDataByScope(rawData);
                }

                const tbody = document.getElementById('store-list-body');
                if (!tbody) return;

            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-500">Không tìm thấy dữ liệu cửa hàng.</td></tr>';
                return;
            }

            // --- KHAI BÁO CÁC HÀM HELPER CỤC BỘ (QUAN TRỌNG) ---
            
            // 1. Hàm bảo mật HTML (Định nghĩa tại chỗ để tránh lỗi this.escapeHTML is not a function)
            const escapeHTML = (str) => {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            // 2. Helper render ảnh thumbnail
            const renderThumb = (url, label) => {
                if (!url || url.length < 5) return `<div class="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300" title="Không có ảnh ${label}"><i data-lucide="image-off" class="w-4 h-4"></i></div>`;
                
                // Xử lý link Google Drive thumbnail nếu cần
                let displayUrl = url;
                if (url.includes('drive.google.com')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) displayUrl = `https://lh3.googleusercontent.com/d/${match[1]}=s100`;
                }

                return `
                    <div class="relative w-8 h-8 group-img cursor-pointer border border-slate-200 rounded overflow-hidden hover:scale-[3] hover:z-50 hover:shadow-xl transition-all bg-white"
                        title="${label}"
                        onclick="event.stopPropagation(); window.open('${url}', '_blank')">
                        <img src="${displayUrl}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/100?text=Error'">
                    </div>
                `;
            };

            // 3. Helper lấy tên Cụm an toàn (tránh lỗi nếu app chưa load xong map)
            const getSafeName = (code, map) => {
                if (!code) return '-';
                return (this[map] && this[map][code]) ? this[map][code] : code;
            };

            let html = '';
            
            data.forEach((s) => {
                // --- XỬ LÝ DỮ LIỆU AN TOÀN (Dùng hàm escapeHTML vừa khai báo ở trên) ---
                const tenCH = escapeHTML(s.ten || 'CH Chưa tên');
                const maCH = escapeHTML(s.id || s.maCH);
                const diaChi = escapeHTML(s.diaChi || '-');
                const cht = escapeHTML(s.cht || '-');
                const sdt = escapeHTML(s.sdt || '');
                
                // Các trường logic
                const imgNgoai = s.AnhNgoai || s.imgOutside || s.anhNgoai || '';
                const imgTrong = s.AnhTrong || s.imgInside || s.anhTrong || '';
                const loai = escapeHTML(s.loaiCh || 'CHTT'); 
                
                // Style cho loại cửa hàng
                const loaiClass = loai === 'CHTT' 
                    ? 'bg-blue-50 text-blue-700 border-blue-100' 
                    : 'bg-purple-50 text-purple-700 border-purple-100';

                // Xử lý Giờ mở cửa
                const safeGioMo = escapeHTML(s.gioMo || '');

                // Tên Cụm/Liên Cụm (Dùng helper getSafeName)
                const tenLC = escapeHTML(getSafeName(s.maLienCum, 'mapLienCum')); 
                const tenCum = escapeHTML(getSafeName(s.maCum, 'mapCum'));

                // Xử lý ngày hết hạn
                let contractBadge = '<span class="text-xs text-slate-400">Chưa rõ</span>';
                let dateText = '-';
                
                if (s.ngayHetHan) {
                    // Check nếu formatDateForInput có tồn tại global không, nếu không dùng raw string
                    dateText = (typeof window.formatDateForInput === 'function') 
                                ? formatDateForInput(s.ngayHetHan) 
                                : escapeHTML(s.ngayHetHan);

                    // Tính ngày còn lại
                    const today = new Date();
                    const endDate = new Date(s.ngayHetHan);
                    if (!isNaN(endDate)) {
                        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                        
                        if (daysLeft < 0) contractBadge = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">Quá hạn</span>`;
                        else if (daysLeft < 30) contractBadge = `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">Còn ${daysLeft} ngày</span>`;
                        else contractBadge = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">Còn ${daysLeft} ngày</span>`;
                    }
                }

                // Link bản đồ
                const linkMap = (s.lat && s.lng) 
                    ? `<a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" class="text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 mt-1"><i data-lucide="map-pin" class="w-3 h-3"></i> Bản đồ</a>` 
                    : '';

                // --- RENDER HTML ---
                html += `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 transition group align-top">
                        
                        <td class="px-4 py-3">
                            <div class="flex flex-col gap-1.5">
                                <span class="font-bold text-slate-700 text-sm group-hover:text-blue-700 transition cursor-pointer" onclick="app.openEditStoreModal('${maCH}')">
                                    ${tenCH}
                                </span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                        ${maCH}
                                    </span>
                                    <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${loaiClass}">
                                        ${loai}
                                    </span>
                                </div>
                            </div>
                        </td>

                        <td class="px-4 py-3 text-sm text-slate-600">
                            <div class="flex flex-col gap-0.5">
                                <span class="font-medium text-slate-800">${tenLC}</span>
                                <span class="text-xs text-slate-400">${tenCum}</span>
                            </div>
                        </td>

                        <td class="px-4 py-3">
                            <div class="flex flex-col">
                                <span class="text-sm font-medium text-slate-700">${cht}</span>
                                ${sdt ? `<a href="tel:${sdt}" class="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"><i data-lucide="phone" class="w-3 h-3"></i> ${sdt}</a>` : ''}
                            </div>
                        </td>

                        <td class="px-4 py-3 max-w-[220px]">
                            <div class="flex flex-col">
                                <div class="text-sm text-slate-600 line-clamp-2 leading-relaxed" title="${diaChi}">${diaChi}</div>
                                ${linkMap}
                                
                                ${safeGioMo ? `
                                <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-start gap-1.5 w-full group/time" title="${safeGioMo}">
                                    <i data-lucide="clock" class="w-3 h-3 text-slate-400 mt-0.5 shrink-0"></i>
                                    <span class="text-[11px] text-slate-500 truncate cursor-pointer hover:text-blue-700 transition font-medium">
                                        ${safeGioMo}
                                    </span>
                                </div>
                                ` : ''}
                            </div>
                        </td>

                        <td class="px-4 py-3">
                            <div class="flex flex-col items-start gap-1">
                                ${contractBadge}
                                <span class="text-[10px] text-slate-400">Hết hạn: <b class="text-slate-600">${dateText}</b></span>
                            </div>
                        </td>

                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2 justify-end">
                                ${renderThumb(imgNgoai, 'Ngoại thất')}
                                ${renderThumb(imgTrong, 'Nội thất')}
                                
                                <button onclick="app.openEditStoreModal('${maCH}')" class="ml-2 p-1.5 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded text-slate-400 transition shadow-sm" title="Chỉnh sửa thông tin">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            if(window.lucide) lucide.createIcons();
        },

        // ============================================================
        // 4. BUSINESS DATA & USER LOGS (CÁC TRANG DỮ LIỆU KHÁC)
        // ============================================================

        async loadUserLogPage() {
            const logs = this.normalizeDataSet(await DataService.getKPILogs());
            this.cachedLogData = logs;
            const stats = {};
            logs.forEach(l => {
                if (l.maCum && l.maNV && this.checkScope(l)) {
                    if (!stats[l.maCum]) stats[l.maCum] = new Set();
                    stats[l.maCum].add(l.maNV);
                }
            });
            const arr = Object.keys(stats).map(k => ({ maCum: k, tenCum: this.getNameCum(k), userCount: stats[k].size }));
            UIRenderer.renderClusterStats(arr);
            UIRenderer.renderUserLogFilter(arr.map(s => s.maCum).sort());
            UIRenderer.renderKPIUserLogs([]);
        },

        handleUserFilterChange(cum) {
            if (!cum) { UIRenderer.renderKPIUserLogs([]); return; }
            const users = new Map();
            this.cachedLogData.filter(l => l.maCum === cum).forEach(l => {
                const id = l.maNV || l.MaNV;
                if (id) {
                    if (!users.has(id)) users.set(id, { maNV: id, maCum: cum, channels: new Set(), totalLogs: 0 });
                    const u = users.get(id);
                    if (l.channelType) u.channels.add(l.channelType.split('-')[0].trim());
                    u.totalLogs++;
                }
            });
            UIRenderer.renderKPIUserLogs(Array.from(users.values()).map(u => ({ ...u, channelStr: Array.from(u.channels).join(', ') })));
        },

        // ============================================================
        // 5. UI & NAVIGATION & MOBILE (GIAO DIỆN)
        // ============================================================

        toggleSidebar() {
        // Đảo ngược trạng thái
        this.isSidebarOpen = !this.isSidebarOpen;
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');

        // Safety check: Nếu không tìm thấy element thì dừng, tránh lỗi JS
        if (!sidebar) return;

        if (this.isSidebarOpen) {
            // --- TRẠNG THÁI MỞ (MOBILE) ---
            // Loại bỏ class ẩn để hiện menu
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            // --- TRẠNG THÁI ĐÓNG ---
            // Thêm class ẩn
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
        },

        closeSidebarOnMobile() {
            if (window.innerWidth < 768 && this.isSidebarOpen) {
                this.toggleSidebar();
            }
        },

        toggleFullScreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((err) => {
                    console.error(`Error enabling full-screen: ${err.message}`);
                    alert("Không thể mở chế độ toàn màn hình trên trình duyệt này.");
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        },

        toggleWidgetFullScreen: function(btn) {
            // 1. Xác định Widget cha (thẻ div chứa class bg-white...)
            // Tìm element cha gần nhất có class 'bg-white' và 'rounded-xl' (cấu trúc trong HTML của bạn)
            const widget = btn.closest('.bg-white.rounded-xl'); 
            
            if (!widget) {
                console.error("Không tìm thấy Widget container!");
                return;
            }

            // 2. Kiểm tra trạng thái hiện tại
            const isFullScreen = widget.classList.contains('widget-fullscreen');

            if (!isFullScreen) {
                // === MỞ FULL SCREEN ===
                
                // a. Tạo Placeholder để giữ chỗ trên layout cũ (chống vỡ layout)
                const placeholder = document.createElement('div');
                placeholder.className = 'widget-placeholder';
                // Copy kích thước hiện tại
                placeholder.style.width = widget.offsetWidth + 'px';
                placeholder.style.height = widget.offsetHeight + 'px';
                
                // b. Lưu tham chiếu placeholder vào widget để dùng khi đóng
                widget._placeholder = placeholder;
                
                // c. Chèn placeholder vào trước widget
                widget.parentNode.insertBefore(placeholder, widget);
                
                // d. Di chuyển Widget ra BODY (Đây là bước quan trọng nhất để thoát khỏi stacking context)
                document.body.appendChild(widget);
                
                // e. Thêm class style
                widget.classList.add('widget-fullscreen');
                document.body.classList.add('widget-fullscreen-open');
                
                // f. Đánh dấu header để style lại (nếu cần)
                const header = widget.querySelector('.border-b');
                if(header) header.classList.add('widget-header');

                // g. Đổi icon nút bấm (Maximize -> Minimize)
                // Xóa nội dung cũ của nút và thay bằng icon thu nhỏ (X hoặc thu nhỏ)
                btn.innerHTML = `<i data-lucide="minimize-2" class="w-5 h-5 text-red-500"></i>`;
                btn.title = "Thu nhỏ / Đóng";
                btn.classList.add('bg-slate-100', 'hover:bg-red-50'); // Style nút đóng nổi bật hơn

            } else {
                // === ĐÓNG FULL SCREEN (THU NHỎ) ===
                
                // a. Xóa class
                widget.classList.remove('widget-fullscreen');
                document.body.classList.remove('widget-fullscreen-open');
                
                const header = widget.querySelector('.widget-header');
                if(header) header.classList.remove('widget-header');

                // b. Đưa Widget về lại vị trí cũ (thay thế placeholder)
                if (widget._placeholder && widget._placeholder.parentNode) {
                    // Animation trượt về (nếu muốn cầu kỳ hơn có thể dùng Web Animations API ở đây)
                    widget._placeholder.parentNode.insertBefore(widget, widget._placeholder);
                    widget._placeholder.remove();
                } else {
                    // Fallback nếu mất placeholder (hiếm gặp)
                    console.warn("Mất placeholder, đưa về cuối dashboard-charts");
                    const container = document.getElementById('dashboard-infrastructure') || document.body;
                    container.appendChild(widget);
                }
                
                // c. Xóa tham chiếu
                delete widget._placeholder;

                // d. Đổi icon nút bấm về cũ (Maximize)
                btn.innerHTML = `<i data-lucide="maximize-2" class="w-4 h-4"></i>`;
                btn.title = "Phóng to";
                btn.classList.remove('bg-slate-100', 'hover:bg-red-50');
            }

            // 3. Re-render Icon (Lucide) và Resize Chart
            if (window.lucide) window.lucide.createIcons();
            
            // Trigger sự kiện resize để Chart.js tự vẽ lại kích thước mới
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                
                // Nếu bạn dùng Chart.js instance cụ thể, có thể gọi .resize() thủ công nếu cần
                // Object.values(app.chartInstances).forEach(chart => chart.resize());
            }, 100);
        },

        navigate(pageId) {
            console.log("Navigating to:", pageId);
            this.closeSidebarOnMobile();

            if (pageId === 'system' && this.currentUser.role !== 'admin') return alert("Không có quyền!");

            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const link = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
            if (link) link.classList.add('active');

            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            const view = document.getElementById(`view-${pageId}`);
            if (view) {
                view.classList.remove('hidden');
                this.updateTitle(pageId);
                this.loadDataForPage(pageId);
            }
        },

        updateTitle(pageId) {
            const t = {
                'dashboard': 'TỔNG QUAN', 'business_data': 'SỐ LIỆU KINH DOANH', 'clusters': 'QUẢN LÝ HẠ TẦNG',
                'direct_channel': 'QUẢN LÝ KÊNH TRỰC TIẾP', 'indirect_channel': 'QUẢN LÝ KÊNH GIÁN TIẾP', 'bts': 'QUẢN LÝ TRẠM BTS'
            };
            document.getElementById('page-title').textContent = t[pageId] || 'Trang Quản Trị';
        },

        // ============================
    // CẬP NHẬT: loadDataForPage (ĐÃ FIX SCOPE DASHBOARD)
    // ============================
        async loadDataForPage(pageId) {
            // Lấy thông tin User hiện tại
            const uScope = (this.currentUser?.scope || 'all').toString().trim();
            const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');
            
            // Xác định Scope mặc định: Admin thì 'all', User thì lấy đúng mã của họ
            const initialScope = isAdmin ? 'all' : uScope;

            if (pageId === 'dashboard') {
                const sel = document.getElementById('dashboard-scope-select'); 
                
                // 1. Set giá trị cho Dropdown (nếu có) theo đúng quyền user
                if (sel) {
                    sel.value = initialScope;
                    
                    // Nếu không phải Admin, disable để không chọn 'all' được (tuỳ chọn)
                    if (!isAdmin) {
                        // sel.disabled = true; 
                    }
                }

                // 2. Cập nhật state hiện tại
                this.currentFilterScope = initialScope;

                // 3. Gọi render giao diện Dashboard
                UIRenderer.renderDashboard(initialScope); 

                // [QUAN TRỌNG] Cập nhật số liệu Cửa hàng/Hạ tầng ngay khi vào trang
                // <--- BẮT ĐẦU THÊM MỚI --->
                if (typeof this.updateInfrastructureStats === 'function') {
                    this.updateInfrastructureStats();
                }
                // <--- KẾT THÚC THÊM MỚI --->

                this.initKPIReportTab();
                const btn = document.querySelector('[onclick*="dash-overview"]');
                if (btn) this.switchTab('dash-overview', btn);
            }
            
            else if (pageId === 'clusters') {
                UIRenderer.renderClusterTable(this.filterDataByScope(this.fullClusterData));
            }
            else if (pageId === 'direct_channel') {
                const defaultBtn = document.querySelector('[onclick*="tab-stores"]');
                if (defaultBtn) {
                    this.switchTab('tab-stores', defaultBtn);
                }
            }
            else if (pageId === 'indirect_channel') {
                UIRenderer.renderIndirectTable(this.filterDataByScope(this.cachedData.indirect));
            }
            else if (pageId === 'bts') {
                UIRenderer.renderBTSTable(this.filterDataByScope(this.cachedData.bts || []));
                this.initBTSFilterControls();
            }
        },
        // ============================================================
    // [NEW] HÀM CẬP NHẬT SỐ LIỆU HẠ TẦNG (DASHBOARD)
    // ============================================================
        updateInfrastructureStats() {
            console.log("📊 Updating Infrastructure Stats...");

            // 1. Helper: Gán text an toàn
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = UIRenderer.formatNumber(val);
            };

            // 2. Lấy dữ liệu đã lọc theo Scope
            const stores = this.filterDataByScope(this.cachedData.stores || []);
            const gdvs = this.filterDataByScope(this.cachedData.gdvs || []);
            const sales = this.filterDataByScope(this.cachedData.sales || []);
            const bts = this.filterDataByScope(this.cachedData.bts || []);

            // --- A. TÍNH TOÁN CỬA HÀNG ---
            let stTotal = stores.length;
            let stType1 = 0;
            let stType2 = 0;
            let stExp = 0;
            let stNoImg = 0;

            const now = new Date();
            const warningDate = new Date();
            warningDate.setDate(now.getDate() + 30); // Cảnh báo trước 30 ngày

            stores.forEach(s => {
                // 1. Phân loại (Logic: Tên loại có chứa '1' hoặc 'Flagship' là Loại 1, còn lại Loại 2)
                const loai = String(s.loaiCh || '').toUpperCase();
                if (loai.includes('1') || loai.includes('FLAGSHIP') || loai.includes('L1')) {
                    stType1++;
                } else {
                    stType2++;
                }

                // 2. Kiểm tra Hạn Hợp Đồng
                if (s.ngayHetHan) {
                    const d = this._parseAnyDate(s.ngayHetHan);
                    if (d && d <= warningDate) {
                        stExp++;
                    }
                }

                // 3. Kiểm tra Hình ảnh (Thiếu 1 trong 2 là tính thiếu)
                const hasOut = s.AnhNgoai || s.imgOutside || s.anhNgoai;
                const hasIn = s.AnhTrong || s.imgInside || s.anhTrong;
                if (!hasOut || !hasIn) {
                    stNoImg++;
                }
            });

            // Update UI Cửa hàng
            setTxt('infra-store-total', stTotal);
            setTxt('infra-store-type1', stType1);
            setTxt('infra-store-type2', stType2);
            setTxt('infra-store-contract-exp', stExp);
            setTxt('infra-store-no-img', stNoImg);

            // --- B. TÍNH TOÁN GDV ---
            setTxt('infra-gdv-total', gdvs.length);
            const chtCount = gdvs.filter(g => String(g.chucVu || '').toLowerCase().includes('trưởng')).length;
            setTxt('infra-gdv-cht', chtCount);
            setTxt('infra-gdv-staff', gdvs.length - chtCount);

            // --- C. TÍNH TOÁN NV BÁN HÀNG ---
            setTxt('infra-sales-total', sales.length);
            const amCount = sales.filter(s => String(s.chucVu || '').toUpperCase().includes('AM')).length;
            setTxt('infra-sales-am', amCount);
            setTxt('infra-sales-staff', sales.length - amCount);

            // --- D. TÍNH TOÁN BTS ---
            setTxt('infra-bts-total', bts.length);
        },

        // ===========================
        // [NEW LOGS] Tab click logger
        // ===========================
        _logTabClick(tabId, btn, extra = {}) {
            const ts = new Date().toISOString();
            const user = this.currentUser || {};
            const btnText = btn ? (btn.innerText || btn.textContent || '').trim() : '';
            console.groupCollapsed(`[TAB_CLICK] ${tabId} | ${ts}`);
            console.log("User:", { name: user.name, role: user.role, scope: user.scope });
            console.log("Button:", btnText);
            console.log("Extra:", extra);
            console.trace("Stack (click path)");
            console.groupEnd();
        },

        _logTabData(tag, payload = {}) {
            const ts = new Date().toISOString();
            console.groupCollapsed(`[TAB_DATA] ${tag} | ${ts}`);
            Object.keys(payload).forEach(k => console.log(`${k}:`, payload[k]));
            console.groupEnd();
        },

        // Trong main.js - Thay thế đoạn switchTab cũ
        switchTab(tabId, btn) {
            const p = btn.closest('.view-section');
            if (!p) return;

            // Ẩn/hiện nội dung tab
            p.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.remove('hidden');

            // Active tab button
            p.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Dashboard: Tab 2 (Biểu đồ & Số liệu)
            if (tabId === 'dash-charts') {
                this.initKPIReportTab();
            }

            // --- KHỐI XỬ LÝ KÊNH TRỰC TIẾP (ĐÃ TỐI ƯU GENERIC) ---
            if (tabId === 'tab-sales') {
                const data = this.filterDataByScope(this.cachedData.sales || []);
                // Gọi hàm generic bên UIRenderer (đảm bảo file ui-renderer.js đã có hàm này)
                UIRenderer.renderStaffTable(data, 'sales-list-body', 'sales');
            }
            
            if (tabId === 'tab-b2b') {
                const data = this.filterDataByScope(this.cachedData.b2b || []);
                UIRenderer.renderStaffTable(data, 'b2b-list-body', 'common'); // B2B dùng chung logic hiển thị cơ bản
            }
            
            if (tabId === 'tab-gdv') {
                const data = this.filterDataByScope(this.cachedData.gdvs || []);
                UIRenderer.renderStaffTable(data, 'gdv-list-body', 'gdv');
            }
            
            if (tabId === 'tab-stores') {
                // Store có logic hiển thị khác biệt (ảnh, bản đồ) nên giữ nguyên hoặc tách riêng
                this.renderStoreList(); 
            }
        },


        updateUserInterface() {
            const user = this.currentUser;
            document.getElementById('sidebar-user-name').textContent = user.name;
            document.getElementById('sidebar-user-role').textContent = user.role === 'admin' ? 'Administrator' : `User: ${user.scope}`;
            document.body.classList.remove('is-admin', 'is-view', 'is-manager');
            document.body.classList.add(`is-${user.role}`);
            const sysMenu = document.querySelector('.system-menu-only');
            if (sysMenu) sysMenu.style.display = user.role === 'admin' ? 'flex' : 'none';
        },

        renderFooter() {
            if (!document.getElementById('app-footer')) {
                document.body.insertAdjacentHTML('beforeend', `<div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50"> hoang.lehuu | Ver LunarNY.2026 </div>`);
            }
        },

        // ============================================================
        // 6. HELPER & UTILS
        // ============================================================
        normalizeDataSet(data) {
            if (!Array.isArray(data)) return [];
            return data.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => newRow[key.trim()] = row[key]);
                return newRow;
            });
        },
        getMapLink(lat, lng) {
            const la = Number(String(lat ?? '').replace(',', '.'));
            const lo = Number(String(lng ?? '').replace(',', '.'));
            if (!isFinite(la) || !isFinite(lo)) return '';
            // [FIXED] Correct Google Maps URL
            return `https://maps.google.com/?q=${la},${lo}`;
        },

        // Chuẩn hoá dữ liệu BTS để hỗ trợ hiển thị toạ độ Google Maps (lat/lng)
        normalizeBTSData(rows) {
            const pickCI = (row, ...aliases) => {
                if (!row) return '';
                const lmap = {};
                Object.keys(row).forEach(k => { lmap[k.toLowerCase()] = k; });
                for (const a of aliases) {
                    if (!a) continue;
                    if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') return row[a];
                    const lk = lmap[String(a).toLowerCase()];
                    if (lk && row[lk] !== undefined && row[lk] !== null && String(row[lk]).trim() !== '') return row[lk];
                }
                return '';
            };

            const normCoord = (v) => {
                if (v === null || v === undefined) return '';
                let s = String(v).trim();
                if (!s) return '';
                s = s.replace(/,/g, '.').replace(/\s+/g, '');
                return s;
            };

            return (rows || []).map(r => {
                const lat = pickCI(r, 'lat', 'latitude', 'viDo', 'vido', 'vĩ độ', 'toado_lat', 'toadoLat', 'x');
                const lng = pickCI(r, 'lng', 'long', 'longitude', 'kinhDo', 'kinhdo', 'kinh độ', 'toado_lng', 'toadoLng', 'y');

                const maLC = pickCI(r, 'maLienCum', 'maliencum', 'lienCum');
                const maC = pickCI(r, 'maCum', 'macum', 'cum');

                return {
                    ...r,
                    maLienCum: (maLC || r.maLienCum || '').toString().trim(),
                    maCum: (maC || r.maCum || '').toString().trim(),
                    lat: normCoord(lat || r.lat),
                    lng: normCoord(lng || r.lng),
                };
            });
        },

        async _getSheetData(cacheKey, methodName) {
            try {
                const svc =
                    (typeof window !== "undefined" && window.DataService) ||
                    (typeof DataService !== "undefined" ? DataService : null);

                if (svc && typeof svc[methodName] === "function") {
                    return await svc[methodName]();
                }
                if (svc && typeof svc.ensureData === "function") {
                    return await svc.ensureData();
                }
                const c = (svc && (svc._cache || svc.cache)) || {};
                return c?.[cacheKey] || c?.[cacheKey.replace(/_/g, "")] || [];
            } catch (e) {
                console.warn(`Không lấy được dữ liệu sheet: ${cacheKey}`, e);
                return [];
            }
        },

        parseDateKey(dateStr) {
            if (!dateStr) return { full: '', month: '' };
            let y, m, d;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length >= 2) {
                    d = parts[0].padStart(2, '0');
                    m = parts[1].padStart(2, '0');
                    y = parts[2];
                    if (y.length === 2) y = '20' + y;
                }
            } else if (dateStr.includes('-')) {
                return { full: dateStr.substring(0, 10), month: dateStr.substring(0, 7) };
            }
            if (y && m) return { full: `${y}-${m}-${d || '01'}`, month: `${y}-${m}` };
            return { full: dateStr, month: dateStr };
        },

       buildDictionary() {
            this.fullClusterData.forEach(lc => {
                // Lưu cả mã gốc và mã đã "dọn dẹp" (viết hoa, xóa khoảng trắng)
                if (lc.maLienCum) {
                    this.mapLienCum[lc.maLienCum] = lc.tenLienCum;
                    this.mapLienCum[this.cleanCode(lc.maLienCum)] = lc.tenLienCum;
                }
                if (lc.cums && Array.isArray(lc.cums)) {
                    lc.cums.forEach(c => { 
                        if (c.maCum) {
                            this.mapCum[c.maCum] = c.tenCum; 
                            this.mapCum[this.cleanCode(c.maCum)] = c.tenCum; 
                        }
                    });
                }
            });
        },

        getNameLienCum(code) { 
            if (!code) return '';
            // Ưu tiên tìm mã gốc, nếu không thấy thì tìm mã đã dọn dẹp
            return this.mapLienCum[code] || this.mapLienCum[this.cleanCode(code)] || code; 
        },
        
        getNameCum(code) { 
            if (!code) return '';
            return this.mapCum[code] || this.mapCum[this.cleanCode(code)] || code; 
        },
        cleanCode(code) { return String(code || '').trim().toUpperCase().replace('KPI_', ''); },

        // CẬP NHẬT: filterDataByScope (Áp dụng logic checkScope chuẩn)
        // ============================================================
        filterDataByScope(data) {
            const user = this.currentUser || {};
            const role = user.role || 'view';
            const scopeRaw = (user.scope || 'all').toString().trim();

            if (role === 'admin' || scopeRaw === 'all') return data || [];

            const scope = this.cleanCode(scopeRaw);

            if (!Array.isArray(data) || data.length === 0) return [];

            // A. Xử lý danh sách Cấu trúc Cụm (Hierarchy - mảng lồng nhau)
            if (data[0] && Array.isArray(data[0].cums)) {
                return data.map(lc => {
                    const maLC = this.cleanCode(lc.maLienCum);
                    
                    // Nếu User là Liên Cụm -> Lấy cả cục
                    if (maLC === scope) return lc;

                    // Nếu không, lọc mảng con cums
                    const matchingCums = (lc.cums || []).filter(c => {
                        const maC = this.cleanCode(c.maCum);
                        return maC === scope;
                    });

                    if (matchingCums.length > 0) {
                        return { ...lc, cums: matchingCums };
                    }
                    return null;
                }).filter(Boolean);
            }

            // B. Xử lý danh sách phẳng (Flat list - Stores, GDV, BTS...)
            // [FIX]: Sử dụng chính hàm checkScope để tận dụng logic tra cứu cha-con
            return data.filter(item => this.checkScope(item));
        },
       
        // ============================================================
        // CẬP NHẬT: checkScope (Thêm Logic tra cứu cha con)
        // ============================================================
        checkScope(item) {
            const user = this.currentUser || {};
            const role = user.role || 'view';
            const userScope = this.cleanCode(user.scope || 'all');

            // Admin hoặc User ALL được xem hết
            if (role === 'admin' || userScope === 'ALL') return true;

            // Lấy mã của item
            const itemLC = this.cleanCode(item?.maLienCum || item?.maliencum || item?.lienCum);
            const itemCum = this.cleanCode(item?.maCum || item?.macum || item?.cum);
            const itemNV = this.cleanCode(item?.maNV || item?.manv);

            // 1. Khớp mã Liên Cụm
            if (itemLC === userScope) return true;

            // 2. Khớp mã Cụm
            if (itemCum === userScope) return true;

            // 3. Khớp mã Nhân viên (xem cá nhân)
            if (itemNV === userScope) return true;

            // [FIX QUAN TRỌNG]: Logic suy luận cha-con
            // Nếu User là Liên Cụm, nhưng Item dữ liệu bị thiếu cột maLienCum (chỉ có maCum)
            // -> Kiểm tra xem maCum đó có thuộc về Liên Cụm của User không.
            if (itemCum && !itemLC) {
                // Kiểm tra userScope có phải là một mã Liên Cụm hợp lệ trong hệ thống không
                if (this.mapLienCum && this.mapLienCum.hasOwnProperty(userScope)) {
                    const parentLC = this.getParentLienCum(itemCum); // Hàm tra cứu ngược
                    if (this.cleanCode(parentLC) === userScope) return true;
                }
            }

            return false;
        },

        initKPIObj(keys) { return keys.reduce((acc, k) => ({ ...acc, [`${k}_TH`]: 0, [`${k}_KH`]: 0 }), {}); },
        calcPercent(actual, plan) {
            if (!plan || plan === 0) return actual > 0 ? 100 : 0;
            return ((actual / plan) * 100).toFixed(1);
        },
        getParentLienCum(cumCode) {
            for (const lc of this.fullClusterData) {
                if (lc.cums.some(c => c.maCum === cumCode)) return lc.maLienCum;
            }
            return null;
        },

        // 7. MODAL & SEARCH HANDLERS (UPDATED)
        // ============================================================

        currentEditingIndirectId: null,

        openEditIndirectModal(id) {
        // 1. Tìm item trong cache
        const list = this.cachedData.indirect || [];
        // Tìm kiếm linh hoạt (String/Number)
        const item = list.find(i => String(i.id) == String(id) || String(i.maDL) == String(id));

        if (!item) {
            console.error("❌ Không tìm thấy item với ID:", id);
            return alert("Không tìm thấy dữ liệu điểm bán này!");
        }

        // Lưu ID đang sửa vào biến toàn cục
        this.currentEditingIndirectId = item.id || item.maDL; 

        // 2. Helper tìm key (giữ nguyên - rất tốt)
        const pick = (row, ...aliases) => {
            if (!row) return '';
            const lmap = {};
            Object.keys(row).forEach(k => { lmap[k.toLowerCase()] = k; });
            for (const a of aliases) {
                const lk = lmap[String(a).toLowerCase()];
                if (lk && row[lk] !== undefined && row[lk] !== null) return row[lk];
            }
            return '';
        };

        const setVal = (domId, val) => { 
            const el = document.getElementById(domId); 
            if(el) el.value = val || ''; 
        };

        // --- 3. ĐIỀN DỮ LIỆU ---
        setVal('edit-indirect-code', pick(item, 'maDL', 'maCode', 'code', 'id'));

        // === [BỔ SUNG QUAN TRỌNG] Đổ dữ liệu vào 2 ô Cụm mới thêm ở HTML ===
        setVal('edit-indirect-liencum', pick(item, 'maLienCum', 'lienCum', 'LienCum', 'maliencum'));
        setVal('edit-indirect-cum', pick(item, 'maCum', 'cum', 'Cum', 'macum'));
        // ===================================================================

        setVal('edit-indirect-name', pick(item, 'ten', 'Ten', 'tenDl'));
        setVal('edit-indirect-phone', pick(item, 'sdt', 'SDT', 'phone')); 
        setVal('edit-indirect-address', pick(item, 'diaChi', 'DiaChi', 'address'));
        
        // Tách tọa độ
        const lat = pick(item, 'lat', 'Lat', 'vido');
        const lng = pick(item, 'lng', 'Lng', 'kinhdo');
        setVal('indirect-lat', lat);
        setVal('indirect-lng', lng);

        // Map đúng tên trường
        setVal('edit-indirect-route', pick(item, 'tuyen', 'Tuyen')); 
        setVal('edit-indirect-class', pick(item, 'phanloai', 'Phanloai', 'PhanLoai')); 
        setVal('edit-indirect-type', pick(item, 'loai', 'Loai')); 
        setVal('edit-indirect-owner', pick(item, 'chuSoHuu', 'ChuSoHuu', 'chu')); 

        // 4. Xử lý ảnh (Reset trước khi show)
        if(document.getElementById('file-outside')) document.getElementById('file-outside').value = '';
        if(document.getElementById('file-inside')) document.getElementById('file-inside').value = '';

        // Kiểm tra hàm showPreviewImage có tồn tại không trước khi gọi
        if (typeof this.showPreviewImage === 'function') {
            this.showPreviewImage('outside', pick(item, 'anhNgoai', 'AnhNgoai', 'imgOutside'));
            this.showPreviewImage('inside', pick(item, 'anhTrong', 'AnhTrong', 'imgInside'));
        }
        
        // 5. Mở Modal
        const modal = document.getElementById('modal-edit-indirect');
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex', 'open', 'animate-fade-in');
        }
    },

        showPreviewImage(type, src) {
            const imgEl = document.getElementById(`img-preview-${type}`);
            const phEl = document.getElementById(`placeholder-${type}`);
            
            // [FIXED] Thêm bước chuyển đổi link Drive giống như Popup Cửa hàng
            const safeUrl = this._convertDriveLink(src);

            if (safeUrl && safeUrl.length > 10) {
                imgEl.src = safeUrl; 
                imgEl.classList.remove('hidden'); 
                phEl.classList.add('hidden');
            } else {
                imgEl.src = ''; // Clear src thừa
                imgEl.classList.add('hidden'); 
                phEl.classList.remove('hidden');
            }
        },
        handleImagePreview(input, type) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { this.showPreviewImage(type, e.target.result); }
                reader.readAsDataURL(input.files[0]);
            }
        },

        // ============================================================
        // 1. Thêm hàm xem ảnh (cho tiện)
        viewImage(url) {
            if (url) window.open(url, '_blank');
        },

        // 1. Biến tạm lưu ảnh
        tempStoreImages: { trong: null, ngoai: null },

        // --- 1. Hàm Mở Modal ---
        openEditStoreModal(storeId) {
            console.log("🚀 [OpenEditStore] Đang mở cho ID:", storeId);

            // A. TÌM MODAL & FIX VỊ TRÍ
            const modal = document.getElementById('modal-edit-store');
            if (!modal) return alert("❌ Lỗi: Không tìm thấy HTML Modal id='modal-edit-store'!");

            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }

            // B. TÌM DỮ LIỆU STORE
            if (!this.cachedData || !this.cachedData.stores) {
                return alert("Dữ liệu đang tải, vui lòng thử lại sau!");
            }
            
            const store = this.cachedData.stores.find(s => 
                String(s.id) === String(storeId) || String(s.maCH) === String(storeId)
            );

            if (!store) return alert("Không tìm thấy dữ liệu cửa hàng này!");

            // C. ĐIỀN DỮ LIỆU VÀO FORM
            const setVal = (domId, val) => {
                const el = document.getElementById(domId);
                if (el) el.value = val || '';
            };

            setVal('store-id', store.id || store.maCH);
            setVal('store-ten', store.ten);
            setVal('store-diaChi', store.diaChi); // <--- Đã có input để điền vào
            
            const elLoai = document.getElementById('store-loaiCh');
            if (elLoai) elLoai.value = store.loaiCh || 'CHTT'; // Mặc định CHTT nếu thiếu

            setVal('store-cht', store.cht);
            setVal('store-sdt', store.sdt);
            setVal('store-email', store.email);

            setVal('store-lat', store.lat);
            setVal('store-lng', store.lng);
            setVal('store-ngayThue', formatDateForInput(store.ngayThue));
            setVal('store-ngayHetHan', formatDateForInput(store.ngayHetHan));

            // D. XỬ LÝ ẢNH
            this.tempStoreImages = { trong: null, ngoai: null }; 
            
            // Reset input file
            modal.querySelectorAll('input[type="file"]').forEach(i => i.value = '');

            // Setup hiển thị ảnh (Dùng hàm helper có sẵn trong class của bạn)
            if (typeof this._setupStoreImagePreview === 'function') {
                this._setupStoreImagePreview('trong', store.AnhTrong || store.anhtrong);
                this._setupStoreImagePreview('ngoai', store.AnhNgoai || store.anhngoai);
            } else {
                // Fallback nếu hàm helper chưa define (phòng hờ)
                const imgT = document.getElementById('preview-store-trong');
                const holderT = document.getElementById('placeholder-store-trong');
                if(store.AnhTrong) { imgT.src = store.AnhTrong; imgT.classList.remove('hidden'); holderT.classList.add('hidden'); }
                else { imgT.classList.add('hidden'); holderT.classList.remove('hidden'); }
                
                const imgN = document.getElementById('preview-store-ngoai');
                const holderN = document.getElementById('placeholder-store-ngoai');
                if(store.AnhNgoai) { imgN.src = store.AnhNgoai; imgN.classList.remove('hidden'); holderN.classList.add('hidden'); }
                else { imgN.classList.add('hidden'); holderN.classList.remove('hidden'); }
            }

            // E. HIỂN THỊ MODAL
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            modal.style.zIndex = '9999'; 
            
            // Reset nút Save
            const btnLoad = document.getElementById('btn-save-loading');
            const btnSave = document.getElementById('btn-save-store');
            if(btnLoad) btnLoad.classList.add('hidden');
            if(btnSave) btnSave.disabled = false;

            console.log("✅ Đã mở Modal. Store:", store.ten);
        },

        /**
         * 2. Hàm Helper nội bộ: Xử lý hiển thị/ẩn ảnh vs placeholder
         * (Dùng chung cho lúc mở modal và lúc chọn ảnh mới)*/

        _setupStoreImagePreview(type, url) {
            // type: 'trong' hoặc 'ngoai'
            const imgEl = document.getElementById(`preview-store-${type}`);
            const placeholderEl = document.getElementById(`placeholder-store-${type}`);

            if (!imgEl || !placeholderEl) return;

            // [QUAN TRỌNG]: Chuyển đổi link Drive trước khi hiển thị
            // Gọi hàm _convertDriveLink để lấy link lh3.googleusercontent...
            const safeUrl = this._convertDriveLink(url);

            // Kiểm tra URL hợp lệ (có dữ liệu và dài hơn 10 ký tự)
            if (safeUrl && safeUrl.length > 10) {
                imgEl.src = safeUrl; // Gán link đã chuyển đổi
                imgEl.classList.remove('hidden');
                placeholderEl.classList.add('hidden');

                // --- [FIX] LOGIC CLICK ĐỂ XEM ẢNH LỚN ---
                imgEl.style.cursor = 'pointer'; // Thêm con trỏ tay
                imgEl.title = "Bấm để xem ảnh gốc";
                
                // Xóa sự kiện cũ (nếu có) để tránh double click
                imgEl.onclick = null; 
                
                // Gán sự kiện mới
                imgEl.onclick = function() {
                    // Mở ảnh trong tab mới
                    window.open(safeUrl, '_blank');
                };
            } else {
                // Không có ảnh -> Hiện placeholder
                imgEl.src = '';
                imgEl.classList.add('hidden');
                placeholderEl.classList.remove('hidden');
                
                // Bỏ sự kiện click
                imgEl.onclick = null;
                imgEl.style.cursor = 'default';
            }
        },

        /**
         * 3. Hàm xử lý sự kiện khi người dùng chọn file ảnh mới
         * Được gọi từ HTML: onchange="app.handleStoreImageInput(this, 'trong')"
         */
        async handleStoreImageInput(input, type) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                
                // 1. Validate dung lượng đầu vào (giữ nguyên)
                if (file.size > 5 * 1024 * 1024) {
                    alert("File ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.");
                    input.value = ''; 
                    return;
                }

                // 2. [FIX] Gọi hàm nén ảnh thay vì đọc file gốc
                try {
                    // Hiển thị loading nhẹ nếu cần
                    console.log(`📸 Đang nén ảnh ${type}...`);
                    
                    // Gọi hàm nén (đã có sẵn ở cuối file main.js)
                    const compressedBase64 = await this.compressImage(file);
                    
                    if (compressedBase64) {
                        // Lưu vào biến tạm (thêm prefix data:image...)
                        if (!this.tempStoreImages) this.tempStoreImages = {};
                        this.tempStoreImages[type] = `data:image/jpeg;base64,${compressedBase64}`;

                        // Hiển thị preview ngay
                        this._setupStoreImagePreview(type, this.tempStoreImages[type]);
                        console.log(`✅ Đã nén và lưu ảnh ${type}`);
                    }
                } catch (e) {
                    console.error("Lỗi nén ảnh:", e);
                    alert("Không thể xử lý ảnh này. Vui lòng thử ảnh khác!");
                }
            }
        },

        /**
         * 4. Hàm đóng Modal (Helper tiện ích)
         * Được gọi từ HTML: onclick="app.closeModal('modal-edit-store')"
         */
        closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('hidden');
            }
        },

        /**
         * 5. Hàm Lưu thay đổi (Đã Fix: Gọi API thực tế)
         */
        async saveStoreChanges() {
        // 1. UI FEEDBACK: HIỆN TRẠNG THÁI "ĐANG LƯU"
        const btnSave = document.getElementById('btn-save-store');
        const btnText = document.getElementById('btn-save-text');
        const btnLoad = document.getElementById('btn-save-loading');

        if (btnSave) {
            btnSave.disabled = true; // Chặn click liên tục
            if (btnText) btnText.innerText = "Đang lưu dữ liệu...";
            if (btnLoad) btnLoad.classList.remove('hidden'); // Hiện vòng xoay
        }

        try {
            const storeId = document.getElementById('store-id').value;
            // Helper lấy giá trị an toàn từ input
            const newVal = (id) => { 
                const el = document.getElementById(id); 
                return el ? el.value.trim() : ""; 
            };

            // 2. THU THẬP DỮ LIỆU (Đã bổ sung DiaChi)
            const payload = {
                id: storeId,
                // --- Thông tin cơ bản ---
                ten: newVal('store-ten'),
                loaiCh: newVal('store-loaiCh'),
                diaChi: newVal('store-diaChi'), // <=== ĐÃ BỔ SUNG TRƯỜNG ĐỊA CHỈ
                
                // --- Liên hệ ---
                cht: newVal('store-cht'),
                sdt: newVal('store-sdt'),
                email: newVal('store-email'),
                
                // --- Vị trí & Hạn thuê ---
                lat: newVal('store-lat'),
                lng: newVal('store-lng'),
                ngayThue: newVal('store-ngayThue'),   // YYYY-MM-DD
                ngayHetHan: newVal('store-ngayHetHan'), // YYYY-MM-DD
            };

            // 3. XỬ LÝ ẢNH & KIỂM TRA BASE64 (Logic cũ của bạn)
            if (!this.tempStoreImages) this.tempStoreImages = {};
            // Nếu có ảnh mới (Base64) thì đưa vào payload gửi lên server
            if (this.tempStoreImages.ngoai) payload.imgOutside = this.tempStoreImages.ngoai;
            if (this.tempStoreImages.trong) payload.imgInside = this.tempStoreImages.trong;

            console.log("📤 Đang gửi cập nhật:", payload);

            // 4. GỌI API
            // (Giả sử DataService.updateStore đã được định nghĩa đúng bên file service)
            const response = await DataService.updateStore(payload);

            if (response && response.success) {
                // 5. CẬP NHẬT CACHE & GIAO DIỆN NGAY LẬP TỨC
                if (this.cachedData && this.cachedData.stores) {
                    const storeIndex = this.cachedData.stores.findIndex(s => String(s.id) === String(storeId) || String(s.maCH) === String(storeId));
                    
                    if (storeIndex !== -1) {
                        // Merge thông tin mới (payload) vào thông tin cũ trong Cache
                        // Việc này đảm bảo DiaChi, Ten, Lat, Lng... cập nhật ngay trên bảng
                        let currentStore = this.cachedData.stores[storeIndex];
                        
                        this.cachedData.stores[storeIndex] = { 
                            ...currentStore, 
                            ...payload 
                        };

                        // Fix hiển thị ảnh ngay lập tức (Ưu tiên hiển thị Base64 vừa chọn)
                        if (payload.imgOutside) {
                            this.cachedData.stores[storeIndex].AnhNgoai = payload.imgOutside; 
                        }
                        if (payload.imgInside) {
                            this.cachedData.stores[storeIndex].AnhTrong = payload.imgInside;
                        }
                    }
                }

                // Render lại bảng danh sách nếu đang ở tab Cửa hàng
                // (Gọi hàm render của UIRenderer để bảng cập nhật dòng vừa sửa)
                if (window.UIRenderer && typeof UIRenderer.renderStoresTable === 'function') {
                    // Tìm đúng thẻ tbody để render lại (hoặc render lại cả bảng tuỳ logic cũ)
                    const tbody = document.getElementById('store-list-body');
                    if(tbody) UIRenderer.renderStoresTable(this.cachedData.stores);
                }

                alert("✅ Đã cập nhật thông tin cửa hàng thành công!");
                this.closeModal('modal-edit-store');

            } else {
                throw new Error(response.error || "Lỗi server không xác định");
            }

        } catch (e) {
            console.error("Lỗi Save Store:", e);
            alert("⚠️ Không thể lưu: " + e.message);
        } finally {
            // 6. TẮT HIỆU ỨNG LOADING (Dù thành công hay thất bại)
            if (btnSave) {
                btnSave.disabled = false;
                if (btnText) btnText.innerText = "Lưu Cập Nhật"; // Trả lại text gốc
                if (btnLoad) btnLoad.classList.add('hidden');
            }
        }
        },
        // ============================================================
        // HÀM LƯU DỮ LIỆU (ĐÃ FIX: BỔ SUNG GỬI CỤM/LIÊN CỤM)
        // ============================================================

        async saveIndirectChannel() {
            // --- 1. LẤY ID BẢN GHI GỐC ---
            const oldId = this.currentEditingIndirectId; 
            if (!oldId) return alert("❌ Lỗi: Không xác định được ID bản ghi gốc.");

            // Tìm Item gốc để backup dữ liệu nếu form nhập thiếu
            const originalItem = (this.cachedData.indirect || []).find(i => String(i.id) == String(oldId) || String(i.maDL) == String(oldId));
            
            // Helper lấy dữ liệu gốc an toàn
            const getOriginalVal = (keys) => {
                if (!originalItem) return '';
                for (let k of keys) {
                    if (originalItem[k] !== undefined && originalItem[k] !== null) return originalItem[k];
                }
                return '';
            };

            // --- 2. LẤY DỮ LIỆU TỪ FORM (ĐÃ CHUẨN HÓA ID) ---
            const codeInput = document.getElementById('edit-indirect-code')?.value.trim();
            const newId = codeInput || oldId; 

            const name = document.getElementById('edit-indirect-name')?.value.trim();
            const phone = document.getElementById('edit-indirect-phone')?.value.trim();
            const address = document.getElementById('edit-indirect-address')?.value.trim();

            // --- BẮT ĐẦU ĐOẠN THAY THẾ ---
            // Lấy giá trị Loại và Phân loại từ form
            const loai = document.getElementById('edit-indirect-loai')?.value.trim() || '';
            const phanLoai = document.getElementById('edit-indirect-phanloai')?.value.trim() || '';
            // --- KẾT THÚC ĐOẠN THAY THẾ ---

            const tuyen = document.getElementById('edit-indirect-route')?.value;
            const chu = document.getElementById('edit-indirect-owner')?.value;
            // Tọa độ (Sửa ID: thêm 'edit-' nếu HTML của bạn dùng pattern này)
            const latVal = document.getElementById('edit-indirect-lat')?.value.trim() || document.getElementById('indirect-lat')?.value.trim();
            const lngVal = document.getElementById('edit-indirect-lng')?.value.trim() || document.getElementById('indirect-lng')?.value.trim();

            // Cụm/Liên Cụm
            const valLienCum = document.getElementById('edit-indirect-liencum')?.value || getOriginalVal(['maLienCum', 'maliencum', 'lienCum']);
            const valCum = document.getElementById('edit-indirect-cum')?.value || getOriginalVal(['maCum', 'macum', 'cum']);

            // [DEBUG] In ra để xem Client có lấy được dữ liệu không?
            console.log("📝 Form Data Check:", { name, phone, address, latVal, lngVal });

            // Validate cơ bản
            if ((latVal && isNaN(latVal)) || (lngVal && isNaN(lngVal))) {
                return alert("⚠️ Tọa độ phải là số (VD: 10.762)!");
            }

            // --- 3. UI LOADING ---
            const saveBtn = document.querySelector('#modal-edit-indirect .btn-save') || 
                            document.querySelector('#modal-edit-indirect button[onclick*="save"]');
            let oldBtnContent = 'Lưu thay đổi';
            if (saveBtn) {
                oldBtnContent = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<i class="animate-spin mr-2">⏳</i> Đang xử lý & Gửi...`;
            }

            try {
                // --- 4. XỬ LÝ ẢNH (NÉN & BASE64) ---
                const fileOutInput = document.getElementById('file-outside');
                const fileInInput = document.getElementById('file-inside');
                
                let imgOutBase64 = null;
                let imgInBase64 = null;

                // Hàm nén ảnh (giả định bạn đã có this.compressImage)
                if (fileOutInput && fileOutInput.files.length > 0) {
                    try {
                        console.log("📸 Đang nén ảnh ngoài...");
                        imgOutBase64 = await this.compressImage(fileOutInput.files[0]);
                    } catch (e) { console.error(e); }
                }
                
                if (fileInInput && fileInInput.files.length > 0) {
                    try {
                        console.log("📸 Đang nén ảnh trong...");
                        imgInBase64 = await this.compressImage(fileInInput.files[0]);
                    } catch (e) { console.error(e); }
                }

                // --- 5. TẠO PAYLOAD (ĐÃ CHUẨN HÓA KEY CHO SERVER) ---
                // Key ở đây phải khớp với logic map cột ở Server
                const payload = {
                    action: 'update_indirect',
                    data: {
                        oldMaDL: oldId, // Key tìm dòng
                        maDL: newId,    // Key cập nhật
                        
                        // Các trường thông tin (dùng key chữ thường cho lành)
                        ten: name,
                        sdt: phone,           
                        diachi: address,      
                        lat: latVal,          
                        lng: lngVal,          
                        tuyen: tuyen,         
                        phanloai: phanLoai,   
                        loai: loai,           
                        chusohuu: chu,        
                        maliencum: valLienCum,
                        macum: valCum,

                        // Ảnh
                        imgOutside: imgOutBase64, 
                        imgInside: imgInBase64    
                    }
                };

                console.log("🚀 Payload sending to Server:", payload); // Kiểm tra payload cuối cùng

                // Gọi API
                const response = await DataService.postData(payload);

                // --- 6. XỬ LÝ KẾT QUẢ (ĐÃ SỬA OPTIMISTIC UI) ---
                if (response && (response.status === 'success' || response.result === 'success' || response.id)) {
                    
                    // 1. Thông báo & Đóng Modal
                    alert("✅ Cập nhật thành công!");
                    this.closeModal('modal-edit-indirect');
                    
                    // 2. CHUẨN BỊ DỮ LIỆU MỚI ĐỂ CẬP NHẬT GIAO DIỆN NGAY
                    // (Tạo object từ các biến bạn đã lấy từ form ở trên)
                    const updatedItem = {
                        ...originalItem, // Giữ lại các trường cũ không bị sửa
                        id: newId,
                        maDL: newId,
                        maCode: newId,
                        
                        ten: name,
                        sdt: phone,
                        diaChi: address,
                        lat: latVal,
                        lng: lngVal,
                        tuyen: tuyen,
                        phanloai: phanLoai, // Chú ý: key phải khớp với hàm render (chữ thường)
                        loai: loai,
                        chuSoHuu: chu,
                        
                        maLienCum: valLienCum,
                        maCum: valCum,
                        
                        // Xử lý ảnh: Nếu có ảnh mới upload (Base64) thì dùng, không thì giữ ảnh cũ
                        // Lưu ý: Base64 cần thêm prefix để hiển thị được ngay
                        anhNgoai: imgOutBase64 ? `data:image/jpeg;base64,${imgOutBase64}` : (originalItem ? (originalItem.anhNgoai || originalItem.imgOutside) : ''),
                        anhTrong: imgInBase64 ? `data:image/jpeg;base64,${imgInBase64}` : (originalItem ? (originalItem.anhTrong || originalItem.imgInside) : '')
                    };

                    // 3. CẬP NHẬT VÀO BỘ NHỚ CACHE (QUAN TRỌNG NHẤT)
                    if (!this.cachedData.indirect) this.cachedData.indirect = [];
                    
                    // Tìm vị trí dòng cũ
                    const index = this.cachedData.indirect.findIndex(i => String(i.id) == String(oldId) || String(i.maDL) == String(oldId));

                    if (index !== -1) {
                        // TRƯỜNG HỢP SỬA: Ghi đè dữ liệu mới vào dòng cũ
                        this.cachedData.indirect[index] = updatedItem;
                        console.log("🔄 Đã cập nhật cache tại dòng:", index);
                    } else {
                        // TRƯỜNG HỢP MỚI: Thêm vào đầu danh sách
                        this.cachedData.indirect.unshift(updatedItem);
                        console.log("➕ Đã thêm mới vào cache");
                    }

                    // 4. VẼ LẠI BẢNG NGAY LẬP TỨC
                    // Lọc lại theo Scope (để đảm bảo nếu sửa Cụm sang cụm khác thì nó tự ẩn đi nếu không thuộc quyền xem)
                    const dataToShow = this.filterDataByScope(this.cachedData.indirect);
                    
                    // Nếu đang có từ khóa tìm kiếm thì lọc lại luôn
                    const searchInput = document.querySelector('input[placeholder*="Tìm kiếm"]'); // Tìm ô search
                    if (searchInput && searchInput.value) {
                        this.handleSearchIndirect(searchInput.value);
                    } else {
                        UIRenderer.renderIndirectTable(dataToShow);
                    }

                } else {
                    alert("❌ Server báo lỗi: " + (response.message || response.error || JSON.stringify(response)));
                }

            } catch (error) {
                console.error("Critical Save Error:", error);
                alert("❌ Lỗi ứng dụng: " + error.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = oldBtnContent;
                }
            }
        },

        // ============================================================
    
            // --- Helper: Chuyển file sang Base64 ---
        toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]); // Lấy phần data sau dấu phẩy
                reader.onerror = error => reject(error);
            });
        },
       // --- HÀM MỚI: NÉN ẢNH (ROBUST VERSION) ---
        compressImage(file, maxWidth = 1024, quality = 0.7) {
            return new Promise((resolve, reject) => {
                // 1. Kiểm tra đầu vào
                if (!file) return resolve(null);
                
                // 2. Kiểm tra loại file (Chỉ chấp nhận ảnh)
                if (!file.type.match(/image.*/)) {
                    return reject(new Error("File không phải là ảnh hợp lệ (JPG/PNG)!"));
                }

                const reader = new FileReader();
                
                // 3. Xử lý lỗi khi đọc file
                reader.onerror = (error) => {
                    console.error("FileReader Error:", error);
                    reject(new Error("Không thể đọc file. File có thể bị hỏng hoặc bị khóa."));
                };

                reader.onload = (event) => {
                    const img = new Image();
                    
                    // 4. Xử lý lỗi khi load ảnh vào bộ nhớ (VD: Ảnh HEIC trình duyệt không hiểu)
                    img.onerror = (e) => {
                        console.error("Image Load Error:", e);
                        reject(new Error("Không thể xử lý ảnh này. Hãy thử ảnh JPG hoặc PNG khác."));
                    };

                    img.src = event.target.result;
                    
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;

                            // Tính toán tỉ lệ
                            if (width > height) {
                                if (width > maxWidth) {
                                    height *= maxWidth / width;
                                    width = maxWidth;
                                }
                            } else {
                                if (height > maxWidth) {
                                    width *= maxWidth / height;
                                    height = maxWidth;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;

                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);

                            // Xuất Base64
                            const dataUrl = canvas.toDataURL('image/jpeg', quality);
                            const base64 = dataUrl.split(',')[1];
                            resolve(base64);
                        } catch (err) {
                            reject(new Error("Lỗi trong quá trình nén ảnh: " + err.message));
                        }
                    };
                };
                
                reader.readAsDataURL(file);
            });
        },
        
        showStaffDetailModal(type) {
            if (!this.currentStaffDataGroups || !this.currentStaffDataGroups[type]) return alert("Không có dữ liệu!");
            const data = this.currentStaffDataGroups[type];
            let title = "Chi tiết Nhân viên";
            if (type === 'gdv') title = "Hiệu suất Giao Dịch Viên";
            if (type === 'sales') title = "Hiệu suất NV Bán Hàng";
            if (type === 'b2b') title = "Hiệu suất NV KHDN (B2B)";

            document.getElementById('modal-detail-title').textContent = title;
            document.getElementById('modal-detail-subtitle').textContent = `Số lượng: ${data.length} nhân sự`;

            UIRenderer.renderDetailModalContent('staff-performance', data);
            document.getElementById('modal-detail-list').classList.add('open');
        },

        handleDashboardFilter(scope) {
            // 1. Cập nhật Scope hiện tại
            this.currentFilterScope = scope;

            // 2. Render lại các biểu đồ/bảng trong Dashboard (nếu UIRenderer hỗ trợ)
            UIRenderer.renderDashboard(scope);

            // [QUAN TRỌNG] Tính lại số liệu Cửa hàng/Hạ tầng theo Scope mới chọn
            // <--- BẮT ĐẦU THÊM MỚI --->
            if (typeof this.updateInfrastructureStats === 'function') {
                this.updateInfrastructureStats();
            }
            // <--- KẾT THÚC THÊM MỚI --->

            // 3. Tính lại bảng xếp hạng
            this.calculateAndRenderRankings();
        },

        showKPIBreakdown(type, viewLevel = 'cum') {
            if (!this.currentKPIReportData || !this.currentKPIReportData[type]) return;
            const rawBreakdown = this.currentKPIReportData[type].breakdown;
            let list = [];

            if (viewLevel === 'cum') {
                list = Object.keys(rawBreakdown).map(code => ({
                    code: code, name: this.getNameCum(code) || code,
                    actual: rawBreakdown[code].actual, plan: rawBreakdown[code].plan,
                    percent: this.calcPercent(rawBreakdown[code].actual, rawBreakdown[code].plan)
                }));
            } else {
                const agg = {};
                Object.keys(rawBreakdown).forEach(cumCode => {
                    const lcCode = this.getParentLienCum(cumCode) || 'KHÁC';
                    if (!agg[lcCode]) agg[lcCode] = { actual: 0, plan: 0 };
                    agg[lcCode].actual += rawBreakdown[cumCode].actual;
                    agg[lcCode].plan += rawBreakdown[cumCode].plan;
                });
                list = Object.keys(agg).map(code => ({
                    code: code, name: this.getNameLienCum(code) || code,
                    actual: agg[code].actual, plan: agg[code].plan,
                    percent: this.calcPercent(agg[code].actual, agg[code].plan)
                }));
            }
            list.sort((a, b) => b.actual - a.actual);

            const labelType = type === 'sub' ? 'Thuê bao' : 'Doanh thu';
            document.getElementById('modal-detail-title').textContent = `Chi tiết ${labelType} - Thực hiện vs Kế hoạch`;
            document.getElementById('modal-detail-subtitle').textContent = `Dữ liệu tổng hợp theo: ${viewLevel === 'cum' ? 'Cụm' : 'Liên Cụm'}`;

            UIRenderer.renderDetailModalContent('kpi-breakdown', list, { type, viewLevel });
            document.getElementById('modal-detail-list').classList.add('open');
        },

        handleChannelChartClick(type, channelName, viewLevel = 'cum') {
            if (!this.currentKPIReportData || !this.currentKPIReportData[type]) return;
            const breakdownData = this.currentKPIReportData[type].breakdown;
            let list = [];

            if (viewLevel === 'cum') {
                list = Object.keys(breakdownData).map(cumCode => {
                    const cumData = breakdownData[cumCode];
                    const val = cumData.channels[channelName] || 0;
                    if (val <= 0) return null;
                    return {
                        code: cumCode, name: this.getNameCum(cumCode) || cumCode,
                        value: val, total: cumData.actual,
                        percent: this.calcPercent(val, cumData.actual)
                    };
                }).filter(Boolean);
            } else {
                const agg = {};
                Object.keys(breakdownData).forEach(cumCode => {
                    const lcCode = this.getParentLienCum(cumCode) || 'KHÁC';
                    const val = breakdownData[cumCode].channels[channelName] || 0;
                    if (!agg[lcCode]) agg[lcCode] = { value: 0, total: 0 };
                    agg[lcCode].value += val;
                    agg[lcCode].total += breakdownData[cumCode].actual;
                });
                list = Object.keys(agg).map(lcCode => {
                    if (agg[lcCode].value <= 0) return null;
                    return {
                        code: lcCode, name: this.getNameLienCum(lcCode) || lcCode,
                        value: agg[lcCode].value, total: agg[lcCode].total,
                        percent: this.calcPercent(agg[lcCode].value, agg[lcCode].total)
                    };
                }).filter(Boolean);
            }
            list.sort((a, b) => b.value - a.value);

            const labelType = type === 'sub' ? 'Thuê bao' : 'Doanh thu';
            document.getElementById('modal-detail-title').textContent = `Chi tiết ${labelType} - Kênh: ${channelName}`;
            document.getElementById('modal-detail-subtitle').textContent = `Phân bổ theo: ${viewLevel === 'cum' ? 'Cụm' : 'Liên Cụm'}`;
            UIRenderer.renderDetailModalContent('kpi-channel-detail', list, { type, channelName, viewLevel });
            document.getElementById('modal-detail-list').classList.add('open');
        },

        async initKPIReportTab() {
            const container = document.getElementById('dash-charts');
            if (container && container.dataset.initialized === "true") {
                this.handleKPIReportFilter();
                return;
            }

            const selScope = document.getElementById('filter-scope');
            const selKPI = document.getElementById('filter-kpi');
            const selChannel = document.getElementById('filter-channel');

            if (selScope && selScope.options.length <= 1) {
                let html = '<option value="all">-- Tất cả Phạm vi --</option>';
                html += '<optgroup label="--- LIÊN CỤM ---">';
                Object.keys(this.mapLienCum).forEach(k => {
                    html += `<option value="${k}">${this.mapLienCum[k]}</option>`;
                });
                html += '</optgroup><optgroup label="--- CỤM ---">';
                Object.keys(this.mapCum).forEach(k => {
                    html += `<option value="${k}">${this.mapCum[k]}</option>`;
                });
                html += '</optgroup>';
                selScope.innerHTML = html;
            }

            try {
                const [struct, logsRaw] = await Promise.all([
                    DataService.getKPIStructure(),
                    DataService.getKPILogs()
                ]);

                if (selKPI && selKPI.options.length <= 1) {
                    let kpiHtml = '<option value="all">Tất cả Chỉ tiêu</option>';
                    struct.forEach(s => {
                        if (s.active) {
                            const code = this.cleanCode(s.ma);
                            kpiHtml += `<option value="${code}">${s.tenHienThi || s.ten || code}</option>`;
                        }
                    });
                    selKPI.innerHTML = kpiHtml;
                }

                if (selChannel && selChannel.options.length <= 1) {
                    const logs = this.normalizeDataSet(logsRaw);
                    const channels = new Set();
                    logs.forEach(l => { if (l.channelType) channels.add(l.channelType.split('-')[0].trim()); });

                    let chanHtml = '<option value="all">Tất cả Kênh</option>';
                    channels.forEach(c => chanHtml += `<option value="${c}">${c}</option>`);
                    selChannel.innerHTML = chanHtml;
                }
            } catch (e) { console.error("Lỗi nạp dữ liệu bộ lọc:", e); }

            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');

            const dFrom = document.getElementById('dash-date-from');
            const dTo = document.getElementById('dash-date-to');
            if (dFrom && !dFrom.value) dFrom.value = `${y}-${m}-01`;
            if (dTo && !dTo.value) dTo.value = `${y}-${m}-${d}`;

            const filterIds = ['filter-scope', 'filter-channel', 'filter-kpi', 'dash-date-from', 'dash-date-to'];
            filterIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.onchange = () => {
                        console.log(`Update triggered by: ${id}`);
                        this.handleKPIReportFilter();
                    };
                }
            });

            if (container) container.dataset.initialized = "true";
            this.handleKPIReportFilter();
        },

       
        closeModal(id) { 
            // Nếu không truyền id, mặc định thử đóng các modal phổ biến hoặc return
            const modalId = id || 'modal-edit-ward'; 
            const modal = document.getElementById(modalId);
            
            if (modal) {
                // 1. Xóa class hiệu ứng
                modal.classList.remove('open');
                
                // 2. Chờ hiệu ứng transition (nếu có) rồi ẩn hẳn đi, hoặc ẩn ngay lập tức
                // Để an toàn và nhanh gọn, ta ẩn luôn và xóa flex
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }
        },
        openRentConfigModal() { if (this.currentUser.role === 'admin') document.getElementById('modal-rent-config').classList.add('open'); else alert('Quyền hạn chế!'); },
        saveRentConfig() { alert("Đã lưu cấu hình (Demo)!"); this.closeModal('modal-rent-config'); },

        handleSearchCluster(k) {
            k = k.toLowerCase().trim();
            let d = this.filterDataByScope(this.fullClusterData);
            if (!k) { UIRenderer.renderClusterTable(d); return; }
            const res = d.map(lc => {
                const sub = lc.cums.filter(c => (c.tenCum || '').toLowerCase().includes(k));
                if (sub.length || (lc.tenLienCum || '').toLowerCase().includes(k)) return { ...lc, cums: sub.length ? sub : lc.cums };
                return null;
            }).filter(Boolean);
            UIRenderer.renderClusterTable(res);
        },

    // ============================================================
        handleSearchIndirect(k) {
            const keyword = (k || '').toString().toLowerCase().trim();
            const sourceData = this.filterDataByScope(this.cachedData.indirect || []);

            if (!keyword) {
                UIRenderer.renderIndirectTable(sourceData);
                return;
            }

            // Hàm hỗ trợ lấy chuỗi an toàn để tìm kiếm
            const getVal = (val) => String(val || '').toLowerCase();

            // BỔ SUNG HÀM PICK TẠI ĐÂY
            // Hàm này tìm giá trị trong object dựa trên danh sách các key (không phân biệt hoa/thường)
            const pick = (row, ...keys) => {
                for (let k of keys) {
                    let lk = Object.keys(row).find(key => key.toLowerCase() === k.toLowerCase());
                    if (lk && row[lk] !== undefined && row[lk] !== null && String(row[lk]).trim() !== '') {
                        return String(row[lk]);
                    }
                }
                return '';
            };

            const filtered = sourceData.filter(item => {
                // Tìm thông tin bổ sung từ Cụm để search
                let clusterExtraInfo = "";
                const maC = pick(item, 'maCum', 'MaCum', 'cum', 'Cum');
                
                if (maC && this.fullClusterData) {
                    for (const lc of this.fullClusterData) {
                        const found = lc.cums.find(c => String(c.maCum).toUpperCase() === String(maC).toUpperCase());
                        if (found) {
                            clusterExtraInfo = (found.tenCum || "") + " " + (found.phuTrach || "");
                            break;
                        }
                    }
                }

                return (
                    getVal(item.ten).includes(keyword) ||
                    getVal(item.maDL).includes(keyword) ||
                    getVal(item.maCode).includes(keyword) ||
                    getVal(item.sdt).includes(keyword) ||
                    getVal(item.chuSoHuu).includes(keyword) ||
                    getVal(item.diaChi).includes(keyword) ||
                    getVal(item.tuyen).includes(keyword) ||
                    getVal(maC).includes(keyword) ||
                    getVal(clusterExtraInfo).includes(keyword) // Tìm được theo Tên cụm/Trưởng cụm
                );
            });

            UIRenderer.renderIndirectTable(filtered);
        },

    // [BỔ SUNG] CÁC HÀM TÌM KIẾM CÒN THIẾU
    // ============================================================

        // 1. Tìm kiếm Cửa hàng (Stores)
        handleSearchStore(k) {
            const keyword = (k || '').toString().toLowerCase().trim();
            
            // Lấy dữ liệu gốc đã được lọc theo quyền (Scope)
            const sourceData = this.filterDataByScope(this.cachedData.stores || []);

            if (!keyword) {
                // Nếu ô tìm kiếm rỗng, render lại danh sách gốc
                this.renderStoreList(null); 
                return;
            }

            // Lọc dữ liệu
            const filtered = sourceData.filter(s => {
                const ten = (s.ten || '').toLowerCase();
                const ma = (s.id || s.maCH || '').toString().toLowerCase();
                const diachi = (s.diaChi || '').toLowerCase();
                const sdt = (s.sdt || '').toString();

                return ten.includes(keyword) || 
                    ma.includes(keyword) || 
                    diachi.includes(keyword) || 
                    sdt.includes(keyword);
            });

            // Render danh sách đã lọc
            this.renderStoreList(filtered);
        },

    // 2. Tìm kiếm Nhân viên (Dùng chung cho GDV, Sales, B2B)

        handleSearchStaff(k, type) {
            const keyword = (k || '').toString().toLowerCase().trim();
            
            let sourceRaw = [];
            let renderId = '';
            let renderType = '';

            // Xác định nguồn dữ liệu dựa trên type
            if (type === 'gdv') {
                sourceRaw = this.cachedData.gdvs;
                renderId = 'gdv-list-body';
                renderType = 'gdv';
            } else if (type === 'sales') {
                sourceRaw = this.cachedData.sales;
                renderId = 'sales-list-body';
                renderType = 'sales';
            } else if (type === 'b2b') {
                sourceRaw = this.cachedData.b2b;
                renderId = 'b2b-list-body';
                renderType = 'common';
            }

            const sourceData = this.filterDataByScope(sourceRaw || []);

            // Nếu keyword rỗng -> render lại full
            if (!keyword) {
                if(window.UIRenderer) UIRenderer.renderStaffTable(sourceData, renderId, renderType);
                return;
            }

            // Lọc dữ liệu
            const filtered = sourceData.filter(s => {
                // Mapping các trường dữ liệu có thể khác nhau
                const ten = (s.ten || s.name || s.hoTen || '').toLowerCase();
                const ma = (s.maNV || s.code || s.id || '').toString().toLowerCase();
                const sdt = (s.sdt || s.phone || s.soDienThoai || '').toString();
                const cum = (s.maCum || '').toString().toLowerCase();

                return ten.includes(keyword) || 
                    ma.includes(keyword) || 
                    sdt.includes(keyword) || 
                    cum.includes(keyword);
            });

            // Gọi UIRenderer để vẽ lại bảng
            if(window.UIRenderer) UIRenderer.renderStaffTable(filtered, renderId, renderType);
        },

        handleSearchGDV(k) { this.handleSearchStaff(k, 'gdv'); },
        handleSearchSales(k) { this.handleSearchStaff(k, 'sales'); },
        handleSearchB2B(k) { this.handleSearchStaff(k, 'b2b'); },

        handleSearchBTS(k) {
            this.btsFilterState.keyword = (k || '').toString();
            this.applyBTSFilters();
        },

        // ===== BTS: Bộ lọc Liên Cụm/Cụm + tìm kiếm keyword =====
        initBTSFilterControls() {
            const view = document.getElementById('view-bts');
            if (!view) return;

            const input = this._ensureBTSSearchInputId(view);
            if (!input) return;

            const wrap = input.parentElement;
            if (!wrap) return;

            let selLC = document.getElementById('bts-filter-liencum');
            if (!selLC) {
                selLC = document.createElement('select');
                selLC.id = 'bts-filter-liencum';
                selLC.className = input.className.replace('w-60', 'w-48');
                selLC.title = 'Lọc theo Liên Cụm';
                wrap.insertBefore(selLC, input);
            }

            let selC = document.getElementById('bts-filter-cum');
            if (!selC) {
                selC = document.createElement('select');
                selC.id = 'bts-filter-cum';
                selC.className = input.className.replace('w-60', 'w-48');
                selC.title = 'Lọc theo Cụm';
                wrap.insertBefore(selC, input);
            }

            const uScope = (this.currentUser?.scope || 'all').toString().trim();
            const isLC = this.mapLienCum && this.mapLienCum.hasOwnProperty(uScope);
            const isC = this.mapCum && this.mapCum.hasOwnProperty(uScope);

            if (isLC) {
                this.btsFilterState.liencum = uScope;
                this.btsFilterState.cum = 'all';
            } else if (isC) {
                this.btsFilterState.cum = uScope;
                const parent = this.getParentLienCum(uScope);
                if (parent) this.btsFilterState.liencum = parent;
            }

            this._populateBTSLienCumOptions(selLC);
            selLC.value = this.btsFilterState.liencum || 'all';

            this._populateBTSCumOptions(selC, selLC.value || 'all');
            selC.value = this.btsFilterState.cum || 'all';

            input.value = this.btsFilterState.keyword || '';

            selLC.onchange = () => {
                this.btsFilterState.liencum = selLC.value || 'all';
                this.btsFilterState.cum = 'all';
                this._populateBTSCumOptions(selC, this.btsFilterState.liencum);
                selC.value = 'all';
                this.applyBTSFilters();
            };

            selC.onchange = () => {
                this.btsFilterState.cum = selC.value || 'all';
                if (this.btsFilterState.cum !== 'all') {
                    const p = this.getParentLienCum(this.btsFilterState.cum);
                    if (p) {
                        this.btsFilterState.liencum = p;
                        selLC.value = p;
                        this._populateBTSCumOptions(selC, p);
                        selC.value = this.btsFilterState.cum;
                    }
                }
                this.applyBTSFilters();
            };

            this.applyBTSFilters();
        },

        _ensureBTSSearchInputId(view) {
            let input = view.querySelector('input[onkeyup*="handleSearchBTS"]');
            if (!input) input = view.querySelector('input[placeholder*="BTS"], input[placeholder*="Trạm"], input[type="search"]');
            if (input && !input.id) input.id = 'bts-search-input';
            return input;
        },

        _populateBTSLienCumOptions(sel) {
            if (!sel) return;

            const uScope = (this.currentUser?.scope || 'all').toString().trim();
            const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');

            let allowed = [];
            if (isAdmin) {
                allowed = Object.keys(this.mapLienCum || {}).sort();
            } else if (this.mapLienCum && this.mapLienCum.hasOwnProperty(uScope)) {
                allowed = [uScope];
            } else if (this.mapCum && this.mapCum.hasOwnProperty(uScope)) {
                const p = this.getParentLienCum(uScope);
                allowed = p ? [p] : Object.keys(this.mapLienCum || {}).sort();
            } else {
                allowed = Object.keys(this.mapLienCum || {}).sort();
            }

            let html = '<option value="all">Tất cả Liên Cụm</option>';
            allowed.forEach(k => { html += `<option value="${k}">${this.getNameLienCum(k)}</option>`; });
            sel.innerHTML = html;
        },

        _populateBTSCumOptions(sel, lcCode = 'all') {
            if (!sel) return;

            const uScope = (this.currentUser?.scope || 'all').toString().trim();
            const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');

            if (!isAdmin && this.mapCum && this.mapCum.hasOwnProperty(uScope)) {
                sel.innerHTML = `<option value="${uScope}">${this.getNameCum(uScope)}</option>`;
                return;
            }

            let cums = [];
            const pushCum = (c) => {
                if (!c?.maCum) return;
                cums.push({ code: c.maCum, name: this.getNameCum(c.maCum) });
            };

            const lcs = this.fullClusterData || [];
            lcs.forEach(lc => {
                const maLC = (lc.maLienCum || '').toString().trim();
                const lcCodeStr = (lcCode || '').toString().trim();
                if (lcCodeStr !== 'all' && maLC !== lcCodeStr) return;

                if (!isAdmin && this.mapLienCum && this.mapLienCum.hasOwnProperty(uScope) && maLC !== uScope) return;

                (lc.cums || []).forEach(pushCum);
            });

            const seen = new Set();
            cums = cums.filter(x => x.code && !seen.has(x.code) && seen.add(x.code));
            cums.sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'vi'));

            let html = '<option value="all">Tất cả Cụm</option>';
            cums.forEach(x => { html += `<option value="${x.code}">${x.name || x.code}</option>`; });
            sel.innerHTML = html;
        },

        applyBTSFilters() {
            const state = this.btsFilterState || { keyword: '', liencum: 'all', cum: 'all' };

            let data = this.filterDataByScope(this.cachedData.bts || []);

            const lc = (state.liencum || 'all').toString().trim();
            const c = (state.cum || 'all').toString().trim();
            const key = (state.keyword || '').toString().trim().toLowerCase();

            if (lc !== 'all') data = data.filter(i => String(i.maLienCum || '').trim() === lc);
            if (c !== 'all') data = data.filter(i => String(i.maCum || '').trim() === c);

            if (key) {
                const pick = (row, ...aliases) => {
                    if (!row) return '';
                    const lmap = {};
                    Object.keys(row).forEach(k => { lmap[k.toLowerCase()] = k; });
                    for (const a of aliases) {
                        if (!a) continue;
                        if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') return row[a];
                        const lk = lmap[String(a).toLowerCase()];
                        if (lk && row[lk] !== undefined && row[lk] !== null && String(row[lk]).trim() !== '') return row[lk];
                    }
                    return '';
                };

                data = data.filter(i => {
                    const fields = [
                        pick(i, 'maTram', 'Mã Trạm', 'matram'),
                        pick(i, 'tenTram', 'Tên Trạm', 'tentram'),
                        pick(i, 'loaitram', 'loaiTram', 'Loại trạm', 'loai tram'),
                        pick(i, 'maCum', 'Mã Cụm', 'macum'),
                        pick(i, 'maLienCum', 'Mã Liên Cụm', 'maliencum'),
                        pick(i, 'tenCum', 'Tên Cụm'),
                        pick(i, 'tenLienCum', 'Tên Liên Cụm'),
                        pick(i, 'diaChi', 'Địa chỉ', 'dia chi', 'DiaChi'),
                        pick(i, 'lat', 'latitude', 'viDo', 'vĩ độ'),
                        pick(i, 'lng', 'long', 'longitude', 'kinhDo', 'kinh độ'),
                    ].map(v => (v || '').toString().toLowerCase());

                    return fields.some(v => v.includes(key));
                });
            }

            UIRenderer.renderBTSTable(data);
            if (window.lucide) lucide.createIcons();
        },

        async showDashboardDetail(type, scope) {
            let scopeType = 'liencum';

            if (scope && this.mapCum && this.mapCum.hasOwnProperty(scope)) {
                scopeType = 'cum';
            } else if (scope && String(scope).startsWith('C_')) {
                scopeType = 'cum';
            }

            const realType = type === 'geo' ? 'commune' : type;
            this.showDetailModal(realType, scope, scopeType);
        },

        // ============================================================
        // CẬP NHẬT: showDetailModal (Fix phần Commune)
        // ============================================================
        async showDetailModal(type, scope, stype) {
            let title = '';
            let detailData = [];

            // Lấy dữ liệu từ cache
            const { stores, gdvs, sales, b2b, bts, indirect } = this.cachedData || {};
            const cleanScope = this.cleanCode(scope); 
            const isViewAll = cleanScope === 'ALL';

            // Hàm lọc chung cho danh sách phẳng
            const filterFn = (item) => {
                if (!this.checkScope(item)) return false; 
                if (isViewAll) return true;
                const field = stype === 'liencum' ? 'maLienCum' : 'maCum';
                return this.cleanCode(item[field]) === cleanScope;
            };

            // --- XỬ LÝ THEO TỪNG LOẠI ---

            if (type === 'list_cum') {
                title = 'Danh sách Đơn vị trực thuộc (Cụm)';
                this.fullClusterData.forEach(lc => {
                    if (!isViewAll && this.cleanCode(lc.maLienCum) !== cleanScope) return;
                    const enrichedCums = (lc.cums || []).map(c => {
                        if (!this.checkScope(c)) return null;
                        
                        const areaAgg = (c.phuongXas || []).reduce((acc, px) => {
                            // [FIX 1]: Quét cả px.dienTich và px.dientich
                            const v = px.dienTich || px.dientich;
                            if (v === null || v === undefined || v === '') return acc;
                            const n = Number(v);
                            if (!isFinite(n)) return acc;
                            acc.sum += n; acc.count += 1; return acc;
                        }, { sum: 0, count: 0 });
                        
                        return {
                            ...c, ten: c.tenCum, tenLienCum: lc.tenLienCum,
                            vlr: (c.phuongXas || []).reduce((acc, px) => acc + (Number(px.vlr) || 0), 0),
                            // [FIX 2]: Quét cả danSo và danso
                            danSo: (c.phuongXas || []).reduce((acc, px) => acc + (Number(px.danSo || px.danso) || 0), 0),
                            dienTich: areaAgg.count ? areaAgg.sum : null,
                            lanhDao: c.phuTrach ? [{ chucVu: 'Phụ trách', ten: c.phuTrach, sdt: c.sdtCum || '' }] : []
                        };
                    }).filter(Boolean);
                    if (enrichedCums.length > 0) detailData.push(...enrichedCums);
                });
            }

            else if (type === 'commune') {
                title = 'Chi tiết Dân số & Phủ trạm theo Phường/Xã';
                
                this.fullClusterData.forEach(lc => {
                    if (stype === 'liencum' && !isViewAll && this.cleanCode(lc.maLienCum) !== cleanScope) return;

                    (lc.cums || []).forEach(c => {
                        const cToCheck = { ...c, maLienCum: lc.maLienCum };
                        if (!this.checkScope(cToCheck)) return;

                        if (stype === 'cum' && !isViewAll && this.cleanCode(c.maCum) !== cleanScope) return;

                        const enrichedPX = (c.phuongXas || []).map(px => ({
                            ...px,
                            tenLienCum: lc.tenLienCum,
                            tenCum: c.tenCum,
                            // [FIX 3]: Ép cứng biến dienTich để UI đọc chuẩn xác
                            dienTich: px.dienTich || px.dientich,
                            danSo: px.danSo || px.danso
                        }));
                        detailData.push(...enrichedPX);
                    });
                });
            }

            else if (type === 'store') { title = 'Danh sách Cửa hàng'; detailData = (stores || []).filter(filterFn); }
            else if (type === 'gdv') { title = 'Danh sách Giao dịch viên'; detailData = (gdvs || []).filter(filterFn); }
            else if (type === 'sales') { title = 'Danh sách NV Bán hàng'; detailData = (sales || []).filter(filterFn); }
            else if (type === 'b2b') { title = 'Danh sách Khách hàng Doanh nghiệp'; detailData = (b2b || []).filter(filterFn); }
            else if (type === 'bts') { title = 'Danh sách Trạm BTS'; detailData = (bts || []).filter(filterFn); }
            else if (type === 'indirect') { title = 'Danh sách Kênh Gián tiếp'; detailData = (indirect || []).filter(filterFn); }

            // --- RENDER UI ---
            const modalTitle = document.getElementById('modal-detail-title');
            const modalSubtitle = document.getElementById('modal-detail-subtitle');
            const modalList = document.getElementById('modal-detail-list');

            if (modalTitle) modalTitle.textContent = title;
            if (modalSubtitle) {
                const scopeName = isViewAll ? 'Toàn Công Ty' : (this.getNameCum(cleanScope) || this.getNameLienCum(cleanScope) || cleanScope);
                modalSubtitle.textContent = `Phạm vi: ${scopeName} | Số lượng: ${UIRenderer.formatNumber(detailData.length)}`;
            }

            UIRenderer.renderDetailModalContent(type, detailData);

            if (modalList) {
                modalList.classList.remove('hidden');
                modalList.classList.add('flex', 'open');
                if (window.lucide) window.lucide.createIcons();
            }
        },


        _excelSerialToDate(serial) {
            const n = Number(serial);
            if (!isFinite(n)) return null;
            const baseUtc = Date.UTC(1899, 11, 30);
            const ms = baseUtc + Math.round(n) * 86400000;
            const d = new Date(ms);
            if (isNaN(d)) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        },

        
        _parseAnyDate(dateVal) {
            if (dateVal === null || dateVal === undefined) return null;
            if (dateVal instanceof Date && !isNaN(dateVal)) return dateVal;
            if (typeof dateVal === 'number' && isFinite(dateVal)) {
                if (dateVal > 1e12) {
                    const d = new Date(dateVal);
                    return isNaN(d) ? null : d;
                }
                if (dateVal > 10000) {
                    return this._excelSerialToDate(dateVal);
                }
            }
            const s = String(dateVal).trim();
            if (!s) return null;
            if (/^\d+(?:\.\d+)?$/.test(s)) {
                const num = Number(s);
                if (isFinite(num)) {
                    if (num > 1e12) {
                        const d = new Date(num);
                        return isNaN(d) ? null : d;
                    }
                    if (num > 10000 && s.length <= 7) {
                        return this._excelSerialToDate(num);
                    }
                }
            }
            let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
            if (m) {
                const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                return isNaN(d) ? null : d;
            }
            m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
            if (m) {
                const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
                return isNaN(d) ? null : d;
            }
            const d = new Date(s);
            return isNaN(d) ? null : d;
        },


        _dateKey(d) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        },

        _startOfWeekMonday(d) {
            const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const day = date.getDay();
            const diff = (day === 0 ? -6 : 1) - day;
            date.setDate(date.getDate() + diff);
            date.setHours(0, 0, 0, 0);
            return date;
        },

        _addDays(d, n) {
            const x = new Date(d.getTime());
            x.setDate(x.getDate() + n);
            return x;
        },
    };

    document.addEventListener('DOMContentLoaded', () => { app.init(); });   
    window.app = app;
