/* ============================
 * main.js (FULL) — FINAL VERSION
 * Updates:
 * - Removed logic for Tab 3 & 4 in Dashboard.
 * - Disabled all tabs in Business Data page.
 * - Optimized generic functions.
 * ============================ */

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

    async init() {
        console.log("App Starting... Version Final (Customized)");

        const savedUser = localStorage.getItem('MIS_USER');
        if (!savedUser) {
            window.location.href = 'login.html';
            return;
        }
        this.currentUser = JSON.parse(savedUser);

        // --- Xử lý sự kiện Global ---
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768 && this.isSidebarOpen) {
                this.toggleSidebar();
            }
        });

        // --- Load Data Ban Đầu ---
        try {
            const [clusters, stores, gdvs, sales, b2b, indirect, bts] = await Promise.all([
                DataService.getClusters(), DataService.getStores(), DataService.getGDVs(),
                DataService.getSalesStaff(), DataService.getB2BStaff(), DataService.getIndirectChannels(), DataService.getBTS()
            ]);

            this.fullClusterData = this.normalizeDataSet(clusters);
            this.cachedData = {
                stores: this.normalizeDataSet(stores),
                gdvs: this.normalizeDataSet(gdvs),
                sales: this.normalizeDataSet(sales),
                b2b: this.normalizeDataSet(b2b),
                indirect: this.normalizeDataSet(indirect),
                bts: this.normalizeBTSData(this.normalizeDataSet(bts))
            };
        } catch (error) {
            console.error("Lỗi data init:", error);
        }

        this.buildDictionary();
        //this.initKPIReportTab();
        this.updateUserInterface();
        this.renderFooter();

        if (window.lucide) lucide.createIcons();
        
        // Mặc định vào Dashboard
        this.navigate('dashboard');
        this.calculateAndRenderRankings();

        // [FIX]: Tắt Loading Overlay
        const loadingOverlay = document.getElementById('global-loader');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden-loader');
        }
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
        console.log("--- TÍNH TOÁN XẾP HẠNG ---");

        // 1. Kiểm tra dữ liệu đầu vào
        if (!this.currentKPIReportData || !this.currentKPIReportData.sub) return;

        const filterScope = this.currentFilterScope || 'all';

        // Nguồn dữ liệu
        const kpiSourceLC = this.currentKPIReportData.sub.cluster;
        const kpiSourceCum = this.currentKPIReportData.sub.breakdown;

        // Hàm tính %
        const calcPercent = (act, pln) => {
            const a = Number(act) || 0;
            const p = Number(pln) || 0;
            if (p === 0) return a > 0 ? 100 : 0;
            return Math.round((a / p) * 100);
        };

        // --- 2. LOOP TÍNH TOÁN ---
        let listLC = [];
        let listCum = [];

        if (this.fullClusterData && this.fullClusterData.length > 0) {
            this.fullClusterData.forEach(lc => {
                // A. XỬ LÝ LIÊN CỤM
                const lcKey = app.cleanCode(lc.maLienCum);
                const kpiLC = kpiSourceLC[lc.maLienCum] || kpiSourceLC[lcKey] || { actual: 0, plan: 0 };

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
                        const cumKey = app.cleanCode(cum.maCum);
                        const kpiCum = kpiSourceCum[cum.maCum] || kpiSourceCum[cumKey] || { actual: 0, plan: 0 };

                        // --- TRUY QUÉT TỪ KHÓA SDT (SMART FIND) ---
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
            });
        }

        // 3. SẮP XẾP & RENDER
        listLC.sort((a, b) => b.percent - a.percent);
        listCum.sort((a, b) => b.percent - a.percent);

        UIRenderer.renderRankingTable('ranking-liencum-container', listLC);
        UIRenderer.renderRankingTable('ranking-cum-container', listCum);

        // --- 4. XỬ LÝ XẾP HẠNG NHÂN VIÊN ---
        if (!this.currentStaffDataGroups) return;

        const mapStaffRanking = (groupData, cachedSourceList) => {
            if (!groupData || !Array.isArray(groupData)) return [];

            // Tạo index O(n)
            const idx = new Map(
                (cachedSourceList || []).map(i => [String(i.maNV || "").trim().toUpperCase(), i])
            );

            let filtered = groupData;
            if (filterScope !== 'all') {
                const isLienCumSelected = app.mapLienCum && app.mapLienCum.hasOwnProperty(filterScope);
                filtered = groupData.filter(s => {
                    if (isLienCumSelected) {
                        const parentLC = app.getParentLienCum(s.maCum);
                        return parentLC === filterScope;
                    }
                    return s.maCum === filterScope;
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
    updateEmployeeSummaryBox(type, dataList) {
        // 1. Tính toán tổng
        let totalPlan = 0;
        let totalActual = 0;

        if (dataList && dataList.length > 0) {
            dataList.forEach(item => {
                totalPlan += Number(item.plan) || 0;
                totalActual += Number(item.actual) || 0;
            });
        }

        // 2. Tính phần trăm
        let percent = 0;
        if (totalPlan > 0) {
            percent = ((totalActual / totalPlan) * 100).toFixed(1);
        } else if (totalActual > 0) {
            percent = 100;
        }

        // 3. Update lên giao diện (DOM)
        // Cập nhật số lượng nhân sự (Count)
        const elCount = document.getElementById(`${type}-count`);
        if (elCount) elCount.textContent = dataList.length;

        // Cập nhật Thực hiện (Actual)
        const elActual = document.getElementById(`${type}-actual`);
        if (elActual) elActual.textContent = UIRenderer.formatNumber(totalActual);

        // Cập nhật Kế hoạch (Plan) - Nếu có hiển thị
        const elPlan = document.getElementById(`${type}-plan`);
        if (elPlan) elPlan.textContent = UIRenderer.formatNumber(totalPlan);

        // Cập nhật % (nếu có thẻ hiển thị %)
        const elPercent = document.getElementById(`${type}-percent`);
        if (elPercent) elPercent.textContent = `${percent}%`;

        // Cập nhật TBPTM BQ ngày/1 nhân viên nếu có
        const elAvgDay = document.getElementById(`${type}-tbptm-avgday`);
        if (elAvgDay) {
            const v = Number(this.currentTBPTMAvgDay?.[type]) || 0;
            const isInt = Math.abs(v - Math.round(v)) < 1e-9;
            elAvgDay.textContent = new Intl.NumberFormat('vi-VN', {
                minimumFractionDigits: isInt ? 0 : 1,
                maximumFractionDigits: 1
            }).format(v);
        }

    },

// Thêm biến này vào đầu file main.js hoặc trong object app (nếu chưa có)
    // _filterTimer: null, 

    async handleKPIReportFilter() {
        // [DEBOUNCE] Nếu đang có lệnh chạy chờ, hủy nó đi để chạy lệnh mới nhất
        if (this._filterTimer) clearTimeout(this._filterTimer);

        this._filterTimer = setTimeout(async () => {
            // --- BẮT ĐẦU LOGIC CŨ ---
            console.log("Loading KPI Report... (Debounced)");
            
            const dFrom = document.getElementById('dash-date-from')?.value;
            const dTo = document.getElementById('dash-date-to')?.value;
            const scope = document.getElementById('filter-scope')?.value || 'all';
            const channelFilter = document.getElementById('filter-channel')?.value || 'all';
            const kpiFilter = document.getElementById('filter-kpi')?.value || 'all';

            if (!dFrom || !dTo) return; // Bỏ alert để đỡ phiền khi init

            const parseYMD = (s) => {
                const [y, m, d] = String(s).split('-').map(n => parseInt(n, 10));
                return new Date(y, (m || 1) - 1, d || 1);
            };
            const pad2 = (n) => String(n).padStart(2, '0');
            const fmtYMD = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
            const fmtYM = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
            const addDays = (dt, days) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + days);
            const startOfWeekMon = (dt) => {
                const dow = dt.getDay(); 
                const offset = (dow + 6) % 7; 
                return addDays(dt, -offset);
            };
            const daysBetweenInclusive = (a, b) => {
                const ms = 86400000; 
                return Math.floor((b.getTime() - a.getTime()) / ms) + 1;
            };

            const dFromObj = parseYMD(dFrom);
            const dToObj = parseYMD(dTo);

            const startOfPrevYear = new Date(dToObj.getFullYear() - 1, 0, 1);
            const extStartObj = dFromObj < startOfPrevYear ? dFromObj : startOfPrevYear;
            const extStartStr = fmtYMD(extStartObj);
            const extMonthFrom = fmtYM(extStartObj);
            const extMonthTo = dTo.substring(0, 7);
            const cacheKey = `${extMonthFrom}|${extMonthTo}`;

            try {
                let raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B;

                // 1. KIỂM TRA CACHE (Tránh tải lại mạng nếu ngày không đổi)
                if (this.reportCache && this.reportCache.key === cacheKey && this.reportCache.data) {
                    console.log("⚡ Dùng dữ liệu KPI từ CACHE RAM");
                    ({ raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B } = this.reportCache.data);
                } else {
                    console.log(`🌐 Tải dữ liệu từ Server... (${cacheKey})`);
                    [raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B] = await Promise.all([
                        DataService.getKPIActual(extMonthFrom, extMonthTo, null),
                        DataService.getKPIPlanning(),
                        DataService.getKPIEmpPlans(),
                        DataService.getKPIStructure(),
                        DataService.getKPILogs(),
                        DataService.getGDVs(),
                        DataService.getSalesStaff(),
                        DataService.getB2BStaff()
                    ]);
                    this.reportCache = {
                        key: cacheKey,
                        data: { raw, plans, empPlansRaw, struct, logs, listGDV, listSales, listB2B }
                    };
                }

                // 2. TÍNH TOÁN (100ms)
                console.time("Pure_Calculation");

                const normalize = (data) => this.normalizeDataSet(data);
                const rawData = normalize(raw);       
                const planData = normalize(plans);    
                const empPlanData = normalize(empPlansRaw); 
                const logData = normalize(logs);

                const detectKey = (sampleRow, ...candidates) => {
                    if (!sampleRow) return candidates[0];
                    const keys = Object.keys(sampleRow);
                    for (const c of candidates) if (keys.includes(c)) return c;
                    const lowerKeys = keys.map(k => k.toLowerCase());
                    for (const c of candidates) {
                        const idx = lowerKeys.indexOf(c.toLowerCase());
                        if (idx > -1) return keys[idx];
                    }
                    return candidates[0]; 
                };

                const typeMap = {};
                struct.forEach(s => {
                    if (s.active) {
                        const k = app.cleanCode(s.ma);
                        const u = (s.dvt || '').toLowerCase();
                        typeMap[k] = (u.includes('tb') || u.includes('thuê bao') || u.includes('sim')) ? 'sub' : 'rev';
                    }
                });
                // TBPTM (Thuê bao phát triển mới) - dùng để tính "TBPTM BQ ngày" cho Summary (không phụ thuộc KPI filter)
                let tbptmCode = (() => {
                    // Tự động nhận diện KPI "Thuê bao PTM" (mỗi dòng = 1 thuê bao).
                    // Ưu tiên: TBPTM rõ ràng > code có PTM > name có PTM + (thuê bao/sim/tb).
                    let best = null;
                    let bestScore = -1;
                    const scoreOne = (codeRaw, nameRaw) => {
                        const code = String(codeRaw || '').trim().toUpperCase();
                        const name = String(nameRaw || '').trim().toUpperCase();
                        if (!code) return;
                        const hasTBPTM = (code === 'TBPTM') || code.includes('TBPTM') || name.includes('TBPTM');
                        const hasPTM = code.includes('PTM') || name.includes('PTM');
                        const hasSubWords = name.includes('THUÊ BAO') || name.includes('THUE BAO') || name.includes('SIM') || name.includes(' TB ' ) || name.endsWith(' TB') || name.startsWith('TB ') || name.includes(' TB');
                        let sc = 0;
                        if (hasTBPTM) sc += 200;
                        if (code === 'PTM') sc += 120;
                        if (hasPTM) sc += 80;
                        if (hasSubWords) sc += 40;
                        if (sc > bestScore) { bestScore = sc; best = code; }
                    };
                    if (Array.isArray(struct)) { 
                        for (const it of struct) scoreOne(it.maKPI, it.moTa || it.tenKPI || it.name);
                    }
                    return best || 'TBPTM';
                })();
                const tbptmStaffMap = {}; // { MANV: totalTBPTMWithinSelectedRange }
const userChannelMap = Object.create(null);
                if (logData.length > 0) {
                    const lSample = logData[0];
                    const kLogNV = detectKey(lSample, 'maNV', 'MaNV', 'user');
                    const kLogCh = detectKey(lSample, 'channelType', 'kenh');
                    logData.forEach(l => {
                        const nv = String(l[kLogNV] ?? '').trim().toUpperCase();
                        if (nv) {
                            const chVal = l[kLogCh] || 'KHÁC';
                            userChannelMap[nv] = String(chVal).split('-')[0].trim();
                        }
                    });
                }

                const staffMap = {};
                const initStaffObj = () => ({ actual: 0, plan: 0 });
                const subData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {}, breakdown: {} };
                const revData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {}, breakdown: {} };
                const initBreakdownObj = () => ({ actual: 0, plan: 0, channels: {} });
                const initClusterObj = () => ({ actual: 0, plan: 0 });
                const subDailyAll = {}; 

                const relevantMonths = new Set();
                let currM = new Date(dFromObj);
                while (currM <= dToObj) {
                    relevantMonths.add(fmtYM(currM));
                    currM.setMonth(currM.getMonth() + 1);
                }
                const checkMonth = (val) => {
                    if (!val) return false;
                    const s = String(val).trim();
                    if (s.length >= 7 && relevantMonths.has(s.substring(0, 7))) return true;
                    if (s.includes('/')) {
                        const p = s.split('/'); 
                        if (p.length >= 3) {
                            const mKey = `${p[2]}-${p[1].padStart(2,'0')}`;
                            return relevantMonths.has(mKey);
                        }
                    }
                    return false;
                };

                const isScopeAll = scope === 'all';
                const isLienCumScope = !isScopeAll && app.mapLienCum && app.mapLienCum.hasOwnProperty(scope);

                // --- LOOP TỐI ƯU (PHIÊN BẢN HIGH PERFORMANCE) ---
                if (rawData.length > 0) {
                    const sample = rawData[0];
                    
                    // 1. DETECT KEYS (Chỉ chạy 1 lần duy nhất)
                    const kDate = detectKey(sample, 'date', 'ngay', 'thoiGian');
                    const kLC   = detectKey(sample, 'maLienCum', 'lienCum', 'maLC');
                    const kCum  = detectKey(sample, 'maCum', 'cum', 'maC');
                    const kKPI  = detectKey(sample, 'maKpi', 'kpi', 'maKPI');
                    const kVal  = detectKey(sample, 'giaTri', 'thucHien', 'revenue', 'value');
                    const kCh   = detectKey(sample, 'channelType', 'kenh', 'channel'); 
                    const kNV   = detectKey(sample, 'maNV', 'MaNV', 'user');

                    // 2. TỐI ƯU TÌM MÃ TBPTM
                    // Logic: Tìm trong struct trước (nhanh), nếu không có mới quét rawData (nhưng giới hạn 500 dòng)
                    if (!tbptmCode || tbptmCode === 'TBPTM') {
                        try {
                            let found = false;
                            // Ưu tiên 1: Tìm trong cấu trúc KPI
                            if (struct && struct.length > 0) {
                                const ptmKpi = struct.find(s => {
                                    const c = app.cleanCode(s.ma).toUpperCase();
                                    const n = (s.ten || s.tenHienThi || '').toUpperCase();
                                    return c.includes('PTM') || n.includes('PHÁT TRIỂN MỚI');
                                });
                                if (ptmKpi) {
                                    tbptmCode = app.cleanCode(ptmKpi.ma);
                                    found = true;
                                }
                            }
                            
                            // Ưu tiên 2: Quét mẫu data (Giới hạn 500 dòng)
                            if (!found) {
                                const limit = Math.min(rawData.length, 500); 
                                const seen = new Set();
                                for (let i = 0; i < limit; i++) {
                                    const c = app.cleanCode(rawData[i][kKPI]);
                                    if (c) seen.add(c);
                                }
                                const candidates = Array.from(seen).filter(c => c.includes('PTM'));
                                if (candidates.includes('TBPTM')) tbptmCode = 'TBPTM';
                                else if (candidates.length > 0) tbptmCode = candidates.sort((a, b) => b.length - a.length)[0];
                            }
                        } catch (e) { /* ignore */ }
                    }

                    // 3. VÒNG LẶP CHÍNH (MAIN LOOP)
                    const len = rawData.length;
                    for (let i = 0; i < len; i++) {
                        const row = rawData[i];

                        // Truy xuất trực tiếp key (Nhanh hơn gọi hàm)
                        const dateVal = row[kDate];
                        if (!dateVal) continue;

                        const parsed = this.parseDateKey(dateVal); 
                        if (parsed.full < extStartStr || parsed.full > dTo) continue;

                        const maLC = String(row[kLC] || 'KHÁC').trim();
                        const maC = String(row[kCum] || 'KHÁC').trim();

                        // Lọc Scope
                        if (!isScopeAll) {
                            if (isLienCumScope) { if (maLC !== scope) continue; }
                            else { if (maC !== scope) continue; }
                        }
                        
                        const kpiCode = app.cleanCode(row[kKPI]);
                        const isSelectedKPI = (kpiFilter === 'all' || kpiCode === kpiFilter);
                        const isTBPTMRow = (kpiCode === tbptmCode);

                        // Không phải KPI đang lọc và cũng không phải TBPTM => bỏ qua
                        if (!isSelectedKPI && !isTBPTMRow) continue;

                        const nvRaw = row[kNV];
                        const nvCode = nvRaw ? String(nvRaw).trim().toUpperCase() : '';

                        // Xử lý kênh
                        const chFromRow = row[kCh];
                        const rowChannel = (chFromRow && String(chFromRow).trim())
                            ? String(chFromRow).split('-')[0].trim()
                            : (userChannelMap[nvCode] || 'KHÁC');

                        // Lọc theo kênh
                        if (channelFilter !== 'all' && rowChannel !== channelFilter) continue;

                        // --- A. XỬ LÝ ĐẾM TBPTM (Cho Summary Box) ---
                        if (isTBPTMRow && parsed.full >= dFrom && nvRaw) {
                            tbptmStaffMap[nvCode] = (tbptmStaffMap[nvCode] || 0) + 1;
                        }

                        // --- B. XỬ LÝ TÍNH TOÁN KPI CHÍNH ---
                        if (!isSelectedKPI) continue;

                        const type = typeMap[kpiCode];
                        if (!type) continue; 

                        // Đếm số lượng thuê bao phát triển hàng ngày
                        if (type === 'sub') subDailyAll[parsed.full] = (subDailyAll[parsed.full] || 0) + 1;

                        if (parsed.full < dFrom) continue;

                        // Lấy giá trị thực tế
                        let val = 0;
                        if (type === 'sub') val = 1;
                        else {
                            val = Number(row[kVal]) || 0;
                            if (val > 10000) val = val / 1000000;
                        }

                        // Cộng dồn vào các nhóm dữ liệu
                        const targetData = type === 'sub' ? subData : revData;
                        
                        targetData.actual += val;
                        targetData.daily[parsed.full] = (targetData.daily[parsed.full] || 0) + val;
                        targetData.channel[rowChannel] = (targetData.channel[rowChannel] || 0) + val;

                        // Cộng dồn theo Liên Cụm
                        if (!targetData.cluster[maLC]) targetData.cluster[maLC] = initClusterObj();
                        targetData.cluster[maLC].actual += val;

                        // Cộng dồn theo Cụm
                        if (!targetData.breakdown[maC]) targetData.breakdown[maC] = initBreakdownObj();
                        targetData.breakdown[maC].actual += val;
                        targetData.breakdown[maC].channels[rowChannel] = (targetData.breakdown[maC].channels[rowChannel] || 0) + val;

                        // Cộng dồn theo Nhân viên
                        if (nvCode) {
                            if (!staffMap[nvCode]) staffMap[nvCode] = initStaffObj();
                            staffMap[nvCode].actual += val;
                        }
                    }
                }
            

                // --- METRICS ---
                const sumBetween = (startDt, endDt) => {
                    let sum = 0;
                    let cur = new Date(startDt.getTime());
                    const endTs = endDt.getTime();
                    while (cur.getTime() <= endTs) {
                        sum += (subDailyAll[fmtYMD(cur)] || 0);
                        cur.setDate(cur.getDate() + 1);
                    }
                    return sum;
                };
                const compare = (c, p) => ({ curr: c, prev: p, delta: c - p, pct: p > 0 ? ((c - p) / p) * 100 : null });

                const selectedDays = Math.max(1, daysBetweenInclusive(dFromObj, dToObj));
                const wkStart = startOfWeekMon(dToObj);
                const wkDays = Math.max(1, daysBetweenInclusive(wkStart, dToObj));
                const wkPrevStart = addDays(wkStart, -7);
                const wkPrevEnd = addDays(wkPrevStart, wkDays - 1);
                
                const moStart = new Date(dToObj.getFullYear(), dToObj.getMonth(), 1);
                const prevMoStart = new Date(dToObj.getFullYear(), dToObj.getMonth() - 1, 1);
                const prevMoTotalDays = new Date(dToObj.getFullYear(), dToObj.getMonth(), 0).getDate();
                const prevMoEnd = new Date(prevMoStart.getFullYear(), prevMoStart.getMonth(), Math.max(1, Math.min(dToObj.getDate(), prevMoTotalDays)));

                const yrStart = new Date(dToObj.getFullYear(), 0, 1);
                const prevYrStart = new Date(dToObj.getFullYear() - 1, 0, 1);
                let prevYrEnd = new Date(dToObj.getFullYear() - 1, dToObj.getMonth(), dToObj.getDate());
                if (prevYrEnd.getMonth() !== dToObj.getMonth()) prevYrEnd = new Date(dToObj.getFullYear() - 1, dToObj.getMonth() + 1, 0);

                subData.metrics = {
                    avgDaily: { value: subData.actual / selectedDays, days: selectedDays, range: { from: dFrom, to: dTo } },
                    week: { ...compare(sumBetween(wkStart, dToObj), sumBetween(wkPrevStart, wkPrevEnd)), range: { from: fmtYMD(wkStart), to: dTo } },
                    month: { ...compare(sumBetween(moStart, dToObj), sumBetween(prevMoStart, prevMoEnd)), range: { from: fmtYMD(moStart), to: dTo } },
                    year: { ...compare(sumBetween(yrStart, dToObj), sumBetween(prevYrStart, prevYrEnd)), range: { from: fmtYMD(yrStart), to: dTo } }
                };

                // --- KẾ HOẠCH ---
                const processPlan = (pData, isEmp) => {
                    if (pData.length === 0) return;
                    const sample = pData[0];
                    const kMonth = detectKey(sample, 'month', 'thang', 'thoiGian', 'date');
                    const kKPI = detectKey(sample, 'maKpi', 'maKPI', 'kpi', 'chiTieu');
                    const kVal = detectKey(sample, 'giaTri', 'keHoach', 'plan', 'target');
                    const kLC = !isEmp ? detectKey(sample, 'maLienCum', 'lienCum') : null;
                    const kCum = !isEmp ? detectKey(sample, 'maCum', 'cum') : null;
                    const kNV = isEmp ? detectKey(sample, 'maNV', 'MaNV', 'user', 'account') : null;

                    for(let i=0; i<pData.length; i++) {
                        const row = pData[i];
                        if (!checkMonth(row[kMonth])) continue;
                        const kpiCode = app.cleanCode(row[kKPI]);
                        if (kpiFilter !== 'all' && kpiCode !== kpiFilter) continue;
                        const type = typeMap[kpiCode];
                        if (!type) continue;
                        
                        let val = Number(row[kVal]) || 0;
                        if (type !== 'sub' && val > 10000) val = val / 1000000;

                        if (!isEmp) {
                            const maLC = String(row[kLC] || 'KHÁC').trim();
                            const maC = String(row[kCum] || 'KHÁC').trim();
                            if (!isScopeAll) {
                                if (isLienCumScope) { if (maLC !== scope) continue; }
                                else { if (maC !== scope) continue; }
                            }
                            const tData = type === 'sub' ? subData : revData;
                            tData.plan += val;
                            if (!tData.cluster[maLC]) tData.cluster[maLC] = initClusterObj();
                            tData.cluster[maLC].plan += val;
                            if (!tData.breakdown[maC]) tData.breakdown[maC] = initBreakdownObj();
                            tData.breakdown[maC].plan += val;
                        } else {
                            const nvRaw = row[kNV];
                            if (nvRaw) {
                                const nvCode = String(nvRaw).trim().toUpperCase();
                                if (!staffMap[nvCode]) staffMap[nvCode] = initStaffObj();
                                staffMap[nvCode].plan += val;
                            }
                        }
                    }
                };
                processPlan(planData, false);
                processPlan(empPlanData, true);

                // --- RENDER ---
                const processStaffList = (list) => {
                    const res = [];
                    if (!list || list.length === 0) return { list: [] };
                    const sSample = list[0];
                    const sMaNV = detectKey(sSample, 'maNV', 'MaNV');
                    const sTen = detectKey(sSample, 'ten', 'hoTen');
                    const sMaCum = detectKey(sSample, 'maCum', 'cum');
                    const sMaLC = detectKey(sSample, 'maLienCum', 'lienCum');
                    const sPhone = detectKey(sSample, 'sdt', 'soDienThoai');

                    list.forEach(staff => {
                        const stCum = staff[sMaCum];
                        const stLC = staff[sMaLC] || app.getParentLienCum(stCum);
                        if (!isScopeAll) {
                            if (isLienCumScope) { if (stLC !== scope) return; }
                            else { if (stCum !== scope) return; }
                        }
                        const code = String(staff[sMaNV] || '').trim().toUpperCase();
                        const kpi = staffMap[code] || { actual: 0, plan: 0 };
                        res.push({
                            code: staff[sMaNV], name: staff[sTen], maCum: stCum, phone: staff[sPhone],
                            actual: kpi.actual, plan: kpi.plan, percent: app.calcPercent(kpi.actual, kpi.plan)
                        });
                    });
                    res.sort((a, b) => Number(b.percent) - Number(a.percent));
                    return { list: res };
                };

                const gGDV = processStaffList(listGDV);
                const gSales = processStaffList(listSales);
                const gB2B = processStaffList(listB2B);


                // --- TBPTM BQ ngày/1 nhân viên (Summary NVBH/GDV/KHDN) ---
                const sumTBPTM = (lst) => {
                    if (!lst || lst.length === 0) return 0;
                    let total = 0;
                    for (const s of lst) {
                        const code = String(s.code || '').trim().toUpperCase();
                        total += tbptmStaffMap[code] || 0;
                    }
                    return total;
                };
                const tbptmTotals = {
                    gdv: sumTBPTM(gGDV.list),
                    sales: sumTBPTM(gSales.list),
                    b2b: sumTBPTM(gB2B.list)
                };
                // TBPTM BQ ngày/1 nhân viên = Tổng TBPTM / (Số ngày trong khoảng lọc * Số nhân viên trong nhóm)
// Lưu ý: nếu muốn xử lý biến động nhân sự theo "person-days" (nhân sự thực tế từng ngày), cần dữ liệu HR (ngày vào/nghỉ) hoặc quy ước khác.
const _hc = {
    gdv: (gGDV.list || []).length,
    sales: (gSales.list || []).length,
    b2b: (gB2B.list || []).length
};
const _safePerEmpPerDay = (total, days, hc) => {
    const d = Math.max(1, Number(days) || 0);
    const h = Number(hc) || 0;
    if (h <= 0) return 0;
    return (Number(total) || 0) / (d * h);
};
const sumActual = (list) => (list || []).reduce((acc, item) => acc + (Number(item.actual) || 0), 0);

this.currentTBPTMAvgDay = {
    gdv: _safePerEmpPerDay(sumActual(gGDV.list), selectedDays, _hc.gdv),
    sales: _safePerEmpPerDay(sumActual(gSales.list), selectedDays, _hc.sales),
    b2b: _safePerEmpPerDay(sumActual(gB2B.list), selectedDays, _hc.b2b)
};
                this.currentTBPTMCode = tbptmCode;

                this.currentStaffDataGroups = { gdv: gGDV.list, sales: gSales.list, b2b: gB2B.list };
                this.currentKPIReportData = { sub: subData, rev: revData };

                UIRenderer.renderKPIReport({ sub: subData, rev: revData }, { dFrom, dTo });
                if (UIRenderer.renderStaffPerformance) UIRenderer.renderStaffPerformance({ gdv: gGDV, sales: gSales, b2b: gB2B });

                this.calculateAndRenderRankings();
                this.renderChartsFromProcessedData(subData, revData);

                console.timeEnd("Pure_Calculation"); 
                console.log("Tính toán xong! Sub Actual:", subData.actual);

            } catch (e) {
                console.error("Lỗi tính toán báo cáo:", e);
            }
        }, 300); // <-- CHỜ 300ms, NẾU CÓ LỆNH KHÁC CHÈN VÀO THÌ HỦY LỆNH NÀY
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

    // --- HÀM MỚI: RENDER DANH SÁCH CỬA HÀNG ---
    renderStoreList() {
        console.log("Rendering Store List...");
        const rawData = this.cachedData.stores || [];
        const data = this.filterDataByScope(rawData);
        UIRenderer.renderStoresTable(data);
    },

    // --- HÀM MỚI: RENDER DANH SÁCH GIAO DỊCH VIÊN (GDV) ---
    renderGDVList() {
        console.log("Rendering GDV List...");
        const rawData = this.cachedData.gdvs || [];
        const data = this.filterDataByScope(rawData);

        const tbody = document.getElementById('gdv-list-body');
        if (!tbody) return console.warn("Không tìm thấy ID: gdv-list-body");
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-slate-500">Chưa có dữ liệu GDV.</td></tr>';
            return;
        }

        let html = '';
        data.forEach((item, index) => {
            const status = item.trangThai || 'Đang làm việc';
            const statusClass = status === 'Nghỉ việc' ? 'text-red-500' : 'text-emerald-600';

            const tenCH = item.tenCH || item.tench || item.cuaHang || '-';
            const maLC = item.maLienCum || item.maliencum || item.lienCum || '';
            const maCum = item.maCum || item.macum || item.cum || '';
            const hienThiLC = this.getNameLienCum(maLC) || maLC;
            const hienThiCum = this.getNameCum(maCum) || maCum;

            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="px-4 py-3 text-center text-slate-500">${index + 1}</td>
                    <td class="px-4 py-3 font-bold text-slate-700">${item.maGDV || item.maNV || ''}</td>
                    <td class="px-4 py-3 text-slate-700 font-medium">${item.ten || item.hoTen || ''}</td>

                    <td class="px-4 py-3 text-sm text-blue-600 font-medium">${tenCH}</td>

                    <td class="px-4 py-3 text-sm">${hienThiLC}</td>
                    <td class="px-4 py-3 text-sm">${hienThiCum}</td>

                    <td class="px-4 py-3 text-center text-sm">${item.vung || '-'}</td>
                    <td class="px-4 py-3 text-sm font-mono">${item.sdt || ''}</td>
                    <td class="px-4 py-3 text-center text-xs font-bold ${statusClass}">${status}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // --- HÀM MỚI: RENDER DANH SÁCH NV BÁN HÀNG ---
    renderSalesList() {
        console.log("Rendering Sales List...");
        const rawData = this.cachedData.sales || [];
        const data = this.filterDataByScope(rawData);

        const tbody = document.getElementById('sales-list-body');
        if (!tbody) return console.warn("Không tìm thấy ID: sales-list-body");
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-slate-500">Chưa có dữ liệu hoặc không thuộc phạm vi quản lý.</td></tr>';
            return;
        }

        let html = '';
        data.forEach((item, index) => {
            const status = item.trangThai || 'Đang làm việc';
            const statusClass = status === 'Nghỉ việc' ? 'text-red-500' : 'text-emerald-600';
            const maLC = item.maLienCum || item.maliencum || item.lienCum || '';
            const maCum = item.maCum || item.macum || item.cum || '';
            const phuongXa = item.phuongXas || item.phuongxas || item.phuongXa || '-';

            const hienThiLC = this.getNameLienCum(maLC) || maLC;
            const hienThiCum = this.getNameCum(maCum) || maCum;

            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="px-4 py-3 text-center text-slate-500">${index + 1}</td>
                    <td class="px-4 py-3 font-bold text-slate-700">${item.maNV || ''}</td>
                    <td class="px-4 py-3 text-slate-700 font-medium">${item.ten || item.hoTen || ''}</td>

                    <td class="px-4 py-3 text-sm">${hienThiLC}</td>
                    <td class="px-4 py-3 text-sm">${hienThiCum}</td>

                    <td class="px-4 py-3 text-center text-sm">${item.vung || '-'}</td>

                    <td class="px-4 py-3 text-sm max-w-[200px] truncate cursor-help" title="${phuongXa}">
                        ${phuongXa}
                    </td>

                    <td class="px-4 py-3 text-sm font-mono">${item.sdt || ''}</td>
                    <td class="px-4 py-3 text-center text-xs font-bold ${statusClass}">${status}</td>

                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // --- HÀM MỚI: RENDER DANH SÁCH KHÁCH HÀNG DOANH NGHIỆP (B2B) ---
    renderB2BList() {
        console.log("Rendering B2B List...");
        const rawData = this.cachedData.b2b || [];
        const data = this.filterDataByScope(rawData);

        const tbody = document.getElementById('b2b-list-body');
        if (!tbody) return console.warn("Không tìm thấy ID: b2b-list-body");
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-slate-500">Chưa có dữ liệu KHDN.</td></tr>';
            return;
        }

        let html = '';
        data.forEach((item, index) => {
            const status = item.trangThai || 'Đang làm việc';
            const statusClass = status === 'Nghỉ việc' ? 'text-red-500' : 'text-purple-600';

            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="px-4 py-3 text-center text-slate-500">${index + 1}</td>
                    <td class="px-4 py-3 font-bold text-slate-700">${item.maNV || ''}</td>
                    <td class="px-4 py-3 text-slate-700 font-medium">${item.ten || item.hoTen || ''}</td>
                    <td class="px-4 py-3 text-sm">${item.lienCum || ''}</td>
                    <td class="px-4 py-3 text-sm">${item.cum || ''}</td>
                    <td class="px-4 py-3 text-center text-sm">${item.vung || '-'}</td>
                    <td class="px-4 py-3 text-sm font-mono">${item.sdt || ''}</td>
                    <td class="px-4 py-3 text-center text-xs font-bold ${statusClass}">${status}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 4. BUSINESS DATA & USER LOGS (CÁC TRANG DỮ LIỆU KHÁC)
    // ============================================================

    // MENU "SỐ LIỆU KINH DOANH" — Tra cứu chi tiết (sheet kpi_data)
initBusinessDataControls() {
    if (this._bizControlsInited) return;
    this._bizControlsInited = true;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const elFrom = document.getElementById('biz-month-from');
    const elTo = document.getElementById('biz-month-to');
    if (elFrom && !elFrom.value) elFrom.value = currentMonth;
    if (elTo && !elTo.value) elTo.value = currentMonth;

    const modeEl = document.getElementById('view-mode');
    const scopeInput = document.getElementById('biz-scope-input');

    const uScope = (this.currentUser?.scope || 'all').toString().trim();
    const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');

    // Default mode theo phạm vi user (NV/Cụm/Liên cụm)
    const defaultMode = (() => {
        if (isAdmin) return 'cum';
        if (this.mapCum && this.mapCum[uScope]) return 'cum';
        if (this.mapLienCum && this.mapLienCum[uScope]) return 'liencum';
        return 'employee';
    })();

    if (modeEl) modeEl.value = modeEl.value || defaultMode;

    // Auto fill scope cho user không phải admin (để khỏi phải nhập lại)
    if (scopeInput && !scopeInput.value && !isAdmin) {
        scopeInput.value = uScope;
    }

    this.handleBusinessModeChange(modeEl?.value || defaultMode);
},

handleBusinessModeChange(mode) {
    const scopeInput = document.getElementById('biz-scope-input');
    const list = document.getElementById('biz-scope-list');
    if (!scopeInput || !list) return;

    const allowedClusters = this.filterDataByScope(this.fullClusterData) || [];

    const setPlaceholder = (ph) => { scopeInput.placeholder = ph; };
    const addOption = (value, label) => {
        const opt = document.createElement('option');
        opt.value = value;
        if (label) opt.label = label; // datalist label (trình duyệt hỗ trợ 1 phần)
        list.appendChild(opt);
    };

    list.innerHTML = '';

    if (mode === 'liencum') {
        setPlaceholder('Nhập mã Liên Cụm (vd: LC-DHO)');
        allowedClusters.forEach(lc => addOption(lc.maLienCum, `${lc.maLienCum} - ${lc.tenLienCum}`));
    } else if (mode === 'cum') {
        setPlaceholder('Nhập mã Cụm (vd: C-DHO)');
        allowedClusters.forEach(lc => {
            (lc.cums || []).forEach(c => addOption(c.maCum, `${c.maCum} - ${c.tenCum} (${lc.tenLienCum})`));
        });
    } else {
        setPlaceholder('Nhập mã NV (vd: 8LAN10002_DHO_015)');
        // Không auto load danh sách NV để tránh nặng (NV có thể nhập/tìm theo mã)
    }

    // Nếu user đang dùng scope tự động (scope = maCum/maLienCum/maNV) mà mode đổi khác loại
    // thì giữ nguyên input, user có thể sửa lại nếu cần.
},

_checkScopeKpiRow(row) {
    const uScope = (this.currentUser?.scope || 'all').toString().trim();
    const isAdmin = (this.currentUser?.role === 'admin' || uScope === 'all');
    if (isAdmin) return true;

    const maLC = (row?.maLienCum || row?.maliencum || row?.lienCum || '').toString().trim();
    const maC = (row?.maCum || row?.macum || row?.cum || '').toString().trim();
    const maNV = (row?.maNV || row?.manv || '').toString().trim();

    return maLC === uScope || maC === uScope || maNV === uScope;
},

_filterKpiRowsClientSide(rows, keyword) {
    const kw = (keyword || '').toString().trim().toLowerCase();
    if (!kw) return rows;

    return (rows || []).filter(r => {
        const date = (r.date || r.ngay || '').toString();
        const maNV = (r.maNV || r.manv || '').toString();
        const maLC = (r.maLienCum || r.maliencum || r.lienCum || '').toString();
        const maC = (r.maCum || r.macum || r.cum || '').toString();
        const maKpi = (r.maKpi || r.maKPI || r.makpi || '').toString();
        const ch = (r.channelTy || r.channelType || r.channel || '').toString();
        const gt = (r.giaTri || r.giatri || r.value || '').toString();
        const blob = `${date}|${maNV}|${maLC}|${maC}|${maKpi}|${ch}|${gt}`.toLowerCase();
        return blob.includes(kw);
    });
},

_applyBusinessScopeFilter(rows, mode, scopeValue) {
    const val = (scopeValue || '').toString().trim();
    if (!val) return rows;

    const cmp = (s) => (s || '').toString().trim().toLowerCase();
    const v = cmp(val);

    if (mode === 'liencum') {
        return (rows || []).filter(r => cmp(r.maLienCum || r.maliencum || r.lienCum) === v || cmp(r.maLienCum || r.maliencum || r.lienCum).includes(v));
    }
    if (mode === 'cum') {
        return (rows || []).filter(r => cmp(r.maCum || r.macum || r.cum) === v || cmp(r.maCum || r.macum || r.cum).includes(v));
    }
    // employee
    return (rows || []).filter(r => cmp(r.maNV || r.manv) === v || cmp(r.maNV || r.manv).includes(v));
},

// ============================
    // CẬP NHẬT: loadBusinessDataPage
    // Fix: Hiển thị đúng cột Thuê bao (giaTri) và Kênh (channelType)
    // ============================
   async loadBusinessDataPage() {
        this.initBusinessDataControls();

        // 1. Hiển thị Loading
        const container = document.getElementById('business-data-container');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center py-16 text-slate-500">
                    <div class="flex items-center gap-2">
                        <span class="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full"></span>
                        <span class="text-sm font-medium">Đang tải dữ liệu KPI...</span>
                    </div>
                </div>`;
        }

        // 2. Lấy tham số từ giao diện
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const mFrom = document.getElementById('biz-month-from')?.value || currentMonth;
        const mTo = document.getElementById('biz-month-to')?.value || currentMonth;
        const mode = document.getElementById('view-mode')?.value || 'cum';
        const scopeValue = document.getElementById('biz-scope-input')?.value || '';
        const keyword = (document.getElementById('business-search')?.value || '').trim();

        try {
            let baseRows = [];

            // 3. CHIẾN LƯỢC TẢI DỮ LIỆU (QUAN TRỌNG)
            if (keyword.length > 0) {
                // TRƯỜNG HỢP A: CÓ TÌM KIẾM -> GỌI SERVER (Server-side Search)
                // Tận dụng sheet kpi_search để lấy kết quả nhanh, không cache RAM
                console.log("🔍 Tìm kiếm Server-side:", keyword);
                baseRows = await DataService.getKPIActual(mFrom, mTo, keyword);
            } else {
                // TRƯỜNG HỢP B: KHÔNG TÌM KIẾM -> DÙNG CACHE CLIENT (Client-side Cache)
                // Tải toàn bộ tháng về cache để phân trang cho mượt
                const cacheKey = `${mFrom}|${mTo}`;
                if (!this.businessCache) this.businessCache = {};
                
                if (!this.businessCache[cacheKey]) {
                    // Gọi API với keyword = null
                    const raw = await DataService.getKPIActual(mFrom, mTo, null);
                    // Lưu bản raw vào cache (sẽ chuẩn hóa sau)
                    this.businessCache[cacheKey] = this.normalizeDataSet(raw);
                }
                baseRows = this.businessCache[cacheKey] || [];
            }

            // 4. CHUẨN HÓA DỮ LIỆU (Mapping cột an toàn)
            const getVal = (obj, ...candidates) => {
                if (!obj) return '';
                // Tìm chính xác
                for (const k of candidates) {
                    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
                }
                // Tìm không phân biệt hoa thường
                const keys = Object.keys(obj);
                const lowerKeys = keys.map(k => k.toLowerCase());
                for (const k of candidates) {
                    const idx = lowerKeys.indexOf(k.toLowerCase());
                    if (idx > -1) return obj[keys[idx]];
                }
                return '';
            };

            // Map lại các trường quan trọng để đảm bảo hiển thị đúng
            let rows = baseRows.map(r => {
                return {
                    ...r,
                    channelType: getVal(r, 'channelType', 'channel', 'kenh'),
                    giaTri: getVal(r, 'giaTri', 'thucHien', 'value', 'revenue'),
                    date: getVal(r, 'date', 'ngay', 'thoiGian'),
                    maNV: getVal(r, 'maNV', 'manv', 'user'),
                    maKpi: getVal(r, 'maKpi', 'makpi', 'kpi'),
                    maLienCum: getVal(r, 'maLienCum', 'lienCum', 'maliencum'),
                    maCum: getVal(r, 'maCum', 'cum', 'macum')
                };
            });

            // 5. KPI Name Map (Tải 1 lần để hiển thị tên đẹp thay vì mã KPI)
            if (!this.kpiNameMap) {
                const struct = await DataService.getKPIStructure();
                const map = {};
                (struct || []).forEach(k => {
                    const raw = (k.ma ?? '').toString().trim();
                    if (!raw) return;
                    const name = k.tenHienThi || k.moTa || raw;
                    map[raw] = name;
                    map[this.cleanCode(raw)] = name;
                });
                this.kpiNameMap = map;
            }

            // 6. Áp dụng các bộ lọc Client-side còn lại

            // Lọc theo quyền User (Admin thấy hết, User thường chỉ thấy cụm mình)
            rows = rows.filter(r => this._checkScopeKpiRow(r));

            // Lọc theo Mode xem (Nếu user chọn lọc theo Cụm/Liên cụm cụ thể)
            rows = this._applyBusinessScopeFilter(rows, mode, scopeValue);

            // (Lưu ý: Không cần gọi _filterKpiRowsClientSide nữa vì Server đã lọc keyword rồi)

            // 7. Sắp xếp: Ngày mới nhất lên đầu -> Mã NV
            rows.sort((a, b) => {
                const da = (a.date || '').toString();
                const db = (b.date || '').toString();
                if (da !== db) return db.localeCompare(da);
                const na = (a.maNV || '').toString();
                const nb = (b.maNV || '').toString();
                return na.localeCompare(nb);
            });

            // 8. Lưu trạng thái để phân trang
            const prevSize = this.businessKpiState?.pageSize || 50;
            this.businessKpiState = {
                rows,
                page: 1,
                pageSize: prevSize,
                mode,
                scopeValue,
                keyword,
                mFrom, mTo
            };

            // 9. Render bảng
            UIRenderer.renderBusinessKPIDetailTable(rows, {
                page: 1,
                pageSize: prevSize,
                mode,
                scopeValue,
                keyword,
                mFrom, mTo,
                kpiNameMap: this.kpiNameMap
            });

        } catch (err) {
            console.error("Business KPI load error:", err);
            if (container) {
                container.innerHTML = `<div class="p-6 text-red-600 font-medium">Lỗi tải dữ liệu KPI: ${String(err?.message || err)}</div>`;
            }
        } finally {
            if (window.lucide) lucide.createIcons();
        }
    },

businessGotoPage(page) {
    const st = this.businessKpiState;
    if (!st || !Array.isArray(st.rows)) return;

    const total = st.rows.length;
    const maxPage = Math.max(1, Math.ceil(total / st.pageSize));
    const p = Math.min(Math.max(1, Number(page) || 1), maxPage);

    st.page = p;
    UIRenderer.renderBusinessKPIDetailTable(st.rows, {
        page: st.page,
        pageSize: st.pageSize,
        mode: st.mode,
        scopeValue: st.scopeValue,
        keyword: st.keyword,
        mFrom: st.mFrom, mTo: st.mTo,
        kpiNameMap: this.kpiNameMap
    });

    const container = document.getElementById('business-data-container');
    if (container) container.scrollTop = 0;
    if (window.lucide) lucide.createIcons();
},

businessSetPageSize(size) {
    const st = this.businessKpiState;
    if (!st) return;
    const s = Math.max(10, Math.min(500, Number(size) || 50));
    st.pageSize = s;
    st.page = 1;
    this.businessGotoPage(1);
},

exportBusinessKpiCSV() {
    const st = this.businessKpiState;
    if (!st || !Array.isArray(st.rows) || st.rows.length === 0) return alert('Không có dữ liệu để xuất!');

    const rows = st.rows;
    const pick = (r, ...keys) => {
        for (const k of keys) {
            if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k];
            const lk = Object.keys(r).find(x => x.toLowerCase() === String(k).toLowerCase());
            if (lk && r[lk] !== undefined && r[lk] !== null && String(r[lk]).trim() !== '') return r[lk];
        }
        return '';
    };

    const headers = ['date','maNV','maLienCum','maCum','maKpi','channelTy','giaTri'];
    const esc = (v) => {
        const s = String(v ?? '');
        if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };

    const csv = [
        headers.join(','),
        ...rows.map(r => ([
            pick(r, 'date', 'ngay'),
            pick(r, 'maNV', 'manv'),
            pick(r, 'maLienCum', 'maliencum', 'lienCum'),
            pick(r, 'maCum', 'macum', 'cum'),
            pick(r, 'maKpi', 'maKPI', 'makpi'),
            pick(r, 'channelTy', 'channelType', 'channel'),
            pick(r, 'giaTri', 'giatri', 'value')
        ]).map(esc).join(','))
    ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = url;
    a.download = `kpi_data_${st.mFrom}_${st.mTo}_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
},

    async renderKPIStructureTab(struct) {
        // [DISABLED]
    },

    async renderPlanningTab() {
        // [DISABLED]
    },

    async savePlanningData() {
        // [DISABLED]
        alert("Chức năng đã bị vô hiệu hóa.");
    },

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
        this.isSidebarOpen = !this.isSidebarOpen;
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');

        if (this.isSidebarOpen) {
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
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

    // --- [THÊM MỚI] Hàm phóng to/thu nhỏ từng Bảng xếp hạng ---
    toggleWidgetFullScreen(btn) {
        const card = btn.closest('.bg-white.rounded-xl');
        if (!card) return;

        card.classList.toggle('widget-fullscreen');

        const isFull = card.classList.contains('widget-fullscreen');

        
        // Khóa scroll nền khi đang phóng to 1 widget
        if (isFull) {
            document.body.classList.add('widget-fullscreen-open');
        } else {
            if (!document.querySelector('.widget-fullscreen')) {
                document.body.classList.remove('widget-fullscreen-open');
            }
        }
if (isFull) {
            btn.innerHTML = '<i data-lucide="minimize-2" class="w-4 h-4 text-red-500"></i>';
            btn.setAttribute('title', 'Thu nhỏ lại');
        } else {
            btn.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4"></i>';
            btn.setAttribute('title', 'Phóng to');
        }

        if (window.lucide) lucide.createIcons();
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

    async loadDataForPage(pageId) {
        if (pageId === 'dashboard') {
            const sel = document.getElementById('dashboard-scope-select'); if (sel) sel.value = 'all';
            UIRenderer.renderDashboard('all');
            this.initKPIReportTab();
            const btn = document.querySelector('[onclick*="dash-overview"]');
            if (btn) this.switchTab('dash-overview', btn);
        }
        else if (pageId === 'business_data') {
            this.loadBusinessDataPage();
        }

        else if (pageId === 'clusters') UIRenderer.renderClusterTable(this.filterDataByScope(this.fullClusterData));
        else if (pageId === 'direct_channel') {
            const defaultBtn = document.querySelector('[onclick*="tab-stores"]');
            if (defaultBtn) {
                this.switchTab('tab-stores', defaultBtn);
            }
        }
        else if (pageId === 'indirect_channel') UIRenderer.renderIndirectTable(this.filterDataByScope(this.cachedData.indirect));
        else if (pageId === 'bts') {
            UIRenderer.renderBTSTable(this.filterDataByScope(this.cachedData.bts || []));
            this.initBTSFilterControls();
        }
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

        // --- KHỐI XỬ LÝ KÊNH TRỰC TIẾP ---
        if (tabId === 'tab-sales') this.renderSalesList();
        if (tabId === 'tab-b2b') this.renderB2BList();
        if (tabId === 'tab-gdv') this.renderGDVList();
        if (tabId === 'tab-stores') this.renderStoreList();
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
            document.body.insertAdjacentHTML('beforeend', `<div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50"> hoang.lehuu | Ver Final </div>`);
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
            if (lc.maLienCum) this.mapLienCum[lc.maLienCum] = lc.tenLienCum;
            lc.cums.forEach(c => { if (c.maCum) this.mapCum[c.maCum] = c.tenCum; });
        });
    },

    getNameLienCum(code) { return this.mapLienCum[code] || code || ''; },
    getNameCum(code) { return this.mapCum[code] || code || ''; },
    cleanCode(code) { return String(code || '').trim().toUpperCase().replace('KPI_', ''); },

    filterDataByScope(data, fieldId = 'maLienCum') {
        const user = this.currentUser || {};
        const role = user.role || 'view';
        const scopeRaw = (user.scope || 'all').toString().trim();

        if (role === 'admin' || scopeRaw === 'all') return data || [];

        const scope = scopeRaw;

        if (Array.isArray(data) && data.length > 0 && data[0] && Array.isArray(data[0].cums)) {
            return (data || []).map(lc => {
                const maLC = (lc.maLienCum || '').toString().trim();
                const tenLC = (lc.tenLienCum || '').toString().trim();

                if (maLC === scope || tenLC === scope) return lc;

                const cums = (lc.cums || []).filter(c => {
                    const maC = (c.maCum || '').toString().trim();
                    const tenC = (c.tenCum || '').toString().trim();
                    return maC === scope || tenC === scope;
                });

                if (cums.length > 0) return { ...lc, cums };
                return null;
            }).filter(Boolean);
        }

        return (data || []).filter(item => {
            if (!item) return false;

            const maLC = (item.maLienCum || item.maliencum || item.lienCum || '').toString().trim();
            const maC = (item.maCum || item.macum || item.cum || '').toString().trim();
            const tenLC = (item.tenLienCum || '').toString().trim();
            const tenC = (item.tenCum || '').toString().trim();

            const vField = (item[fieldId] || '').toString().trim();
            return maLC === scope || maC === scope || vField === scope || tenLC === scope || tenC === scope;
        });
    },

    checkScope(item) {
        const user = this.currentUser || {};
        const role = user.role || 'view';
        const scopeRaw = (user.scope || 'all').toString().trim();

        if (role === 'admin' || scopeRaw === 'all') return true;

        const scope = scopeRaw;
        const maLC = (item?.maLienCum || item?.maliencum || item?.lienCum || '').toString().trim();
        const maC = (item?.maCum || item?.macum || item?.cum || '').toString().trim();

        return maLC === scope || maC === scope;
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

    // ============================================================
    // 7. MODAL & SEARCH HANDLERS
    // ============================================================

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
        this.currentFilterScope = scope;
        UIRenderer.renderDashboard(scope);
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

    openUploadModal(type) { document.getElementById('upload-type').value = type; document.getElementById('modal-upload').classList.add('open'); },
    // main.js (Mới - Đã sửa lỗi)
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
    handleSearchIndirect(k) {
        // 1. Chuẩn hóa từ khóa đầu vào
        const keyword = (k || '').toString().toLowerCase().trim();
        
        // 2. Lấy dữ liệu gốc đã được lọc theo quyền hạn (Scope) của user
        const sourceData = this.filterDataByScope(this.cachedData.indirect);

        // 3. Nếu không có từ khóa thì hiển thị toàn bộ
        if (!keyword) {
            UIRenderer.renderIndirectTable(sourceData);
            return;
        }

        // 4. Hàm hỗ trợ lấy giá trị chuỗi an toàn từ object
        const getVal = (val) => String(val || '').toLowerCase();

        // 5. Thực hiện lọc đa tiêu chí
        const filtered = sourceData.filter(item => {
            // Nhóm 1: Tìm theo Tên (Điểm bán / Chủ kênh)
            if (getVal(item.ten).includes(keyword)) return true;
            if (getVal(item.hoTen).includes(keyword)) return true;

            // Nhóm 2: Tìm theo Mã (Mã NV / Mã Kênh / Mã Điểm Bán)
            if (getVal(item.maNV).includes(keyword)) return true;
            if (getVal(item.maKenh).includes(keyword)) return true; 
            if (getVal(item.code).includes(keyword)) return true;

            // Nhóm 3: Tìm theo Cụm / Liên Cụm (Dành cho quản lý muốn lọc nhanh)
            if (getVal(item.maCum).includes(keyword)) return true;
            if (getVal(item.cum).includes(keyword)) return true; // Phòng trường hợp key là 'cum'
            
            if (getVal(item.maLienCum).includes(keyword)) return true;
            if (getVal(item.lienCum).includes(keyword)) return true; // Phòng trường hợp key là 'lienCum'

            // Nhóm 4: Tìm theo SĐT (Rất hữu ích thực tế)
            if (getVal(item.sdt).includes(keyword)) return true;
            if (getVal(item.soDienThoai).includes(keyword)) return true;

            return false;
        });

        // 6. Render lại bảng với dữ liệu đã lọc
        UIRenderer.renderIndirectTable(filtered);
    },
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

    handleSearchStore(k) { UIRenderer.renderStoresTable(k ? this.cachedData.stores.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.stores); },
    handleSearchGDV(k) { UIRenderer.renderGDVTable(k ? this.cachedData.gdvs.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.gdvs); },
    handleSearchSales(k) { UIRenderer.renderSalesTable(k ? this.cachedData.sales.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.sales); },
    handleSearchB2B(k) { UIRenderer.renderB2BTable(k ? this.cachedData.b2b.filter(i => i.ten.toLowerCase().includes(k.toLowerCase())) : this.cachedData.b2b); },

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

    async showDetailModal(type, scope, stype) {
        let title = '';
        let detailData = [];

        const { stores, gdvs, sales, b2b, bts, indirect } = this.cachedData || {};

        const filterFn = (item) => {
            if (scope === 'all') return true;
            const field = stype === 'liencum' ? 'maLienCum' : 'maCum';
            return (item[field] || '').toString() === scope.toString();
        };

        if (type === 'list_cum') {
            title = 'Danh sách Đơn vị trực thuộc (Cụm)';
            this.fullClusterData.forEach(lc => {
                if (scope !== 'all' && lc.maLienCum !== scope) return;

                const enrichedCums = (lc.cums || []).map(c => {
                    const areaAgg = (c.phuongXas || []).reduce((acc, px) => {
                        const v = px.dienTich;
                        if (v === null || v === undefined || v === '') return acc;
                        const n = Number(v);
                        if (!isFinite(n)) return acc;
                        acc.sum += n;
                        acc.count += 1;
                        return acc;
                    }, { sum: 0, count: 0 });

                    return {
                        ...c,
                        ten: c.tenCum,
                        tenLienCum: lc.tenLienCum,
                        vlr: (c.phuongXas || []).reduce((acc, px) => acc + (Number(px.vlr) || 0), 0),
                        danSo: (c.phuongXas || []).reduce((acc, px) => acc + (Number(px.danSo) || 0), 0),
                        dienTich: areaAgg.count ? areaAgg.sum : null,
                        // Hiển thị phụ trách ở cột riêng (và vẫn giữ lanhDao để dùng lại nếu cần)
                        lanhDao: c.phuTrach ? [{ chucVu: 'Phụ trách', ten: c.phuTrach, sdt: c.sdtCum || '' }] : []
                    };
                });

                detailData.push(...enrichedCums);
            });
        }

else if (type === 'commune') {
            title = 'Chi tiết Dân số & Phủ trạm theo Phường/Xã';
            this.fullClusterData.forEach(lc => {
                if (stype === 'liencum' && scope !== 'all' && lc.maLienCum !== scope) return;
                (lc.cums || []).forEach(c => {
                    if (stype === 'cum' && c.maCum !== scope) return;
                    const enrichedPX = (c.phuongXas || []).map(px => ({
                        ...px,
                        tenLienCum: lc.tenLienCum,
                        tenCum: c.tenCum
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

        const modalTitle = document.getElementById('modal-detail-title');
        const modalSubtitle = document.getElementById('modal-detail-subtitle');
        const modalList = document.getElementById('modal-detail-list');

        if (modalTitle) modalTitle.textContent = title;
        if (modalSubtitle) {
            const scopeName = scope === 'all' ? 'Toàn Công Ty' : (this.getNameCum(scope) || this.getNameLienCum(scope) || scope);
            const countFormatted = UIRenderer.formatNumber(detailData.length);
            modalSubtitle.textContent = `Phạm vi: ${scopeName} | Số lượng: ${countFormatted}`;
        }

        UIRenderer.renderDetailModalContent(type, detailData);

        if (modalList) {
            modalList.classList.remove('hidden');
            modalList.classList.add('flex', 'open');
            if (window.lucide) window.lucide.createIcons();
        }
    },

    // ===== DASHBOARD: TAB THUÊ BAO VLR/PSC (sheet vlr_psc) - DISABLED =====
    async initVlrPscTab() {
         console.log("Tab VLR/PSC removed by request.");
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

    _avg(arr) {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    },

    async renderVlrPscTab(scope = 'all') {
         // DISABLED
    },

    // ===== DASHBOARD: TAB DOANH THU (sheet doanhthu) - DISABLED =====
    async initDoanhThuTab() {
        console.log("Tab Doanh thu removed by request.");
    },

    _parseMonthVal(monthVal) {
        if (monthVal === null || monthVal === undefined) return null;
        if (typeof monthVal === 'number' && isFinite(monthVal) && monthVal > 10000 && monthVal < 200000) {
            const d = this._excelSerialToDate(monthVal);
            if (d) return { y: d.getFullYear(), m: d.getMonth() + 1 };
        }
        const s = String(monthVal).trim();
        if (!s) return null;
        if (/^\d+(?:\.\d+)?$/.test(s) && s.length <= 5) {
            const num = Number(s);
            if (isFinite(num) && num > 10000) {
                const d = this._excelSerialToDate(num);
                if (d) return { y: d.getFullYear(), m: d.getMonth() + 1 };
            }
        }
        let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
        if (m) return { y: Number(m[1]), m: Number(m[2]) };
        m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
        if (m) return { y: Number(m[1]), m: Number(m[2]) };
        m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
        if (m) return { y: Number(m[2]), m: Number(m[1]) };
        m = s.match(/^(\d{4})[.\-_ ]?(\d{1,2})$/);
        if (m) return { y: Number(m[1]), m: Number(m[2]) };
        const d = this._parseAnyDate(s);
        if (d) return { y: d.getFullYear(), m: d.getMonth() + 1 };
        return null;
    },

    _monthNum(ym) { return ym.y * 100 + ym.m; },

    _formatMonth(ym) {
        const mm = String(ym.m).padStart(2, '0');
        return `${mm}/${ym.y}`;
    },

    async renderDoanhThuTab(scope = 'all') {
        // DISABLED
    },
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
