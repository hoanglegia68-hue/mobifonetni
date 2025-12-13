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

    rentalConfig: {
        emails: "admin@mobifone.vn, quanly@mobifone.vn",
        alertDays: [90, 60],
        urgentDay: 30
    },

    // ============================================================
    // 2. INIT
    // ============================================================
    async init() {
        console.log("App Starting... Version 05.00 (Advanced Charts & Date Filter)");

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

    // ============================================================
    // 3. HELPER
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
    // 4. UI & NAV
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
            document.body.insertAdjacentHTML('beforeend', `<div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50">MBF TNI | Ver 05.00</div>`);
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

    // ============================================================
    // 5. DASHBOARD & KPI REPORT (NÂNG CẤP)
    // ============================================================

    handleDashboardFilter(scope) { UIRenderer.renderDashboard(scope); },

    async initKPIReportTab() {
        const selScope = document.getElementById('filter-scope');
        if (selScope) {
            selScope.innerHTML = '<option value="all">Tất cả Liên Cụm</option>';
            Object.keys(this.mapLienCum).forEach(k => selScope.innerHTML += `<option value="${k}">${this.mapLienCum[k]}</option>`);
        }

        // Tải logs trước để lấy danh sách kênh cho Filter
        const logs = this.normalizeDataSet(await DataService.getKPILogs());
        const channels = new Set();
        logs.forEach(l => { if(l.channelType) channels.add(l.channelType.split('-')[0].trim()); });
        
        const selChannel = document.getElementById('filter-channel');
        if (selChannel) {
            selChannel.innerHTML = '<option value="all">Tất cả Kênh</option>';
            channels.forEach(c => selChannel.innerHTML += `<option value="${c}">${c}</option>`);
        }

        // Set default dates (Đầu tháng đến Hôm nay)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        
        const dFrom = document.getElementById('dash-date-from');
        const dTo = document.getElementById('dash-date-to');
        if(dFrom) dFrom.value = `${y}-${m}-01`;
        if(dTo) dTo.value = `${y}-${m}-${d}`;

        const btn = document.getElementById('btn-apply-report-filter');
        if (btn) btn.addEventListener('click', () => this.handleKPIReportFilter());
    },

    async handleKPIReportFilter() {
        console.log("Loading Advanced Chart Data...");
        const dFrom = document.getElementById('dash-date-from')?.value;
        const dTo = document.getElementById('dash-date-to')?.value;
        const scope = document.getElementById('filter-scope')?.value || 'all';
        const channelFilter = document.getElementById('filter-channel')?.value || 'all';

        if (!dFrom || !dTo) return alert("Vui lòng chọn khoảng thời gian!");

        try {
            const [raw, plans, struct, logs] = await Promise.all([
                DataService.getKPIActual(dFrom.substring(0,7), dTo.substring(0,7), null), // Vẫn fetch data rộng theo tháng
                DataService.getKPIPlanning(),
                DataService.getKPIStructure(),
                DataService.getKPILogs()
            ]);

            const rawData = this.normalizeDataSet(raw);
            const planData = this.normalizeDataSet(plans);
            const logData = this.normalizeDataSet(logs);

            // 1. Map NV -> Kênh (Từ logs)
            const userChannelMap = {};
            logData.forEach(l => {
                const nv = l.maNV || l.MaNV;
                const ch = (l.channelType || 'KHÁC').split('-')[0].trim();
                if(nv) userChannelMap[nv] = ch;
            });

            // 2. Phân loại KPI (Tb vs Trd)
            const unitMap = {}; 
            const typeMap = {}; // 'sub' or 'rev'
            struct.forEach(s => { 
                if(s.active) {
                    const k = app.cleanCode(s.ma);
                    const u = (s.dvt || '').toLowerCase();
                    unitMap[k] = u;
                    typeMap[k] = (u === 'tb' || u.includes('thuê bao')) ? 'sub' : 'rev';
                }
            });

            // 3. AGGREGATE DỮ LIỆU
            const subData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {} };
            const revData = { actual: 0, plan: 0, daily: {}, channel: {}, cluster: {} };
            
            const initObj = () => ({ actual: 0, plan: 0 });

            // 3a. Xử lý Thực hiện (Actual)
            rawData.forEach(row => {
                const parsed = this.parseDateKey(row.date);
                if (parsed.full < dFrom || parsed.full > dTo) return; // Filter chính xác theo ngày
                if (!this.checkScope(row)) return;
                if (scope !== 'all' && row.maLienCum !== scope && row.maCum !== scope) return;

                const kpi = app.cleanCode(row.maKpi);
                const type = typeMap[kpi];
                if (!type) return; // Bỏ qua nếu không xác định được loại

                // Filter Channel
                const nv = row.maNV;
                const rowChannel = userChannelMap[nv] || 'KHÁC';
                if (channelFilter !== 'all' && rowChannel !== channelFilter) return;

                let val = Number(row.giaTri) || 0;
                // Chuẩn hóa đơn vị
                if (type === 'sub') val = 1; // Đếm số lượng
                else val = val / 1000000;    // Doanh thu ra Triệu

                const targetData = type === 'sub' ? subData : revData;
                
                // Cộng tổng
                targetData.actual += val;

                // Cộng theo ngày
                const dKey = parsed.full;
                if (!targetData.daily[dKey]) targetData.daily[dKey] = 0;
                targetData.daily[dKey] += val;

                // Cộng theo Kênh
                if (!targetData.channel[rowChannel]) targetData.channel[rowChannel] = 0;
                targetData.channel[rowChannel] += val;

                // Cộng theo Đơn vị (để so sánh plan)
                const cKey = row.maLienCum || row.maCum || 'KHÁC';
                if (!targetData.cluster[cKey]) targetData.cluster[cKey] = initObj();
                targetData.cluster[cKey].actual += val;
            });

            // 3b. Xử lý Kế hoạch (Plan) - Plan theo Tháng
            // Logic: Nếu chọn từ 1/12 đến 15/12, ta vẫn lấy Plan cả tháng 12 (hoặc chia tỷ lệ nếu muốn complex)
            // Ở đây hiển thị Plan tổng của các tháng có dính dáng tới range
            const relevantMonths = new Set();
            let curr = new Date(dFrom);
            const end = new Date(dTo);
            while (curr <= end) {
                relevantMonths.add(curr.toISOString().substring(0, 7));
                curr.setMonth(curr.getMonth() + 1);
            }

            planData.forEach(row => {
                const m = (row.month || row.thang || '').substring(0, 7);
                if (!relevantMonths.has(m)) return;
                
                if (scope !== 'all' && row.maLienCum !== scope && row.maCum !== scope) return;
                // Plan không có Channel nên không filter theo Channel được -> Giữ nguyên Plan tổng
                
                const kpi = app.cleanCode(row.maKpi);
                const type = typeMap[kpi];
                if (!type) return;

                let val = Number(row.giaTri || row.keHoach) || 0;
                const targetData = type === 'sub' ? subData : revData;

                targetData.plan += val;

                const cKey = row.maLienCum || row.maCum || 'KHÁC';
                if (!targetData.cluster[cKey]) targetData.cluster[cKey] = initObj();
                targetData.cluster[cKey].plan += val;
            });

            // Gửi dữ liệu sang UI
            UIRenderer.renderKPIReport({ sub: subData, rev: revData }, { dFrom, dTo });

        } catch (e) { console.error(e); }
    },

    // ============================================================
    // 6. BUSINESS DATA
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

    // ============================================================
    // 7. CÁC TAB KHÁC
    // ============================================================
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

    switchTab(tabId, btn) {
        const p = btn.closest('.view-section'); // Tìm section cha
        if (!p) return; // Guard clause tránh lỗi nếu click sai chỗ

        // Ẩn tất cả tab-content bên trong section này
        p.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
        
        // Hiện tab được chọn (Lúc này ID đã khớp với HTML mới)
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.remove('hidden');
        else console.error(`Không tìm thấy tab có ID: ${tabId}`);

        // Xử lý active button
        p.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Logic tải dữ liệu riêng cho từng tab
        // QUAN TRỌNG: Gọi đúng hàm handleKPIReportFilter
        if(tabId === 'dash-charts') {
            this.handleKPIReportFilter(); 
        }
        
        if(tabId === 'tab-kpi-thuchien') this.loadBusinessDataPage(); 
        if(tabId === 'tab-kehoach') this.renderPlanningTab(); 
        if(tabId === 'tab-user-ghinhan') this.loadUserLogPage(); 
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

    async showDashboardDetail(type, scope) { this.showDetailModal(type==='geo'?'commune':type, scope, 'liencum'); },
    async showDetailModal(type, scope, stype) {
        let t='', d=[]; 
        const {stores, gdvs, sales, b2b, bts, indirect} = this.cachedData;
        const filter = i => i[stype==='liencum'?'maLienCum':'maCum'] === scope;
        
        if(type==='commune') this.fullClusterData.forEach(lc => { if(scope==='all'||lc.maLienCum===scope) lc.cums.forEach(c => d.push(...c.phuongXas)); });
        else if(type==='store') { t='DS Cửa Hàng'; d=scope==='all'?stores:stores.filter(filter); }
        else if(type==='gdv') { t='DS GDV'; d=scope==='all'?gdvs:gdvs.filter(filter); }
        else if(type==='sales') { t='DS NVBH'; d=scope==='all'?sales:sales.filter(filter); }
        else if(type==='b2b') { t='DS KHDN'; d=scope==='all'?b2b:b2b.filter(filter); }
        else if(type==='bts') { t='DS Trạm BTS'; d=scope==='all'?bts:bts.filter(filter); }
        else if(type==='indirect') { t='DS Kênh GT'; d=scope==='all'?indirect:indirect.filter(filter); }
        
        document.getElementById('modal-detail-title').textContent = t;
        document.getElementById('modal-detail-subtitle').textContent = `SL: ${d.length}`;
        UIRenderer.renderDetailModalContent(type, d);
        document.getElementById('modal-detail-list').classList.add('open');
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
