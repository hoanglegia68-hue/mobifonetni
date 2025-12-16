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
    chartInstances: {}, // Lưu chart instances để destroy khi vẽ lại
    currentKPIReportData: null, // Lưu dữ liệu báo cáo để dùng cho Popup Breakdown

    rentalConfig: {
        emails: "admin@mobifone.vn, quanly@mobifone.vn",
        alertDays: [90, 60],
        urgentDay: 30
    },

    // ============================================================
    // 2. INIT & AUTH (KHỞI TẠO & ĐĂNG NHẬP)
    // ============================================================
    async init() {
        console.log("App Starting... Version 05.03 (Standard Clean)");

        const savedUser = localStorage.getItem('MIS_USER');
        if (!savedUser) { window.location.href = 'login.html'; return; }
        this.currentUser = JSON.parse(savedUser);

        try {
            const [clusters, stores, gdvs, sales, b2b, indirect, bts] = await Promise.all([
                DataService.getClusters(), DataService.getStores(), DataService.getGDVs(),
                DataService.getSalesStaff(), DataService.getB2BStaff(), DataService.getIndirectChannels(), DataService.getBTS()
            ]);
            
            this.fullClusterData = this.normalizeDataSet(clusters);
            this.cachedData = { 
                stores: this.normalizeDataSet(stores), gdvs: this.normalizeDataSet(gdvs), 
                sales: this.normalizeDataSet(sales), b2b: this.normalizeDataSet(b2b), 
                indirect: this.normalizeDataSet(indirect), bts: this.normalizeDataSet(bts) 
            }; 
        } catch (error) { console.error("Lỗi data:", error); }

        this.buildDictionary();
        this.initKPIReportTab(); 
        this.updateUserInterface();
        this.renderFooter();
        lucide.createIcons();
        this.navigate('dashboard');
    },

    logout() {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            localStorage.removeItem('MIS_USER');
            localStorage.removeItem('MIS_LOCAL_DATA'); 
            window.location.href = 'login.html';
        }
    },

    // ============================================================
    // 3. LOGIC XỬ LÝ DỮ LIỆU KPI & BIỂU ĐỒ
    // ============================================================
    // TRONG FILE main.js
// ============================================================
    // UPDATE: TÁCH RIÊNG PLAN CỤM (kpi_planning) VÀ NV (kpi_emp)
    // ============================================================
    async handleKPIReportFilter() {
        console.log("Loading Staff & KPI Data (Separated Logic)...");
        
        // 1. Lấy giá trị bộ lọc
        const dFrom = document.getElementById('dash-date-from')?.value;
        const dTo = document.getElementById('dash-date-to')?.value;
        const scope = document.getElementById('filter-scope')?.value || 'all';
        const channelFilter = document.getElementById('filter-channel')?.value || 'all';
        const kpiFilter = document.getElementById('filter-kpi')?.value || 'all';

        if (!dFrom || !dTo) return alert("Vui lòng chọn khoảng thời gian!");

        try {
            // 2. Tải dữ liệu: Thêm getKPIEmpPlans() vào Promise
            const [raw, plans, empPlans, struct, logs, listGDV, listSales, listB2B] = await Promise.all([
                DataService.getKPIActual(dFrom.substring(0,7), dTo.substring(0,7), null),
                DataService.getKPIPlanning(),  // Sheet kpi_planning (Chỉ chứa Cụm)
                DataService.getKPIEmpPlans(),  // [MỚI] Sheet kpi_emp (Chỉ chứa Nhân viên)
                DataService.getKPIStructure(),
                DataService.getKPILogs(),
                DataService.getGDVs(),
                DataService.getSalesStaff(),
                DataService.getB2BStaff()
            ]);

            const rawData = this.normalizeDataSet(raw);
            const planData = this.normalizeDataSet(plans);     // Dữ liệu kế hoạch Cụm
            const empPlanData = this.normalizeDataSet(empPlans); // Dữ liệu kế hoạch Nhân viên
            const logData = this.normalizeDataSet(logs);

            // 3. Map & Init (Giữ nguyên)
            const userChannelMap = {};
            logData.forEach(l => {
                const nv = l.maNV || l.MaNV;
                const ch = (l.channelType || 'KHÁC').split('-')[0].trim();
                if(nv) userChannelMap[nv] = ch;
            });

            const typeMap = {}; 
            struct.forEach(s => { 
                if(s.active) {
                    const k = app.cleanCode(s.ma);
                    const u = (s.dvt || '').toLowerCase();
                    typeMap[k] = (u === 'tb' || u.includes('thuê bao')) ? 'sub' : 'rev';
                }
            });

            // Init data structure
            const initData = () => ({ actual: 0, plan: 0, daily: {}, channel: {}, cluster: {}, breakdown: {} });
            const subData = initData();
            const revData = initData();
            const initClusterObj = () => ({ actual: 0, plan: 0 });
            const initBreakdownObj = () => ({ actual: 0, plan: 0, channels: {} });
            const staffMap = {}; // Map lưu trữ KPI nhân viên

            // --- 4. TÍNH TOÁN KPI THỰC HIỆN (ACTUAL) ---
            // (Giữ nguyên Logic tính thực hiện)
            rawData.forEach(row => {
                const parsed = this.parseDateKey(row.date);
                if (parsed.full < dFrom || parsed.full > dTo) return;
                if (!this.checkScope(row)) return;

                if (scope !== 'all') {
                    if (scope.startsWith('LC-') && row.maLienCum !== scope) return;
                    if (scope.startsWith('C-') && row.maCum !== scope) return;
                }

                const kpi = app.cleanCode(row.maKpi);
                if (kpiFilter !== 'all' && kpi !== kpiFilter) return;
                const type = typeMap[kpi];
                if (!type) return;

                const nv = row.maNV || row.MaNV;
                const rowChannel = userChannelMap[nv] || 'KHÁC';
                if (channelFilter !== 'all' && rowChannel !== channelFilter) return;

                let val = Number(row.giaTri) || 0;
                if (type === 'sub') val = 1; else val = val / 1000000;

                // Cộng dồn KPI Chung
                const targetData = type === 'sub' ? subData : revData;
                targetData.actual += val;
                const dKey = parsed.full;
                if (!targetData.daily[dKey]) targetData.daily[dKey] = 0;
                targetData.daily[dKey] += val;
                if (!targetData.channel[rowChannel]) targetData.channel[rowChannel] = 0;
                targetData.channel[rowChannel] += val;
                const cKey = row.maLienCum || 'KHÁC'; 
                if (!targetData.cluster[cKey]) targetData.cluster[cKey] = initClusterObj();
                targetData.cluster[cKey].actual += val;

                // Cộng dồn KPI Nhân viên (Actual)
                if (nv) {
                    const nvCode = String(nv).trim().toUpperCase();
                    if (!staffMap[nvCode]) staffMap[nvCode] = { actual: 0, plan: 0 };
                    staffMap[nvCode].actual += val;
                }
            });

            // =========================================================
            // 5. TÍNH TOÁN KPI KẾ HOẠCH (PLAN) - TÁCH 2 LUỒNG
            // =========================================================
            
            // Xác định các tháng cần lấy
            const relevantMonths = new Set();
            let curr = new Date(dFrom);
            const dateEnd = new Date(dTo);
            while (curr <= dateEnd) {
                const y = curr.getFullYear();
                const m = String(curr.getMonth() + 1).padStart(2, '0');
                relevantMonths.add(`${y}-${m}`);
                curr.setMonth(curr.getMonth() + 1);
            }

            // Hàm helper check tháng (Smart Parsing)
            const checkMonth = (rowMonth) => {
                let mKey = '';
                if (typeof rowMonth === 'string') {
                    rowMonth = rowMonth.trim();
                    if (rowMonth.match(/^\d{4}-\d{2}/)) mKey = rowMonth.substring(0, 7);
                    else if (rowMonth.includes('/')) {
                        const parts = rowMonth.split('/');
                        if (parts.length >= 2) mKey = parts[2].length === 4 ? `${parts[2]}-${parts[0].padStart(2,'0')}` : `${parts[2]}-${parts[1]}`;
                    }
                } else if (rowMonth instanceof Date && !isNaN(rowMonth)) {
                    mKey = `${rowMonth.getFullYear()}-${String(rowMonth.getMonth() + 1).padStart(2, '0')}`;
                }
                return relevantMonths.has(mKey);
            };

            // --- LUỒNG 1: DUYỆT SHEET KPI_PLANNING (Cho Cụm/Liên Cụm) ---
            planData.forEach(row => {
                if (!checkMonth(row.month || row.thang)) return;
                
                // Check Scope
                if (scope !== 'all') {
                    if (scope.startsWith('LC-') && row.maLienCum !== scope) return;
                    if (scope.startsWith('C-') && row.maCum !== scope) return;
                }

                const kpi = app.cleanCode(row.maKpi || row.maKPI);
                if (kpiFilter !== 'all' && kpi !== kpiFilter) return;
                const type = typeMap[kpi];
                if (!type) return;

                let val = Number(row.giaTri || row.keHoach) || 0;

                // Chỉ cộng dồn vào Báo cáo Chung (Biểu đồ)
                const targetData = type === 'sub' ? subData : revData;
                targetData.plan += val;

                const cKey = row.maLienCum || 'KHÁC';
                if (!targetData.cluster[cKey]) targetData.cluster[cKey] = initClusterObj();
                targetData.cluster[cKey].plan += val;

                const cumCode = row.maCum || 'KHÁC';
                if (!targetData.breakdown[cumCode]) targetData.breakdown[cumCode] = initBreakdownObj();
                targetData.breakdown[cumCode].plan += val;
            });

            // --- LUỒNG 2: DUYỆT SHEET KPI_EMP (Cho Nhân viên) ---
            empPlanData.forEach(row => {
                if (!checkMonth(row.month || row.thang)) return;

                const kpi = app.cleanCode(row.maKpi || row.maKPI);
                if (kpiFilter !== 'all' && kpi !== kpiFilter) return;
                const type = typeMap[kpi];
                if (!type) return;

                let val = Number(row.keHoach || row.giaTri) || 0;
                
                // Lấy mã NV
                const rawNV = row.maNV || row.MaNV || row.manv; 
                if (rawNV) {
                    const nvCode = String(rawNV).trim().toUpperCase();

                    // Logic Scope cho Nhân viên (Nếu cần check NV này thuộc Cụm nào)
                    // Lưu ý: Sheet kpi_emp có thể không có cột maCum, nên ta không lọc scope ở đây 
                    // mà sẽ lọc ở bước hiển thị (processStaffGroup) dựa vào danh sách nhân sự gốc.

                    if (!staffMap[nvCode]) {
                        staffMap[nvCode] = { 
                            code: nvCode, 
                            actual: 0, 
                            plan: 0
                        };
                    }

                    // Quy đổi đơn vị cho nhân viên
                    let valStaff = val;
                    if (type !== 'sub') {
                        if (val > 5000) valStaff = val / 1000000; 
                    }
                    
                    staffMap[nvCode].plan += valStaff;
                }
            });

            // --- 6. PHÂN LOẠI 3 LỰC LƯỢNG (GDV, SALES, B2B) ---
            // (Đoạn này giữ nguyên logic chuẩn 100% đã sửa ở câu trước)
            const processStaffGroup = (sourceList) => {
                const resultList = [];
                let totalActual = 0;
                let totalPlan = 0;

                sourceList.forEach(staff => {
                    if (scope !== 'all') {
                         if (scope.startsWith('LC-') && staff.maLienCum !== scope) return;
                         if (scope.startsWith('C-') && staff.maCum !== scope) return;
                    }

                    const staffCode = String(staff.maNV || '').trim().toUpperCase();
                    const kpiData = staffMap[staffCode] || { actual: 0, plan: 0 };
                    
                    totalActual += kpiData.actual;
                    totalPlan += kpiData.plan;

                    resultList.push({
                        code: staff.maNV, 
                        name: staff.ten,
                        maCum: staff.maCum,
                        actual: kpiData.actual,
                        plan: kpiData.plan,
                        percent: kpiData.plan > 0 ? ((kpiData.actual / kpiData.plan) * 100).toFixed(1) : (kpiData.actual > 0 ? 100 : 0)
                    });
                });

                resultList.sort((a, b) => Number(b.percent) - Number(a.percent));

                return {
                    list: resultList,
                    totalActual,
                    totalPlan,
                    totalCount: resultList.length,
                    totalPercent: totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : 0
                };
            };

            const groupGDV = processStaffGroup(listGDV);
            const groupSales = processStaffGroup(listSales);
            const groupB2B = processStaffGroup(listB2B);

            this.currentStaffDataGroups = {
                gdv: groupGDV.list,
                sales: groupSales.list,
                b2b: groupB2B.list
            };
            this.currentKPIReportData = { sub: subData, rev: revData };

            // --- 7. RENDER GIAO DIỆN ---
            UIRenderer.renderKPIReport({ sub: subData, rev: revData }, { dFrom, dTo });

            if (UIRenderer.renderStaffPerformance) {
                UIRenderer.renderStaffPerformance({
                    gdv: groupGDV,
                    sales: groupSales,
                    b2b: groupB2B
                });
            }

        } catch (e) { console.error("Lỗi xử lý báo cáo:", e); }
    },

    // Hàm mở Modal chi tiết cho từng loại NV
    showStaffDetailModal(type) {
        if (!this.currentStaffDataGroups || !this.currentStaffDataGroups[type]) return alert("Không có dữ liệu!");
        
        const data = this.currentStaffDataGroups[type];
        let title = "Chi tiết Nhân viên";
        if(type === 'gdv') title = "Hiệu suất Giao Dịch Viên";
        if(type === 'sales') title = "Hiệu suất NV Bán Hàng";
        if(type === 'b2b') title = "Hiệu suất NV KHDN (B2B)";

        document.getElementById('modal-detail-title').textContent = title;
        document.getElementById('modal-detail-subtitle').textContent = `Số lượng: ${data.length} nhân sự`;
        
        UIRenderer.renderDetailModalContent('staff-performance', data);
        document.getElementById('modal-detail-list').classList.add('open');
    },

    // Xử lý khi bộ lọc Dashboard thay đổi (All / Liên Cụm / Cụm)
    handleDashboardFilter(scope) {
        console.log("Dashboard Filter Changed:", scope);
        // Gọi hàm renderDashboard với scope mới để vẽ lại toàn bộ dữ liệu (Thẻ số liệu + Bảng)
        UIRenderer.renderDashboard(scope);
    },
    // Hàm xử lý khi Click vào biểu đồ Kênh (Tỷ trọng)
    handleChannelChartClick(type, channelName) {
        if (!this.currentKPIReportData || !this.currentKPIReportData[type]) return;

        console.log(`Xem chi tiết kênh: ${channelName} (${type})`);
        
        const breakdownData = this.currentKPIReportData[type].breakdown;
        
        // Tạo danh sách hiển thị
        let list = Object.keys(breakdownData).map(cumCode => {
            const cumData = breakdownData[cumCode];
            const val = cumData.channels[channelName] || 0;
            const totalCum = cumData.actual; // Tổng sản lượng của Cụm đó
            
            // Chỉ lấy những cụm có số liệu của kênh này
            if (val <= 0) return null;

            return {
                code: cumCode,
                name: this.getNameCum(cumCode) || cumCode,
                value: val, // Giá trị của kênh này tại cụm này
                total: totalCum, // Tổng cụm để tính tỷ trọng
                percent: totalCum > 0 ? ((val / totalCum) * 100).toFixed(1) : 0
            };
        }).filter(item => item !== null);

        // Sắp xếp giảm dần theo sản lượng
        list.sort((a, b) => b.value - a.value);

        // Hiển thị Modal
        const labelType = type === 'sub' ? 'Thuê bao' : 'Doanh thu';
        document.getElementById('modal-detail-title').textContent = `Chi tiết ${labelType} - Kênh: ${channelName}`;
        document.getElementById('modal-detail-subtitle').textContent = `Phân bổ theo Cụm`;
        
        UIRenderer.renderDetailModalContent('kpi-channel-detail', list);
        document.getElementById('modal-detail-list').classList.add('open');
    },

    // Hàm hiển thị Popup Breakdown (chung)
   // ... (Giữ nguyên các phần code khác)

    // ============================================================
    // NÂNG CẤP: XỬ LÝ CLICK BIỂU ĐỒ & CHI TIẾT (CỤM/LIÊN CỤM)
    // ============================================================
    
    // 1. XỬ LÝ CHI TIẾT THỰC HIỆN vs KẾ HOẠCH
    showKPIBreakdown(type, viewLevel = 'cum') {
        if (!this.currentKPIReportData || !this.currentKPIReportData[type]) return;
        
        const rawBreakdown = this.currentKPIReportData[type].breakdown; // Dữ liệu gốc đang theo Cụm
        let list = [];

        if (viewLevel === 'cum') {
            // Mức Cụm: Lấy trực tiếp
            list = Object.keys(rawBreakdown).map(code => ({
                code: code,
                name: this.getNameCum(code) || code,
                actual: rawBreakdown[code].actual,
                plan: rawBreakdown[code].plan,
                percent: this.calcPercent(rawBreakdown[code].actual, rawBreakdown[code].plan)
            }));
        } else {
            // Mức Liên Cụm: Cộng dồn (Aggregate)
            const agg = {};
            Object.keys(rawBreakdown).forEach(cumCode => {
                // Tìm mã Liên Cụm cha của Cụm này
                const lcCode = this.getParentLienCum(cumCode) || 'KHÁC'; 
                if (!agg[lcCode]) agg[lcCode] = { actual: 0, plan: 0 };
                
                agg[lcCode].actual += rawBreakdown[cumCode].actual;
                agg[lcCode].plan += rawBreakdown[cumCode].plan;
            });

            list = Object.keys(agg).map(code => ({
                code: code,
                name: this.getNameLienCum(code) || code,
                actual: agg[code].actual,
                plan: agg[code].plan,
                percent: this.calcPercent(agg[code].actual, agg[code].plan)
            }));
        }

        // Sắp xếp: Thực hiện giảm dần
        list.sort((a, b) => b.actual - a.actual);

        // Render UI
        const labelType = type === 'sub' ? 'Thuê bao' : 'Doanh thu';
        document.getElementById('modal-detail-title').textContent = `Chi tiết ${labelType} - Thực hiện vs Kế hoạch`;
        document.getElementById('modal-detail-subtitle').textContent = `Dữ liệu tổng hợp theo: ${viewLevel === 'cum' ? 'Cụm' : 'Liên Cụm'}`;
        
        // Truyền thêm metadata để UI vẽ nút chuyển đổi
        UIRenderer.renderDetailModalContent('kpi-breakdown', list, { type, viewLevel });
        document.getElementById('modal-detail-list').classList.add('open');
    },

    // 2. XỬ LÝ CHI TIẾT THEO KÊNH (CHANNEL)
    handleChannelChartClick(type, channelName, viewLevel = 'cum') {
        if (!this.currentKPIReportData || !this.currentKPIReportData[type]) return;

        console.log(`Chi tiết kênh: ${channelName} (${type}) - Level: ${viewLevel}`);
        const breakdownData = this.currentKPIReportData[type].breakdown;
        let list = [];

        if (viewLevel === 'cum') {
            list = Object.keys(breakdownData).map(cumCode => {
                const cumData = breakdownData[cumCode];
                const val = cumData.channels[channelName] || 0;
                const totalCum = cumData.actual; 
                if (val <= 0) return null;

                return {
                    code: cumCode,
                    name: this.getNameCum(cumCode) || cumCode,
                    value: val,
                    total: totalCum,
                    percent: this.calcPercent(val, totalCum) // Tỷ trọng kênh trong cụm
                };
            }).filter(item => item !== null);
        } else {
            // Aggregate theo Liên Cụm
            const agg = {};
            Object.keys(breakdownData).forEach(cumCode => {
                const lcCode = this.getParentLienCum(cumCode) || 'KHÁC';
                const cumData = breakdownData[cumCode];
                const val = cumData.channels[channelName] || 0;
                
                if (!agg[lcCode]) agg[lcCode] = { value: 0, total: 0 };
                agg[lcCode].value += val;
                agg[lcCode].total += cumData.actual;
            });

            list = Object.keys(agg).map(lcCode => {
                if (agg[lcCode].value <= 0) return null;
                return {
                    code: lcCode,
                    name: this.getNameLienCum(lcCode) || lcCode,
                    value: agg[lcCode].value,
                    total: agg[lcCode].total,
                    percent: this.calcPercent(agg[lcCode].value, agg[lcCode].total)
                };
            }).filter(item => item !== null);
        }

        list.sort((a, b) => b.value - a.value);

        const labelType = type === 'sub' ? 'Thuê bao' : 'Doanh thu';
        document.getElementById('modal-detail-title').textContent = `Chi tiết ${labelType} - Kênh: ${channelName}`;
        document.getElementById('modal-detail-subtitle').textContent = `Phân bổ theo: ${viewLevel === 'cum' ? 'Cụm' : 'Liên Cụm'}`;
        
        UIRenderer.renderDetailModalContent('kpi-channel-detail', list, { type, channelName, viewLevel });
        document.getElementById('modal-detail-list').classList.add('open');
    },

    // HELPER: Tính toán % và Tìm cha
    calcPercent(actual, plan) {
        if (!plan || plan === 0) return actual > 0 ? 100 : 0;
        return ((actual / plan) * 100).toFixed(1);
    },

    getParentLienCum(cumCode) {
        // Tìm trong fullClusterData xem Cụm này thuộc Liên Cụm nào
        for (const lc of this.fullClusterData) {
            if (lc.cums.some(c => c.maCum === cumCode)) {
                return lc.maLienCum;
            }
        }
        return null;
    },


    // ============================================================
    // 4. BUSINESS DATA & USER LOGS
    // ============================================================
    async loadBusinessDataPage() {
        console.log("Loading Business Data...");
        const mFrom = document.getElementById('biz-month-from')?.value || '2025-12';
        const mTo = document.getElementById('biz-month-to')?.value || '2025-12';
        const viewMode = document.getElementById('view-mode')?.value || 'cluster';

        const [raw, plans, struct] = await Promise.all([
            DataService.getKPIActual(mFrom, mTo, null),
            DataService.getKPIPlanning(),
            DataService.getKPIStructure()
        ]);

        const rawData = this.normalizeDataSet(raw);
        const planData = this.normalizeDataSet(plans);

        const cleanStructure = struct.filter(s => s.active).map(s => ({
            ...s, ma: this.cleanCode(s.ma), tenHienThi: s.tenHienThi || s.ten || s.ma
        }));
        const kpiKeys = cleanStructure.map(k => k.ma);
        const unitMap = {}; cleanStructure.forEach(s => unitMap[s.ma] = (s.dvt||'').toLowerCase());

        const aggData = {};
        const keyField = viewMode === 'liencum' ? 'maLienCum' : 'maCum';
        const nameMap = viewMode === 'liencum' ? this.mapLienCum : this.mapCum;

        planData.forEach(row => {
            const m = (row.month || row.thang || '').substring(0, 7);
            if (m < mFrom || m > mTo) return;
            let code = row[keyField];
            if (!code && viewMode === 'liencum' && row.maLienCum) code = row.maLienCum;
            if (!code || !this.checkScope({[keyField]: code})) return;

            const uKey = `${code}_${m}`;
            if (!aggData[uKey]) aggData[uKey] = { ma: code, hienThi: nameMap[code]||code, month: m, ...this.initKPIObj(kpiKeys) };
            const kpi = this.cleanCode(row.maKpi);
            if (kpiKeys.includes(kpi)) aggData[uKey][`${kpi}_KH`] += (Number(row.giaTri)||0);
        });

        rawData.forEach(row => {
            const parsed = this.parseDateKey(row.date);
            if (parsed.month < mFrom || parsed.month > mTo) return;
            const code = row[keyField] || 'KHÁC';
            if (!this.checkScope(row)) return;

            const uKey = `${code}_${parsed.month}`;
            if (!aggData[uKey]) aggData[uKey] = { ma: code, hienThi: nameMap[code]||code, month: parsed.month, ...this.initKPIObj(kpiKeys) };
            const kpi = this.cleanCode(row.maKpi);
            let actual = Number(row.giaTri)||0;
            const u = unitMap[kpi];
            if (u === 'tb' || u.includes('thuê bao')) actual = 1;
            else if (u.includes('doanh thu')) actual = actual; 
            if (kpiKeys.includes(kpi)) aggData[uKey][`${kpi}_TH`] += actual;
        });

        const processed = Object.values(aggData);
        if (processed.length > 0) {
            const total = { id: 'TOTAL', hienThi: 'TỔNG CỘNG', isTotal: true, ma: 'TOTAL', ...this.initKPIObj(kpiKeys) };
            kpiKeys.forEach(k => {
                total[`${k}_TH`] = processed.reduce((s, i) => s + (i[`${k}_TH`]||0), 0);
                total[`${k}_KH`] = processed.reduce((s, i) => s + (i[`${k}_KH`]||0), 0);
            });
            processed.push(total);
        }
        UIRenderer.renderKPIActualTable(processed, cleanStructure);
        this.renderKPIStructureTab(struct);
    },

    initKPIObj(keys) { return keys.reduce((acc, k) => ({...acc, [`${k}_TH`]: 0, [`${k}_KH`]: 0}), {}); },

    async renderKPIStructureTab(struct) {
        let data = struct || await DataService.getKPIStructure();
        UIRenderer.renderKPIStructureTable(data.map(s => ({...s, ma: this.cleanCode(s.ma), tenHienThi: s.tenHienThi||s.ten})));
    },

    async renderPlanningTab() {
        const struct = await DataService.getKPIStructure();
        const plans = await DataService.getKPIPlanning();
        const m = document.getElementById('planning-month')?.value || '2025-12';
        document.getElementById('planning-month').value = m;
        const pMap = {};
        this.normalizeDataSet(plans).forEach(row => {
            if ((row.month||row.thang).substring(0, 7) === m) pMap[`${row.maCum}_${app.cleanCode(row.maKpi)}`] = row.keHoach || row.giaTri;
        });
        const activeKPIs = struct.filter(k => k.active).map(k => ({ ...k, ma: this.cleanCode(k.ma), tenHienThi: k.tenHienThi || k.ten || k.ma }));
        let rows = [];
        this.filterDataByScope(this.fullClusterData).forEach(lc => {
            lc.cums.forEach(c => rows.push({ maLienCum: lc.maLienCum, tenLienCum: lc.tenLienCum, maCum: c.maCum, tenCum: c.tenCum }));
        });
        UIRenderer.renderPlanningTable(rows, activeKPIs, pMap);
    },

    async savePlanningData() {
        const inputs = document.querySelectorAll('.plan-input');
        const m = document.getElementById('planning-month')?.value; 
        if (!m) return alert("Chưa chọn tháng!");
        const payload = [];
        inputs.forEach(i => {
            const val = Number(i.value.replace(/\./g, '')) || 0;
            if (val > 0) payload.push({ thang: m, maCum: i.dataset.cum, maKpi: i.dataset.kpi, keHoach: val });
        });
        if (!payload.length) return alert("Chưa có dữ liệu!");
        console.log("Saving...", payload);
        alert(`Đã lưu ${payload.length} chỉ tiêu (Demo).`);
    },

    async loadUserLogPage() {
        const logs = this.normalizeDataSet(await DataService.getKPILogs());
        this.cachedLogData = logs;
        const stats = {};
        logs.forEach(l => {
            if(l.maCum && l.maNV && this.checkScope(l)) {
                if(!stats[l.maCum]) stats[l.maCum] = new Set();
                stats[l.maCum].add(l.maNV);
            }
        });
        const arr = Object.keys(stats).map(k => ({ maCum: k, tenCum: this.getNameCum(k), userCount: stats[k].size }));
        UIRenderer.renderClusterStats(arr);
        UIRenderer.renderUserLogFilter(arr.map(s => s.maCum).sort());
        UIRenderer.renderKPIUserLogs([]);
    },

    handleUserFilterChange(cum) {
        if(!cum) { UIRenderer.renderKPIUserLogs([]); return; }
        const users = new Map();
        this.cachedLogData.filter(l => l.maCum === cum).forEach(l => {
            const id = l.maNV || l.MaNV;
            if(id) {
                if(!users.has(id)) users.set(id, { maNV: id, maCum: cum, channels: new Set(), totalLogs: 0 });
                const u = users.get(id);
                if(l.channelType) u.channels.add(l.channelType.split('-')[0].trim());
                u.totalLogs++;
            }
        });
        UIRenderer.renderKPIUserLogs(Array.from(users.values()).map(u => ({...u, channelStr: Array.from(u.channels).join(', ')})));
    },

    // ============================================================
    // 5. HELPER & UTILS
    // ============================================================
    normalizeDataSet(data) {
        if (!Array.isArray(data)) return [];
        return data.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => newRow[key.trim()] = row[key]);
            return newRow;
        });
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
            if (lc.maLienCum) this.mapLienCum[lc.maLienCum] = lc.tenLienCum;
            lc.cums.forEach(c => { if (c.maCum) this.mapCum[c.maCum] = c.tenCum; });
        });
    },

    getNameLienCum(code) { return this.mapLienCum[code] || code || ''; },
    getNameCum(code) { return this.mapCum[code] || code || ''; },
    cleanCode(code) { return String(code || '').trim().toUpperCase().replace('KPI_', ''); },

    // ============================================================
    // 6. UI & NAVIGATION
    // ============================================================
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
            document.body.insertAdjacentHTML('beforeend', `<div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50"> hoang.lehuu | Ver 05.03</div>`);
        }
    },

    filterDataByScope(data, fieldId = 'maLienCum') {
        const user = this.currentUser;
        if (user.role === 'admin' || user.scope === 'all') return data;
        return data.filter(item => item[fieldId] === user.scope || item.tenLienCum === user.scope);
    },

    checkScope(item) {
        const user = this.currentUser;
        if (user.role === 'admin' || user.scope === 'all') return true;
        return (item.maLienCum === user.scope || item.maCum === user.scope);
    },

    navigate(pageId) {
        if (pageId === 'system' && this.currentUser.role !== 'admin') return alert("Không có quyền!");
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const link = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
        if(link) link.classList.add('active');

        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const view = document.getElementById(`view-${pageId}`);
        if(view) {
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

    async loadDataForPage(pageId) {
        if (pageId === 'dashboard') {
            const sel = document.getElementById('dashboard-scope-select'); if(sel) sel.value = 'all';
            UIRenderer.renderDashboard('all');
            const btn = document.querySelector('[onclick*="dash-overview"]');
            if (btn) this.switchTab('dash-overview', btn); 
        }
        else if (pageId === 'business_data') {
            const btn = document.querySelector('[onclick*="tab-kpi-thuchien"]');
            if (btn) this.switchTab('tab-kpi-thuchien', btn); else this.loadBusinessDataPage();
        }
        else if (pageId === 'clusters') UIRenderer.renderClusterTable(this.filterDataByScope(this.fullClusterData));
        else if (pageId === 'direct_channel') {
             const { stores, gdvs, sales, b2b } = this.cachedData;
             UIRenderer.renderStoresTable(this.filterDataByScope(stores));
             UIRenderer.renderGDVTable(this.filterDataByScope(gdvs));
             UIRenderer.renderSalesTable(this.filterDataByScope(sales));
             UIRenderer.renderB2BTable(this.filterDataByScope(b2b));
        }
        else if (pageId === 'indirect_channel') UIRenderer.renderIndirectTable(this.filterDataByScope(this.cachedData.indirect));
        else if (pageId === 'bts') UIRenderer.renderBTSTable(this.filterDataByScope(this.cachedData.bts));
    },

    switchTab(tabId, btn) {
        const p = btn.closest('.view-section'); 
        if (!p) return; 

        p.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.remove('hidden');

        p.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if(tabId === 'dash-charts') {
            this.initKPIReportTab();
            this.handleKPIReportFilter(); 
        }
        if(tabId === 'tab-kpi-thuchien') this.loadBusinessDataPage(); 
        if(tabId === 'tab-kehoach') this.renderPlanningTab(); 
        if(tabId === 'tab-user-ghinhan') this.loadUserLogPage(); 
    },
    
    // ============================================================
    // 7. MODAL & SEARCH & OTHERS
    // ============================================================
// ============================================================
    // BỔ SUNG LOGIC NẠP DỮ LIỆU KPI VÀO DROPDOWN
    // ============================================================
    async initKPIReportTab() {
        const selScope = document.getElementById('filter-scope');
        const selKPI = document.getElementById('filter-kpi'); // Đã có
        
        // 1. Nạp Scope (Giữ nguyên code cũ của bạn)
        if (selScope && selScope.options.length <= 1) {
            selScope.innerHTML = '<option value="all">-- Tất cả Phạm vi --</option>';
            let lcGroup = document.createElement('optgroup');
            lcGroup.label = "--- LIÊN CỤM ---";
            Object.keys(this.mapLienCum).forEach(k => {
                lcGroup.innerHTML += `<option value="${k}">${this.mapLienCum[k]}</option>`;
            });
            selScope.appendChild(lcGroup);
            let cGroup = document.createElement('optgroup');
            cGroup.label = "--- CỤM ---";
            Object.keys(this.mapCum).forEach(k => {
                cGroup.innerHTML += `<option value="${k}">${this.mapCum[k]}</option>`;
            });
            selScope.appendChild(cGroup);
        }

        // 2. [QUAN TRỌNG] BỔ SUNG ĐOẠN NÀY ĐỂ NẠP KPI
        if (selKPI && selKPI.options.length <= 1) {
            try {
                const struct = await DataService.getKPIStructure();
                let html = '<option value="all">Tất cả Chỉ tiêu</option>';
                struct.forEach(s => {
                    if (s.active) {
                        const code = this.cleanCode(s.ma);
                        const label = s.tenHienThi || s.ten || code;
                        html += `<option value="${code}">${label}</option>`;
                    }
                });
                selKPI.innerHTML = html;
            } catch (e) { console.error("Lỗi load KPI options:", e); }
        }

        // 3. Nạp Channel (Giữ nguyên code cũ của bạn)
        const logs = this.normalizeDataSet(await DataService.getKPILogs());
        const channels = new Set();
        logs.forEach(l => { if(l.channelType) channels.add(l.channelType.split('-')[0].trim()); });
        
        const selChannel = document.getElementById('filter-channel');
        if (selChannel && selChannel.options.length <= 1) {
            selChannel.innerHTML = '<option value="all">Tất cả Kênh</option>';
            channels.forEach(c => selChannel.innerHTML += `<option value="${c}">${c}</option>`);
        }

        // 4. Setup ngày tháng (Giữ nguyên code cũ của bạn)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        
        const dFrom = document.getElementById('dash-date-from');
        const dTo = document.getElementById('dash-date-to');
        if(dFrom && !dFrom.value) dFrom.value = `${y}-${m}-01`;
        if(dTo && !dTo.value) dTo.value = `${y}-${m}-${d}`;

        const btn = document.getElementById('btn-apply-report-filter');
        if (btn && !btn.hasAttribute('data-init')) {
            btn.addEventListener('click', () => this.handleKPIReportFilter());
            btn.setAttribute('data-init', 'true');
        }
    },

    openUploadModal(type) { document.getElementById('upload-type').value = type; document.getElementById('modal-upload').classList.add('open'); },
    closeModal(id) { document.getElementById(id||'modal-edit-ward').classList.remove('open'); },
    openRentConfigModal() { if(this.currentUser.role === 'admin') document.getElementById('modal-rent-config').classList.add('open'); else alert('Quyền hạn chế!'); },
    saveRentConfig() { alert("Đã lưu cấu hình (Demo)!"); this.closeModal('modal-rent-config'); },
    
    handleSearchCluster(k) {
        k = k.toLowerCase().trim();
        let d = this.filterDataByScope(this.fullClusterData);
        if(!k) { UIRenderer.renderClusterTable(d); return; }
        const res = d.map(lc => {
            const sub = lc.cums.filter(c => (c.tenCum||'').toLowerCase().includes(k));
            if(sub.length || (lc.tenLienCum||'').toLowerCase().includes(k)) return {...lc, cums: sub.length?sub:lc.cums};
            return null;
        }).filter(Boolean);
        UIRenderer.renderClusterTable(res);
    },
    handleSearchIndirect(k) { 
        let d = this.filterDataByScope(this.cachedData.indirect);
        UIRenderer.renderIndirectTable(k ? d.filter(i => (i.ten||'').toLowerCase().includes(k.toLowerCase())) : d);
    },
    handleSearchBTS(k) {
        let d = this.filterDataByScope(this.cachedData.bts);
        UIRenderer.renderBTSTable(k ? d.filter(i => (i.tenTram||'').toLowerCase().includes(k.toLowerCase())) : d);
    },
    handleSearchStore(k) { UIRenderer.renderStoresTable(k ? this.cachedData.stores.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.stores); },
    handleSearchGDV(k) { UIRenderer.renderGDVTable(k ? this.cachedData.gdvs.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.gdvs); },
    handleSearchSales(k) { UIRenderer.renderSalesTable(k ? this.cachedData.sales.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.sales); },
    handleSearchB2B(k) { UIRenderer.renderB2BTable(k ? this.cachedData.b2b.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.b2b); },

    async showDashboardDetail(type, scope) {
        let scopeType = 'liencum'; 
        if (scope && scope.startsWith('C-')) scopeType = 'cum';
        const realType = type === 'geo' ? 'commune' : type;
        console.log(`Open Detail: Type=${realType}, Scope=${scope}, Level=${scopeType}`);
        this.showDetailModal(realType, scope, scopeType);
    },

    async showDetailModal(type, scope, stype) {
        let title = '';
        let detailData = []; 
        const { stores, gdvs, sales, b2b, bts, indirect } = this.cachedData;

        const filterFn = (item) => {
            if (scope === 'all') return true;
            const field = stype === 'liencum' ? 'maLienCum' : 'maCum';
            return (item[field] || '').toString() === scope.toString();
        };
        
        if (type === 'commune') {
            title = 'Chi tiết Dân số & Phủ trạm theo Phường/Xã';
            this.fullClusterData.forEach(lc => {
                if (stype === 'liencum' && scope !== 'all' && lc.maLienCum !== scope) return;
                lc.cums.forEach(c => {
                    if (stype === 'cum' && c.maCum !== scope) return;
                    const enrichedPX = c.phuongXas.map(px => ({ ...px, tenLienCum: lc.tenLienCum, tenCum: c.tenCum }));
                    detailData.push(...enrichedPX);
                });
            });
        } 
        else if (type === 'store') { title = 'Danh sách Cửa hàng'; detailData = stores.filter(filterFn); }
        else if (type === 'gdv') { title = 'Danh sách Giao dịch viên'; detailData = gdvs.filter(filterFn); }
        else if (type === 'sales') { title = 'Danh sách NV Bán hàng'; detailData = sales.filter(filterFn); }
        else if (type === 'b2b') { title = 'Danh sách Khách hàng Doanh nghiệp'; detailData = b2b.filter(filterFn); }
        else if (type === 'bts') { title = 'Danh sách Trạm BTS'; detailData = bts.filter(filterFn); }
        else if (type === 'indirect') { title = 'Danh sách Kênh Gián tiếp (Đại lý/Điểm bán)'; detailData = indirect.filter(filterFn); }

        const modalTitle = document.getElementById('modal-detail-title');
        const modalSubtitle = document.getElementById('modal-detail-subtitle');
        const modalList = document.getElementById('modal-detail-list');

        if (modalTitle) modalTitle.textContent = title;
        if (modalSubtitle) {
            const scopeName = scope === 'all' ? 'Toàn Công Ty' : (this.getNameCum(scope) || this.getNameLienCum(scope) || scope);
            modalSubtitle.textContent = `Phạm vi: ${scopeName} | Số lượng: ${detailData.length}`;
        }
        
        UIRenderer.renderDetailModalContent(type, detailData);
        if (modalList) modalList.classList.add('open');
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
