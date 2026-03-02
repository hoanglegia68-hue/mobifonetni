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
        mobileBreakpoint: 1024,
        indirectRouteState: {
            route: 'all',
            period: 'month',
            map: null,
            layer: null,
            sourceData: null,
            checkinsSynced: false,
            syncingCheckins: false
        },
        storeMapState: { cum: 'all', map: null, layer: null, sourceData: null },
        indirectCheckinDistanceThresholdM: 300,
        indirectKpiHistoryRows: [],
        tablePaginationState: {},
        tablePaginationObservers: {},
        tablePaginationDefaultSize: 20,
        tablePaginationBodyIds: [
            'dashboard-breakdown-body',
            'cluster-table-body',
            'store-list-body',
            'gdv-list-body',
            'sales-list-body',
            'b2b-list-body',
            'indirect-route-kpi-body',
            'indirect-kpi-assign-body',
            'indirect-list-body',
            'bts-list-body',
            'kpi-personal-table-body',
            'weekly-report-table-body',
            'market-table-body',
            'focus-report-table-body',
            'product-table-body'
        ],

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
                    if (!btnMenu.dataset.boundSidebar) {
                        btnMenu.dataset.boundSidebar = '1';
                        btnMenu.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.toggleSidebar();
                        });
                    }
                    btnMenu.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.toggleSidebar();
                    };
                    console.log("✅ Đã kích hoạt nút Menu Mobile");
                } else {
                    console.error("❌ LỖI: Không tìm thấy nút id='mobile-menu-btn'");
                }

                // Event delegation fallback: đảm bảo nút menu vẫn hoạt động nếu DOM bị re-render
                if (!document.body.dataset.boundMobileMenuDelegated) {
                    document.body.dataset.boundMobileMenuDelegated = '1';
                    document.body.addEventListener('click', (e) => {
                        const btn = e.target && e.target.closest ? e.target.closest('#mobile-menu-btn') : null;
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        this.toggleSidebar();
                    }, true);
                }

                // 2. Xử lý Overlay (Vùng tối) - GỘP CHUNG VÀO ĐÂY
                const overlay = document.getElementById('mobile-overlay');
                if (overlay) {
                    if (!overlay.dataset.boundSidebar) {
                        overlay.dataset.boundSidebar = '1';
                        overlay.addEventListener('click', () => {
                            if (this.isSidebarOpen) this.toggleSidebar();
                        });
                    }
                }

                // 3. Xử lý khi co giãn màn hình (Resize)
                window.addEventListener('resize', () => {
                    // Nếu màn hình to lên (Desktop) mà menu đang mở kiểu mobile -> Reset lại
                    if (window.innerWidth >= this.mobileBreakpoint && this.isSidebarOpen) {
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
                this.initTablePagination_();
                this.renderFooter();

                if (window.lucide) lucide.createIcons();
                
                // Vào Dashboard
                this.navigate('dashboard');
                this.calculateAndRenderRankings();
                this.prefetchAuxiliaryData();

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
                    const normToken = (v) => String(v || '')
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, ' ')
                        .trim();
                    const classifyKpiType = (code, dvt, name) => {
                        const raw = `${normToken(code)} ${normToken(dvt)} ${normToken(name)}`.trim();
                        const compact = raw.replace(/\s+/g, '');
                        const isSub = (
                            raw.includes('thue bao') ||
                            compact.includes('thuebao') ||
                            /\btb\b/.test(raw) ||
                            compact.startsWith('tb') ||
                            raw.includes('tbptm') ||
                            raw.includes('tb ptm') ||
                            raw.includes('ptm') ||
                            raw.includes('sim') ||
                            raw.includes('cai') ||
                            raw.includes('sub') ||
                            raw.includes('phat trien moi')
                        );
                        if (isSub) return 'sub';
                        const isRev = (
                            raw.includes('doanh thu') ||
                            compact.includes('doanhthu') ||
                            raw.includes('revenue') ||
                            raw.includes('rev') ||
                            /\bdt\b/.test(raw)
                        );
                        if (isRev) return 'rev';
                        return null;
                    };
                    const typeMap = {};
                    struct.forEach(s => {
                        if (!s) return;
                        const activeRaw = String(s.active === undefined ? 'true' : s.active).trim().toLowerCase();
                        if (activeRaw === 'false' || activeRaw === '0' || activeRaw === 'no') return;
                        const k = app.cleanCode(s.ma);
                        let t = classifyKpiType(k, s.dvt, s.tenHienThi || s.ten || '');
                        if (!t) {
                            const dvt = normToken(s.dvt || '');
                            if (dvt.includes('thue bao') || /\btb\b/.test(dvt) || dvt.includes('sim') || dvt.includes('cai')) {
                                t = 'sub';
                            }
                        }
                        if (!t) t = 'rev';
                        if (k) typeMap[k] = t;
                    });
                    
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

                            let type = typeMap[kpiCode] || classifyKpiType(kpiCode, '', '');
                            if (!type) type = 'rev';
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
                            let type = typeMap[kpiCode] || classifyKpiType(kpiCode, '', '');
                            if (!type) type = 'rev';
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
                const safeOpenUrl = this.sanitizeExternalUrl(url, true);
                if (!safeOpenUrl) {
                    return `
                        <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                            <i data-lucide="image-off" class="w-5 h-5"></i>
                        </div>
                    `;
                }
                const encodedUrl = encodeURIComponent(safeOpenUrl);

                return `
                    <div class="relative group cursor-pointer w-10 h-10" onclick="app.viewImage(decodeURIComponent('${encodedUrl}'))">
                        <img src="${directLink}" alt="${altText}" 
                            class="w-full h-full rounded-lg object-cover border border-slate-200 shadow-sm group-hover:scale-150 group-hover:z-50 transition-all duration-200 origin-center bg-white"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2220%22 y=%2224%22 font-size=%229%22 text-anchor=%22middle%22 fill=%22%2364758b%22%3EImage%3C/text%3E%3C/svg%3E';">
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
                this.renderDirectStoreMap(data);
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
                const safeOriginalUrl = this.sanitizeExternalUrl(url, true);
                if (!safeOriginalUrl) return `<div class="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300" title="Link ảnh không hợp lệ"><i data-lucide="shield-alert" class="w-4 h-4"></i></div>`;
                
                // Xử lý link Google Drive thumbnail nếu cần
                let displayUrl = safeOriginalUrl;
                if (safeOriginalUrl.includes('drive.google.com')) {
                    const match = safeOriginalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || safeOriginalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) displayUrl = `https://lh3.googleusercontent.com/d/${match[1]}=s100`;
                }
                const encodedUrl = encodeURIComponent(safeOriginalUrl);

                return `
                    <div class="relative w-8 h-8 group-img cursor-pointer border border-slate-200 rounded overflow-hidden hover:scale-[3] hover:z-50 hover:shadow-xl transition-all bg-white"
                        title="${label}"
                        onclick="event.stopPropagation(); app.viewImage(decodeURIComponent('${encodedUrl}'))">
                        <img src="${displayUrl}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%22 y=%2254%22 font-size=%2212%22 text-anchor=%22middle%22 fill=%22%2364758b%22%3ENo%20Image%3C/text%3E%3C/svg%3E';">
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
                const mapUrl = this.getMapLink(s.lat, s.lng);
                const linkMap = mapUrl
                    ? `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 mt-1"><i data-lucide="map-pin" class="w-3 h-3"></i> Bản đồ</a>` 
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
            this.renderDirectStoreMap(data);
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

        initTablePagination_() {
            if (this._tablePaginationInitialized) return;
            this._tablePaginationInitialized = true;
            this._tablePaginationTimers = this._tablePaginationTimers || {};

            const ids = Array.isArray(this.tablePaginationBodyIds) ? this.tablePaginationBodyIds : [];
            ids.forEach((tbodyId) => {
                const tbody = document.getElementById(tbodyId);
                if (!tbody) return;
                if (this.tablePaginationObservers[tbodyId]) {
                    try { this.tablePaginationObservers[tbodyId].disconnect(); } catch (e) {}
                }
                const obs = new MutationObserver(() => this._queueApplyTablePagination_(tbodyId));
                obs.observe(tbody, { childList: true });
                this.tablePaginationObservers[tbodyId] = obs;
                this._queueApplyTablePagination_(tbodyId);
            });
        },

        _queueApplyTablePagination_(tbodyId) {
            if (!tbodyId) return;
            this._tablePaginationTimers = this._tablePaginationTimers || {};
            if (this._tablePaginationTimers[tbodyId]) {
                clearTimeout(this._tablePaginationTimers[tbodyId]);
            }
            this._tablePaginationTimers[tbodyId] = setTimeout(() => {
                delete this._tablePaginationTimers[tbodyId];
                this._applyTablePagination_(tbodyId);
            }, 50);
        },

        _getTablePagerEl_(tbodyId, tbody) {
            const pagerId = `table-pager-${tbodyId}`;
            let pager = document.getElementById(pagerId);
            if (pager) return pager;

            const table = tbody?.closest('table');
            const anchor = table?.parentElement || table || tbody;
            pager = document.createElement('div');
            pager.id = pagerId;
            pager.className = 'table-pager border-t border-slate-100 bg-slate-50 px-2 py-1.5';
            if (anchor && anchor.parentNode) {
                anchor.parentNode.insertBefore(pager, anchor.nextSibling);
            }
            return pager;
        },

        _applyTablePagination_(tbodyId) {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            const rows = Array.from(tbody.children || []).filter((el) => el.tagName === 'TR');
            const totalRows = rows.length;
            const pager = this._getTablePagerEl_(tbodyId, tbody);

            const st = this.tablePaginationState[tbodyId] || {
                page: 1,
                size: this.tablePaginationDefaultSize
            };
            st.page = Number(st.page) || 1;
            st.size = Number(st.size) || this.tablePaginationDefaultSize;
            this.tablePaginationState[tbodyId] = st;

            if (totalRows <= st.size || totalRows <= 1) {
                rows.forEach((r) => { r.style.display = ''; });
                if (pager) pager.classList.add('hidden');
                return;
            }

            const totalPages = Math.max(1, Math.ceil(totalRows / st.size));
            if (st.page > totalPages) st.page = totalPages;
            if (st.page < 1) st.page = 1;

            const start = (st.page - 1) * st.size;
            const end = start + st.size;
            rows.forEach((r, idx) => {
                r.style.display = (idx >= start && idx < end) ? '' : 'none';
            });

            const options = [10, 20, 50, 100]
                .map((n) => `<option value="${n}" ${st.size === n ? 'selected' : ''}>${n}</option>`)
                .join('');
            if (pager) {
                pager.classList.remove('hidden');
                pager.innerHTML = `
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="text-slate-500">Tổng <b>${this._fmtNum(totalRows)}</b> dòng</div>
                        <div class="flex items-center gap-1">
                            <button class="btn-secondary h-[26px] px-2 ${st.page <= 1 ? 'opacity-40 pointer-events-none' : ''}" onclick="app.changeTablePage_('${tbodyId}', -1)">Trước</button>
                            <span class="px-1 text-slate-600">Trang <b>${st.page}</b> / ${totalPages}</span>
                            <button class="btn-secondary h-[26px] px-2 ${st.page >= totalPages ? 'opacity-40 pointer-events-none' : ''}" onclick="app.changeTablePage_('${tbodyId}', 1)">Sau</button>
                            <select class="border border-slate-300 rounded px-1 py-1 text-xs bg-white" onchange="app.setTablePageSize_('${tbodyId}', this.value)">
                                ${options}
                            </select>
                        </div>
                    </div>
                `;
            }
        },

        changeTablePage_(tbodyId, delta) {
            const id = String(tbodyId || '').trim();
            if (!id) return;
            const st = this.tablePaginationState[id] || { page: 1, size: this.tablePaginationDefaultSize };
            st.page = Math.max(1, (Number(st.page) || 1) + (Number(delta) || 0));
            this.tablePaginationState[id] = st;
            this._applyTablePagination_(id);
        },

        setTablePageSize_(tbodyId, size) {
            const id = String(tbodyId || '').trim();
            if (!id) return;
            const pageSize = Number(size) || this.tablePaginationDefaultSize;
            const st = this.tablePaginationState[id] || { page: 1, size: this.tablePaginationDefaultSize };
            st.size = pageSize;
            st.page = 1;
            this.tablePaginationState[id] = st;
            this._applyTablePagination_(id);
        },

        refreshTablePaginations_() {
            const ids = Array.isArray(this.tablePaginationBodyIds) ? this.tablePaginationBodyIds : [];
            ids.forEach((id) => this._queueApplyTablePagination_(id));
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
            if (window.innerWidth < this.mobileBreakpoint && this.isSidebarOpen) {
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
                this.renderIndirectChannelPage(this.filterDataByScope(this.cachedData.indirect));
            }
            else if (pageId === 'bts') {
                UIRenderer.renderBTSTable(this.filterDataByScope(this.cachedData.bts || []));
                this.initBTSFilterControls();
            }

            setTimeout(() => this.refreshTablePaginations_(), 80);
        },

        renderIndirectChannelPage(data = null) {
            const rows = Array.isArray(data) ? data : this.filterDataByScope(this.cachedData.indirect || []);
            UIRenderer.renderIndirectTable(rows);
            this.renderIndirectRouteMapAndKPI(rows);
            this.initIndirectKpiAssignmentPanel();
            this._syncIndirectCheckinsFromServer_();
        },

        _pickIndirectVal(row, ...aliases) {
            if (!row) return '';
            const norm = (s) => String(s || '')
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d").replace(/Đ/g, "D")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");
            const allKeys = Object.keys(row || {});
            const lmap = {};
            allKeys.forEach((k) => { lmap[norm(k)] = k; });
            for (const a of aliases) {
                if (!a) continue;
                if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') return row[a];
                const cleanAlias = norm(a);
                const keyExact = lmap[cleanAlias];
                if (keyExact && row[keyExact] !== undefined && row[keyExact] !== null && String(row[keyExact]).trim() !== '') return row[keyExact];
                const keyContains = allKeys.find((k) => norm(k).includes(cleanAlias));
                if (keyContains && row[keyContains] !== undefined && row[keyContains] !== null && String(row[keyContains]).trim() !== '') return row[keyContains];
            }
            return '';
        },

        _parseIndirectSubsMonthly_(raw) {
            if (!raw) return {};
            let data = raw;
            if (typeof raw === 'string') {
                const s = raw.trim();
                if (!s) return {};
                try {
                    data = JSON.parse(s);
                } catch (e) {
                    return {};
                }
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
            const out = {};
            Object.keys(data).forEach((k) => {
                const key = String(k || '').trim();
                if (!/^\d{4}-\d{2}$/.test(key)) return;
                const num = Number(data[k]) || 0;
                out[key] = num;
            });
            return out;
        },

        _formatIndirectSubsHistoryText_(monthlyObj) {
            const keys = Object.keys(monthlyObj || {}).sort((a, b) => b.localeCompare(a));
            if (!keys.length) return '';
            return keys.map((k) => `${k}:${this._fmtNum(monthlyObj[k])}`).join(' | ');
        },

        _getPeriodMonthKeys_(period) {
            const now = new Date();
            const keys = [];
            const count = period === 'quarter' ? 3 : 1;
            for (let i = 0; i < count; i += 1) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                keys.push(`${y}-${m}`);
            }
            return keys;
        },

        _normalizeIndirectPoints(data = null) {
            const src = Array.isArray(data) ? data : this.filterDataByScope(this.cachedData.indirect || []);
            return (src || []).map((r) => {
                const maDL = String(this._pickIndirectVal(r, 'maDL', 'MaDL', 'maCode', 'code', 'id') || '').trim();
                const ten = String(this._pickIndirectVal(r, 'ten', 'Ten', 'tenDiemBan') || '').trim() || maDL;
                const tuyen = String(this._pickIndirectVal(r, 'tuyen', 'Tuyen', 'tuyenBanHang') || '').trim() || 'Chưa phân tuyến';
                const maCum = String(this._pickIndirectVal(r, 'maCum', 'macum', 'cum', 'Cum') || '').trim();
                const latRaw = this._pickIndirectVal(r, 'lat', 'Lat', 'ViDo');
                const lngRaw = this._pickIndirectVal(r, 'lng', 'Lng', 'KinhDo');
                const lat = this._toCoordNumber(latRaw);
                const lng = this._toCoordNumber(lngRaw);
                const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);

                const subsRaw = this._pickIndirectVal(
                    r,
                    'thuebao', 'thue_bao', 'thueBao', 'tb',
                    'doanhso', 'doanh_so', 'doanhSo',
                    'doanhthu', 'doanh_thu', 'doanhThu',
                    'sales', 'revenue'
                );
                const subs = Number(String(subsRaw || 0).replace(/[^\d.-]/g, '')) || 0;
                const subsMonthlyRaw = this._pickIndirectVal(
                    r,
                    'thuebaothang', 'thue_bao_thang', 'thueBaoThang', 'tbThang'
                );
                const subsMonthly = this._parseIndirectSubsMonthly_(subsMonthlyRaw);

                return {
                    maDL,
                    ten,
                    tuyen,
                    maCum,
                    lat: hasCoord ? lat : null,
                    lng: hasCoord ? lng : null,
                    hasCoord,
                    subs,
                    subsMonthly
                };
            }).filter((p) => p.maDL);
        },

        _loadIndirectCheckins() {
            try {
                const raw = localStorage.getItem('MIS_INDIRECT_CHECKINS');
                const arr = JSON.parse(raw || '[]');
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return [];
            }
        },

        _saveIndirectCheckins(list) {
            const safe = Array.isArray(list) ? list.slice(-5000) : [];
            localStorage.setItem('MIS_INDIRECT_CHECKINS', JSON.stringify(safe));
        },

        async _syncIndirectCheckinsFromServer_(force = false) {
            if (!window.DataService || typeof DataService.getIndirectCheckins !== 'function') return;
            if (this.indirectRouteState.syncingCheckins) return;
            if (!force && this.indirectRouteState.checkinsSynced) return;

            this.indirectRouteState.syncingCheckins = true;
            try {
                const remoteRows = await DataService.getIndirectCheckins();
                const remote = Array.isArray(remoteRows) ? remoteRows : [];
                const local = this._loadIndirectCheckins();
                const merged = new Map();
                local.forEach((c) => {
                    const key = String(c.id || `${c.maDL}_${c.ts}_${c.gpsLat}_${c.gpsLng}`).trim();
                    if (!key) return;
                    merged.set(key, c);
                });
                remote.forEach((r) => {
                    const key = String(r.id || `${r.ma_dl || r.maDL}_${r.ts}_${r.gps_lat || r.gpsLat}_${r.gps_lng || r.gpsLng}`).trim();
                    if (!key) return;
                    merged.set(key, {
                        id: r.id,
                        maDL: r.ma_dl || r.maDL || '',
                        ten: r.ten_diem_ban || r.ten || '',
                        tuyen: r.tuyen || '',
                        ts: r.ts || r.time || r.created_at || '',
                        gpsLat: Number(r.gps_lat || r.gpsLat) || null,
                        gpsLng: Number(r.gps_lng || r.gpsLng) || null,
                        pointLat: Number(r.point_lat || r.pointLat) || null,
                        pointLng: Number(r.point_lng || r.pointLng) || null,
                        distanceM: Number(r.distance_m || r.distanceM) || null,
                        near: String(r.near).toLowerCase() === 'true' || r.near === true,
                        user: r.user_name || r.user || '',
                        username: r.username || '',
                        email: String(r.email || '').trim().toLowerCase(),
                        scope: r.scope || ''
                    });
                });
                const mergedList = Array.from(merged.values())
                    .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')))
                    .slice(-5000);
                this._saveIndirectCheckins(mergedList);
                this.indirectRouteState.checkinsSynced = true;
                this.renderIndirectRouteMapAndKPI();
            } catch (e) {
                console.warn('[Indirect] Sync check-in from server failed:', e);
            } finally {
                this.indirectRouteState.syncingCheckins = false;
            }
        },

        _getIndirectPeriodStart(period) {
            const now = new Date();
            const d = new Date(now);
            if (period === 'week') d.setDate(now.getDate() - 7);
            else if (period === 'quarter') d.setDate(now.getDate() - 90);
            else d.setDate(now.getDate() - 30); // month default
            d.setHours(0, 0, 0, 0);
            return d;
        },

        _formatPct(value) {
            const n = Number(value) || 0;
            return `${n.toFixed(1)}%`;
        },

        _fmtNum(value) {
            return (window.UIRenderer && typeof UIRenderer.formatNumber === 'function')
                ? UIRenderer.formatNumber(Number(value) || 0)
                : new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
        },

        _notify(message, level = 'info') {
            if (typeof this.toast_ === 'function') {
                this.toast_(message, level);
                return;
            }
            if (level === 'error' || level === 'warning') alert(message);
            else console.log(message);
        },

        _escapeHtml_(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        _initIndirectRouteMap() {
            const mapEl = document.getElementById('indirect-route-map');
            if (!mapEl || !window.L) return null;

            if (!this.indirectRouteState.map) {
                this.indirectRouteState.map = L.map(mapEl, { preferCanvas: true }).setView([10.75, 106.67], 9);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(this.indirectRouteState.map);
                this.indirectRouteState.layer = L.layerGroup().addTo(this.indirectRouteState.map);
            }
            return this.indirectRouteState.map;
        },

        _calcDistanceMeters(lat1, lng1, lat2, lng2) {
            const toRad = (v) => (v * Math.PI) / 180;
            const R = 6371000;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return Math.round(R * c);
        },

        _updateIndirectRouteFilter(points) {
            const sel = document.getElementById('indirect-route-filter');
            if (!sel) return;
            const current = String(sel.value || this.indirectRouteState.route || 'all');
            const routes = Array.from(new Set((points || []).map((p) => p.tuyen))).sort((a, b) => a.localeCompare(b, 'vi'));
            let html = `<option value="all">Tất cả tuyến</option>`;
            routes.forEach((r) => { html += `<option value="${r}">${r}</option>`; });
            sel.innerHTML = html;
            sel.value = routes.includes(current) || current === 'all' ? current : 'all';
            this.indirectRouteState.route = sel.value;
        },

        _renderIndirectRouteKPI(allPoints, viewPoints) {
            const periodSel = document.getElementById('indirect-kpi-period');
            const period = String(periodSel?.value || this.indirectRouteState.period || 'month');
            this.indirectRouteState.period = period;
            const fromDate = this._getIndirectPeriodStart(period);
            const periodMonths = this._getPeriodMonthKeys_(period);
            const pointSubsForPeriod = (point) => {
                const monthly = point?.subsMonthly || {};
                if (periodMonths.length && Object.keys(monthly).length) {
                    return periodMonths.reduce((acc, m) => acc + (Number(monthly[m]) || 0), 0);
                }
                return Number(point?.subs) || 0;
            };

            const pointMap = new Map((viewPoints || []).map((p) => [p.maDL, p]));
            const checkins = this._loadIndirectCheckins().filter((c) => {
                const t = new Date(c.ts || c.time || 0);
                return pointMap.has(String(c.maDL || '').trim()) && t >= fromDate;
            });
            const totalPoints = (viewPoints || []).length;
            const totalSubsByPoint = (viewPoints || []).reduce((acc, p) => acc + pointSubsForPeriod(p), 0);
            const reportedSubs = (() => {
                const pType = (period === 'month') ? 'month' : ((period === 'week') ? 'week' : '');
                if (!pType) return 0;
                const pKey = pType === 'month'
                    ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                    : this._dateKey(this._startOfWeekMonday(new Date()));
                const cumSet = new Set((viewPoints || []).map((p) => String(p.maCum || '').trim().toLowerCase()).filter(Boolean));
                return (this.indirectKpiHistoryRows || []).reduce((acc, r) => {
                    const rType = String(r.periodType || '').trim().toLowerCase();
                    const rKey = String(r.periodKey || '').trim();
                    if (rType !== pType || rKey !== pKey) return acc;
                    const rCum = String(r.maCum || '').trim().toLowerCase();
                    if (cumSet.size && rCum && !cumSet.has(rCum)) return acc;
                    return acc + (Number(r.actualSubs || 0) || 0);
                }, 0);
            })();
            const visitedSet = new Set(checkins.map((c) => String(c.maDL || '').trim()));
            const coverage = totalPoints > 0 ? (visitedSet.size / totalPoints) * 100 : 0;
            const frequency = totalPoints > 0 ? (checkins.length / totalPoints) : 0;

            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            setTxt('indirect-kpi-subs', this._fmtNum(reportedSubs > 0 ? reportedSubs : totalSubsByPoint));
            setTxt('indirect-kpi-coverage', this._formatPct(coverage));
            setTxt('indirect-kpi-frequency', `${frequency.toFixed(2)} lần/điểm`);
            setTxt('indirect-kpi-checkins', this._fmtNum(checkins.length));

            const tbody = document.getElementById('indirect-route-kpi-body');
            if (!tbody) return;
            const routeMap = new Map();
            (viewPoints || []).forEach((p) => {
                if (!routeMap.has(p.tuyen)) routeMap.set(p.tuyen, []);
                routeMap.get(p.tuyen).push(p);
            });

            const html = Array.from(routeMap.entries()).map(([route, pts], idx) => {
                const idSet = new Set(pts.map((p) => p.maDL));
                const logs = checkins.filter((c) => idSet.has(String(c.maDL || '').trim()));
                const visited = new Set(logs.map((c) => String(c.maDL || '').trim())).size;
                const routeCoverage = pts.length > 0 ? (visited / pts.length) * 100 : 0;
                const routeFrequency = pts.length > 0 ? (logs.length / pts.length) : 0;
                const routeSubs = pts.reduce((acc, p) => acc + pointSubsForPeriod(p), 0);
                return `
                    <tr class="border-b border-slate-100">
                        <td class="px-2 py-1 text-xs">${idx + 1}</td>
                        <td class="px-2 py-1 text-xs font-semibold text-slate-700">${route}</td>
                        <td class="px-2 py-1 text-right text-xs">${this._fmtNum(routeSubs)}</td>
                        <td class="px-2 py-1 text-right text-xs">${visited}/${pts.length} (${routeCoverage.toFixed(1)}%)</td>
                        <td class="px-2 py-1 text-right text-xs">${routeFrequency.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
            tbody.innerHTML = html || `<tr><td colspan="5" class="text-center py-4 text-slate-400 text-xs">Chưa có dữ liệu tuyến.</td></tr>`;
        },

        renderIndirectRouteMapAndKPI(sourceData = null) {
            const activeSource = Array.isArray(sourceData)
                ? sourceData
                : (Array.isArray(this.indirectRouteState.sourceData)
                    ? this.indirectRouteState.sourceData
                    : this.filterDataByScope(this.cachedData.indirect || []));

            this.indirectRouteState.sourceData = activeSource;
            const points = this._normalizeIndirectPoints(activeSource);
            this._updateIndirectRouteFilter(points);

            const route = this.indirectRouteState.route || 'all';
            const viewPoints = route === 'all' ? points : points.filter((p) => p.tuyen === route);
            this._renderIndirectRouteKPI(points, viewPoints);

            const mapEmpty = document.getElementById('indirect-map-empty');
            const map = this._initIndirectRouteMap();
            if (!map || !this.indirectRouteState.layer) {
                if (mapEmpty) {
                    mapEmpty.classList.remove('hidden');
                    mapEmpty.textContent = 'Không tải được thư viện bản đồ (Leaflet).';
                }
                return;
            }

            const layer = this.indirectRouteState.layer;
            layer.clearLayers();
            const coords = viewPoints.filter((p) => p.hasCoord);
            if (!coords.length) {
                if (mapEmpty) {
                    mapEmpty.classList.remove('hidden');
                    mapEmpty.textContent = 'Chưa có tọa độ để hiển thị bản đồ tuyến.';
                }
                return;
            }
            if (mapEmpty) mapEmpty.classList.add('hidden');

            const palette = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#374151'];
            const routeMap = new Map();
            coords.forEach((p) => {
                if (!routeMap.has(p.tuyen)) routeMap.set(p.tuyen, []);
                routeMap.get(p.tuyen).push(p);
            });

            const bounds = [];
            Array.from(routeMap.entries()).forEach(([routeName, pts], idx) => {
                const color = palette[idx % palette.length];
                const ordered = pts.slice().sort((a, b) => String(a.ten).localeCompare(String(b.ten), 'vi'));
                const poly = ordered.map((p) => [p.lat, p.lng]);
                if (poly.length >= 2) {
                    L.polyline(poly, { color, weight: 3, opacity: 0.75 }).addTo(layer).bindTooltip(routeName);
                }
                ordered.forEach((p, orderIdx) => {
                    const marker = L.circleMarker([p.lat, p.lng], {
                        radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 2
                    }).addTo(layer);
                    marker.bindPopup(`
                        <div class="text-xs">
                            <div><b>${p.ten}</b></div>
                            <div>Mã: ${p.maDL}</div>
                            <div>Tuyến: ${p.tuyen}</div>
                            <div>Thứ tự: ${orderIdx + 1}</div>
                        </div>
                    `);
                    bounds.push([p.lat, p.lng]);
                });
            });

            if (bounds.length) {
                map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
            }
            setTimeout(() => map.invalidateSize(), 80);
        },

        handleIndirectRouteFilterChange(value) {
            this.indirectRouteState.route = String(value || 'all');
            this.renderIndirectRouteMapAndKPI();
        },

        handleIndirectPeriodChange(value) {
            this.indirectRouteState.period = String(value || 'month');
            this.renderIndirectRouteMapAndKPI();
        },

        handleIndirectAssignPeriodChange(value) {
            const period = String(value || 'week');
            const weekEl = document.getElementById('indirect-kpi-assign-week');
            const monthEl = document.getElementById('indirect-kpi-assign-month');
            if (!weekEl || !monthEl) return;
            if (period === 'month') {
                weekEl.classList.add('hidden');
                monthEl.classList.remove('hidden');
                if (!monthEl.value) {
                    const now = new Date();
                    monthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
            } else {
                monthEl.classList.add('hidden');
                weekEl.classList.remove('hidden');
                if (!weekEl.value) weekEl.value = this._dateKey(this._startOfWeekMonday(new Date()));
            }
        },

        _buildIndirectSalesStaffOptions_() {
            const sel = document.getElementById('indirect-kpi-assign-staff');
            if (!sel) return;
            const sales = this.filterDataByScope(this.cachedData.sales || []);
            const list = (sales || []).map((s) => ({
                maNV: String(s.maNV || s.manv || s.code || '').trim(),
                tenNV: String(s.ten || s.hoTen || s.fullName || s.name || '').trim(),
                email: String(s.email || s.Email || '').trim().toLowerCase(),
                maCum: String(s.maCum || s.macum || s.cum || '').trim()
            })).filter((r) => r.maNV || r.email);
            list.sort((a, b) => String(a.tenNV || a.maNV).localeCompare(String(b.tenNV || b.maNV), 'vi'));

            let html = '<option value="">Chọn nhân viên bán hàng</option>';
            list.forEach((s) => {
                const value = encodeURIComponent(JSON.stringify(s));
                const label = `${s.tenNV || s.maNV}${s.maNV ? ` (${s.maNV})` : ''}`;
                html += `<option value="${value}">${label}</option>`;
            });
            sel.innerHTML = html;
        },

        _renderIndirectKpiAssignments_(rows) {
            const tbody = document.getElementById('indirect-kpi-assign-body');
            if (!tbody) return;
            const list = Array.isArray(rows) ? rows : [];
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="px-2 py-3 text-center text-slate-400">Chưa có dữ liệu giao KPI.</td></tr>';
                return;
            }
            tbody.innerHTML = list.slice(0, 100).map((r) => {
                const periodType = String(r.period_type || r.periodType || 'week').toLowerCase();
                const periodKey = String(r.period_key || r.period_start || '');
                const periodLabel = periodType === 'month' ? `Tháng ${periodKey}` : `Tuần ${periodKey}`;
                const staffLabel = String(r.ten_nv || r.tenNV || r.ma_nv || r.maNV || '-');
                const subs = Number(r.thue_bao_target || r.thueBaoTarget || 0) || 0;
                const cov = Number(r.do_phu_target || r.doPhuTarget || 0) || 0;
                const freq = Number(r.tan_suat_target || r.tanSuatTarget || 0) || 0;
                return `
                    <tr class="border-b border-slate-100">
                        <td class="px-2 py-1">${periodLabel}</td>
                        <td class="px-2 py-1">${staffLabel}</td>
                        <td class="px-2 py-1 text-right">${this._fmtNum(subs)}</td>
                        <td class="px-2 py-1 text-right">${cov.toFixed(1)}%</td>
                        <td class="px-2 py-1 text-right">${freq.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
        },

        async _loadIndirectKpiAssignments_() {
            if (!window.DataService || typeof DataService.getIndirectKpiPlans !== 'function') {
                this._renderIndirectKpiAssignments_([]);
                return [];
            }
            try {
                const rows = await DataService.getIndirectKpiPlans();
                const listRaw = Array.isArray(rows) ? rows : [];
                const merged = new Map();
                listRaw.forEach((r) => {
                    const k = [
                        String(r.period_type || '').trim().toLowerCase(),
                        String(r.period_key || r.period_start || '').trim(),
                        String(r.ma_nv || r.maNV || '').trim().toLowerCase()
                    ].join('|');
                    if (!k) return;
                    const prev = merged.get(k);
                    if (!prev) {
                        merged.set(k, r);
                        return;
                    }
                    const pAt = String(prev.updated_at || prev.created_at || '');
                    const nAt = String(r.updated_at || r.created_at || '');
                    if (nAt.localeCompare(pAt) >= 0) merged.set(k, r);
                });
                const list = Array.from(merged.values());
                list.sort((a, b) => {
                    const ak = String(a.period_key || a.period_start || '');
                    const bk = String(b.period_key || b.period_start || '');
                    if (ak !== bk) return bk.localeCompare(ak);
                    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
                });
                this._renderIndirectKpiAssignments_(list);
                return list;
            } catch (e) {
                console.error('[Indirect KPI] load assignment failed:', e);
                this._renderIndirectKpiAssignments_([]);
                return [];
            }
        },

        async initIndirectKpiAssignmentPanel() {
            const periodEl = document.getElementById('indirect-kpi-assign-period');
            const isPrivileged = this._isPrivilegedRoleForIndirect_();
            const assignPanel = document.getElementById('indirect-kpi-assign-panel');
            const myPanel = document.getElementById('indirect-kpi-my-panel');
            if (assignPanel) assignPanel.classList.toggle('hidden', !isPrivileged);
            if (myPanel) myPanel.classList.toggle('hidden', isPrivileged);

            if (periodEl) {
                this._buildIndirectSalesStaffOptions_();
                this.handleIndirectAssignPeriodChange(periodEl.value || 'week');
                await this._loadIndirectKpiAssignments_();
            }

            const myPeriodEl = document.getElementById('indirect-kpi-my-period');
            if (myPeriodEl) {
                this.handleIndirectMyPeriodChange(myPeriodEl.value || 'week');
                await this.loadMyIndirectKpiPlan_();
            }

            await this.loadIndirectKpiHistory_();
            this.renderIndirectRouteMapAndKPI();
        },

        _isPrivilegedRoleForIndirect_() {
            const role = String(this.currentUser?.role || '').toLowerCase();
            const scope = String(this.currentUser?.scope || '').toLowerCase();
            return role === 'admin' || role === 'bgd' || role === 'manager' || scope === 'all';
        },

        _resolvePeriodKey_(periodType) {
            const type = String(periodType || 'week');
            if (type === 'month') {
                const month = String(document.getElementById('indirect-kpi-my-month')?.value || '').trim();
                if (month) return month;
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
            const week = String(document.getElementById('indirect-kpi-my-week')?.value || '').trim();
            if (week) return this._dateKey(this._startOfWeekMonday(new Date(week)));
            return this._dateKey(this._startOfWeekMonday(new Date()));
        },

        handleIndirectMyPeriodChange(value) {
            const period = String(value || 'week');
            const weekEl = document.getElementById('indirect-kpi-my-week');
            const monthEl = document.getElementById('indirect-kpi-my-month');
            if (!weekEl || !monthEl) return;
            if (period === 'month') {
                weekEl.classList.add('hidden');
                monthEl.classList.remove('hidden');
                if (!monthEl.value) {
                    const now = new Date();
                    monthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
            } else {
                monthEl.classList.add('hidden');
                weekEl.classList.remove('hidden');
                if (!weekEl.value) weekEl.value = this._dateKey(this._startOfWeekMonday(new Date()));
            }
            this.loadMyIndirectKpiPlan_();
        },

        _periodWindow_(periodType, periodKey) {
            if (periodType === 'month') {
                const [y, m] = String(periodKey || '').split('-').map((x) => Number(x));
                const from = new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
                const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
                return { from, to };
            }
            const from = this._startOfWeekMonday(new Date(periodKey || new Date()));
            const to = this._addDays(from, 7);
            return { from, to };
        },

        _calcMyCheckinStats_(periodType, periodKey, maCum = '') {
            const me = String(this.currentUser?.email || this.currentUser?.username || '').trim().toLowerCase();
            const window = this._periodWindow_(periodType, periodKey);
            const logs = this._loadIndirectCheckins().filter((c) => {
                const owner = String(c.email || c.user || c.username || '').trim().toLowerCase();
                if (me && owner && owner !== me) return false;
                const t = new Date(c.ts || c.time || 0);
                return t >= window.from && t < window.to;
            });
            const points = this._normalizeIndirectPoints().filter((p) => {
                if (!maCum) return true;
                return String(p.maCum || '').trim() === String(maCum).trim();
            });
            const pointSet = new Set(points.map((p) => String(p.maDL || '').trim()));
            const validLogs = logs.filter((c) => pointSet.has(String(c.maDL || '').trim()));
            const visited = new Set(validLogs.map((c) => String(c.maDL || '').trim())).size;
            const totalPoints = points.length;
            const coverage = totalPoints > 0 ? (visited / totalPoints) * 100 : 0;
            const frequency = totalPoints > 0 ? (validLogs.length / totalPoints) : 0;
            return {
                checkins: validLogs.length,
                coverage,
                frequency
            };
        },

        async loadMyIndirectKpiPlan_() {
            const periodType = String(document.getElementById('indirect-kpi-my-period')?.value || 'week');
            const periodKey = this._resolvePeriodKey_(periodType);
            if (!window.DataService || typeof DataService.getIndirectKpiPlans !== 'function') return;
            try {
                const rows = await DataService.getIndirectKpiPlans();
                const meMail = String(this.currentUser?.email || '').trim().toLowerCase();
                const meCode = String(this.currentUser?.maNV || this.currentUser?.username || '').trim().toLowerCase();
                const target = (rows || []).find((r) => {
                    const rType = String(r.period_type || '').trim().toLowerCase();
                    const rKey = String(r.period_key || r.period_start || '').trim();
                    const rMail = String(r.email || '').trim().toLowerCase();
                    const rCode = String(r.ma_nv || r.maNV || '').trim().toLowerCase();
                    return rType === periodType && rKey === periodKey
                        && ((meMail && rMail === meMail) || (meCode && rCode === meCode));
                }) || null;
                let report = null;
                if (typeof DataService.getIndirectKpiReports === 'function') {
                    const reports = await DataService.getIndirectKpiReports();
                    report = (reports || []).find((r) => {
                        const rType = String(r.period_type || '').trim().toLowerCase();
                        const rKey = String(r.period_key || r.period_start || '').trim();
                        const rMail = String(r.email || '').trim().toLowerCase();
                        const rCode = String(r.ma_nv || r.maNV || '').trim().toLowerCase();
                        return rType === periodType && rKey === periodKey
                            && ((meMail && rMail === meMail) || (meCode && rCode === meCode));
                    }) || null;
                }

                const targetSubs = Number(target?.thue_bao_target || 0) || 0;
                const targetCoverage = Number(target?.do_phu_target || 0) || 0;
                const targetFrequency = Number(target?.tan_suat_target || 0) || 0;
                const maCum = String(target?.ma_cum || '').trim();
                const stats = this._calcMyCheckinStats_(periodType, periodKey, maCum);
                const setTxt = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = value;
                };
                setTxt('indirect-kpi-my-target-subs', this._fmtNum(targetSubs));
                setTxt('indirect-kpi-my-target-coverage', `${targetCoverage.toFixed(1)}%`);
                setTxt('indirect-kpi-my-target-frequency', targetFrequency.toFixed(2));
                setTxt('indirect-kpi-my-checkins', this._fmtNum(stats.checkins));
                const input = document.getElementById('indirect-kpi-my-actual-subs');
                const noteInput = document.getElementById('indirect-kpi-my-note');
                const reportSubs = Number(report?.thue_bao_actual || report?.thueBaoActual || 0) || 0;
                const reportNote = String(report?.ghi_chu || report?.ghiChu || '').trim();
                if (input && (!input.value || input.dataset.periodKey !== `${periodType}_${periodKey}`)) {
                    input.value = reportSubs > 0 ? String(reportSubs) : '';
                    input.dataset.periodKey = `${periodType}_${periodKey}`;
                }
                if (noteInput && noteInput.dataset.periodKey !== `${periodType}_${periodKey}`) {
                    noteInput.value = reportNote;
                    noteInput.dataset.periodKey = `${periodType}_${periodKey}`;
                }
                this._myIndirectKpiContext = {
                    periodType,
                    periodKey,
                    target,
                    stats,
                    report
                };
            } catch (e) {
                console.error('[Indirect KPI] load my plan failed:', e);
            }
        },

        async saveMyIndirectKpiReport() {
            if (!window.DataService || typeof DataService.upsertIndirectKpiReport !== 'function') {
                this._notify('Không tìm thấy API báo cáo KPI.', 'error');
                return;
            }
            const ctx = this._myIndirectKpiContext || {};
            const periodType = ctx.periodType || String(document.getElementById('indirect-kpi-my-period')?.value || 'week');
            const periodKey = ctx.periodKey || this._resolvePeriodKey_(periodType);
            const target = ctx.target || {};
            const actualSubs = Number(document.getElementById('indirect-kpi-my-actual-subs')?.value || 0) || 0;
            const note = String(document.getElementById('indirect-kpi-my-note')?.value || '').trim();
            const stats = ctx.stats || this._calcMyCheckinStats_(periodType, periodKey, String(target?.ma_cum || ''));

            const payload = {
                period_type: periodType,
                period_start: periodKey,
                ma_nv: target?.ma_nv || this.currentUser?.maNV || this.currentUser?.username || '',
                ten_nv: target?.ten_nv || this.currentUser?.name || this.currentUser?.fullname || '',
                email: target?.email || this.currentUser?.email || '',
                ma_cum: target?.ma_cum || this.currentUser?.scope || '',
                thue_bao_target: Number(target?.thue_bao_target || 0) || 0,
                do_phu_target: Number(target?.do_phu_target || 0) || 0,
                tan_suat_target: Number(target?.tan_suat_target || 0) || 0,
                thue_bao_actual: actualSubs,
                checkin_count: Number(stats.checkins || 0),
                do_phu_actual: Number(stats.coverage || 0),
                tan_suat_actual: Number(stats.frequency || 0),
                ghi_chu: note
            };

            try {
                const resp = await DataService.upsertIndirectKpiReport(payload);
                if (resp?.error) throw new Error(resp.error);
                this._notify('Đã lưu báo cáo KPI của bạn.', 'success');
                await this.loadMyIndirectKpiPlan_();
                await this.loadIndirectKpiHistory_();
                this.renderIndirectRouteMapAndKPI();
            } catch (e) {
                console.error('[Indirect KPI] save my report failed:', e);
                this._notify(`Không lưu được báo cáo KPI: ${e.message}`, 'error');
            }
        },

        _normalizeIndirectKpiHistoryRow_(row, idx) {
            const periodType = String(row.period_type || row.periodType || 'week').trim().toLowerCase() === 'month' ? 'month' : 'week';
            const periodKey = String(row.period_key || row.period_start || '').trim();
            const maNV = String(row.ma_nv || row.maNV || '').trim();
            const tenNV = String(row.ten_nv || row.tenNV || '').trim();
            const email = String(row.email || '').trim().toLowerCase();
            const maCum = String(row.ma_cum || row.maCum || '').trim();
            const targetSubs = Number(row.thue_bao_target || row.thueBaoTarget || 0) || 0;
            const actualSubs = Number(row.thue_bao_actual || row.thueBaoActual || 0) || 0;
            const checkins = Number(row.checkin_count || row.checkinCount || 0) || 0;
            const targetCoverage = Number(row.do_phu_target || row.doPhuTarget || 0) || 0;
            const actualCoverage = Number(row.do_phu_actual || row.doPhuActual || 0) || 0;
            const targetFrequency = Number(row.tan_suat_target || row.tanSuatTarget || 0) || 0;
            const actualFrequency = Number(row.tan_suat_actual || row.tanSuatActual || 0) || 0;
            const note = String(row.ghi_chu || row.ghiChu || '').trim();
            const updatedAt = String(row.updated_at || row.created_at || '').trim();
            return {
                id: String(row.id || `IKR_${idx}`).trim() || `IKR_${idx}`,
                periodType,
                periodKey,
                maNV,
                tenNV,
                email,
                maCum,
                targetSubs,
                actualSubs,
                checkins,
                targetCoverage,
                actualCoverage,
                targetFrequency,
                actualFrequency,
                note,
                updatedAt
            };
        },

        _renderIndirectKpiHistory_(rows) {
            const countEl = document.getElementById('indirect-kpi-history-count');
            const tbody = document.getElementById('indirect-kpi-history-body');
            const list = Array.isArray(rows) ? rows : [];
            if (countEl) countEl.textContent = this._fmtNum(list.length);
            if (!tbody) return;
            if (!list.length) {
                tbody.innerHTML = '';
                return;
            }
            tbody.innerHTML = list.slice(0, 300).map((r) => {
                const periodLabel = r.periodType === 'month' ? `Tháng ${r.periodKey}` : `Tuần ${r.periodKey}`;
                const staffLabel = String(r.tenNV || r.maNV || r.email || '-');
                const cumName = this.getNameCum ? (this.getNameCum(r.maCum) || r.maCum || '-') : (r.maCum || '-');
                const subsLabel = `${this._fmtNum(r.actualSubs)}/${this._fmtNum(r.targetSubs)}`;
                const checkinLabel = `${this._fmtNum(r.checkins)} | ĐP ${r.actualCoverage.toFixed(1)}%/${r.targetCoverage.toFixed(1)}% | TS ${r.actualFrequency.toFixed(2)}/${r.targetFrequency.toFixed(2)}`;
                const title = `Cập nhật: ${r.updatedAt || '-'}${r.note ? ` | Ghi chú: ${r.note}` : ''}`;
                return `
                    <tr class="border-b border-slate-100" title="${this._escapeHtml_(title)}">
                        <td class="px-2 py-1">${periodLabel}</td>
                        <td class="px-2 py-1">${this._escapeHtml_(staffLabel)}</td>
                        <td class="px-2 py-1">${this._escapeHtml_(cumName)}</td>
                        <td class="px-2 py-1 text-right">${subsLabel}</td>
                        <td class="px-2 py-1 text-right">${checkinLabel}</td>
                    </tr>
                `;
            }).join('');
        },

        _populateIndirectKpiHistoryFilterOptions_(rows) {
            const list = Array.isArray(rows) ? rows : [];
            const staffEl = document.getElementById('indirect-kpi-history-staff');
            const cumEl = document.getElementById('indirect-kpi-history-cum');
            const currentStaff = String(staffEl?.value || 'all');
            const currentCum = String(cumEl?.value || 'all');

            if (staffEl) {
                const staffMap = new Map();
                list.forEach((r) => {
                    const key = String(r.maNV || r.email || '').trim().toLowerCase();
                    if (!key) return;
                    if (!staffMap.has(key)) {
                        const label = String(r.tenNV || r.maNV || r.email || key).trim();
                        staffMap.set(key, label);
                    }
                });
                const staffEntries = Array.from(staffMap.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'vi'));
                let html = '<option value="all">Tất cả NVBH</option>';
                staffEntries.forEach(([key, label]) => {
                    html += `<option value="${this._escapeHtml_(key)}">${this._escapeHtml_(label)}</option>`;
                });
                staffEl.innerHTML = html;
                staffEl.value = staffMap.has(currentStaff) ? currentStaff : 'all';
            }

            if (cumEl) {
                const cumList = Array.from(new Set(list.map((r) => String(r.maCum || '').trim()).filter(Boolean)))
                    .sort((a, b) => String(a).localeCompare(String(b), 'vi'));
                let html = '<option value="all">Tất cả cụm</option>';
                cumList.forEach((code) => {
                    const name = this.getNameCum ? (this.getNameCum(code) || code) : code;
                    html += `<option value="${this._escapeHtml_(code)}">${this._escapeHtml_(name)}</option>`;
                });
                cumEl.innerHTML = html;
                cumEl.value = cumList.includes(currentCum) ? currentCum : 'all';
            }
        },

        _getFilteredIndirectKpiHistory_() {
            const periodType = String(document.getElementById('indirect-kpi-history-period')?.value || 'all').trim().toLowerCase();
            const staffKey = String(document.getElementById('indirect-kpi-history-staff')?.value || 'all').trim().toLowerCase();
            const cumKey = String(document.getElementById('indirect-kpi-history-cum')?.value || 'all').trim().toLowerCase();
            return (this.indirectKpiHistoryRows || []).filter((r) => {
                if (periodType !== 'all' && String(r.periodType || '').toLowerCase() !== periodType) return false;
                if (staffKey !== 'all') {
                    const rowStaffKey = String(r.maNV || r.email || '').trim().toLowerCase();
                    if (rowStaffKey !== staffKey) return false;
                }
                if (cumKey !== 'all' && String(r.maCum || '').trim().toLowerCase() !== cumKey) return false;
                return true;
            });
        },

        filterIndirectKpiHistory() {
            this._renderIndirectKpiHistory_(this._getFilteredIndirectKpiHistory_());
        },

        async loadIndirectKpiHistory_() {
            if (!window.DataService || typeof DataService.getIndirectKpiReports !== 'function') {
                this.indirectKpiHistoryRows = [];
                this._populateIndirectKpiHistoryFilterOptions_([]);
                this._renderIndirectKpiHistory_([]);
                return [];
            }
            try {
                const rows = await DataService.getIndirectKpiReports();
                const list = (Array.isArray(rows) ? rows : []).map((r, i) => this._normalizeIndirectKpiHistoryRow_(r, i));
                list.sort((a, b) => {
                    if (a.periodKey !== b.periodKey) return String(b.periodKey).localeCompare(String(a.periodKey));
                    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
                });
                this.indirectKpiHistoryRows = list;
                this._populateIndirectKpiHistoryFilterOptions_(list);
                this.filterIndirectKpiHistory();
                return list;
            } catch (e) {
                console.error('[Indirect KPI] load history failed:', e);
                this.indirectKpiHistoryRows = [];
                this._populateIndirectKpiHistoryFilterOptions_([]);
                this._renderIndirectKpiHistory_([]);
                return [];
            }
        },

        exportIndirectKpiHistory() {
            const rows = this._getFilteredIndirectKpiHistory_();
            if (!rows.length) {
                this._notify('Không có dữ liệu lịch sử KPI để xuất.', 'warning');
                return;
            }
            if (!window.XLSX) {
                this._notify('Thiếu thư viện xuất Excel.', 'error');
                return;
            }
            const out = rows.map((r) => ({
                'Kỳ': r.periodType === 'month' ? `Tháng ${r.periodKey}` : `Tuần ${r.periodKey}`,
                'Mã NV': r.maNV || '',
                'Nhân viên': r.tenNV || r.email || '',
                'Email': r.email || '',
                'Cụm': this.getNameCum ? (this.getNameCum(r.maCum) || r.maCum || '') : (r.maCum || ''),
                'Thuê bao KH': r.targetSubs,
                'Thuê bao TH': r.actualSubs,
                'Check-in': r.checkins,
                'Độ phủ KH (%)': Number(r.targetCoverage.toFixed(2)),
                'Độ phủ TH (%)': Number(r.actualCoverage.toFixed(2)),
                'Tần suất KH': Number(r.targetFrequency.toFixed(3)),
                'Tần suất TH': Number(r.actualFrequency.toFixed(3)),
                'Ghi chú': r.note || '',
                'Cập nhật lúc': r.updatedAt || ''
            }));
            const ws = XLSX.utils.json_to_sheet(out);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'KPI_Indirect');
            XLSX.writeFile(wb, `indirect_kpi_history_${this._dateKey(new Date())}.xlsx`);
            this._notify('Đã xuất lịch sử báo cáo KPI.', 'success');
        },

        async saveIndirectKpiAssignment() {
            if (!window.DataService || typeof DataService.upsertIndirectKpiPlan !== 'function') {
                this._notify('Không tìm thấy API giao KPI.', 'error');
                return;
            }
            const periodType = String(document.getElementById('indirect-kpi-assign-period')?.value || 'week');
            const weekVal = String(document.getElementById('indirect-kpi-assign-week')?.value || '').trim();
            const monthVal = String(document.getElementById('indirect-kpi-assign-month')?.value || '').trim();
            const staffRaw = String(document.getElementById('indirect-kpi-assign-staff')?.value || '').trim();
            if (!staffRaw) {
                this._notify('Vui lòng chọn nhân viên bán hàng.', 'warning');
                return;
            }
            let staff = null;
            try {
                staff = JSON.parse(decodeURIComponent(staffRaw));
            } catch (e) {
                this._notify('Thông tin nhân viên không hợp lệ.', 'error');
                return;
            }

            const targetSubs = Number(document.getElementById('indirect-kpi-target-subs')?.value || 0);
            const targetCoverage = Number(document.getElementById('indirect-kpi-target-coverage')?.value || 0);
            const targetFrequency = Number(document.getElementById('indirect-kpi-target-frequency')?.value || 0);
            const periodStart = periodType === 'month'
                ? (monthVal || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
                : this._dateKey(this._startOfWeekMonday(new Date(weekVal || new Date())));

            const payload = {
                period_type: periodType === 'month' ? 'month' : 'week',
                period_start: periodStart,
                ma_nv: staff.maNV || '',
                ten_nv: staff.tenNV || '',
                email: staff.email || '',
                ma_cum: staff.maCum || '',
                thue_bao_target: Number.isFinite(targetSubs) ? targetSubs : 0,
                do_phu_target: Number.isFinite(targetCoverage) ? targetCoverage : 0,
                tan_suat_target: Number.isFinite(targetFrequency) ? targetFrequency : 0
            };

            try {
                const resp = await DataService.upsertIndirectKpiPlan(payload);
                if (resp?.error) throw new Error(resp.error);
                this._notify('Đã giao KPI cho nhân viên bán hàng.', 'success');
                await this._loadIndirectKpiAssignments_();
            } catch (e) {
                console.error('[Indirect KPI] save assignment failed:', e);
                this._notify(`Không lưu được KPI: ${e.message}`, 'error');
            }
        },

        _normalizeStorePoints(data = null) {
            const src = Array.isArray(data)
                ? data
                : (Array.isArray(this.storeMapState.sourceData)
                    ? this.storeMapState.sourceData
                    : this.filterDataByScope(this.cachedData.stores || []));
            return (src || []).map((s) => {
                const id = String(s.id || s.maCH || '').trim();
                const ten = String(s.ten || s.Ten || id).trim() || id;
                const diaChi = String(s.diaChi || s.DiaChi || '').trim();
                const maCum = String(s.maCum || s.macum || '').trim();
                const lat = this._toCoordNumber(s.lat || s.Lat || '');
                const lng = this._toCoordNumber(s.lng || s.Lng || '');
                const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);
                return { id, ten, diaChi, maCum, lat: hasCoord ? lat : null, lng: hasCoord ? lng : null, hasCoord };
            }).filter((p) => p.id);
        },

        _initDirectStoreMap_() {
            const mapEl = document.getElementById('direct-store-map');
            if (!mapEl || !window.L) return null;
            if (!this.storeMapState.map) {
                this.storeMapState.map = L.map(mapEl, { preferCanvas: true }).setView([10.75, 106.67], 9);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(this.storeMapState.map);
                this.storeMapState.layer = L.layerGroup().addTo(this.storeMapState.map);
            }
            return this.storeMapState.map;
        },

        _updateStoreMapFilter_(points) {
            const sel = document.getElementById('direct-store-map-filter');
            if (!sel) return;
            const current = String(sel.value || this.storeMapState.cum || 'all');
            const cums = Array.from(new Set((points || []).map((p) => p.maCum).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b, 'vi'));
            let html = '<option value="all">Tất cả cụm</option>';
            cums.forEach((c) => {
                const label = this.getNameCum ? (this.getNameCum(c) || c) : c;
                html += `<option value="${c}">${label}</option>`;
            });
            sel.innerHTML = html;
            sel.value = (current === 'all' || cums.includes(current)) ? current : 'all';
            this.storeMapState.cum = sel.value;
        },

        renderDirectStoreMap(sourceData = null) {
            const activeSource = Array.isArray(sourceData)
                ? sourceData
                : (Array.isArray(this.storeMapState.sourceData)
                    ? this.storeMapState.sourceData
                    : this.filterDataByScope(this.cachedData.stores || []));
            this.storeMapState.sourceData = activeSource;
            const points = this._normalizeStorePoints(activeSource);
            this._updateStoreMapFilter_(points);
            const selectedCum = String(this.storeMapState.cum || 'all');
            const viewPoints = selectedCum === 'all' ? points : points.filter((p) => p.maCum === selectedCum);
            const coords = viewPoints.filter((p) => p.hasCoord);

            const countEl = document.getElementById('direct-store-map-count');
            if (countEl) countEl.textContent = this._fmtNum(coords.length);

            const emptyEl = document.getElementById('direct-store-map-empty');
            const map = this._initDirectStoreMap_();
            if (!map || !this.storeMapState.layer) {
                if (emptyEl) {
                    emptyEl.classList.remove('hidden');
                    emptyEl.textContent = 'Không tải được thư viện bản đồ (Leaflet).';
                }
                return;
            }

            const layer = this.storeMapState.layer;
            layer.clearLayers();
            if (!coords.length) {
                if (emptyEl) {
                    emptyEl.classList.remove('hidden');
                    emptyEl.textContent = 'Chưa có tọa độ cửa hàng để hiển thị.';
                }
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');

            const palette = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#374151'];
            const cumIndex = new Map();
            let colorIdx = 0;
            const bounds = [];
            coords.forEach((p) => {
                if (!cumIndex.has(p.maCum)) {
                    cumIndex.set(p.maCum, palette[colorIdx % palette.length]);
                    colorIdx += 1;
                }
                const color = cumIndex.get(p.maCum);
                L.circleMarker([p.lat, p.lng], {
                    radius: 6,
                    color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: 2
                }).addTo(layer).bindPopup(`
                    <div class="text-xs">
                        <div><b>${p.ten}</b></div>
                        <div>Mã: ${p.id}</div>
                        <div>Cụm: ${this.getNameCum ? (this.getNameCum(p.maCum) || p.maCum) : p.maCum}</div>
                        <div>${p.diaChi || ''}</div>
                    </div>
                `);
                bounds.push([p.lat, p.lng]);
            });

            if (bounds.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
            setTimeout(() => map.invalidateSize(), 80);
        },

        handleStoreMapFilterChange(value) {
            this.storeMapState.cum = String(value || 'all');
            this.renderDirectStoreMap();
        },

        async checkInIndirectPoint(encodedMa) {
            const maDL = decodeURIComponent(String(encodedMa || '')).trim();
            if (!maDL) return;
            if (!navigator.geolocation) {
                this._notify('Thiết bị/trình duyệt không hỗ trợ GPS.', 'error');
                return;
            }

            const points = this._normalizeIndirectPoints();
            const point = points.find((p) => String(p.maDL).trim() === maDL);
            if (!point) {
                this._notify('Không tìm thấy điểm bán để check-in.', 'warning');
                return;
            }

            const statusEl = document.getElementById('indirect-checkin-status');
            if (statusEl) statusEl.textContent = `Đang check-in GPS cho: ${point.ten}...`;

            const getPosition = () => new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                });
            });

            try {
                const pos = await getPosition();
                const gpsLat = Number(pos.coords.latitude);
                const gpsLng = Number(pos.coords.longitude);
                const hasPointCoord = Number.isFinite(point.lat) && Number.isFinite(point.lng);
                const distanceM = hasPointCoord ? this._calcDistanceMeters(point.lat, point.lng, gpsLat, gpsLng) : null;
                const thresholdM = Number(this.indirectCheckinDistanceThresholdM) || 300;
                const near = hasPointCoord ? distanceM <= thresholdM : null;

                const logs = this._loadIndirectCheckins();
                logs.push({
                    id: `CI_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    maDL: point.maDL,
                    ten: point.ten,
                    tuyen: point.tuyen,
                    ts: new Date().toISOString(),
                    gpsLat,
                    gpsLng,
                    pointLat: point.lat,
                    pointLng: point.lng,
                    distanceM,
                    near,
                    user: this.currentUser?.name || this.currentUser?.username || '',
                    username: String(this.currentUser?.username || '').trim(),
                    email: String(this.currentUser?.email || '').trim().toLowerCase(),
                    scope: String(this.currentUser?.scope || '').trim()
                });
                this._saveIndirectCheckins(logs);

                if (window.DataService && typeof DataService.saveIndirectCheckin === 'function') {
                    try {
                        await DataService.saveIndirectCheckin({
                            id: logs[logs.length - 1].id,
                            maDL: point.maDL,
                            ten: point.ten,
                            tuyen: point.tuyen,
                            ma_cum: point.maCum,
                            ts: logs[logs.length - 1].ts,
                            gpsLat,
                            gpsLng,
                            pointLat: point.lat,
                            pointLng: point.lng,
                            distanceM,
                            near,
                            user: this.currentUser?.name || this.currentUser?.username || ''
                        });
                    } catch (errSave) {
                        console.warn('[Indirect] save check-in to server failed:', errSave);
                    }
                }

                if (statusEl) {
                    if (distanceM === null) {
                        statusEl.textContent = `Đã check-in ${point.ten} (chưa có tọa độ điểm để đo khoảng cách).`;
                    } else {
                        statusEl.textContent = `Đã check-in ${point.ten}: cách điểm ${distanceM}m ${near ? '(ĐẠT)' : '(CHƯA ĐẠT)'} (ngưỡng ${thresholdM}m).`;
                    }
                }
                this._notify('Check-in GPS thành công.', 'success');
                this.renderIndirectRouteMapAndKPI();
            } catch (e) {
                let msg = 'Không thể lấy vị trí GPS.';
                if (e && e.code === 1) msg = 'Bạn đã từ chối quyền truy cập vị trí.';
                if (e && e.code === 2) msg = 'Không xác định được vị trí hiện tại.';
                if (e && e.code === 3) msg = 'Hết thời gian lấy vị trí GPS.';
                if (statusEl) statusEl.textContent = msg;
                this._notify(msg, 'error');
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
        _toCoordNumber(value) {
            const raw = String(value ?? '').trim().replace(/^\'+/, '').replace(',', '.');
            if (!raw) return NaN;
            const n = Number(raw);
            return Number.isFinite(n) ? n : NaN;
        },
        getMapLink(lat, lng) {
            const la = this._toCoordNumber(lat);
            const lo = this._toCoordNumber(lng);
            if (!isFinite(la) || !isFinite(lo)) return '';
            // [FIXED] Correct Google Maps URL
            return this.sanitizeExternalUrl(`https://maps.google.com/?q=${la},${lo}`) || '';
        },

        sanitizeExternalUrl(url, allowDataImage = false) {
            const raw = String(url || '').trim();
            if (!raw) return '';
            if (allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw)) {
                return raw;
            }
            try {
                const parsed = new URL(raw, window.location.origin);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    return parsed.href;
                }
            } catch (e) {
                return '';
            }
            return '';
        },

        openExternalUrl(url, allowDataImage = false) {
            const safe = this.sanitizeExternalUrl(url, allowDataImage);
            if (!safe) {
                console.warn("Blocked unsafe URL:", url);
                return false;
            }
            window.open(safe, '_blank', 'noopener,noreferrer');
            return true;
        },

        prefetchAuxiliaryData() {
            if (!window.DataService || typeof DataService.warmup !== 'function') return;
            const task = () => {
                DataService.warmup(['kpicanhan', 'lich_tuan', 'market', 'report', 'products'])
                    .catch((e) => console.warn("Warmup fail:", e));
            };
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(task, { timeout: 1200 });
            } else {
                setTimeout(task, 250);
            }
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
            if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
                const y = dateStr.getFullYear();
                const m = String(dateStr.getMonth() + 1).padStart(2, '0');
                const d = String(dateStr.getDate()).padStart(2, '0');
                return { full: `${y}-${m}-${d}`, month: `${y}-${m}` };
            }
            const raw = String(dateStr).trim();
            if (!raw) return { full: '', month: '' };
            let y, m, d;
            if (raw.includes('/')) {
                const parts = raw.split('/');
                if (parts.length >= 2) {
                    d = parts[0].padStart(2, '0');
                    m = parts[1].padStart(2, '0');
                    y = parts[2];
                    if (y.length === 2) y = '20' + y;
                }
            } else if (raw.includes('-')) {
                return { full: raw.substring(0, 10), month: raw.substring(0, 7) };
            }
            if (y && m) return { full: `${y}-${m}-${d || '01'}`, month: `${y}-${m}` };
            return { full: raw, month: raw };
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

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthInput = document.getElementById('edit-indirect-subs-month');
        const subsInput = document.getElementById('edit-indirect-subs-value');
        const historyInput = document.getElementById('edit-indirect-subs-history');
        if (monthInput && !monthInput.value) monthInput.value = currentMonth;
        const subsMonthly = this._parseIndirectSubsMonthly_(
            pick(item, 'thuebaothang', 'thueBaoThang', 'thue_bao_thang', 'tbThang')
        );
        if (historyInput) historyInput.value = this._formatIndirectSubsHistoryText_(subsMonthly);
        if (subsInput) {
            const monthKey = monthInput?.value || currentMonth;
            const currentVal = (subsMonthly[monthKey] !== undefined)
                ? subsMonthly[monthKey]
                : (pick(item, 'thuebao', 'thueBao', 'thue_bao', 'tb') || '');
            subsInput.value = currentVal || '';
        }

        if (monthInput && !monthInput.dataset.bound) {
            monthInput.addEventListener('change', () => {
                const all = this._parseIndirectSubsMonthly_(historyInput?.dataset.raw || '{}');
                if (subsInput) subsInput.value = all[monthInput.value] || '';
            });
            monthInput.dataset.bound = '1';
        }
        if (historyInput) historyInput.dataset.raw = JSON.stringify(subsMonthly);

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
            if (!url) return;
            this.openExternalUrl(url, true);
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
                imgEl.onclick = () => {
                    // Mở ảnh trong tab mới (kèm kiểm soát URL an toàn)
                    this.openExternalUrl(safeUrl, true);
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

            if (response && (response.success || response.status === 'success' || response.result === 'success')) {
                // Ưu tiên reload từ server để lấy đúng link ảnh Drive mới nhất
                let refreshedOk = false;
                try {
                    if (DataService.invalidateLocalCache_) {
                        DataService.invalidateLocalCache_(['stores']);
                    }
                    if (typeof DataService.ensureData === 'function') {
                        await DataService.ensureData(true);
                    }
                    const latestStores = await DataService.getStores();
                    if (Array.isArray(latestStores)) {
                        this.cachedData.stores = this.filterDataByScope(this.normalizeDataSet(latestStores));
                        refreshedOk = true;
                    }
                } catch (eReload) {
                    console.warn('[Store] reload after save failed:', eReload);
                }

                // Fallback optimistic nếu reload không thành công
                if (!refreshedOk && this.cachedData && this.cachedData.stores) {
                    const storeIndex = this.cachedData.stores.findIndex(s => String(s.id) === String(storeId) || String(s.maCH) === String(storeId));
                    if (storeIndex !== -1) {
                        const currentStore = this.cachedData.stores[storeIndex];
                        this.cachedData.stores[storeIndex] = { ...currentStore, ...payload };
                    }
                }

                this.renderStoreList();
                this.tempStoreImages = { trong: null, ngoai: null };

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
            const subsMonth = String(document.getElementById('edit-indirect-subs-month')?.value || '').trim();
            const subsValueRaw = String(document.getElementById('edit-indirect-subs-value')?.value || '').trim();
            const subsValue = subsValueRaw === '' ? '' : (Number(subsValueRaw) || 0);
            const existingSubsHistoryRaw = getOriginalVal(['thuebaothang', 'thueBaoThang', 'thue_bao_thang', 'tbThang']);
            const subsHistory = this._parseIndirectSubsMonthly_(existingSubsHistoryRaw);
            if (/^\d{4}-\d{2}$/.test(subsMonth)) {
                if (subsValueRaw === '') delete subsHistory[subsMonth];
                else subsHistory[subsMonth] = Number(subsValue) || 0;
            }
            const subsHistoryStr = JSON.stringify(subsHistory);
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
                        thuebao: subsValue,
                        thuebaothang: subsHistoryStr,
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

                    // 2. Reload từ server để đảm bảo lấy đúng link ảnh trong/ngoài mới nhất
                    let refreshedOk = false;
                    try {
                        if (DataService.invalidateLocalCache_) {
                            DataService.invalidateLocalCache_(['indirect']);
                        }
                        if (typeof DataService.ensureData === 'function') {
                            await DataService.ensureData(true);
                        }
                        const latestIndirect = await DataService.getIndirectChannels();
                        if (Array.isArray(latestIndirect)) {
                            this.cachedData.indirect = this.filterDataByScope(this.normalizeDataSet(latestIndirect));
                            refreshedOk = true;
                        }
                    } catch (eReload) {
                        console.warn('[Indirect] reload after save failed:', eReload);
                    }

                    // 3. Fallback optimistic nếu reload không thành công
                    if (!refreshedOk) {
                        const updatedItem = {
                            ...originalItem,
                            id: newId,
                            maDL: newId,
                            maCode: newId,
                            ten: name,
                            sdt: phone,
                            diaChi: address,
                            lat: latVal,
                            lng: lngVal,
                            tuyen: tuyen,
                            phanloai: phanLoai,
                            loai: loai,
                            chuSoHuu: chu,
                            thueBao: subsValue,
                            thuebao: subsValue,
                            thueBaoThang: subsHistoryStr,
                            thuebaothang: subsHistoryStr,
                            maLienCum: valLienCum,
                            maCum: valCum,
                            anhNgoai: imgOutBase64 ? `data:image/jpeg;base64,${imgOutBase64}` : (originalItem ? (originalItem.anhNgoai || originalItem.imgOutside) : ''),
                            anhTrong: imgInBase64 ? `data:image/jpeg;base64,${imgInBase64}` : (originalItem ? (originalItem.anhTrong || originalItem.imgInside) : '')
                        };
                        if (!this.cachedData.indirect) this.cachedData.indirect = [];
                        const index = this.cachedData.indirect.findIndex(i => String(i.id) == String(oldId) || String(i.maDL) == String(oldId));
                        if (index !== -1) this.cachedData.indirect[index] = updatedItem;
                        else this.cachedData.indirect.unshift(updatedItem);
                    }

                    // 4. Render lại danh sách + map/kpi để thấy số mới ngay sau khi lưu
                    this.renderIndirectChannelPage(this.filterDataByScope(this.cachedData.indirect || []));

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
            
            // Nếu không nhập gì, render lại toàn bộ
            if (!k) { UIRenderer.renderClusterTable(d); return; }
            
            const res = d.map(lc => {
                // 1. Tìm ở cấp độ Cụm con (Tên Cụm, Mã Cụm, Trưởng Cụm)
                const sub = (lc.cums || []).filter(c => 
                    (c.tenCum || '').toLowerCase().includes(k) ||
                    (c.maCum || '').toLowerCase().includes(k) ||
                    (c.phuTrach || '').toLowerCase().includes(k)
                );

                // 2. Tìm ở cấp độ Liên Cụm (Tên Liên Cụm, Mã Liên Cụm, Trưởng Liên Cụm)
                const matchLienCum = 
                    (lc.tenLienCum || '').toLowerCase().includes(k) ||
                    (lc.maLienCum || '').toLowerCase().includes(k) ||
                    (lc.truongLienCum || '').toLowerCase().includes(k);

                // 3. Logic hiển thị:
                // - Nếu khớp thông tin Liên Cụm: Hiển thị Liên cụm đó và TẤT CẢ các cụm con.
                // - Nếu chỉ khớp thông tin Cụm con: Hiển thị Liên cụm đó nhưng CHỈ xổ ra các cụm con khớp từ khóa.
                if (matchLienCum || sub.length > 0) {
                    return { 
                        ...lc, 
                        cums: matchLienCum ? lc.cums : sub 
                    };
                }
                
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
                this.renderIndirectRouteMapAndKPI(sourceData);
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
            this.renderIndirectRouteMapAndKPI(filtered);
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
