const UIRenderer = {
    // --- 1. CÁC HÀM HELPER DÙNG CHUNG ---
    
    // Tạo Link Google Map
    getMapLink(lat, lng, address) {
        if (!lat || !lng) return `<span class="text-slate-500 text-xs">${address}</span>`;
        return `
            <div class="flex flex-col">
                <span class="text-xs font-medium text-slate-700 truncate max-w-[200px]" title="${address}">${address}</span>
                <a href="http://googleusercontent.com/maps.google.com/?q=${lat},${lng}" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <i data-lucide="map-pin" class="w-3 h-3"></i> Xem bản đồ
                </a>
            </div>
        `;
    },

    // Tạo Badge Trạng thái nhân sự
    getStatusBadge(status, date) {
        if (status === 'Nghỉ việc') {
            return `<span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Nghỉ việc (${date})</span>`;
        }
        return `<span class="px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Đang làm việc</span>`;
    },

    // Class mờ dòng nếu nghỉ việc
    getRowClass(status) {
        return status === 'Nghỉ việc' ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white hover:bg-slate-50';
    },

    // Avatar chữ cái đầu
    getInitials(name) {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0][0];
        return parts[0][0] + parts[parts.length - 1][0];
    },

    // Tính số ngày còn lại (Dùng cho Hợp đồng thuê)
    getDaysRemaining(endDateStr) {
        if (!endDateStr) return 9999;
        const end = new Date(endDateStr);
        const now = new Date();
        const diffTime = end - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    },

    // Format ngày VN (dd/mm/yyyy)
    formatDateVN(dateStr) {
        if(!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    },

    // --- 2. QUẢN LÝ HẠ TẦNG (CLUSTERS) ---

    // Hàm này giữ nguyên vì dữ liệu đã có sẵn Tên (tenLienCum/tenCum)
    renderClusterTable(data) {
        const tbody = document.getElementById('cluster-table-body');
        if (!tbody) return;
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu phù hợp</td></tr>`;
            return;
        }

        let html = '';
        let stt = 1;

        data.forEach(lc => {
            let totalRowsLC = 0;
            lc.cums.forEach(c => totalRowsLC += c.phuongXas.length);

            lc.cums.forEach((cum, indexCum) => {
                const totalRowsCum = cum.phuongXas.length;

                cum.phuongXas.forEach((px, indexPx) => {
                    html += `<tr class="bg-white hover:bg-blue-50/50 transition-colors group">`;

                    // Cột Liên Cụm (Gộp ô)
                    if (indexCum === 0 && indexPx === 0) {
                        html += `
                            <td class="border-r-light text-center font-bold text-slate-400 align-top pt-4" rowspan="${totalRowsLC}">${stt++}</td>
                            <td class="border-r-light align-top pt-4 w-56" rowspan="${totalRowsLC}">
                                <div class="font-bold text-blue-800 text-base">${lc.tenLienCum}</div>
                                <div class="text-slate-400 text-[10px] italic">(${lc.maLienCum})</div>
                                <div class="mt-2 flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100 w-fit">
                                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-sm">${this.getInitials(lc.truongLienCum)}</div>
                                    <div>
                                        <div class="font-semibold text-slate-700 text-xs">${lc.truongLienCum}</div>
                                        <div class="text-[10px] text-slate-500">${lc.sdtLienCum || ''}</div>
                                    </div>
                                </div>
                            </td>
                        `;
                    }

                    // Cột Cụm (Gộp ô)
                    if (indexPx === 0) {
                        html += `
                            <td class="border-r-light align-top pt-4 w-48" rowspan="${totalRowsCum}">
                                <div class="font-semibold text-slate-700">${cum.tenCum}</div>
                                <div class="text-slate-400 text-[10px] italic">(${cum.maCum})</div>
                                <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <i data-lucide="user" class="w-3 h-3"></i> ${cum.phuTrach}
                                </div>
                            </td>
                        `;
                    }

                    // Các cột chi tiết xã
                    let leadersHtml = px.lanhDao && px.lanhDao.length > 0 ? px.lanhDao.map(ld => {
                        let badgeClass = (ld.chucVu.includes('Chủ tịch') || ld.chucVu.includes('Bí thư')) ? 'primary' : 
                                         (ld.chucVu.includes('CA') || ld.chucVu.includes('Công an')) ? 'secondary' : 'default';
                        return `<div class="role-badge ${badgeClass}" title="SĐT: ${ld.sdt}"><span class="opacity-75">${ld.chucVu}:</span> <span>${ld.ten}</span></div>`;
                    }).join('') : '<span class="text-xs text-slate-300 italic">Chưa cập nhật</span>';

                    html += `
                        <td class="font-medium text-slate-800">${px.ten}</td>
                        <td class="text-sm">
                            <div class="flex flex-col gap-1">
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">VLR:</span> <span class="font-mono font-bold text-blue-600">${px.vlr.toLocaleString()}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Dân:</span> <span class="font-mono text-slate-600">${px.danSo.toLocaleString()}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Trạm:</span> <span class="font-mono text-emerald-600 font-bold">${px.tram}</span></div>
                            </div>
                        </td>
                        <td><div class="flex flex-col items-start gap-1">${leadersHtml}</div></td>
                        <td class="text-center align-middle">
                            <button onclick="app.openEditModal('${px.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="Chỉnh sửa"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                        </td>
                    </tr>`;
                });
            });
        });

        tbody.innerHTML = html;
        lucide.createIcons();
    },

    // --- 3. KÊNH TRỰC TIẾP (SỬ DỤNG MAPPING ID -> TÊN) ---

    // Tab Cửa hàng (Stores)
    renderStoresTable(data) {
        const tbody = document.getElementById('store-list-body');
        if (!tbody) return;
        tbody.innerHTML = data.map((item, idx) => {
            
            // LOGIC CẢNH BÁO HẾT HẠN
            const daysLeft = this.getDaysRemaining(item.ngayHetHan);
            let alertHtml = '';
            let rowClass = 'bg-white';

            if (daysLeft < 0) {
                alertHtml = `<span class="flex items-center text-red-600 font-bold text-xs"><i data-lucide="alert-triangle" class="w-3 h-3 mr-1"></i> QUÁ HẠN (${Math.abs(daysLeft)} ngày)</span>`;
                rowClass = 'bg-red-50';
            } else if (daysLeft <= app.rentalConfig.urgentDay) {
                alertHtml = `<span class="flex items-center text-red-600 font-bold text-xs"><i data-lucide="siren" class="w-3 h-3 mr-1 animate-pulse"></i> CÒN ${daysLeft} NGÀY (GẤP)</span>`;
            } else if (daysLeft <= app.rentalConfig.alertDays[1]) {
                alertHtml = `<span class="flex items-center text-orange-500 font-bold text-xs"><i data-lucide="bell" class="w-3 h-3 mr-1"></i> Còn ${daysLeft} ngày</span>`;
            } else if (daysLeft <= app.rentalConfig.alertDays[0]) {
                alertHtml = `<span class="flex items-center text-yellow-600 font-bold text-xs"><i data-lucide="clock" class="w-3 h-3 mr-1"></i> Sắp hết (${daysLeft} ngày)</span>`;
            } else {
                alertHtml = `<span class="text-slate-400 text-xs">Còn ${daysLeft} ngày</span>`;
            }

            return `
            <tr class="${rowClass} border-b hover:bg-slate-50">
                <td class="p-3 border-b text-center">${idx + 1}</td>
                <td class="p-3 border-b font-bold text-blue-600">${item.id}</td>
                <td class="p-3 border-b font-semibold">${item.ten}</td>
                
                <td class="p-3 border-b text-sm text-slate-700" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 border-b text-sm text-slate-500" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                
                <td class="p-3 border-b">${this.getMapLink(item.lat, item.lng, item.diaChi)}</td>
                
                <td class="p-3 border-b">
                    <div class="text-xs">
                        <div class="text-slate-500">BĐ: <span class="font-mono text-slate-700">${this.formatDateVN(item.ngayThue)}</span></div>
                        <div class="text-slate-500">KT: <span class="font-mono font-bold text-slate-800">${this.formatDateVN(item.ngayHetHan)}</span></div>
                    </div>
                </td>

                <td class="p-3 border-b">
                    ${alertHtml}
                </td>

                <td class="p-3 border-b text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
            </tr>
            `;
        }).join('');
    },

    // Tab Giao dịch viên
    renderGDVTable(data) {
        const tbody = document.getElementById('gdv-list-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(item => `
            <tr class="${this.getRowClass(item.trangThai)} border-b transition">
                <td class="p-3 text-center text-slate-500">${item.stt}</td>
                <td class="p-3 font-mono font-bold text-slate-600">${item.ma}</td>
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs">
                    <div class="font-bold text-blue-600">${item.maCH}</div>
                    <div class="text-slate-500 truncate w-32">${item.tenCH}</div>
                </td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
    },

    // Tab NVBH
   // Tab NVBH
    renderSalesTable(data) {
        const tbody = document.getElementById('sales-list-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(item => `
            <tr class="${this.getRowClass(item.trangThai)} border-b transition">
                <td class="p-3 text-center text-slate-500">${item.stt}</td>
                <td class="p-3 font-mono font-bold text-slate-600">${item.ma}</td>
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                
                <td class="p-3"><div class="flex flex-wrap gap-1">${(item.phuongXas || []).map(px => `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-[10px]">${px}</span>`).join('')}</div></td>
                
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
    },
    // Tab KHDN
    renderB2BTable(data) {
        const tbody = document.getElementById('b2b-list-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(item => `
            <tr class="${this.getRowClass(item.trangThai)} border-b transition">
                <td class="p-3 text-center text-slate-500">${item.stt}</td>
                <td class="p-3 font-mono font-bold text-slate-600">${item.ma}</td>
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
    },

    // --- 4. KÊNH GIÁN TIẾP ---

    renderIndirectTable(data) {
        const tbody = document.getElementById('indirect-list-body');
        if (!tbody) return;
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, idx) => `
            <tr class="bg-white border-b hover:bg-slate-50 transition">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-blue-600">${item.maDL}</td>
                <td class="p-3 font-medium text-slate-700">${item.ten}</td>
                <td class="p-3 font-mono text-xs text-slate-500">${item.maNV}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-1 rounded text-[10px] font-bold border 
                        ${item.loai.includes('UQ') ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          item.loai.includes('C2C') ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                          'bg-slate-50 text-slate-600 border-slate-200'}">
                        ${item.loai}
                    </span>
                </td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3">${this.getMapLink(item.lat, item.lng, item.diaChi)}</td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    // --- 5. TRẠM BTS ---

    renderBTSTable(data) {
        const tbody = document.getElementById('bts-list-body');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, idx) => `
             <tr class="bg-white border-b hover:bg-slate-50 transition">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-slate-700">${item.maTram}</td>
                <td class="p-3 font-medium text-blue-700">${item.tenTram}</td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3">${this.getMapLink(item.lat, item.lng, item.diaChi)}</td>
                <td class="p-3 text-sm italic text-slate-500">${item.ghiChu}</td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    // --- 6. SỐ LIỆU KINH DOANH (KPI) ---
    // (Giữ nguyên, chỉ cần đảm bảo Apps Script trả về đúng cột 'maLienCum' để lọc KPI Actulal ở main.js)

    renderKPIStructureTable(data) {
        const tbody = document.getElementById('body-cautruc');
        if (!tbody) return;
        tbody.innerHTML = data.map(item => `
            <tr class="bg-white border-b hover:bg-slate-50">
                <td class="p-3 text-center">${item.stt}</td>
                <td class="p-3 font-mono font-bold text-blue-600">${item.ma}</td>
                <td class="p-3 font-semibold">${item.ten}</td>
                <td class="p-3 text-sm text-slate-500">${item.dvt}</td>
                <td class="p-3 text-sm">${item.ngayApDung}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                        ${item.active ? 'Đang áp dụng' : 'Ngưng'}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <button onclick="app.openEditModal()" class="admin-only text-slate-400 hover:text-blue-600"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    renderKPIActualTable(data, structure) {
        const table = document.getElementById('table-thuchien');
        if (!table) return;

        let headerHtml = `<tr><th class="p-3 text-left w-32">Liên Cụm</th><th class="p-3 text-left w-32">Cụm</th><th class="p-3 text-left w-40">Phường/Xã</th>`;
        structure.forEach(kpi => {
            if (kpi.active) headerHtml += `<th class="p-3 text-right bg-blue-50/50 min-w-[100px]">${kpi.ten}<br><span class="text-[10px] font-normal text-slate-500">(${kpi.dvt})</span></th>`;
        });
        headerHtml += `</tr>`;
        table.querySelector('thead').innerHTML = headerHtml;

        const tbody = document.getElementById('body-thuchien');
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + structure.length}" class="text-center p-8 text-slate-400">Không có dữ liệu thực hiện</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(row => {
            // Hiển thị tên (dịch từ mã ID nếu có)
            const dispLC = app.getNameLienCum(row.maLienCum || row.lienCum);
            const dispCum = app.getNameCum(row.maCum || row.cum);

            let rowHtml = `<tr class="bg-white border-b hover:bg-slate-50"><td class="p-3 font-bold text-slate-600">${dispLC}</td><td class="p-3 text-sm">${dispCum}</td><td class="p-3 font-medium text-blue-700">${row.phuong}</td>`;
            structure.forEach(kpi => {
                if (kpi.active) {
                    const val = row[kpi.ma] !== undefined ? row[kpi.ma].toLocaleString() : '-';
                    rowHtml += `<td class="p-3 text-right font-mono text-slate-700">${val}</td>`;
                }
            });
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');
    },

    renderKPIUserLogs(data) {
        const tbody = document.getElementById('body-user-ghinhan');
        if (!tbody) return;
        tbody.innerHTML = data.map(item => `
            <tr class="bg-white border-b hover:bg-slate-50">
                <td class="p-3 text-center">${item.stt}</td>
                <td class="p-3 text-sm" title="${item.maLienCum || ''}">${app.getNameLienCum(item.maLienCum || item.lienCum)}</td>
                <td class="p-3 text-sm" title="${item.maCum || ''}">${app.getNameCum(item.maCum || item.cum)}</td>
                <td class="p-3 font-medium text-blue-600">${item.user}</td>
                <td class="p-3"><span class="badge-region">${item.kenh}</span></td>
                <td class="p-3 text-xs text-slate-500 font-mono">${item.time}</td>
            </tr>
        `).join('');
    },

    renderPlanningTable(staffList) {
        const tbody = document.getElementById('body-kehoach');
        if (!tbody) return;
        tbody.innerHTML = staffList.map((nv, idx) => `
            <tr class="bg-white border-b hover:bg-slate-50">
                <td class="p-3 text-center">${idx + 1}</td>
                <td class="p-3 font-mono text-xs font-bold text-slate-500">${nv.ma || nv.id}</td>
                <td class="p-3 font-medium">${nv.ten}</td>
                <td class="p-3 text-xs italic">${nv.chucVu || 'Nhân viên'}</td>
                <td class="p-3 text-xs text-slate-500" title="${nv.maCum || nv.maLienCum}">${app.getNameCum(nv.maCum || nv.maLienCum)}</td>
                <td class="p-2"><input type="number" class="w-full border border-slate-200 rounded px-2 py-1 text-right text-sm focus:border-blue-500 outline-none" placeholder="0"></td>
                <td class="p-2"><input type="number" class="w-full border border-slate-200 rounded px-2 py-1 text-right text-sm focus:border-blue-500 outline-none" placeholder="0"></td>
                <td class="p-2"><input type="number" class="w-full border border-slate-200 rounded px-2 py-1 text-right text-sm focus:border-blue-500 outline-none" placeholder="100"></td>
            </tr>
        `).join('');
    },

    // --- 7. DASHBOARD ---

    renderDashboardSummary(clusters, stores, gdvs, sales, indirect, bts) {
        const tbody = document.getElementById('dashboard-summary-body');
        if (!tbody) return;

        const summaryData = clusters.map(lc => {
            const lcMa = lc.maLienCum; // Lấy Mã để dùng cho filter
            
            return { 
                lcName: lc.tenLienCum, // Hiển thị Tên
                lcMa: lcMa, // Giữ Mã để so sánh
                countCum: lc.cums.length,
                // Lọc theo Mã Liên Cụm
                countStore: stores.filter(i => i.maLienCum === lcMa).length,
                countGDV: gdvs.filter(i => i.maLienCum === lcMa).length,
                countSale: sales.filter(i => i.maLienCum === lcMa).length,
                countAgency: indirect.filter(i => i.maLienCum === lcMa).length,
                countBTS: bts.filter(i => i.maLienCum === lcMa).length,
                rawData: lc 
            };
        });

        tbody.innerHTML = summaryData.map((item, idx) => `
            <tr class="bg-white border-b hover:bg-slate-50">
                <td class="p-3 text-center">${idx + 1}</td>
                <td class="p-3 font-bold text-blue-700" title="${item.lcMa}">${item.lcName}</td>
                <td class="p-3 text-center">${item.countCum}</td>
                <td class="p-3 text-center font-bold">${item.countStore}</td>
                <td class="p-3 text-center">${item.countGDV}</td>
                <td class="p-3 text-center">${item.countSale}</td>
                <td class="p-3 text-center">${item.countAgency}</td>
                <td class="p-3 text-center">${item.countBTS}</td>
                <td class="p-3 text-center">
                    <button class="text-blue-600 hover:underline text-xs flex items-center justify-center w-full" 
                        onclick='app.showClusterDetail(${JSON.stringify(item.rawData)})'>
                        Xem Xã <i data-lucide="chevron-down" class="w-3 h-3 ml-1"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    showClusterDetail(lcData) {
        const panel = document.getElementById('commune-detail-panel');
        const title = document.getElementById('detail-lc-name');
        const tbody = document.getElementById('commune-detail-body');
        
        panel.classList.remove('hidden');
        title.textContent = lcData.tenLienCum;
        
        let rows = '';
        lcData.cums.forEach(cum => {
            cum.phuongXas.forEach(px => {
                const leaders = px.lanhDao ? px.lanhDao.map(l => `${l.chucVu}: ${l.ten}`).join(', ') : '';
                rows += `
                    <tr class="border-b bg-white">
                        <td class="p-2 font-medium text-slate-700">${cum.tenCum}</td>
                        <td class="p-2 text-blue-600">${px.ten}</td>
                        <td class="p-2 text-xs italic text-slate-500">${leaders || 'Chưa cập nhật'}</td>
                        <td class="p-2 text-right font-mono text-xs">${px.danSo.toLocaleString()}</td>
                        <td class="p-2 text-right font-mono text-xs font-bold">${px.vlr.toLocaleString()}</td>
                    </tr>
                `;
            });
        });
        tbody.innerHTML = rows;
    },

    renderDashboardCharts(kpiData, instances) {
        if (instances.revenueChart) instances.revenueChart.destroy();
        if (instances.subChart) instances.subChart.destroy();

        // Lấy danh sách Mã Liên Cụm (hoặc tên) để làm labels
        const labels = [...new Set(kpiData.map(d => d.maLienCum || d.lienCum))];
        
        // Dịch Mã sang Tên để hiển thị trên trục X
        const displayLabels = labels.map(code => app.getNameLienCum(code));
        
        // Tính toán lại dữ liệu dựa trên Mã
        const dataPlan = labels.map(l => 600); // Mock Plan
        const dataActual = labels.map(code => kpiData.filter(d => (d.maLienCum || d.lienCum) === code).reduce((sum, item) => sum + (item.KPI_DT || 0), 0));

        const ctxRev = document.getElementById('chartRevenue').getContext('2d');
        instances.revenueChart = new Chart(ctxRev, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [
                    { label: 'Kế hoạch', data: dataPlan, backgroundColor: '#cbd5e1' },
                    { label: 'Thực hiện', data: dataActual, backgroundColor: '#2563eb' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        const totalNewSub = kpiData.reduce((sum, item) => sum + (item.KPI_TB_MOI || 0), 0);
        const total4G = kpiData.reduce((sum, item) => sum + (item.KPI_4G || 0), 0);

        const ctxSub = document.getElementById('chartSubscriber').getContext('2d');
        instances.subChart = new Chart(ctxSub, {
            type: 'doughnut',
            data: {
                labels: ['Thuê bao mới', 'Gói cước 4G'],
                datasets: [{
                    data: [totalNewSub, total4G],
                    backgroundColor: ['#10b981', '#f59e0b']
                }]
            },
            options: { responsive: true }
        });
    }
};