const app = {
    // --- 1. QUẢN LÝ TRẠNG THÁI (STATE) ---
    currentUser: null,       // User đang đăng nhập
    fullClusterData: [],     // Cache dữ liệu hạ tầng (dùng để tra cứu)
    
    // TỪ ĐIỂN TRA CỨU (Mapping ID -> Tên)
    mapLienCum: {}, 
    mapCum: {},

    chartInstances: {},      // Cache biểu đồ

    // --- CẤU HÌNH CẢNH BÁO THUÊ ---
    rentalConfig: {
        emails: "admin@mobifone.vn, quanly@mobifone.vn",
        alertDays: [90, 60],
        urgentDay: 30
    },

    // --- 2. KHỞI TẠO ỨNG DỤNG (INIT) ---
    async init() {
        console.log("App Starting... Version 01.31 (Final Perfect Logic)");

        // A. KIỂM TRA ĐĂNG NHẬP (Bảo mật)
        const savedUser = localStorage.getItem('MIS_USER');
        if (!savedUser) {
            window.location.href = 'login.html'; // Chưa đăng nhập -> Đá về Login
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

    // --- 3. LOGIC TỪ ĐIỂN & HELPER ---
    
    // Xây dựng map: LC_01 -> TÂN CHÂU
    buildDictionary() {
        this.fullClusterData.forEach(lc => {
            // Lưu map Liên Cụm
            if (lc.maLienCum) this.mapLienCum[lc.maLienCum] = lc.tenLienCum;
            
            // Lưu map Cụm
            lc.cums.forEach(c => {
                if (c.maCum) this.mapCum[c.maCum] = c.tenCum;
            });
        });
    },

    getNameLienCum(code) { return this.mapLienCum[code] || code || ''; },
    getNameCum(code) { return this.mapCum[code] || code || ''; },

    // Hàm chuẩn hóa mã: Xóa khoảng trắng, về chữ hoa (QUAN TRỌNG ĐỂ LINK DATA)
    cleanCode(code) {
        return String(code || '').trim().toUpperCase();
    },

    // --- 4. LOGIC PHÂN QUYỀN & GIAO DIỆN ---

    updateUserInterface() {
        const user = this.currentUser;

        // Render Sidebar Info
        const nameEl = document.getElementById('sidebar-user-name');
        const roleEl = document.getElementById('sidebar-user-role');
        
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) {
            let roleText = 'Nhân viên';
            if (user.role === 'admin') roleText = 'Administrator';
            if (user.role === 'manager') roleText = `Quản lý: ${this.getNameLienCum(user.scope)}`;
            roleEl.textContent = roleText;
        }

        // Xử lý Class Body để ẩn hiện menu
        document.body.classList.remove('is-admin', 'is-view', 'is-manager');
        document.body.classList.add(`is-${user.role}`);

        // Menu Hệ thống: Chỉ Admin thấy
        const systemMenu = document.querySelector('.system-menu-only');
        if (systemMenu) systemMenu.style.display = user.role === 'admin' ? 'flex' : 'none';
    },

    // Đăng xuất
    logout() {
        if(confirm('Bạn có chắc muốn đăng xuất?')) {
            localStorage.removeItem('MIS_USER');       // Xóa session
            localStorage.removeItem('MIS_LOCAL_DATA'); // Xóa cache dữ liệu
            window.location.href = 'login.html';
        }
    },

    renderFooter() {
        if (!document.getElementById('app-footer')) {
            const footerHTML = `
                <div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50">
                    Bản quyền <span class="font-bold">MBF TNI</span> | Ver <span class="font-mono">01.31</span>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', footerHTML);
        }
    },

    // --- 5. LOGIC LỌC DỮ LIỆU (SCOPE FILTER) ---
    filterDataByScope(data, fieldId = 'maLienCum') {
        const user = this.currentUser;
        
        // Admin hoặc View All -> Xem hết
        if (user.role === 'admin' || user.scope === 'all') return data;
        
        // Manager -> Lọc đúng Mã ID
        return data.filter(item => {
            if (item[fieldId] === user.scope) return true;
            if (item.tenLienCum === user.scope || item.lienCum === user.scope) return true;
            return false;
        });
    },

    // --- 6. ĐIỀU HƯỚNG (NAVIGATION) ---
    navigate(pageId) {
        if (pageId === 'system' && this.currentUser.role !== 'admin') {
            alert("Bạn không có quyền truy cập menu này!");
            return;
        }

        // Active Menu Item
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
        if(activeLink) activeLink.classList.add('active');

        // Switch View
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

    // --- 7. LOAD DỮ LIỆU TỪNG TRANG ---
    async loadDataForPage(pageId) {
        if (pageId === 'dashboard') {
            this.loadDashboard();
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
            
            // Lọc dữ liệu
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

    // --- 8. DASHBOARD LOGIC ---
    async loadDashboard() {
        let [clusters, stores, gdvs, sales, indirect, bts] = await Promise.all([
            Promise.resolve(this.fullClusterData),
            DataService.getStores(), DataService.getGDVs(),
            DataService.getSalesStaff(), DataService.getIndirectChannels(), DataService.getBTS()
        ]);

        // Lọc quyền
        clusters = this.filterDataByScope(clusters, 'maLienCum');
        stores = this.filterDataByScope(stores, 'maLienCum');
        gdvs = this.filterDataByScope(gdvs, 'maLienCum');
        sales = this.filterDataByScope(sales, 'maLienCum');
        indirect = this.filterDataByScope(indirect, 'maLienCum');
        bts = this.filterDataByScope(bts, 'maLienCum');

        // Render Summary Cards
        UIRenderer.renderDashboardSummary(clusters, stores, gdvs, sales, indirect, bts);

        // Setup Dropdown Scope
        const scopeSelect = document.getElementById('chart-scope');
        if(scopeSelect) {
            let options = '<option value="all">Toàn công ty</option>';
            if (this.currentUser.role === 'manager') {
                options = `<option value="${this.currentUser.scope}">${this.getNameLienCum(this.currentUser.scope)}</option>`;
            } else {
                options += clusters.map(c => `<option value="${c.maLienCum}">${c.tenLienCum}</option>`).join('');
            }
            scopeSelect.innerHTML = options;
        }
            
        this.updateCharts(); 
    },

    async updateCharts() {
        const from = document.getElementById('chart-from').value;
        const to = document.getElementById('chart-to').value;
        const scope = document.getElementById('chart-scope').value;

        const kpiData = await DataService.getKPIActual(from, to, '');
        let filteredKPI = scope !== 'all' ? kpiData.filter(d => d.maLienCum === scope || d.lienCum === scope) : kpiData;
        UIRenderer.renderDashboardCharts(filteredKPI, this.chartInstances);
    },

    // --- 9. BUSINESS DATA & SEARCH (PHẦN QUAN TRỌNG NHẤT) ---

    async loadBusinessDataPage() {
        console.log("--> Đang tải dữ liệu kinh doanh...");
        const structure = await DataService.getKPIStructure();
        const mFrom = document.getElementById('filter-month-from').value;
        const mTo = document.getElementById('filter-month-to').value;
        const keyword = document.getElementById('business-search').value;
        
        // Lấy chế độ xem (có fallback nếu chưa có element)
        const viewModeEl = document.getElementById('view-mode');
        const viewMode = viewModeEl ? viewModeEl.value : 'cluster';

        let rawData = await DataService.getKPIActual(mFrom, mTo, keyword);
        console.log(`--> Đã lấy được ${rawData.length} dòng dữ liệu thô.`);

        // 1. CHUẨN BỊ MAP ĐƠN VỊ TÍNH
        const kpiUnitMap = {};
        const listKpiKeys = []; 
        
        structure.forEach(item => {
            if(item.active) {
                // Chuẩn hóa mã KPI trong Cấu trúc (VD: "KPI_DT " -> "KPI_DT")
                const code = this.cleanCode(item.ma);
                // Lưu đơn vị tính để quyết định cộng hay đếm
                kpiUnitMap[code] = (item.dvt || '').toLowerCase();
                listKpiKeys.push(code); // Lưu key đã chuẩn hóa
            }
        });

        // 2. GOM NHÓM DỮ LIỆU (AGGREGATION)
        const aggregatedData = {};

        rawData.forEach(row => {
            // Lọc Scope (Quyền xem dữ liệu)
            if (!this.checkScope(row)) return;

            // Tạo Key gom nhóm dựa trên View Mode (Cụm hoặc Liên Cụm)
            let key = '', tenHienThi = '';
            
            if (viewMode === 'liencum') {
                key = row.maLienCum; 
                tenHienThi = this.getNameLienCum(row.maLienCum);
            } else {
                key = `${row.maLienCum}_${row.maCum}`;
                tenHienThi = this.getNameCum(row.maCum);
            }

            // Init Object nếu chưa có
            if (!aggregatedData[key]) {
                aggregatedData[key] = {
                    id: key,                  
                    hienThi: tenHienThi || `Mã: ${row.maCum}`,      
                    maLienCum: row.maLienCum, 
                    phuong: viewMode === 'liencum' ? '-' : (row.phuong || ''), // Ẩn cột Phường nếu xem Liên Cụm
                    viewMode: viewMode,
                    detailRows: [],           
                    ...listKpiKeys.reduce((acc, k) => ({...acc, [k]: 0}), {}) 
                };
                
                // Init các biến đệm cho cộng gộp (Dù có trong structure hay không vẫn cần đệm để tính)
                aggregatedData[key]['FWAP'] = 0;
                aggregatedData[key]['SAYMEE'] = 0;
                aggregatedData[key]['TBPTM_GOC'] = 0; 
            }

            aggregatedData[key].detailRows.push(row);

            // 3. LOGIC TÍNH TOÁN: ĐẾM (COUNT) HAY CỘNG (SUM)?
            const rawKpiCode = this.cleanCode(row.maKpi);
            const rawValue = Number(row.giaTri) || 0;
            
            // A. Xử lý nhóm Thuê bao đặc biệt (TBPTM, FWAP, SAYMEE) -> LUÔN ĐẾM = 1
            if (['FWAP', 'SAYMEE'].includes(rawKpiCode)) {
                aggregatedData[key][rawKpiCode] += 1; // Luôn đếm dòng
            }
            else if (rawKpiCode.includes('TBPTM')) {
                 aggregatedData[key]['TBPTM_GOC'] += 1; // Đếm dòng TBPTM gốc
            }
            // B. Xử lý các KPI khác theo Đơn vị tính
            else if (kpiUnitMap.hasOwnProperty(rawKpiCode)) {
                const unit = kpiUnitMap[rawKpiCode];
                
                if (unit.includes('đồng') || unit.includes('doanh thu') || unit.includes('tiền')) {
                    // Nếu là TIỀN -> CỘNG giá trị
                    aggregatedData[key][rawKpiCode] += rawValue;
                } else {
                    // Nếu là THUÊ BAO (hoặc cái khác) -> ĐẾM dòng
                    // (Lưu ý: Logic này áp dụng nếu file log là từng dòng giao dịch. 
                    // Nếu file log đã là dòng tổng hợp thì cần sửa lại chỗ này thành += rawValue)
                    // Theo yêu cầu của bạn: Thuê bao thì ĐẾM.
                    aggregatedData[key][rawKpiCode] += 1;
                }
            }
        });

        let processedData = Object.values(aggregatedData);

        // 4. LOGIC CỘNG GỘP: TBPTM HIỂN THỊ = GỐC + FWAP + SAYMEE
        const KEY_TBPTM = 'TBPTM'; 
        processedData.forEach(item => {
            const valFWAP = item['FWAP'] || 0;
            const valSAYMEE = item['SAYMEE'] || 0;
            const valTBPTM_Goc = item['TBPTM_GOC'] || 0; 

            // Ghi đè giá trị hiển thị
            item[KEY_TBPTM] = valTBPTM_Goc + valFWAP + valSAYMEE;
        });

        // 5. TÍNH DÒNG TỔNG CỘNG (GRAND TOTAL)
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

            // Đưa dòng tổng xuống cuối cùng
            processedData.push(totalRow);
        }

        // 6. RENDER RA MÀN HÌNH
        // Truyền Structure gốc để lấy Tên hiển thị đúng (vì cleanCode ở trên đã UpperCase mã)
        const cleanStructure = structure.map(s => ({
            ...s, 
            ma: this.cleanCode(s.ma),
            // Giữ lại tên hiển thị tiếng Việt, nếu không có thì fallback
            tenHienThi: s.tenHienThi || s.ten || s.ma 
        }));
        
        UIRenderer.renderKPIStructureTable(cleanStructure);
        UIRenderer.renderKPIActualTable(processedData, cleanStructure);
        
        this.renderPlanningTab();
        lucide.createIcons();
    },

    // Hàm phụ trợ check scope (Tách ra cho gọn)
    checkScope(item) {
        const user = this.currentUser;
        if (user.role === 'admin' || user.scope === 'all') return true;
        if (item.maLienCum === user.scope || item.lienCum === user.scope) return true;
        return false;
    },

    // Hàm xử lý khi Click vào dòng (Drill-down)
    handleRowClick(id) {
        alert(`Bạn đang xem chi tiết: ${id}. \nChức năng hiển thị popup chi tiết đang được xây dựng!`);
    },

    async renderPlanningTab() {
        const type = document.getElementById('filter-staff-type').value;
        let staffList = [];

        if (type === 'store' || type === 'all') {
            let gdvs = await DataService.getGDVs();
            gdvs = this.filterDataByScope(gdvs, 'maLienCum');
            staffList = staffList.concat(gdvs.map(x => ({...x, chucVu: 'GDV Cửa hàng'})));
        }
        if (type === 'sales' || type === 'all') {
            let sales = await DataService.getSalesStaff();
            sales = this.filterDataByScope(sales, 'maLienCum');
            staffList = staffList.concat(sales.map(x => ({...x, chucVu: 'NV Bán hàng'})));
        }
        if (type === 'b2b' || type === 'all') {
            let b2b = await DataService.getB2BStaff();
            b2b = this.filterDataByScope(b2b, 'maLienCum');
            staffList = staffList.concat(b2b.map(x => ({...x, chucVu: 'NV KHDN'})));
        }
        UIRenderer.renderPlanningTable(staffList);
    },

    // --- 10. SEARCH FUNCTIONS (Tìm kiếm thông minh) ---

    handleSearchCluster(keyword) {
        keyword = keyword.toLowerCase().trim();
        // Lọc scope trước
        let data = this.filterDataByScope(this.fullClusterData, 'maLienCum');
        
        if (!keyword) { UIRenderer.renderClusterTable(data); return; }

        // Logic tìm kiếm đệ quy
        const filtered = data.map(lc => {
            const matchLC = (lc.tenLienCum || '').toLowerCase().includes(keyword);
            
            const filteredCums = lc.cums.map(cum => {
                const matchCum = (cum.tenCum || '').toLowerCase().includes(keyword);
                
                // Tìm trong xã
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

    // --- 11. CÁC TÍNH NĂNG KHÁC (UPLOAD, MODAL...) ---
    
    switchTab(tabId, btnElement) {
        const parent = btnElement.closest('.view-section');
        parent.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId).classList.remove('hidden');
        parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
        if(tabId === 'dash-charts') this.updateCharts();
    },
    
    // Mở Modal Upload
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
        // Giả lập upload
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

    // Modal Cảnh báo thuê
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
    
    // Các hàm placeholder
    openEditModal() { if(this.currentUser.role === 'admin') document.getElementById('modal-edit-ward').classList.add('open'); else alert('Quyền hạn chế!'); },
    saveWardData() { alert('Chức năng đang phát triển!'); this.closeModal(); },
    downloadTemplate(type) { alert(`Đang tải mẫu cho: ${type}...`); },
    
    // Alias quan trọng để HTML gọi được
    loadBusinessData: () => app.loadBusinessDataPage(),
    addKPIStructure: () => alert("Chức năng thêm KPI đang phát triển")
};

// Khởi chạy App khi trang tải xong
document.addEventListener('DOMContentLoaded', () => { app.init(); });
