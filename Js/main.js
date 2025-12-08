const app = {
    // --- 1. CẤU HÌNH USER & PHÂN QUYỀN (DEMO) ---
    users: [
        { name: "Admin User", role: "admin", scope: "all" },           // Full quyền
        { name: "View Only User", role: "view", scope: "all" },        // Chỉ xem
        { name: "Manager Tan Chau", role: "manager", scope: "TÂN CHÂU" } // Chỉ xem dữ liệu Tân Châu
    ],
    currentUserIndex: 0, 

    get currentUser() {
        return this.users[this.currentUserIndex];
    },

    // --- CẤU HÌNH CẢNH BÁO THUÊ (MẶC ĐỊNH) ---
    rentalConfig: {
        emails: "admin@mobifone.vn, quanly@mobifone.vn",
        alertDays: [90, 60], // Các mốc gửi cảnh báo định kỳ
        urgentDay: 30        // Mốc gửi cảnh báo hàng ngày (Gấp)
    },

    fullClusterData: [],     // Cache dữ liệu hạ tầng
    chartInstances: {},      // Cache biểu đồ

    // --- KHỞI TẠO ỨNG DỤNG ---
    async init() {
        console.log("App Starting...");
        lucide.createIcons();
        
        // 1. Cập nhật giao diện theo quyền
        this.updateUserInterface();

        // 2. Lấy dữ liệu gốc
        this.fullClusterData = await DataService.getClusters();
        
        // 3. Vào trang Dashboard mặc định
        this.navigate('dashboard');
    },

    // --- 2. LOGIC PHÂN QUYỀN (CORE) ---
    
    toggleUserRole() {
        this.currentUserIndex = (this.currentUserIndex + 1) % this.users.length;
        this.updateUserInterface();
        
        alert(`Đã chuyển sang quyền: ${this.currentUser.role.toUpperCase()} (${this.currentUser.name})`);
        
        // Reload lại trang hiện tại để áp dụng quyền
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) {
            const onclickAttr = activeItem.getAttribute('onclick');
            const currentPage = onclickAttr.match(/'([^']+)'/)[1];
            this.loadDataForPage(currentPage);
        }
    },

    updateUserInterface() {
        const user = this.currentUser;
        
        // Update Sidebar Info
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role-display');
        const userAvatarEl = document.getElementById('user-avatar');

        if(userNameEl) userNameEl.textContent = user.name;
        if(userRoleEl) userRoleEl.textContent = `Role: ${user.role} | Scope: ${user.scope}`;
        
        let avatarText = 'AD';
        if (user.role === 'view') avatarText = 'VW';
        if (user.role === 'manager') avatarText = 'MG';
        if(userAvatarEl) userAvatarEl.textContent = avatarText;

        // Xử lý CSS Body
        document.body.classList.remove('is-admin', 'is-view', 'is-manager');
        document.body.classList.add(`is-${user.role}`);

        // Ẩn/Hiện Menu Hệ thống
        const systemMenu = document.querySelector('.system-menu-only');
        if (systemMenu) {
            systemMenu.style.display = user.role === 'admin' ? 'flex' : 'none';
        }
    },

    // --- 3. LOGIC LỌC DỮ LIỆU (SCOPE FILTER) ---
    filterDataByScope(data, fieldName = 'lienCum') {
        if (this.currentUser.role !== 'manager') return data;
        
        return data.filter(item => {
            const val = item[fieldName] || item.tenLienCum; 
            return val && val.toUpperCase().includes(this.currentUser.scope.toUpperCase());
        });
    },

    // --- 4. ĐIỀU HƯỚNG & LOAD DATA ---
    navigate(pageId) {
        if (pageId === 'system' && this.currentUser.role !== 'admin') {
            alert("Bạn không có quyền truy cập menu Cấu hình Hệ thống!");
            return;
        }

        // Active Menu
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
        if(activeLink) activeLink.classList.add('active');

        // Show View Section
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

    async loadDataForPage(pageId) {
        if (pageId === 'dashboard') {
            this.loadDashboard();
        }
        else if (pageId === 'clusters') {
            let data = await DataService.getClusters();
            data = this.filterDataByScope(data, 'tenLienCum');
            UIRenderer.renderClusterTable(data);
        }
        else if (pageId === 'direct_channel') {
            let [stores, gdvs, sales, b2b] = await Promise.all([
                DataService.getStores(), DataService.getGDVs(),
                DataService.getSalesStaff(), DataService.getB2BStaff()
            ]);
            
            // Lọc dữ liệu
            stores = this.filterDataByScope(stores, 'lienCum');
            gdvs = this.filterDataByScope(gdvs, 'lienCum');
            sales = this.filterDataByScope(sales, 'lienCum');
            b2b = this.filterDataByScope(b2b, 'lienCum');

            UIRenderer.renderStoresTable(stores); // Đã có logic cảnh báo thuê trong UI
            UIRenderer.renderGDVTable(gdvs);
            UIRenderer.renderSalesTable(sales);
            UIRenderer.renderB2BTable(b2b);
            lucide.createIcons();
        }
        else if (pageId === 'indirect_channel') {
            let data = await DataService.getIndirectChannels();
            data = this.filterDataByScope(data, 'lienCum');
            UIRenderer.renderIndirectTable(data);
        }
        else if (pageId === 'bts') {
            let data = await DataService.getBTS();
            data = this.filterDataByScope(data, 'lienCum');
            UIRenderer.renderBTSTable(data);
        }
        else if (pageId === 'business_data') {
            await this.loadBusinessDataPage();
        }
    },

    // --- 5. DASHBOARD LOGIC ---
    async loadDashboard() {
        let clusters = await DataService.getClusters();
        let stores = await DataService.getStores();
        let gdvs = await DataService.getGDVs();
        let sales = await DataService.getSalesStaff();
        let indirect = await DataService.getIndirectChannels();
        let bts = await DataService.getBTS();

        // Lọc quyền
        clusters = this.filterDataByScope(clusters, 'tenLienCum');
        stores = this.filterDataByScope(stores, 'lienCum');
        gdvs = this.filterDataByScope(gdvs, 'lienCum');
        sales = this.filterDataByScope(sales, 'lienCum');
        indirect = this.filterDataByScope(indirect, 'lienCum');
        bts = this.filterDataByScope(bts, 'lienCum');

        // Render Summary
        UIRenderer.renderDashboardSummary(clusters, stores, gdvs, sales, indirect, bts);

        // Setup Dropdown Chart
        const scopeSelect = document.getElementById('chart-scope');
        if(scopeSelect) {
            let options = '<option value="all">Toàn công ty</option>';
            if (this.currentUser.role === 'manager') {
                options = `<option value="${this.currentUser.scope}">${this.currentUser.scope}</option>`;
            } else {
                options += clusters.map(c => `<option value="${c.tenLienCum}">${c.tenLienCum}</option>`).join('');
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
        let filteredKPI = kpiData;
        if (scope !== 'all') {
            filteredKPI = kpiData.filter(d => d.lienCum === scope);
        }
        UIRenderer.renderDashboardCharts(filteredKPI, this.chartInstances);
    },

    // --- 6. BUSINESS DATA LOGIC ---
    async loadBusinessDataPage() {
        const structure = await DataService.getKPIStructure();
        const mFrom = document.getElementById('filter-month-from').value;
        const mTo = document.getElementById('filter-month-to').value;
        const keyword = document.getElementById('business-search').value;

        let actualData = await DataService.getKPIActual(mFrom, mTo, keyword);
        actualData = this.filterDataByScope(actualData, 'lienCum');
        const userLogs = await DataService.getKPIUserLogs();

        UIRenderer.renderKPIStructureTable(structure);
        UIRenderer.renderKPIActualTable(actualData, structure);
        UIRenderer.renderKPIUserLogs(userLogs);
        
        this.renderPlanningTab();
        lucide.createIcons();
    },

    async renderPlanningTab() {
        const type = document.getElementById('filter-staff-type').value;
        let staffList = [];

        if (type === 'store' || type === 'all') {
            let gdvs = await DataService.getGDVs();
            gdvs = this.filterDataByScope(gdvs, 'lienCum');
            staffList = staffList.concat(gdvs.map(x => ({...x, chucVu: 'GDV Cửa hàng'})));
        }
        if (type === 'sales' || type === 'all') {
            let sales = await DataService.getSalesStaff();
            sales = this.filterDataByScope(sales, 'lienCum');
            staffList = staffList.concat(sales.map(x => ({...x, chucVu: 'NV Bán hàng'})));
        }
        if (type === 'b2b' || type === 'all') {
            let b2b = await DataService.getB2BStaff();
            b2b = this.filterDataByScope(b2b, 'lienCum');
            staffList = staffList.concat(b2b.map(x => ({...x, chucVu: 'NV KHDN'})));
        }
        UIRenderer.renderPlanningTable(staffList);
    },

    // --- 7. TÍNH NĂNG CẢNH BÁO THUÊ CỬA HÀNG (NEW) ---
    
    // Mở Modal Cấu hình
    openRentConfigModal() {
        if(this.currentUser.role !== 'admin') {
            alert("Chỉ Admin mới được cấu hình cảnh báo!");
            return;
        }
        document.getElementById('config-emails').value = this.rentalConfig.emails;
        document.getElementById('config-day-1').value = this.rentalConfig.alertDays[0];
        document.getElementById('config-day-2').value = this.rentalConfig.alertDays[1];
        document.getElementById('config-day-urgent').value = this.rentalConfig.urgentDay;
        
        document.getElementById('modal-rent-config').classList.add('open');
    },

    // Lưu Cấu hình
    saveRentConfig() {
        this.rentalConfig.emails = document.getElementById('config-emails').value;
        const d1 = parseInt(document.getElementById('config-day-1').value);
        const d2 = parseInt(document.getElementById('config-day-2').value);
        const du = parseInt(document.getElementById('config-day-urgent').value);
        
        this.rentalConfig.alertDays = [d1, d2];
        this.rentalConfig.urgentDay = du;

        alert("Đã lưu cấu hình cảnh báo thành công!");
        this.closeModal('modal-rent-config');
    },

    // Chạy thử logic gửi mail
    async checkRentalStatusAndNotify() {
        // Lấy danh sách cửa hàng (đã lọc theo quyền nếu là manager)
        let stores = await DataService.getStores();
        stores = this.filterDataByScope(stores, 'lienCum');
        
        const logs = [];
        
        stores.forEach(store => {
            // Hàm getDaysRemaining được định nghĩa bên ui-renderer.js, ta dùng lại hoặc tính ở đây
            // Để an toàn, ta tính lại ở đây:
            const getDays = (dateStr) => {
                if (!dateStr) return 9999;
                const end = new Date(dateStr);
                const now = new Date();
                return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
            };

            const daysLeft = getDays(store.ngayHetHan);
            
            // Logic so khớp
            if (daysLeft <= this.rentalConfig.urgentDay) {
                logs.push(`⚠️ [GẤP - GỬI HÀNG NGÀY] CH ${store.ten}: Còn ${daysLeft} ngày. Email tới: ${this.rentalConfig.emails}`);
            } 
            else if (this.rentalConfig.alertDays.includes(daysLeft)) {
                logs.push(`🔔 [ĐỊNH KỲ] CH ${store.ten}: Còn ${daysLeft} ngày. Email tới: ${this.rentalConfig.emails}`);
            }
        });

        if (logs.length > 0) {
            alert("Hệ thống đã quét và giả lập gửi các email sau:\n\n" + logs.join("\n"));
        } else {
            alert("Hệ thống đã quét: Không có cửa hàng nào trùng khớp ngày cảnh báo hôm nay.");
        }
    },

    // --- 8. FILE & MODAL HELPERS ---

    switchTab(tabId, btnElement) {
        const parent = btnElement.closest('.view-section');
        parent.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId).classList.remove('hidden');
        parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
        if(tabId === 'dash-charts') this.updateCharts();
    },

    downloadTemplate(typeParam) {
        const type = typeParam || document.getElementById('upload-type').value;
        let headers = [];
        let fileName = "";
        let sheetName = "Data";

        switch(type) {
            case 'cluster': fileName = "Mau_Nhap_LienCum.xlsx"; headers = ["STT", "Tên Liên Cụm", "Trưởng Liên Cụm", "Tên Cụm", "Phụ Trách Cụm", "Tên Phường Xã", "VLR", "Dân Số", "Số Trạm BTS", "Lãnh Đạo Xã", "Chức Vụ", "SĐT"]; break;
            case 'store': fileName = "Mau_Nhap_CuaHang.xlsx"; headers = ["STT", "Mã CH", "Tên Cửa Hàng", "Liên Cụm", "Cụm", "Địa Chỉ", "Lat", "Lng", "CHT", "SĐT", "Giờ Mở", "Trạng Thái", "Ngày Thuê", "Ngày Hết Hạn"]; break;
            case 'gdv': fileName = "Mau_Nhap_GDV.xlsx"; headers = ["STT", "Mã GDV", "Họ Tên", "Mã CH", "Tên CH", "Liên Cụm", "Cụm", "Vùng", "SĐT", "Trạng Thái", "Ngày Nghỉ"]; break;
            case 'sales': fileName = "Mau_Nhap_NVBH.xlsx"; headers = ["STT", "Mã NVBH", "Họ Tên", "Liên Cụm", "Cụm", "Vùng", "Phường Xã", "SĐT", "Trạng Thái", "Ngày Nghỉ"]; break;
            case 'b2b': fileName = "Mau_Nhap_KHDN.xlsx"; headers = ["STT", "Mã NV", "Họ Tên", "Liên Cụm", "Cụm", "Vùng", "SĐT", "Trạng Thái", "Ngày Nghỉ"]; break;
            case 'indirect': fileName = "Mau_Nhap_KenhGianTiep.xlsx"; headers = ["STT", "Mã ĐL", "Tên ĐL", "Mã NV", "Loại", "Liên Cụm", "Cụm", "Địa Chỉ", "Lat", "Lng"]; break;
            case 'bts': fileName = "Mau_Nhap_TramBTS.xlsx"; headers = ["STT", "Mã Trạm", "Tên Trạm", "Liên Cụm", "Cụm", "Địa Chỉ", "Lat", "Lng", "Ghi Chú"]; break;
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName);
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
                    const activeItem = document.querySelector('.nav-item.active');
                    if(activeItem) this.loadDataForPage(activeItem.getAttribute('onclick').match(/'([^']+)'/)[1]);
                }, 500);
            } else {
                width += 10;
                document.getElementById('progress-bar-inner').style.width = width + '%';
            }
        }, 50);
    },

    handleSearchCluster(keyword) {
        keyword = keyword.toLowerCase().trim();
        let data = this.filterDataByScope(this.fullClusterData, 'tenLienCum');
        if (!keyword) { UIRenderer.renderClusterTable(data); return; }

        const filtered = data.map(lc => {
            const matchLC = lc.tenLienCum.toLowerCase().includes(keyword) || lc.truongLienCum.toLowerCase().includes(keyword);
            const filteredCums = lc.cums.map(cum => {
                const filteredPX = cum.phuongXas.filter(px => px.ten.toLowerCase().includes(keyword) || (px.lanhDao && px.lanhDao.some(ld => ld.ten.toLowerCase().includes(keyword))));
                if (filteredPX.length > 0 || cum.tenCum.toLowerCase().includes(keyword)) return { ...cum, phuongXas: filteredPX.length ? filteredPX : cum.phuongXas };
                return null;
            }).filter(c => c !== null);
            if (filteredCums.length > 0 || matchLC) return { ...lc, cums: filteredCums.length ? filteredCums : lc.cums };
            return null;
        }).filter(lc => lc !== null);
        UIRenderer.renderClusterTable(filtered);
    },

    async handleSearchIndirect(keyword) {
        let data = await DataService.getIndirectChannels();
        data = this.filterDataByScope(data, 'lienCum');
        if(keyword) data = data.filter(i => i.ten.toLowerCase().includes(keyword.toLowerCase()));
        UIRenderer.renderIndirectTable(data);
    },

    async handleSearchBTS(keyword) {
        let data = await DataService.getBTS();
        data = this.filterDataByScope(data, 'lienCum');
        if(keyword) data = data.filter(i => i.tenTram.toLowerCase().includes(keyword.toLowerCase()));
        UIRenderer.renderBTSTable(data);
    },

    closeModal(id) { document.getElementById(id || 'modal-edit-ward').classList.remove('open'); },
    openEditModal() { 
        if(this.currentUser.role !== 'admin') return alert('Chỉ Admin mới có quyền sửa!');
        document.getElementById('modal-edit-ward').classList.add('open'); 
    },
    saveWardData() { alert('Đã lưu!'); this.closeModal(); },
    addKPIStructure() { alert('Chức năng đang phát triển.'); }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });