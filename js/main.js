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
        console.log("App Starting... Version 01.26");

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
        this.renderFooter(); // Hiển thị bản quyền
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

    // Hàm Helper để UI gọi: Dịch Mã -> Tên
    getNameLienCum(code) { return this.mapLienCum[code] || code || ''; },
    getNameCum(code) { return this.mapCum[code] || code || ''; },

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
        // Footer bản quyền cố định góc dưới
        if (!document.getElementById('app-footer')) {
            const footerHTML = `
                <div id="app-footer" class="fixed bottom-1 right-2 text-[10px] text-slate-400 opacity-60 pointer-events-none z-50">
                    Bản quyền <span class="font-bold">hoang.lehuu</span> | Ver <span class="font-mono">01.26</span>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', footerHTML);
        }
    },

    // --- 5. LOGIC LỌC DỮ LIỆU (SCOPE FILTER - THEO ID) ---
    // Mặc định lọc theo cột 'maLienCum'
    filterDataByScope(data, fieldId = 'maLienCum') {
        const user = this.currentUser;
        
        // Admin hoặc View All -> Xem hết
        if (user.role === 'admin' || user.scope === 'all') return data;
        
        // Manager -> Lọc đúng Mã ID
        return data.filter(item => {
            // Check theo Mã (Ưu tiên)
            if (item[fieldId] === user.scope) return true;
            // Check fallback theo Tên (Phòng khi data cũ chưa có mã)
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
        // A. DASHBOARD
        if (pageId === 'dashboard') {
            this.loadDashboard();
        }
        // B. HẠ TẦNG (CLUSTERS)
        else if (pageId === 'clusters') {
            // Lọc theo scope (dùng tenLienCum hoặc maLienCum đều được vì object cluster có cả 2)
            let data = this.filterDataByScope(this.fullClusterData, 'maLienCum');
            UIRenderer.renderClusterTable(data);
        }
        // C. KÊNH TRỰC TIẾP (STORES, GDV, SALES, B2B)
        else if (pageId === 'direct_channel') {
            let [stores, gdvs, sales, b2b] = await Promise.all([
                DataService.getStores(), DataService.getGDVs(),
                DataService.getSalesStaff(), DataService.getB2BStaff()
            ]);
            
            // Lọc dữ liệu theo Mã Liên Cụm
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
        // D. KÊNH GIÁN TIẾP
        else if (pageId === 'indirect_channel') {
            let data = await DataService.getIndirectChannels();
            data = this.filterDataByScope(data, 'maLienCum');
            UIRenderer.renderIndirectTable(data);
        }
        // E. TRẠM BTS
        else if (pageId === 'bts') {
            let data = await DataService.getBTS();
            data = this.filterDataByScope(data, 'maLienCum');
            UIRenderer.renderBTSTable(data);
        }
        // F. SỐ LIỆU KINH DOANH
        else if (pageId === 'business_data') {
            await this.loadBusinessDataPage();
        }
    },

    // --- 8. DASHBOARD LOGIC ---
    async loadDashboard() {
        let clusters = this.fullClusterData;
        let stores = await DataService.getStores();
        let gdvs = await DataService.getGDVs();
        let sales = await DataService.getSalesStaff();
        let indirect = await DataService.getIndirectChannels();
        let bts = await DataService.getBTS();

        // Lọc quyền
        clusters = this.filterDataByScope(clusters, 'maLienCum');
        stores = this.filterDataByScope(stores, 'maLienCum');
        gdvs = this.filterDataByScope(gdvs, 'maLienCum');
        sales = this.filterDataByScope(sales, 'maLienCum');
        indirect = this.filterDataByScope(indirect, 'maLienCum');
        bts = this.filterDataByScope(bts, 'maLienCum');

        // Render Summary Cards
        UIRenderer.renderDashboardSummary(clusters, stores, gdvs, sales, indirect, bts);

        // Setup Dropdown Scope (Hiển thị Tên thay vì Mã)
        const scopeSelect = document.getElementById('chart-scope');
        if(scopeSelect) {
            let options = '<option value="all">Toàn công ty</option>';
            if (this.currentUser.role === 'manager') {
                // Nếu là Manager, chỉ hiện 1 option là scope của họ
                options = `<option value="${this.currentUser.scope}">${this.getNameLienCum(this.currentUser.scope)}</option>`;
            } else {
                // Admin hiện list tất cả Liên Cụm
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

        // Lấy dữ liệu KPI
        const kpiData = await DataService.getKPIActual(from, to, '');
        let filteredKPI = kpiData;

        // Lọc biểu đồ
        if (scope !== 'all') {
            // Lọc theo Mã Liên Cụm (hoặc Tên nếu data cũ)
            filteredKPI = kpiData.filter(d => d.maLienCum === scope || d.lienCum === scope);
        }
        UIRenderer.renderDashboardCharts(filteredKPI, this.chartInstances);
    },

    // --- 9. BUSINESS DATA & SEARCH ---
    
    async loadBusinessDataPage() {
        const structure = await DataService.getKPIStructure();
        // ... (Logic cũ)
        const mFrom = document.getElementById('filter-month-from').value;
        const mTo = document.getElementById('filter-month-to').value;
        const keyword = document.getElementById('business-search').value;

        let actualData = await DataService.getKPIActual(mFrom, mTo, keyword);
        actualData = this.filterDataByScope(actualData, 'maLienCum');
        
        UIRenderer.renderKPIStructureTable(structure);
        UIRenderer.renderKPIActualTable(actualData, structure);
        
        // Tab Planning
        this.renderPlanningTab();
        lucide.createIcons();
    },

    async renderPlanningTab() {
        // Gom nhân sự từ các nguồn khác nhau để hiển thị bảng Planning
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

        // Logic tìm kiếm đệ quy (Tìm cả trong Cụm/Xã)
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
    // Giữ nguyên các hàm bổ trợ
    switchTab(tabId, btnElement) {
        const parent = btnElement.closest('.view-section');
        parent.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId).classList.remove('hidden');
        parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
        if(tabId === 'dash-charts') this.updateCharts();
    },
    
    // Mở Modal Upload (Demo)
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
    downloadTemplate(type) { alert(`Đang tải mẫu cho: ${type}...`); }
};

// Khởi chạy App khi trang tải xong
document.addEventListener('DOMContentLoaded', () => { app.init(); });