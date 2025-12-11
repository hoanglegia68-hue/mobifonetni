const app = {
    // ============================================================
    // 1. QUẢN LÝ TRẠNG THÁI (STATE)
    // ============================================================
    currentUser: null,       // User đang đăng nhập
    fullClusterData: [],     // Cache dữ liệu hạ tầng (dùng để tra cứu)
    cachedKPIData: [],       // Cache dữ liệu KPI (Dùng cho cả báo cáo và lọc User)
    cachedLogData: [],       // Cache dữ liệu Log User
    
    // TỪ ĐIỂN TRA CỨU (Mapping ID -> Tên)
    mapLienCum: {}, 
    mapCum: {},

    chartInstances: {},      // Cache biểu đồ

    // CẤU HÌNH CẢNH BÁO THUÊ
    rentalConfig: {
        emails: "admin@mobifone.vn, quanly@mobifone.vn",
        alertDays: [90, 60],
        urgentDay: 30
    },

    // ============================================================
    // 2. KHỞI TẠO ỨNG DỤNG (INIT)
    // ============================================================
    async init() {
        console.log("App Starting... Version 02.01 (Final Complete)");

        // A. KIỂM TRA ĐĂNG NHẬP
        const savedUser = localStorage.getItem('MIS_USER');
        if (!savedUser) {
            window.location.href = 'login.html'; 
            return;
        }
        this.currentUser = JSON.parse(savedUser);

        // B. Lấy dữ liệu hạ tầng trước (Để xây dựng từ điển tra cứu)
        this.fullClusterData = await DataService.getClusters();
        
        // C. Xây dựng Từ điển (Mapping)
        this.buildDictionary();

        // D. Cập nhật giao diện User
        this.updateUserInterface();
        this.renderFooter();
        lucide.createIcons();

        // E. Vào trang Dashboard mặc định
        this.navigate('dashboard');
    },

    // ============================================================
    // 3. LOGIC TỪ ĐIỂN & HELPER
    // ============================================================
    
    buildDictionary() {
        this.fullClusterData.forEach(lc => {
            if (lc.maLienCum) this.mapLienCum[lc.maLienCum] = lc.tenLienCum;
            lc.cums.forEach(c => {
                if (c.maCum) this.mapCum[c.maCum] = c.tenCum;
            });
        });
    },

    getNameLienCum(code) { return this.mapLienCum[code] || code || ''; },
    getNameCum(code) { return this.mapCum[code] || code || ''; },

    cleanCode(code) {
        return String(code || '').trim().toUpperCase();
    },

    // ============================================================
    // 4. LOGIC PHÂN QUYỀN & GIAO DIỆN
    // ============================================================

    updateUserInterface() {
        const user = this.currentUser;
        const nameEl = document.getElementById('sidebar-user-name');
        const roleEl = document.getElementById('sidebar-user-role');
        
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) {
            let roleText = 'Nhân viên';
            if (user.role === 'admin') roleText = 'Administrator';
            if (user.role === 'manager') roleText = `Quản lý: ${this.getNameLienCum(user.scope)}`;
            roleEl.textContent = roleText;
        }

        document.body.classList.remove('is-admin', 'is-view', 'is-manager');
        document.body.classList.add(`is-${user.role}`);

        const systemMenu = document.querySelector('.system-menu-only');
        if (systemMenu) systemMenu.style.display = user.role === 'admin' ? 'flex' : 'none';
    },

    logout() {
        if(confirm('Bạn có chắc muốn đăng xuất?')) {
            localStorage.removeItem('MIS_USER');       
            localStorage.removeItem('MIS_LOCAL_DATA'); 
            window.location.href = 'login.html';
        }
    },

    renderFooter() {
        if (!document.getElementById('app-footer')) {
            const footerHTML = `
                <div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50">
                    Bản quyền <span class="font-bold">hoang.lehuu</span> | Ver <span class="font-mono">02.01</span>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', footerHTML);
        }
    },

    // ============================================================
    // 5. LOGIC LỌC DỮ LIỆU (SCOPE FILTER)
    // ============================================================
    filterDataByScope(data, fieldId = 'maLienCum') {
        const user = this.currentUser;
        if (user.role === 'admin' || user.scope === 'all') return data;
        return data.filter(item => {
            if (item[fieldId] === user.scope) return true;
            if (item.tenLienCum === user.scope || item.lienCum === user.scope) return true;
            return false;
        });
    },

    // ============================================================
    // 6. ĐIỀU HƯỚNG (NAVIGATION)
    // ============================================================
    navigate(pageId) {
        if (pageId === 'system' && this.currentUser.role !== 'admin') {
            alert("Bạn không có quyền truy cập menu này!");
            return;
        }

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
        if(activeLink) activeLink.classList.add('active');

        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const targetView = document.getElementById(`view-${pageId}`);
        if(targetView) {
            targetView.classList.remove('hidden');
            this.updateTitle(pageId);
            this.loadDataForPage(pageId);
        }
    },

    updateTitle(pageId) {
        const titles = { 
            'dashboard': 'TỔNG QUAN HỆ THỐNG', 
            'clusters': 'QUẢN LÝ HẠ TẦNG LIÊN CỤM', 
            'direct_channel': 'QUẢN LÝ KÊNH TRỰC TIẾP',
            'indirect_channel': 'QUẢN LÝ KÊNH GIÁN TIẾP',
            'bts': 'QUẢN LÝ TRẠM BTS',
            'business_data': 'SỐ LIỆU KINH DOANH',
            'system': 'QUẢN TRỊ HỆ THỐNG USER'
        };
        document.getElementById('page-title').textContent = titles[pageId] || 'Trang Quản Trị';
    },

    // ============================================================
    // 7. LOAD DỮ LIỆU TỪNG TRANG
    // ============================================================
    async loadDataForPage(pageId) {
        if (pageId === 'dashboard') {
            // Reset dropdown về mặc định khi vào lại Dashboard
            const select = document.getElementById('dashboard-scope-select');
            if(select) select.value = 'all';
            
            // Gọi hàm render Dashboard mới (Cards + Breakdown)
            UIRenderer.renderDashboard('all');
            
            // Render luôn biểu đồ (Lazy load)
            this.updateCharts();
        }
        else if (pageId === 'clusters') {
            let data = this.filterDataByScope(this.fullClusterData, 'maLienCum');
            UIRenderer.renderClusterTable(data);
        }
        else if (pageId === 'direct_channel') {
            let [stores, gdvs, sales, b2b] = await Promise.all([
                DataService.getStores(), DataService.getGDVs(),
                DataService.getSalesStaff(), DataService.getB2BStaff()
            ]);
            
            stores = this.filterDataByScope(stores, 'maLienCum');
            gdvs = this.filterDataByScope(gdvs, 'maLienCum');
            sales = this.filterDataByScope(sales, 'maLienCum');
            b2b = this.filterDataByScope(b2b, 'maLienCum');

            UIRenderer.renderStoresTable(stores);
            UIRenderer.renderGDVTable(gdvs);
            UIRenderer.renderSalesTable(sales);
            UIRenderer.renderB2BTable(b2b);
            lucide.createIcons();
        }
        else if (pageId === 'indirect_channel') {
            let data = await DataService.getIndirectChannels();
            UIRenderer.renderIndirectTable(this.filterDataByScope(data, 'maLienCum'));
        }
        else if (pageId === 'bts') {
            let data = await DataService.getBTS();
            UIRenderer.renderBTSTable(this.filterDataByScope(data, 'maLienCum'));
        }
        else if (pageId === 'business_data') {
            await this.loadBusinessDataPage();
        }
    },

    // ============================================================
    // 8. DASHBOARD LOGIC (MỚI)
    // ============================================================
    
    // Hàm xử lý khi chọn Dropdown lọc trên Dashboard
    handleDashboardFilter(scope) {
        UIRenderer.renderDashboard(scope);
    },

    async updateCharts() {
        const from = document.getElementById('chart-from').value;
        const to = document.getElementById('chart-to').value;
        
        const kpiData = await DataService.getKPIActual(from, to, '');
        UIRenderer.renderDashboardCharts(kpiData, this.chartInstances);
    },

    // ============================================================
    // 9. BUSINESS DATA & SEARCH
    // ============================================================

    async loadBusinessDataPage() {
        console.log("--> Đang tải dữ liệu kinh doanh...");
        const structure = await DataService.getKPIStructure();
        const mFrom = document.getElementById('filter-month-from').value;
        const mTo = document.getElementById('filter-month-to').value;
        const keyword = document.getElementById('business-search').value;
        
        const viewModeEl = document.getElementById('view-mode');
        const viewMode = viewModeEl ? viewModeEl.value : 'cluster';

        let rawData = await DataService.getKPIActual(mFrom, mTo, keyword);
        this.cachedKPIData = rawData || [];
        
        // 1. CHUẨN BỊ MAP ĐƠN VỊ TÍNH
        const kpiUnitMap = {};
        const listKpiKeys = []; 
        
        structure.forEach(item => {
            if(item.active) {
                const code = this.cleanCode(item.ma);
                kpiUnitMap[code] = (item.dvt || '').toLowerCase();
                listKpiKeys.push(code);
            }
        });

        // 2. GOM NHÓM DỮ LIỆU
        const aggregatedData = {};

        rawData.forEach(row => {
            if (!this.checkScope(row)) return;

            let key = '', tenHienThi = '';
            if (viewMode === 'liencum') {
                key = row.maLienCum; 
                tenHienThi = this.getNameLienCum(row.maLienCum);
            } else {
                key = `${row.maLienCum}_${row.maCum}`;
                tenHienThi = this.getNameCum(row.maCum);
            }

            if (!aggregatedData[key]) {
                aggregatedData[key] = {
                    id: key,                  
                    hienThi: tenHienThi || `Mã: ${row.maCum}`,      
                    maLienCum: row.maLienCum, 
                    phuong: viewMode === 'liencum' ? '-' : (row.phuong || ''),
                    viewMode: viewMode,
                    detailRows: [],           
                    ...listKpiKeys.reduce((acc, k) => ({...acc, [k]: 0}), {}) 
                };
                
                aggregatedData[key]['FWAP'] = 0;
                aggregatedData[key]['SAYMEE'] = 0;
                aggregatedData[key]['TBPTM_GOC'] = 0; 
            }

            aggregatedData[key].detailRows.push(row);

            // LOGIC TÍNH TOÁN
            const rawKpiCode = this.cleanCode(row.maKpi);
            const rawValue = Number(row.giaTri) || 0;
            
            if (['FWAP', 'SAYMEE'].includes(rawKpiCode)) {
                aggregatedData[key][rawKpiCode] += 1; 
            }
            else if (rawKpiCode.includes('TBPTM')) {
                 aggregatedData[key]['TBPTM_GOC'] += 1; 
            }
            else if (kpiUnitMap.hasOwnProperty(rawKpiCode)) {
                const unit = kpiUnitMap[rawKpiCode];
                if (unit.includes('đồng') || unit.includes('doanh thu') || unit.includes('tiền')) {
                    aggregatedData[key][rawKpiCode] += rawValue;
                } else {
                    aggregatedData[key][rawKpiCode] += 1;
                }
            }
        });

        let processedData = Object.values(aggregatedData);

        // LOGIC CỘNG GỘP TBPTM
        const KEY_TBPTM = 'TBPTM'; 
        processedData.forEach(item => {
            const valFWAP = item['FWAP'] || 0;
            const valSAYMEE = item['SAYMEE'] || 0;
            const valTBPTM_Goc = item['TBPTM_GOC'] || 0; 
            item[KEY_TBPTM] = valTBPTM_Goc + valFWAP + valSAYMEE;
        });

        // TÍNH DÒNG TỔNG
        if (processedData.length > 0) {
            const totalRow = {
                id: 'TOTAL',
                hienThi: 'TỔNG CỘNG TOÀN CÔNG TY',
                phuong: '',
                isTotal: true, 
                ...listKpiKeys.reduce((acc, k) => ({...acc, [k]: 0}), {})
            };

            processedData.forEach(item => {
                listKpiKeys.forEach(key => {
                    totalRow[key] += (item[key] || 0);
                });
            });

            processedData.push(totalRow);
        }

        // RENDER
        const cleanStructure = structure.map(s => ({
            ...s, 
            ma: this.cleanCode(s.ma),
            tenHienThi: s.tenHienThi || s.ten || s.ma 
        }));
        
        UIRenderer.renderKPIStructureTable(cleanStructure);
        UIRenderer.renderKPIActualTable(processedData, cleanStructure);
        
        lucide.createIcons();
    },

    checkScope(item) {
        const user = this.currentUser;
        if (user.role === 'admin' || user.scope === 'all') return true;
        if (item.maLienCum === user.scope || item.lienCum === user.scope) return true;
        return false;
    },

    handleRowClick(id) {
        alert(`Bạn đang xem chi tiết: ${id}. \nChức năng hiển thị popup chi tiết đang được xây dựng!`);
    },

    // ============================================================
    // 10. TAB GIAO KẾ HOẠCH (LOGIC MỚI: THEO CỤM & LIÊN CỤM)
    // ============================================================

    async renderPlanningTab() {
        console.log("--> Đang tải giao diện lập kế hoạch...");
        
        const structure = await DataService.getKPIStructure();
        const allPlans = await DataService.getKPIPlanning();
        const selectedMonth = document.getElementById('planning-month')?.value; 

        // Map dữ liệu
        const planMap = {};
        if (selectedMonth && allPlans.length > 0) {
            allPlans.forEach(row => {
                let rowMonth = row.month;
                if (row.month instanceof Date) {
                   rowMonth = row.month.toISOString().slice(0, 7); 
                } else if (typeof row.month === 'string') {
                   rowMonth = row.month.slice(0, 7);
                }

                if (rowMonth === selectedMonth) {
                    const key = `${row.maCum}_${row.maKpi}`;
                    planMap[key] = row.giaTri;
                }
            });
        }

        const activeKPIs = structure.filter(k => k.active).map(k => ({
            ...k, 
            ma: this.cleanCode(k.ma),
            tenHienThi: k.tenHienThi || k.ten || k.ma
        }));

        let rawClusters = this.filterDataByScope(this.fullClusterData, 'maLienCum');
        let planningRows = [];
        rawClusters.forEach(lc => {
            lc.cums.forEach(c => {
                planningRows.push({
                    maLienCum: lc.maLienCum,
                    tenLienCum: lc.tenLienCum,
                    maCum: c.maCum,
                    tenCum: c.tenCum,
                });
            });
        });

        UIRenderer.renderPlanningTable(planningRows, activeKPIs, planMap);
    },

    async savePlanningData() {
        const inputs = document.querySelectorAll('.plan-input');
        const month = document.getElementById('planning-month')?.value; 
        
        if (!month) return alert("Vui lòng chọn tháng áp dụng!");

        const payload = [];
        inputs.forEach(input => {
            const val = Number(input.value.replace(/\./g, '')) || 0; 
            if (val > 0) {
                payload.push({
                    thang: month,
                    maCum: input.dataset.cum,      
                    maKpi: input.dataset.kpi,      
                    keHoach: val
                });
            }
        });
        
        if (payload.length === 0) return alert("Chưa có dữ liệu nào được nhập!");
        alert(`Đã thu thập ${payload.length} chỉ tiêu. \n(Log chi tiết xem trong Console F12)`);
        console.log("Saving Plan:", payload);
    },

    // ============================================================
    // 11. TAB USER GHI NHẬN (ĐÃ TỐI ƯU & HỢP NHẤT)
    // ============================================================

    async loadUserLogPage() {
        console.log("--> Đang tải dữ liệu KPI_LOGS...");
        
        // 1. Gọi DataService
        this.cachedLogData = await DataService.getKPILogs();

        if (!this.cachedLogData || this.cachedLogData.length === 0) {
            alert("Không tìm thấy dữ liệu KPI Logs!");
            UIRenderer.renderKPIUserLogs([]); 
            return;
        }

        // 2. TÍNH TOÁN THỐNG KÊ
        const clusterStatsMap = {};
        this.cachedLogData.forEach(log => {
            const mCum = log.maCum;
            const mNV = log.maNV || log.MaNV || log.manv;
            
            if (mCum && mNV) {
                if (!clusterStatsMap[mCum]) {
                    clusterStatsMap[mCum] = new Set();
                }
                clusterStatsMap[mCum].add(mNV);
            }
        });

        const statsArray = Object.keys(clusterStatsMap).map(maCum => ({
            maCum: maCum,
            tenCum: this.getNameCum(maCum),
            userCount: clusterStatsMap[maCum].size
        }));

        // Render bảng thống kê so sánh
        UIRenderer.renderClusterStats(statsArray);

        // 3. Render Dropdown & Reset bảng chi tiết
        const uniqueCumCodes = statsArray.map(s => s.maCum).sort();
        UIRenderer.renderUserLogFilter(uniqueCumCodes);
        UIRenderer.renderKPIUserLogs([]); 
    },

    // Xử lý khi chọn dropdown Lọc Cụm trong tab User Logs
    handleUserFilterChange(selectedCum) {
        if (!selectedCum) {
            UIRenderer.renderKPIUserLogs([]);
            return;
        }

        const filteredLogs = this.cachedLogData.filter(item => item.maCum === selectedCum);
        const userMap = new Map();
        
        filteredLogs.forEach(log => {
            const code = log.maNV || log.MaNV || log.manv; 
            
            if (code) {
                if (!userMap.has(code)) {
                    userMap.set(code, {
                        maNV: code,
                        maCum: log.maCum,
                        maLienCum: log.maLienCum,
                        channels: new Set(),
                        totalLogs: 0
                    });
                }

                const userObj = userMap.get(code);
                const rawData = log.channelType || log.ChannelType || log.channeltype || '';
                
                if (rawData) {
                    // Logic tách thông minh
                    if (rawData.includes('-')) userObj.channels.add(rawData.split('-')[0].trim());
                    else if (rawData.includes('_')) userObj.channels.add(rawData.split('_')[0].trim());
                    else userObj.channels.add(rawData);
                }
                userObj.totalLogs += 1;
            }
        });

        const distinctUsers = Array.from(userMap.values()).map(u => ({
            ...u,
            channelStr: Array.from(u.channels).join(', ')
        }));
        
        UIRenderer.renderKPIUserLogs(distinctUsers);
    },

    // ============================================================
    // 12. SEARCH FUNCTIONS
    // ============================================================

    handleSearchCluster(keyword) {
        keyword = keyword.toLowerCase().trim();
        let data = this.filterDataByScope(this.fullClusterData, 'maLienCum');
        
        if (!keyword) { UIRenderer.renderClusterTable(data); return; }

        const filtered = data.map(lc => {
            const matchLC = (lc.tenLienCum || '').toLowerCase().includes(keyword);
            const filteredCums = lc.cums.map(cum => {
                const matchCum = (cum.tenCum || '').toLowerCase().includes(keyword);
                const filteredPX = cum.phuongXas.filter(px => 
                    (px.ten || '').toLowerCase().includes(keyword) || 
                    (px.lanhDao && px.lanhDao.some(ld => (ld.ten || '').toLowerCase().includes(keyword)))
                );
                
                if (filteredPX.length > 0 || matchCum) {
                    return { ...cum, phuongXas: filteredPX.length ? filteredPX : cum.phuongXas };
                }
                return null;
            }).filter(c => c !== null);

            if (filteredCums.length > 0 || matchLC) {
                return { ...lc, cums: filteredCums.length ? filteredCums : lc.cums };
            }
            return null;
        }).filter(lc => lc !== null);

        UIRenderer.renderClusterTable(filtered);
    },

    async handleSearchIndirect(keyword) {
        let data = await DataService.getIndirectChannels();
        data = this.filterDataByScope(data, 'maLienCum');
        if(keyword) data = data.filter(i => (i.ten || '').toLowerCase().includes(keyword.toLowerCase()));
        UIRenderer.renderIndirectTable(data);
    },

    async handleSearchBTS(keyword) {
        let data = await DataService.getBTS();
        data = this.filterDataByScope(data, 'maLienCum');
        if(keyword) data = data.filter(i => (i.tenTram || '').toLowerCase().includes(keyword.toLowerCase()));
        UIRenderer.renderBTSTable(data);
    },

    // ============================================================
    // 13. UTILS & EVENT HANDLERS
    // ============================================================
    
    switchTab(tabId, btnElement) {
        const parent = btnElement.closest('.view-section');
        parent.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId).classList.remove('hidden');
        parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');

        // Logic tải dữ liệu lười (Lazy load)
        if(tabId === 'dash-charts') this.updateCharts();
        if(tabId === 'tab-kehoach') this.renderPlanningTab(); 
        if(tabId === 'tab-user-ghinhan') this.loadUserLogPage(); 
    },
    
    openUploadModal(type = 'cluster') {
        document.getElementById('upload-type').value = type;
        document.getElementById('file-input').value = '';
        document.getElementById('file-name-display').classList.add('hidden');
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('progress-bar-inner').style.width = '0%';
        document.getElementById('upload-status').textContent = '';
        document.getElementById('modal-upload').classList.add('open');
    },

    handleFileSelect(input) {
        if (input.files && input.files[0]) {
            const display = document.getElementById('file-name-display');
            display.textContent = `Đã chọn: ${input.files[0].name}`;
            display.classList.remove('hidden');
        }
    },

    startUpload() {
        if (!document.getElementById('file-input').files[0]) {
            alert("Vui lòng chọn file trước!");
            return;
        }
        document.getElementById('upload-progress').style.display = 'block';
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
                document.getElementById('upload-status').textContent = "Thành công!";
                document.getElementById('progress-bar-inner').style.backgroundColor = "#10b981";
                setTimeout(() => {
                    this.closeModal('modal-upload');
                    alert("Đã cập nhật dữ liệu!");
                }, 500);
            } else { width += 10; document.getElementById('progress-bar-inner').style.width = width + '%'; }
        }, 50);
    },

    openRentConfigModal() {
        if(this.currentUser.role !== 'admin') return alert("Chỉ Admin mới được cấu hình!");
        document.getElementById('config-emails').value = this.rentalConfig.emails;
        document.getElementById('modal-rent-config').classList.add('open');
    },
    saveRentConfig() {
        this.rentalConfig.emails = document.getElementById('config-emails').value;
        alert("Đã lưu cấu hình!");
        this.closeModal('modal-rent-config');
    },

    closeModal(id) { document.getElementById(id || 'modal-edit-ward').classList.remove('open'); },
    
    openEditModal() { if(this.currentUser.role === 'admin') document.getElementById('modal-edit-ward').classList.add('open'); else alert('Quyền hạn chế!'); },
    saveWardData() { alert('Chức năng đang phát triển!'); this.closeModal(); },
    downloadTemplate(type) { alert(`Đang tải mẫu cho: ${type}...`); },
    
    loadBusinessData: () => app.loadBusinessDataPage(),
    addKPIStructure: () => alert("Chức năng thêm KPI đang phát triển"),

    // ============================================================
    // 14. MODAL CHI TIẾT (DRILL-DOWN) - ĐÃ TÍCH HỢP
    // ============================================================

    async showDetailModal(type, scopeCode, scopeType) {
        // scopeType: 'liencum' hoặc 'cum'
        // scopeCode: Mã (VD: 'LC_TANCHAU' hoặc 'CUM_ABC')

        console.log(`Open Detail: ${type} - ${scopeCode} (${scopeType})`);
        
        let title = '';
        let detailData = [];

        // 1. Lấy dữ liệu thô
        let [stores, gdvs, sales, indirect, bts] = await Promise.all([
            DataService.getStores(), DataService.getGDVs(), DataService.getSalesStaff(),
            DataService.getIndirectChannels(), DataService.getBTS()
        ]);

        // Helper lọc
        const filterFn = (item) => item[scopeType === 'liencum' ? 'maLienCum' : 'maCum'] === scopeCode;

        if (type === 'commune') {
            title = 'Danh sách Phường/Xã & Thông tin Lãnh đạo';
            
            // Logic lấy Xã hơi phức tạp vì nó nằm lồng trong Clusters
            this.fullClusterData.forEach(lc => {
                lc.cums.forEach(c => {
                    let match = false;
                    if (scopeType === 'liencum' && lc.maLienCum === scopeCode) match = true;
                    if (scopeType === 'cum' && c.maCum === scopeCode) match = true;

                    if (match) {
                        detailData.push(...c.phuongXas);
                    }
                });
            });

        } else if (type === 'store') {
            title = 'Danh sách Cửa hàng';
            detailData = stores.filter(filterFn);
        } else if (type === 'gdv') {
            title = 'Danh sách Giao dịch viên';
            detailData = gdvs.filter(filterFn);
        } else if (type === 'sales') {
            title = 'Danh sách NV Bán hàng';
            detailData = sales.filter(filterFn);
        } else if (type === 'bts') {
            title = 'Danh sách Trạm BTS';
            detailData = bts.filter(filterFn);
        } else if (type === 'indirect') {
            title = 'Danh sách Kênh Gián tiếp';
            detailData = indirect.filter(filterFn);
        }

        // 2. Cập nhật UI Modal
        document.getElementById('modal-detail-title').textContent = title;
        document.getElementById('modal-detail-subtitle').textContent = `Đơn vị: ${app.getNameCum(scopeCode) || app.getNameLienCum(scopeCode) || scopeCode} - Số lượng: ${detailData.length}`;
        
        // 3. Render Table
        UIRenderer.renderDetailModalContent(type, detailData);

        // 4. Mở Modal
        document.getElementById('modal-detail-list').classList.add('open');
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
