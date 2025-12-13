const UIRenderer = {
    // ============================================================
    // 1. CÁC HÀM HELPER DÙNG CHUNG
    // ============================================================
    
    // Format số liệu (1.000.000)
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return new Intl.NumberFormat('vi-VN').format(num);
    },

    // Tạo Link Google Map
    getMapLink(lat, lng, address) {
        if (!lat || !lng) return `<span class="text-slate-500 text-xs">${address}</span>`;
        return `
            <div class="flex flex-col">
                <span class="text-xs font-medium text-slate-700 truncate max-w-[200px]" title="${address}">${address}</span>
                <a href="http://maps.google.com/?q=${lat},${lng}" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <i data-lucide="map-pin" class="w-3 h-3"></i> Xem bản đồ
                </a>
            </div>
        `;
    },

    // Tạo Badge Trạng thái nhân sự
    getStatusBadge(status, date) {
        if (status === 'Nghỉ việc') {
            return `<span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Nghỉ việc (${date || ''})</span>`;
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

    // Tính số ngày còn lại (Hỗ trợ cả dd/mm/yyyy và yyyy-mm-dd)
    getDaysRemaining(endDateStr) {
        if (!endDateStr) return 9999;
        let end;
        
        // Xử lý ngày Việt Nam (31/12/2025)
        if (endDateStr.includes('/')) {
            const parts = endDateStr.split('/');
            if (parts.length === 3) {
                // new Date(y, m-1, d)
                end = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        } 
        
        if (!end || isNaN(end.getTime())) {
            end = new Date(endDateStr);
        }
        
        if (isNaN(end.getTime())) return 9999;

        const now = new Date();
        now.setHours(0,0,0,0);
        const diffTime = end - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    },

    // Format ngày VN (dd/mm/yyyy)
    formatDateVN(dateStr) {
        if(!dateStr) return '';
        try {
            // Check nếu là chuỗi dd/mm/yyyy sẵn rồi thì trả về luôn
            if (typeof dateStr === 'string' && dateStr.includes('/') && dateStr.split('/').length === 3) return dateStr;

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr; 
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        } catch (e) { return dateStr; }
    },

    // ============================================================
    // 2. QUẢN LÝ HẠ TẦNG (CLUSTERS)
    // ============================================================

    renderClusterTable(data) {
        const tbody = document.getElementById('cluster-table-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
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

                    if (indexCum === 0 && indexPx === 0) {
                        html += `
                            <td class="border-r border-slate-100 text-center font-bold text-slate-400 align-top pt-4" rowspan="${totalRowsLC}">${stt++}</td>
                            <td class="border-r border-slate-100 align-top pt-4 w-56" rowspan="${totalRowsLC}">
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

                    if (indexPx === 0) {
                        html += `
                            <td class="border-r border-slate-100 align-top pt-4 w-48" rowspan="${totalRowsCum}">
                                <div class="font-semibold text-slate-700">${cum.tenCum}</div>
                                <div class="text-slate-400 text-[10px] italic">(${cum.maCum})</div>
                                <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <i data-lucide="user" class="w-3 h-3"></i> ${cum.phuTrach}
                                </div>
                            </td>
                        `;
                    }

                    let leadersHtml = px.lanhDao && px.lanhDao.length > 0 ? px.lanhDao.map(ld => {
                        let badgeClass = (ld.chucVu.includes('Chủ tịch') || ld.chucVu.includes('Bí thư')) ? 'text-blue-700 bg-blue-50' : 
                                         (ld.chucVu.includes('CA') || ld.chucVu.includes('Công an')) ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100';
                        return `<div class="text-[10px] mb-1 px-1.5 py-0.5 rounded border border-slate-200 w-fit ${badgeClass}" title="SĐT: ${ld.sdt}">
                            <span class="opacity-75 font-semibold">${ld.chucVu}:</span> <span>${ld.ten}</span>
                        </div>`;
                    }).join('') : '<span class="text-xs text-slate-300 italic">Chưa cập nhật</span>';

                    html += `
                        <td class="font-medium text-slate-800 border-b border-slate-100">${px.ten}</td>
                        <td class="text-sm border-b border-slate-100">
                            <div class="flex flex-col gap-1">
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">VLR:</span> <span class="font-mono font-bold text-blue-600">${this.formatNumber(px.vlr)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Dân:</span> <span class="font-mono text-slate-600">${this.formatNumber(px.danSo)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Trạm:</span> <span class="font-mono text-emerald-600 font-bold">${px.tram}</span></div>
                            </div>
                        </td>
                        <td class="border-b border-slate-100"><div class="flex flex-col items-start gap-1">${leadersHtml}</div></td>
                        <td class="text-center align-middle border-b border-slate-100">
                            <button onclick="app.openEditModal('${px.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="Chỉnh sửa"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                        </td>
                    </tr>`;
                });
            });
        });

        tbody.innerHTML = html;
        lucide.createIcons();
    },

    // ============================================================
    // 3. KÊNH TRỰC TIẾP & GIÁN TIẾP & BTS
    // ============================================================

    renderStoresTable(data) {
        const tbody = document.getElementById('store-list-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
             tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
             return;
        }

        tbody.innerHTML = data.map((item, idx) => {
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

            const dai = item.dai || '-';
            const rong = item.rong || '-';
            const dt = item.dienTich || '-';

            return `
            <tr class="${rowClass} border-b hover:bg-slate-50">
                <td class="p-3 border-b text-center">${idx + 1}</td>
                <td class="p-3 border-b font-bold text-blue-600">${item.id}</td>
                <td class="p-3 border-b font-semibold">${item.ten}</td>
                <td class="p-3 border-b text-sm text-slate-700" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 border-b text-sm text-slate-500" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 border-b">${this.getMapLink(item.lat, item.lng, item.diaChi)}</td>
                <td class="p-3 border-b text-xs">
                    <div class="whitespace-nowrap"><span class="text-slate-500">Dài:</span> <b>${dai}</b>m</div>
                    <div class="whitespace-nowrap"><span class="text-slate-500">Rộng:</span> <b>${rong}</b>m</div>
                    <div class="mt-1 font-bold text-blue-700 bg-blue-50 px-1 rounded w-fit">DT: ${dt} m²</div>
                </td>
                <td class="p-3 border-b">
                    <div class="text-xs">
                        <div class="text-slate-500">BĐ: <span class="font-mono text-slate-700">${this.formatDateVN(item.ngayThue)}</span></div>
                        <div class="text-slate-500">KT: <span class="font-mono font-bold text-slate-800">${this.formatDateVN(item.ngayHetHan)}</span></div>
                    </div>
                </td>
                <td class="p-3 border-b">${alertHtml}</td>
                <td class="p-3 border-b text-sm text-slate-500 italic max-w-[200px] truncate" title="${item.ghiChu || ''}">${item.ghiChu || ''}</td>
            </tr>`;
        }).join('');
        lucide.createIcons();
    },

    renderGDVTable(data) {
        const tbody = document.getElementById('gdv-list-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
             tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
             return;
        }

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
        lucide.createIcons();
    },

    renderSalesTable(data) {
        const tbody = document.getElementById('sales-list-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
             tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
             return;
        }

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
        lucide.createIcons();
    },

    renderB2BTable(data) {
        const tbody = document.getElementById('b2b-list-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
             tbody.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
             return;
        }

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
        lucide.createIcons();
    },

    renderIndirectTable(data) {
        const tbody = document.getElementById('indirect-list-body');
        if (!tbody) return;
        
        if (!data || data.length === 0) {
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
                        ${(item.loai || '').includes('UQ') ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          (item.loai || '').includes('C2C') ? 'bg-orange-50 text-orange-600 border-orange-100' : 
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

    renderBTSTable(data) {
        const tbody = document.getElementById('bts-list-body');
        if (!tbody) return;

        if (!data || data.length === 0) {
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

    // ============================================================
    // 4. SỐ LIỆU KINH DOANH (KPI) 
    // ============================================================

    renderKPIStructureTable(structure) {
        const tbody = document.getElementById('body-cautruc');
        if (tbody) {
            tbody.innerHTML = structure.map((item, i) => `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="p-3 text-center">${i+1}</td>
                    <td class="p-3 font-mono font-bold text-blue-600">${item.ma}</td>
                    <td class="p-3 font-semibold">${item.tenHienThi}</td>
                    <td class="p-3 text-sm text-slate-500">${item.dvt}</td>
                    <td class="p-3 text-sm">${item.ngayApDung || '-'}</td>
                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${item.active ? 'Đang áp dụng' : 'Ngưng'}</span></td>
                    <td class="p-3 text-center"><button onclick="app.openEditModal()" class="admin-only text-slate-400 hover:text-blue-600"><i data-lucide="edit-3" class="w-4 h-4"></i></button></td>
                </tr>
            `).join('');
        }
        lucide.createIcons();
    },

    // HÀM RENDER CHÍNH CHO TAB SỐ LIỆU KINH DOANH (ĐÃ ĐƯỢC CẬP NHẬT HEADER 2 DÒNG)
    renderKPIActualTable(data, structure) {
        const tbody = document.getElementById('kpi-actual-tbody') || document.getElementById('body-thuchien');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="100" class="text-center py-8 text-slate-400 italic">Không có dữ liệu phù hợp với bộ lọc</td></tr>`;
            return;
        }

        // Tạo lại Header động để khớp với cấu trúc KPI mới
        const thead = document.getElementById('kpi-header');
        if (thead) {
            let headerHtml = `
                <tr>
                    <th rowspan="2" class="w-12 text-center sticky left-0 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">#</th>
                    <th rowspan="2" class="min-w-[150px] sticky left-12 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Đơn vị</th>
                    <th rowspan="2" class="w-20">Thời gian</th>
            `;

            let subHeaderHtml = '<tr>';
            structure.forEach(kpi => {
                headerHtml += `<th colspan="2" class="text-center min-w-[200px]">${kpi.tenHienThi} (${kpi.dvt})</th>`;
                subHeaderHtml += `
                    <th class="text-right w-24 border-t border-r border-slate-200">Thực hiện</th>
                    <th class="text-right w-24 border-t border-slate-200">Kế hoạch</th>
                `;
            });

            headerHtml += '</tr>';
            subHeaderHtml += '</tr>';
            thead.innerHTML = headerHtml + subHeaderHtml;
        }

        // Render Body
        const fragment = document.createDocumentFragment();
        data.forEach((item, index) => {
            const tr = document.createElement('tr');
            if (item.isTotal) {
                tr.className = "bg-blue-100 font-bold border-t-2 border-blue-300 text-blue-900 sticky bottom-0 z-10 shadow-lg";
            } else {
                tr.className = "bg-white border-b hover:bg-slate-50 cursor-pointer transition-colors";
                tr.onclick = () => app.handleRowClick(item.hienThi); 
            }

            let sttHtml = item.isTotal ? 'TỔNG' : (index + 1);
            let rowHtml = `
                <td class="p-3 text-center border-r bg-white sticky left-0 z-30 border-r-slate-200 font-medium ${item.isTotal ? 'bg-blue-200 font-bold' : 'text-slate-500'} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">${sttHtml}</td>
                <td class="p-3 font-bold text-blue-700 border-r whitespace-nowrap sticky left-12 z-30 bg-white ${item.isTotal ? 'bg-blue-200 text-blue-900' : 'group-hover:bg-slate-50'} border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title="${item.ma}">${item.hienThi}</td>
                <td class="p-3 text-sm font-medium border-r text-slate-600">${item.month || ''}</td>
            `;

            structure.forEach(kpi => {
                const cleanKey = app.cleanCode(kpi.ma);
                const actual = item[`${cleanKey}_TH`] || 0;
                const plan = item[`${cleanKey}_KH`] || 0;
                
                let actualVal = this.formatNumber(actual);
                let planVal = this.formatNumber(plan);
                
                // Tô màu nếu là %
                if (kpi.dvt && kpi.dvt.toLowerCase().includes('%')) {
                     let percent = actual; // Với % thì giá trị chính là số
                     let percentClass = percent >= 100 ? 'text-green-600' : (percent >= 80 ? 'text-orange-600' : 'text-red-600');
                     actualVal = `<span class="${percentClass}">${percent}%</span>`;
                     planVal = '-';
                }
                
                rowHtml += `
                    <td class="p-3 text-right font-bold border-r ${item.isTotal ? 'bg-blue-100' : 'text-slate-800'}">${actualVal}</td>
                    <td class="p-3 text-right font-medium border-r ${item.isTotal ? 'bg-blue-100' : 'text-slate-500'}">${planVal}</td>
                `;
            });

            tr.innerHTML = rowHtml;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    },

    renderPlanningTable(rows, kpiStructure, planMap = {}) {
        const table = document.getElementById('table-kehoach'); 
        if (!table) return;

        // Tính tổng cột
        const colTotals = {};
        kpiStructure.forEach(k => colTotals[k.ma] = 0);
        rows.forEach(row => {
            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const val = Number(planMap[key]) || 0;
                colTotals[kpi.ma] += val;
            });
        });

        // Render Header
        let theadHtml = `
            <tr>
                <th class="w-12 text-center p-3 border font-bold text-slate-800 bg-slate-200 sticky top-0 left-0 z-[60] shadow-md border-b-2 border-slate-300">STT</th>
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[200px] sticky top-0 left-12 z-[60] shadow-md border-b-2 border-slate-300">Đơn vị (Cụm)</th> 
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[120px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">Liên Cụm</th>
        `;

        kpiStructure.forEach(kpi => {
            theadHtml += `<th class="p-3 border font-bold text-slate-800 bg-slate-200 text-right min-w-[140px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">${kpi.tenHienThi} <br> <span class="text-[10px] font-normal text-slate-600 italic">(${kpi.dvt})</span></th>`;
        });
        theadHtml += `</tr>`;
        
        let thead = table.querySelector('thead');
        if(!thead) { thead = document.createElement('thead'); table.appendChild(thead); }
        thead.innerHTML = theadHtml;

        const tbody = document.getElementById('body-kehoach');
        if (!tbody) return;
        
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + kpiStructure.length}" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        // Render Body Input
        tbody.innerHTML = rows.map((row, index) => {
            let rowHtml = `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors group">
                    <td class="p-3 text-center border-r bg-slate-50 font-medium text-slate-500 sticky left-0 z-30 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">${index + 1}</td>
                    <td class="p-3 font-medium text-blue-700 border-r whitespace-nowrap sticky left-12 z-30 bg-white group-hover:bg-slate-50 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title="${row.maCum}">${row.tenCum}</td>
                    <td class="p-3 text-sm text-slate-500 border-r text-xs">${app.getNameLienCum(row.maLienCum)}</td>
            `;

            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const rawVal = planMap[key];
                const displayVal = rawVal !== undefined ? new Intl.NumberFormat('vi-VN').format(rawVal) : '';
                rowHtml += `<td class="p-2 border-r"><input type="text" class="plan-input w-full text-right border border-slate-200 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-semibold text-slate-700 focus:bg-white bg-slate-50/30" placeholder="-" data-cum="${row.maCum}" data-kpi="${kpi.ma}" value="${displayVal}" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"></td>`;
            });
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');

        // Render Footer (Tổng)
        let tfoot = table.querySelector('tfoot');
        if(tfoot) tfoot.remove();
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);

        let tfootHtml = `
            <tr class="bg-yellow-100 font-bold text-slate-800 border-t-2 border-yellow-300 shadow-inner sticky bottom-0 z-50">
                <td class="p-3 text-center sticky left-0 z-[60] bg-yellow-100 border-r border-yellow-200 border-t-2 border-yellow-300">#</td>
                <td class="p-3 text-left sticky left-12 z-[60] bg-yellow-100 border-r border-yellow-200 uppercase tracking-wider text-xs border-t-2 border-yellow-300">Tổng cộng</td>
                <td class="p-3 border-r border-yellow-200 bg-yellow-100"></td> 
        `;
        kpiStructure.forEach(kpi => {
            const totalVal = colTotals[kpi.ma] || 0;
            const displayTotal = totalVal > 0 ? new Intl.NumberFormat('vi-VN').format(totalVal) : '-';
            tfootHtml += `<td class="p-3 text-right border-r border-yellow-200 text-blue-800 text-sm bg-yellow-100">${displayTotal}</td>`;
        });
        tfootHtml += `</tr>`;
        tfoot.innerHTML = tfootHtml;
    },

    // ============================================================
    // 5. USER LOGS & STATS
    // ============================================================

    renderUserLogFilter(listCum, selectedCum = "") {
        const container = document.getElementById('filter-container-user'); 
        if (!container) return;

        let options = `<option value="">-- Chọn Đơn vị (Cụm) --</option>`;
        listCum.forEach(cumCode => {
            const tenCum = app.getNameCum(cumCode) || cumCode;
            const isSelected = cumCode === selectedCum ? 'selected' : '';
            options += `<option value="${cumCode}" ${isSelected}>${tenCum}</option>`;
        });

        container.innerHTML = `
            <div class="flex items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4">
                <div class="flex items-center gap-2">
                    <label class="font-bold text-sm text-slate-700 whitespace-nowrap">Lọc theo Cụm:</label>
                    <select id="user-filter-select" onchange="app.handleUserFilterChange(this.value)" class="border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[250px]">${options}</select>
                </div>
                <div class="h-6 w-px bg-slate-300 mx-2"></div>
                <div class="text-sm text-slate-600 flex items-center gap-1"><i data-lucide="info" class="w-4 h-4 text-blue-500"></i><span>Dữ liệu trích xuất từ lịch sử ghi nhận KPI thực tế</span></div>
            </div>`;
        lucide.createIcons();
    },

    renderClusterStats(statsData) {
        const container = document.getElementById('stats-grid');
        if (!container) return;

        if (!statsData || statsData.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-400 col-span-full">Chưa có dữ liệu thống kê.</p>';
            return;
        }

        statsData.sort((a, b) => b.userCount - a.userCount);
        container.innerHTML = statsData.map(item => `
            <div class="flex flex-col bg-slate-50 border border-slate-200 rounded p-2 hover:shadow-md transition cursor-pointer" 
                 onclick="app.handleUserFilterChange('${item.maCum}'); document.getElementById('user-filter-select').value='${item.maCum}';">
                <span class="text-[10px] uppercase font-bold text-slate-500 truncate" title="${item.tenCum}">${item.tenCum}</span>
                <div class="flex justify-between items-end mt-1">
                    <span class="text-lg font-bold text-blue-700 leading-none">${item.userCount}</span>
                    <span class="text-[10px] text-slate-400">users</span>
                </div>
            </div>
        `).join('');
    },

    renderKPIUserLogs(data) {
        const tbody = document.getElementById('body-user-ghinhan');
        let statDiv = document.getElementById('user-stat-summary');
        
        if (statDiv) {
            statDiv.innerHTML = (data && data.length > 0) 
                ? `<div class="text-sm font-bold text-blue-800 mb-2">➤ Chi tiết: <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-1 border border-blue-200">${data.length} Mã NV</span></div>`
                : '';
        }

        if (!tbody) return;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-12 text-slate-400 italic bg-slate-50/50">
                <div class="flex flex-col items-center gap-2"><i data-lucide="filter" class="w-8 h-8 opacity-50"></i><span>Vui lòng chọn Cụm (hoặc click vào ô thống kê) để xem chi tiết</span></div>
            </td></tr>`;
            lucide.createIcons();
            return;
        }

        tbody.innerHTML = data.map((item, i) => `
            <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                <td class="p-3 text-center text-slate-500 font-medium border-r">${i+1}</td>
                <td class="p-3 font-bold text-blue-700 font-mono text-sm border-r">${item.maNV}</td>
                <td class="p-3 text-sm text-slate-700 border-r">${item.channelStr || '-'}</td>
                <td class="p-3 text-sm text-slate-600 border-r">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-sm text-slate-500 text-xs border-r">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-right"><span class="text-xs font-bold text-slate-400">${item.totalLogs} records</span></td>
            </tr>
        `).join('');
        lucide.createIcons();
    },
  
    // ============================================================
    // 6. DASHBOARD CHÍNH (THẺ & BẢNG INTERACTIVE)
    // ============================================================

    async renderDashboard(filterScope = 'all') {
        const allClusters = await DataService.getClusters();
        const allStores = await DataService.getStores();
        const allBts = await DataService.getBTS();
        const allGdvs = await DataService.getGDVs();
        const allSales = await DataService.getSalesStaff();
        const allB2B = await DataService.getB2BStaff();
        const allIndirect = await DataService.getIndirectChannels(); 

        // 1. Fill Data vào Dropdown
        const select = document.getElementById('dashboard-scope-select');
        if (select && select.options.length === 1) { 
            allClusters.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.maLienCum;
                opt.textContent = c.tenLienCum;
                select.appendChild(opt);
            });
        }

        // 2. Filter dữ liệu
        const filterByScope = (list) => {
            if (filterScope === 'all') return list;
            return list.filter(item => item.maLienCum === filterScope);
        };

        const stores = filterByScope(allStores);
        const bts = filterByScope(allBts);
        const gdvs = filterByScope(allGdvs);
        const sales = filterByScope(allSales);
        const b2b = filterByScope(allB2B);
        const indirect = filterByScope(allIndirect);
        
        // --- LOGIC TÍNH TOÁN VLR/DÂN SỐ ---
        let communes = [];
        if (filterScope === 'all') {
            allClusters.forEach(lc => {
                lc.cums.forEach(c => communes.push(...c.phuongXas));
            });
        } else {
            const selectedLC = allClusters.find(c => c.maLienCum === filterScope);
            if (selectedLC) selectedLC.cums.forEach(c => communes.push(...c.phuongXas));
        }

        const totalVLR = communes.reduce((sum, px) => sum + (Number(px.vlr) || 0), 0);
        const totalPop = communes.reduce((sum, px) => sum + (Number(px.danSo) || 0), 0);
        const totalCommunes = communes.length;
        
        // Count Active/Expiring
        const storesExpiring = stores.filter(s => {
            if(!s.ngayHetHan) return false;
            return this.getDaysRemaining(s.ngayHetHan) < 30; 
        }).length;
        const countActive = (list) => list.filter(i => i.trangThai !== 'Nghỉ việc').length;

        // --- RENDER CARDS ---
        document.getElementById('dashboard-infrastructure').innerHTML = `
            <div onclick="app.showDashboardDetail('store', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">Cửa Hàng</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(stores.length)}</h3></div>
                    <div class="p-2 bg-blue-50 text-blue-600 rounded-lg"><i data-lucide="store" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-sm flex justify-between">
                    <span class="text-slate-500">Sắp hết hạn:</span> 
                    <span class="font-bold ${storesExpiring > 0 ? 'text-red-500' : ''}">${storesExpiring}</span>
                </div>
            </div>

            <div onclick="app.showDashboardDetail('geo', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-yellow-500 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-slate-500 text-sm font-medium uppercase">Địa Lý & Dân Số</p>
                        <h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(totalCommunes)}</h3>
                    </div>
                    <div class="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><i data-lucide="map" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div class="flex justify-between items-center"><span class="text-slate-500">VLR:</span> <span class="font-bold text-blue-700">${this.formatNumber(totalVLR)}</span></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">Dân số:</span> <span class="font-bold text-slate-700">${this.formatNumber(totalPop)}</span></div>
                </div>
            </div>

            <div onclick="app.showDashboardDetail('indirect', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-cyan-500 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">Điểm Bán/Đại Lý</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(indirect.length)}</h3></div>
                    <div class="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><i data-lucide="shopping-bag" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">Kênh gián tiếp</div>
            </div>

            <div onclick="app.showDashboardDetail('bts', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-indigo-500 hover:shadow-md transition-shadow group cursor-pointer">
                <div class="flex justify-between items-center">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">Tổng Trạm BTS</p><h3 class="text-3xl font-bold text-slate-800">${this.formatNumber(bts.length)}</h3></div>
                    <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><i data-lucide="tower-control" class="w-6 h-6"></i></div>
                </div>
                <div class="border-t border-slate-100 pt-3 mt-4">
                    <span class="text-xs text-slate-500">Hạ tầng phát sóng</span>
                </div>
            </div>
        `;

        document.getElementById('dashboard-hr').innerHTML = `
            <div onclick="app.showDashboardDetail('gdv', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 hover:shadow-md transition-shadow group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">Giao Dịch Viên</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(gdvs))}</h3></div>
                    <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><i data-lucide="users" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-sm flex justify-between"><span class="text-slate-500">Tổng số:</span> <b>${gdvs.length}</b></div>
            </div>

            <div onclick="app.showDashboardDetail('sales', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-orange-500 hover:shadow-md transition-shadow group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">NV Bán Hàng</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(sales))}</h3></div>
                    <div class="p-2 bg-orange-50 text-orange-600 rounded-lg"><i data-lucide="briefcase" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-sm flex justify-between"><span class="text-slate-500">Nghỉ việc:</span> <b class="text-red-500">${sales.length - countActive(sales)}</b></div>
            </div>

            <div onclick="app.showDashboardDetail('b2b', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-500 hover:shadow-md transition-shadow group cursor-pointer">
                <div class="flex justify-between items-start">
                    <div><p class="text-slate-500 text-sm font-medium uppercase">Kênh KHDN</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(b2b))}</h3></div>
                    <div class="p-2 bg-purple-50 text-purple-600 rounded-lg"><i data-lucide="building-2" class="w-6 h-6"></i></div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">Phụ trách khách hàng doanh nghiệp</div>
            </div>
        `;

        // --- BẢNG CHI TIẾT ---
        let displayClusters = allClusters;
        if (filterScope !== 'all') {
            const selectedLC = allClusters.find(c => c.maLienCum === filterScope);
            if (selectedLC) {
                displayClusters = selectedLC.cums.map(c => ({
                    isCum: true, maCode: c.maCum, tenHienThi: c.tenCum, parentCode: selectedLC.maLienCum, ...c
                }));
            }
        } else {
            displayClusters = displayClusters.map(lc => ({
                isCum: false, maCode: lc.maLienCum, tenHienThi: lc.tenLienCum, ...lc
            }));
        }

        const tbody = document.getElementById('dashboard-breakdown-body');
        if (tbody) {
            tbody.innerHTML = displayClusters.map((item, idx) => {
                const filterKey = item.isCum ? 'maCum' : 'maLienCum';
                const code = item.maCode;

                const cStore = allStores.filter(i => i[filterKey] === code).length;
                const cGdv = allGdvs.filter(i => i[filterKey] === code).length;
                const cSale = allSales.filter(i => i[filterKey] === code).length;
                const cAgency = allIndirect.filter(i => i[filterKey] === code).length;
                const cBts = allBts.filter(i => i[filterKey] === code).length;
                const countXa = item.isCum ? item.phuongXas.length : item.cums.reduce((sum, c) => sum + c.phuongXas.length, 0);

                const makeLink = (count, type, cssClass) => {
                    if(count === 0) return `<span class="text-slate-300">-</span>`;
                    return `<button onclick="app.showDashboardDetail('${type}', '${code}')" 
                            class="${cssClass} hover:underline hover:scale-110 transition-transform cursor-pointer px-2 py-0.5 rounded shadow-sm text-xs border border-transparent hover:border-slate-300">
                            ${count}
                            </button>`;
                };

                return `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.tenHienThi}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${code}</div>
                    </td>
                    <td class="p-3 text-center font-medium">${makeLink(countXa, 'commune', 'text-slate-700 font-bold bg-slate-100')} <span class="text-[10px] text-slate-400 block">Xã/Phường</span></td>
                    <td class="p-3 text-center">${makeLink(cStore, 'store', 'text-blue-700 font-bold bg-blue-50')}</td>
                    <td class="p-3 text-center">${makeLink(cGdv, 'gdv', 'text-emerald-700 font-bold bg-emerald-50')}</td>
                    <td class="p-3 text-center">${makeLink(cSale, 'sales', 'text-orange-700 font-bold bg-orange-50')}</td>
                    <td class="p-3 text-center">${makeLink(cAgency, 'indirect', 'text-cyan-700 font-bold bg-cyan-50')}</td>
                    <td class="p-3 text-center">${makeLink(cBts, 'bts', 'text-indigo-700 font-bold bg-indigo-50')}</td>
                </tr>`;
            }).join('');
        }
        lucide.createIcons();
    },

    /**
     * Vẽ toàn bộ báo cáo Biểu đồ & Số liệu KPI
     */
    renderKPIReport(kpiData, filters, mapLienCum, mapCum) {
        ['chartSubDaily', 'chartSubComparative', 'chartRevenueDaily', 'chartRevenueComparative'].forEach(id => {
            if (app.chartInstances[id]) {
                app.chartInstances[id].destroy();
                delete app.chartInstances[id];
            }
        });

        // Tự động tính % hoàn thành
        const calculatePercent = (actual, plan) => plan > 0 ? Math.min(100, Math.round((actual / plan) * 100)) : (actual > 0 ? 100 : 0);
        
        // Cập nhật Widget số liệu
        const updateWidget = (id, actual, plan) => {
            const percent = calculatePercent(actual, plan);
            const percentEl = document.getElementById(`${id}-percent`);
            document.getElementById(`${id}-actual`).textContent = this.formatNumber(actual);
            document.getElementById(`${id}-plan`).textContent = this.formatNumber(plan);
            if (percentEl) percentEl.textContent = `${percent}%`;
            return percent;
        };

        // Tính tổng
        const sumWithPlanFallback = (data, actualKey, planKey) => {
            const totalActual = data.reduce((sum, item) => sum + (Number(item[actualKey] || 0)), 0);
            const totalPlan = data.reduce((sum, item) => sum + (Number(item[planKey] || item[actualKey] || 0)), 0); // Nếu ko có plan thì lấy actual làm mốc 100%
            return { totalActual, totalPlan };
        };

        const { totalActual: totalActualTB, totalPlan: totalPlanTB } = sumWithPlanFallback(kpiData, 'KPI_TB_MOI_TH', 'KPI_TB_MOI_KH');
        const { totalActual: totalActual4G, totalPlan: totalPlan4G } = sumWithPlanFallback(kpiData, 'KPI_4G_TH', 'KPI_4G_KH');
        const { totalActual: totalActualDT, totalPlan: totalPlanDT } = sumWithPlanFallback(kpiData, 'KPI_DT_TH', 'KPI_DT_KH');
        
        // Update UI Widgets
        updateWidget('kpi-tb-moi', totalActualTB, totalPlanTB);
        const barTB = document.querySelector('#subscriber-widgets div:nth-child(2) .progress-bar');
        if(barTB) barTB.style.width = `${calculatePercent(totalActualTB, totalPlanTB)}%`;

        updateWidget('kpi-4g', totalActual4G, totalPlan4G);
        const bar4G = document.querySelector('#subscriber-widgets div:nth-child(4) .progress-bar');
        if(bar4G) bar4G.style.width = `${calculatePercent(totalActual4G, totalPlan4G)}%`;

        updateWidget('kpi-dt', totalActualDT, totalPlanDT);
        const barDT = document.querySelector('#revenue-widgets div:nth-child(2) .progress-bar');
        if(barDT) barDT.style.width = `${calculatePercent(totalActualDT, totalPlanDT)}%`;

        // Vẽ biểu đồ Line Chart (Theo ngày)
        const dailyData = kpiData.reduce((acc, item) => {
            const date = item.DATE; 
            if (!date) return acc;
            acc[date] = acc[date] || { date, tbActual: 0, tbPlan: 0, dtActual: 0, dtPlan: 0 };
            acc[date].tbActual += (Number(item.KPI_TB_MOI_TH) || 0);
            acc[date].tbPlan += (Number(item.KPI_TB_MOI_KH || item.KPI_TB_MOI_TH || 0)); 
            acc[date].dtActual += (Number(item.KPI_DT_TH) || 0);
            acc[date].dtPlan += (Number(item.KPI_DT_KH || item.KPI_DT_TH || 0)); 
            return acc;
        }, {});

        const sortedDates = Object.keys(dailyData).sort();
        const dailyLabels = sortedDates.map(d => d.substring(8, 10) + '/' + d.substring(5, 7)); // DD/MM
        
        // 1. Chart TB Daily
        const ctxSubDaily = document.getElementById('chartSubDaily');
        if (ctxSubDaily) {
            app.chartInstances['chartSubDaily'] = new Chart(ctxSubDaily.getContext('2d'), {
                type: 'line',
                data: {
                    labels: dailyLabels,
                    datasets: [
                        { label: 'Thực hiện', data: sortedDates.map(d => dailyData[d].tbActual), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3, pointRadius: 2 },
                        { label: 'Kế hoạch', data: sortedDates.map(d => dailyData[d].tbPlan), borderColor: '#cbd5e1', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3, pointRadius: 0 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
            });
        }

        // 2. Chart DT Daily
        const ctxRevDaily = document.getElementById('chartRevenueDaily');
        if (ctxRevDaily) {
            app.chartInstances['chartRevenueDaily'] = new Chart(ctxRevDaily.getContext('2d'), {
                type: 'line',
                data: {
                    labels: dailyLabels,
                    datasets: [
                        { label: 'Thực hiện', data: sortedDates.map(d => dailyData[d].dtActual), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3, pointRadius: 2 },
                        { label: 'Kế hoạch', data: sortedDates.map(d => dailyData[d].dtPlan), borderColor: '#cbd5e1', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3, pointRadius: 0 }
                    ]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    scales: { y: { beginAtZero: true, ticks: { callback: (v) => v/1000000 + ' Tr' } }, x: { grid: { display: false } } },
                    plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${this.formatNumber(c.parsed.y/1000000)} Tr` } } }
                }
            });
        }
    },

    // ============================================================
    // 7. MODAL CHI TIẾT (DRILL-DOWN)
    // ============================================================

    renderDetailModalContent(type, data) {
        const thead = document.getElementById('modal-detail-thead');
        const tbody = document.getElementById('modal-detail-tbody');
        if(!thead || !tbody) return;

        let headerHtml = '';
        let bodyHtml = '';

        if (type === 'commune' || type === 'geo') {
            headerHtml = `
                <tr>
                    <th class="p-3 text-left border-b font-bold text-slate-700 w-12">STT</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700">Tên Phường/Xã</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700">VLR (Thuê bao)</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700">Dân số</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700">Thông tin Lãnh đạo</th>
                </tr>`;
            
            let stt = 1;
            data.forEach(item => {
                 let leaderHtml = '<span class="text-slate-400 italic text-xs">Chưa cập nhật</span>';
                 if (item.lanhDao && item.lanhDao.length > 0) {
                     leaderHtml = item.lanhDao.map(ld => `
                        <div class="mb-1 pb-1 border-b border-dashed border-slate-100 last:border-0 flex items-center justify-between gap-4">
                            <div><span class="font-bold text-slate-700 text-sm">${ld.ten}</span> <span class="text-xs text-slate-500"> - ${ld.chucVu}</span></div>
                            ${ld.sdt ? `<a href="tel:${ld.sdt}" class="text-xs font-mono text-blue-600 hover:underline flex items-center"><i data-lucide="phone" class="w-3 h-3 mr-1"></i>${ld.sdt}</a>` : ''}
                        </div>
                     `).join('');
                 }
                 bodyHtml += `
                    <tr class="border-b hover:bg-slate-50">
                        <td class="p-3 text-center text-slate-500">${stt++}</td>
                        <td class="p-3 font-bold text-blue-700">${item.ten}</td>
                        <td class="p-3 text-right font-mono">${this.formatNumber(item.vlr)}</td>
                        <td class="p-3 text-right font-mono">${this.formatNumber(item.danSo)}</td>
                        <td class="p-3 min-w-[250px]">${leaderHtml}</td>
                    </tr>`;
            });
        } else if (type === 'store') {
            headerHtml = `<tr><th class="p-3 border-b text-center">STT</th><th class="p-3 border-b">Mã CH</th><th class="p-3 border-b">Tên Cửa Hàng</th><th class="p-3 border-b">Địa chỉ</th><th class="p-3 border-b">Diện tích</th></tr>`;
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50"><td class="p-3 text-center text-slate-500">${idx+1}</td><td class="p-3 font-bold text-blue-600">${i.id}</td><td class="p-3 font-bold">${i.ten}</td><td class="p-3 text-sm">${i.diaChi}</td><td class="p-3 text-sm">${i.dienTich || '-'}</td></tr>
            `).join('');
        } else if (type === 'gdv' || type === 'sales' || type === 'b2b') {
            headerHtml = `<tr><th class="p-3 border-b text-center">STT</th><th class="p-3 border-b">Mã NV</th><th class="p-3 border-b">Họ Tên</th><th class="p-3 border-b">SĐT</th><th class="p-3 border-b text-center">Trạng thái</th></tr>`;
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50"><td class="p-3 text-center text-slate-500">${idx+1}</td><td class="p-3 font-bold text-blue-600">${i.ma}</td><td class="p-3 font-bold">${i.ten}</td><td class="p-3 font-mono text-sm">${i.sdt}</td><td class="p-3 text-center">${this.getStatusBadge(i.trangThai)}</td></tr>
            `).join('');
        } else if (type === 'bts') {
            headerHtml = `<tr><th class="p-3 border-b text-center">STT</th><th class="p-3 border-b">Mã Trạm</th><th class="p-3 border-b">Tên Trạm</th><th class="p-3 border-b">Địa chỉ</th><th class="p-3 border-b">Ghi chú</th></tr>`;
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50"><td class="p-3 text-center text-slate-500">${idx+1}</td><td class="p-3 font-bold text-blue-600">${i.maTram}</td><td class="p-3 font-bold">${i.tenTram}</td><td class="p-3 text-sm">${i.diaChi}</td><td class="p-3 text-sm italic">${i.ghiChu}</td></tr>
            `).join('');
        } else if (type === 'indirect') {
             headerHtml = `<tr><th class="p-3 border-b text-center">STT</th><th class="p-3 border-b">Mã ĐL</th><th class="p-3 border-b">Tên Đại Lý</th><th class="p-3 border-b">Loại</th><th class="p-3 border-b">Địa chỉ</th></tr>`;
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50"><td class="p-3 text-center text-slate-500">${idx+1}</td><td class="p-3 font-bold text-blue-600">${i.maDL}</td><td class="p-3 font-bold">${i.ten}</td><td class="p-3 text-sm">${i.loai}</td><td class="p-3 text-sm">${i.diaChi}</td></tr>
            `).join('');
        }

        thead.innerHTML = headerHtml;
        tbody.innerHTML = bodyHtml;
        lucide.createIcons();
    },

    renderDashboardCharts(kpiData, instances) {
        if (instances.revenueChart) instances.revenueChart.destroy();
        if (instances.subChart) instances.subChart.destroy();

        const labels = [...new Set(kpiData.map(d => d.maLienCum || d.lienCum))];
        const displayLabels = labels.map(code => app.getNameLienCum(code));
        
        const dataPlan = labels.map(l => 600); // Demo data
        const dataActual = labels.map(code => kpiData.filter(d => (d.maLienCum || d.lienCum) === code).reduce((sum, item) => sum + (Number(item.KPI_DT) || 0), 0));

        const ctxRev = document.getElementById('chartRevenue');
        if (ctxRev) {
            instances.revenueChart = new Chart(ctxRev.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: displayLabels,
                    datasets: [
                        { label: 'Kế hoạch', data: dataPlan, backgroundColor: '#cbd5e1' },
                        { label: 'Thực hiện', data: dataActual, backgroundColor: '#2563eb' }
                    ]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true } }, maintainAspectRatio: false }
            });
        }
    }
};
