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

    // HÀM RENDER CHÍNH CHO TAB SỐ LIỆU KINH DOANH
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

    // ============================================================
    // 6. DASHBOARD CHÍNH (NÂNG CẤP: LỌC CỤM & LIÊN CỤM)
    // ============================================================

    async renderDashboard(filterScope = 'all') {
        // Lấy dữ liệu
        const allClusters = await DataService.getClusters();
        const allStores = await DataService.getStores();
        const allBts = await DataService.getBTS();
        const allGdvs = await DataService.getGDVs();
        const allSales = await DataService.getSalesStaff();
        const allB2B = await DataService.getB2BStaff();
        const allIndirect = await DataService.getIndirectChannels(); 

        // --------------------------------------------------------
        // 1. NÂNG CẤP DROPDOWN (Chia Group Cụm / Liên Cụm)
        // --------------------------------------------------------
        const select = document.getElementById('dashboard-scope-select');
        // Chỉ khởi tạo lại nếu chưa có dữ liệu hoặc đang ở trạng thái mặc định sơ sài
        if (select && select.querySelectorAll('optgroup').length === 0) { 
            select.innerHTML = '<option value="all">Toàn Công Ty</option>';
            
            // Group 1: LIÊN CỤM
            const lcGroup = document.createElement('optgroup');
            lcGroup.label = "--- LIÊN CỤM ---";
            allClusters.forEach(c => {
                lcGroup.innerHTML += `<option value="${c.maLienCum}">${c.tenLienCum}</option>`;
            });
            select.appendChild(lcGroup);

            // Group 2: CỤM (Flatten dữ liệu từ cây Clusters)
            const cGroup = document.createElement('optgroup');
            cGroup.label = "--- CỤM ---";
            allClusters.forEach(lc => {
                lc.cums.forEach(c => {
                    cGroup.innerHTML += `<option value="${c.maCum}">${c.tenCum} (${lc.tenLienCum})</option>`;
                });
            });
            select.appendChild(cGroup);

            // Set lại giá trị đang chọn (để không bị reset về 'all' khi reload UI)
            select.value = filterScope; 
        }

        // --------------------------------------------------------
        // 2. LOGIC LỌC DỮ LIỆU (Hỗ trợ cả Liên Cụm & Cụm)
        // --------------------------------------------------------
        const filterByScope = (list) => {
            if (filterScope === 'all') return list;
            // Kiểm tra item thuộc Liên Cụm OR thuộc Cụm được chọn
            return list.filter(item => item.maLienCum === filterScope || item.maCum === filterScope);
        };

        const stores = filterByScope(allStores);
        const bts = filterByScope(allBts);
        const gdvs = filterByScope(allGdvs);
        const sales = filterByScope(allSales);
        const b2b = filterByScope(allB2B);
        const indirect = filterByScope(allIndirect);
        
        // --- Tính toán VLR/Dân số ---
        let communes = [];
        if (filterScope === 'all') {
            allClusters.forEach(lc => lc.cums.forEach(c => communes.push(...c.phuongXas)));
        } else {
            // Tìm trong Liên Cụm
            const foundLC = allClusters.find(c => c.maLienCum === filterScope);
            if (foundLC) {
                foundLC.cums.forEach(c => communes.push(...c.phuongXas));
            } else {
                // Nếu không phải Liên Cụm, tìm trong Cụm
                allClusters.forEach(lc => {
                    const foundCum = lc.cums.find(c => c.maCum === filterScope);
                    if (foundCum) communes.push(...foundCum.phuongXas);
                });
            }
        }

        const totalVLR = communes.reduce((sum, px) => sum + (Number(px.vlr) || 0), 0);
        const totalPop = communes.reduce((sum, px) => sum + (Number(px.danSo) || 0), 0);
        const totalCommunes = communes.length;
        
        // Count Helpers
        const storesExpiring = stores.filter(s => s.ngayHetHan && this.getDaysRemaining(s.ngayHetHan) < 30).length;
        const countActive = (list) => list.filter(i => i.trangThai !== 'Nghỉ việc').length;

        // --------------------------------------------------------
        // 3. VẼ LẠI CÁC THẺ (CARDS)
        // --------------------------------------------------------
        // ... (Giữ nguyên HTML phần Cards như cũ, chỉ thay đổi biến số liệu đã lọc ở trên)
        // Để tiết kiệm không gian, tôi dùng lại cấu trúc cũ nhưng inject biến mới:
        
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

        // --------------------------------------------------------
        // 4. BẢNG CHI TIẾT PHÂN BỔ (Tự động chuyển view)
        // --------------------------------------------------------
        let displayItems = [];
        let viewMode = 'liencum'; // Mặc định: liencum, cum, xaphuong

        if (filterScope === 'all') {
            // View All -> Hiển thị danh sách LIÊN CỤM
            viewMode = 'liencum';
            displayItems = allClusters.map(lc => ({
                code: lc.maLienCum,
                name: lc.tenLienCum,
                subCount: lc.cums.length, // Số cụm
                type: 'Liên Cụm',
                filterKey: 'maLienCum' // Key dùng để lọc data con
            }));
        } else {
            // Kiểm tra xem Scope là Liên Cụm hay Cụm
            const foundLC = allClusters.find(c => c.maLienCum === filterScope);
            
            if (foundLC) {
                // View 1 Liên Cụm -> Hiển thị danh sách CỤM trực thuộc
                viewMode = 'cum';
                displayItems = foundLC.cums.map(c => ({
                    code: c.maCum,
                    name: c.tenCum,
                    subCount: c.phuongXas.length, // Số Xã
                    type: 'Cụm',
                    filterKey: 'maCum'
                }));
            } else {
                // View 1 Cụm -> Hiển thị chính CỤM đó (hoặc list Xã nếu muốn, ở đây hiển thị 1 dòng tổng hợp)
                viewMode = 'cum_detail';
                // Tìm Cụm trong toàn bộ data
                let foundCum = null;
                allClusters.forEach(lc => {
                    const c = lc.cums.find(x => x.maCum === filterScope);
                    if(c) foundCum = c;
                });

                if(foundCum) {
                    displayItems = [{
                        code: foundCum.maCum,
                        name: foundCum.tenCum,
                        subCount: foundCum.phuongXas.length,
                        type: 'Cụm',
                        filterKey: 'maCum'
                    }];
                }
            }
        }

        // Update Table Header dựa trên View Mode
        const tHeadLabel = viewMode === 'liencum' ? 'Liên Cụm' : 'Cụm / Đơn vị';
        const tSubLabel = viewMode === 'liencum' ? 'Số Cụm' : 'Số Xã';
        
        // Cập nhật tiêu đề bảng (Thao tác DOM trực tiếp vào thẻ thead của bảng breakdown nếu cần, 
        // ở đây ta giả định cấu trúc HTML header cố định, chỉ render body, 
        // nhưng để UX tốt, ta nên update Text Header cột 2 và 3)
        const tableHeaderRows = document.querySelectorAll('#view-dashboard table thead th');
        if(tableHeaderRows.length > 2) {
            tableHeaderRows[1].textContent = `Đơn vị (${tHeadLabel})`;
            tableHeaderRows[2].textContent = tSubLabel;
        }

        const tbody = document.getElementById('dashboard-breakdown-body');
        if (tbody) {
            tbody.innerHTML = displayItems.map((item, idx) => {
                const code = item.code;
                const filterKey = item.filterKey;

                // Đếm số liệu con tương ứng với Code này
                const cStore = allStores.filter(i => i[filterKey] === code).length;
                const cGdv = allGdvs.filter(i => i[filterKey] === code).length;
                const cSale = allSales.filter(i => i[filterKey] === code).length;
                const cAgency = allIndirect.filter(i => i[filterKey] === code).length;
                const cBts = allBts.filter(i => i[filterKey] === code).length;
                
                // Helper tạo nút bấm xem chi tiết
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
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${code}</div>
                    </td>
                    <td class="p-3 text-center font-medium">
                        <span class="text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded text-xs">${item.subCount}</span>
                    </td>
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
    
    // ============================================================
    // CẬP NHẬT HÀM VẼ BIỂU ĐỒ (SỬA LỖI 2 - BƯỚC 2)
    // ============================================================
    renderKPIReport(data, filterInfo) {
        // Destroy old charts
        ['chartSubDaily', 'chartSubChannel', 'chartSubCluster', 'chartRevDaily', 'chartRevChannel', 'chartRevCluster'].forEach(id => {
            if (app.chartInstances[id]) {
                app.chartInstances[id].destroy();
                delete app.chartInstances[id];
            }
        });

        const updateWidget = (prefix, actual, plan) => {
            const elActual = document.getElementById(`stat-${prefix}-actual`);
            const elPlan = document.getElementById(`stat-${prefix}-plan`);
            const elPercent = document.getElementById(`stat-${prefix}-percent`);
            const elProg = document.getElementById(`prog-${prefix}`);

            if (elActual) elActual.textContent = this.formatNumber(actual);
            if (elPlan) elPlan.textContent = this.formatNumber(plan);
            
            const percent = plan > 0 ? Math.round((actual / plan) * 100) : (actual > 0 ? 100 : 0);
            if (elPercent) elPercent.textContent = `${percent}%`;
            if (elProg) elProg.style.width = `${Math.min(percent, 100)}%`;
        };

        updateWidget('sub', data.sub.actual, data.sub.plan);
        updateWidget('rev', data.rev.actual, data.rev.plan);

        // Helper: Line Chart
        const createLineChart = (canvasId, dailyData, color) => {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            const dates = Object.keys(dailyData).sort();
            const values = dates.map(d => dailyData[d]);
            const labels = dates.map(d => d.split('-').slice(1).join('/')); 

            app.chartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Thực hiện', data: values, borderColor: color, backgroundColor: color + '20', fill: true, tension: 0.3, pointRadius: 3 }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        };

        // Helper: Bar Chart (Channel) - CÓ SỰ KIỆN CLICK
        const createChannelChart = (canvasId, channelData, color, type) => {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            const labels = Object.keys(channelData);
            const values = Object.values(channelData);

            app.chartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Số lượng', data: values, backgroundColor: color, borderRadius: 4 }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    indexAxis: 'y',
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const channelName = labels[index];
                            // GỌI HÀM XỬ LÝ CLICK TRONG MAIN.JS
                            app.handleChannelChartClick(type, channelName);
                        }
                    },
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                }
            });
        };

        // Helper: Cluster Chart
        const createClusterChart = (canvasId, clusterData, colorActual) => {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            const clusters = Object.keys(clusterData);
            const actuals = clusters.map(c => clusterData[c].actual);
            const plans = clusters.map(c => clusterData[c].plan);
            const clusterNames = clusters.map(c => app.getNameLienCum(c) || app.getNameCum(c) || c);

            app.chartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: clusterNames,
                    datasets: [{ label: 'Thực hiện', data: actuals, backgroundColor: colorActual }, { label: 'Kế hoạch', data: plans, backgroundColor: '#cbd5e1' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        };

        createLineChart('chartSubDaily', data.sub.daily, '#10b981'); 
        // Truyền thêm tham số 'sub' để biết đang click vào biểu đồ thuê bao
        createChannelChart('chartSubChannel', data.sub.channel, '#34d399', 'sub');
        createClusterChart('chartSubCluster', data.sub.cluster, '#059669');

        createLineChart('chartRevDaily', data.rev.daily, '#2563eb'); 
        // Truyền thêm tham số 'rev' để biết đang click vào biểu đồ doanh thu
        createChannelChart('chartRevChannel', data.rev.channel, '#60a5fa', 'rev');
        createClusterChart('chartRevCluster', data.rev.cluster, '#1d4ed8');
    },

 
    // ============================================================
    // 7. MODAL CHI TIẾT (DRILL-DOWN) - PHIÊN BẢN CHUẨN (MERGED)
    // ============================================================

    renderDetailModalContent(type, data, meta = {}) {
        const thead = document.getElementById('modal-detail-thead');
        const tbody = document.getElementById('modal-detail-tbody');
        if(!thead || !tbody) return;

        // --- 1. TẠO THANH CÔNG CỤ CHUYỂN ĐỔI (TOGGLE) ---
        // Chỉ hiện khi type là báo cáo KPI
        let toggleHtml = '';
        if (type === 'kpi-breakdown' || type === 'kpi-channel-detail') {
            const isCum = meta.viewLevel === 'cum'; // Mặc định là 'cum' nếu không truyền
            
            const btnClassBase = "px-3 py-1 text-xs font-bold rounded border transition-colors focus:outline-none";
            const btnActive = "bg-blue-600 text-white border-blue-600 shadow-sm";
            const btnInactive = "bg-white text-slate-600 border-slate-300 hover:bg-slate-50";

            // Logic gọi hàm khi bấm nút
            // Nếu là breakdown (Thực hiện/Kế hoạch)
            const fnCallCum = type === 'kpi-breakdown' 
                ? `app.showKPIBreakdown('${meta.type}', 'cum')` 
                : `app.handleChannelChartClick('${meta.type}', '${meta.channelName}', 'cum')`;
                
            const fnCallLC = type === 'kpi-breakdown' 
                ? `app.showKPIBreakdown('${meta.type}', 'liencum')` 
                : `app.handleChannelChartClick('${meta.type}', '${meta.channelName}', 'liencum')`;

            toggleHtml = `
                <tr class="bg-slate-50 border-b">
                    <td colspan="5" class="p-3">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="${fnCallCum}" class="${btnClassBase} ${isCum ? btnActive : btnInactive}">Xem theo Cụm</button>
                            <button onclick="${fnCallLC}" class="${btnClassBase} ${!isCum ? btnActive : btnInactive}">Xem theo Liên Cụm</button>
                        </div>
                    </td>
                </tr>
            `;
        }

        let headerHtml = '';
        let bodyHtml = '';

        // --------------------------------------------------------
        // CASE 1: KPI BREAKDOWN (Số liệu Chi tiết Thực hiện vs Kế hoạch)
        // --------------------------------------------------------
        if (type === 'kpi-breakdown') {
            headerHtml = `
                ${toggleHtml}
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100">Đơn vị (${meta.viewLevel === 'liencum' ? 'Liên Cụm' : 'Cụm'})</th>
                    <th class="p-3 border-b text-right bg-slate-100">Thực hiện</th>
                    <th class="p-3 border-b text-right bg-slate-100">Kế hoạch</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32">% HT</th>
                </tr>`;
            
            bodyHtml = data.map((item, idx) => {
                let colorClass = item.percent >= 100 ? 'bg-green-500' : (item.percent >= 80 ? 'bg-blue-500' : 'bg-red-500');
                let textClass = item.percent >= 100 ? 'text-green-600' : (item.percent >= 80 ? 'text-blue-600' : 'text-red-600');
                
                return `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${item.code}</div>
                    </td>
                    <td class="p-3 text-right font-bold text-slate-800">${this.formatNumber(item.actual)}</td>
                    <td class="p-3 text-right text-slate-500">${this.formatNumber(item.plan)}</td>
                    <td class="p-3 align-middle">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold ${textClass} w-8 text-right">${item.percent}%</span>
                            <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div class="h-full ${colorClass}" style="width: ${Math.min(item.percent, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        } 
        
        // --------------------------------------------------------
        // CASE 2: KPI CHANNEL DETAIL (Chi tiết theo Kênh)
        // --------------------------------------------------------
        else if (type === 'kpi-channel-detail') {
            headerHtml = `
                ${toggleHtml}
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100">Đơn vị (${meta.viewLevel === 'liencum' ? 'Liên Cụm' : 'Cụm'})</th>
                    <th class="p-3 border-b text-right bg-slate-100">Sản lượng Kênh</th>
                    <th class="p-3 border-b text-right bg-slate-100">Tổng Đơn vị</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32">Tỷ trọng</th>
                </tr>`;
            
            bodyHtml = data.map((item, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${item.code}</div>
                    </td>
                    <td class="p-3 text-right font-bold text-blue-700">${this.formatNumber(item.value)}</td>
                    <td class="p-3 text-right text-slate-500">${this.formatNumber(item.total)}</td>
                    <td class="p-3 align-middle">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-600 w-10 text-right">${item.percent}%</span>
                            <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div class="h-full bg-blue-500" style="width: ${Math.min(item.percent, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>`).join('');
        }

        // --------------------------------------------------------
        // CASE 3: PHƯỜNG XÃ (Địa lý / Dân số)
        // --------------------------------------------------------
        else if (type === 'commune' || type === 'geo') {
             headerHtml = `
                <tr>
                    <th class="p-3 text-left border-b font-bold text-slate-700 w-12 bg-slate-100">STT</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Tên Phường/Xã</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Thuộc Đơn vị</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700 bg-slate-100">VLR (Thuê bao)</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700 bg-slate-100">Dân số</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Thông tin Lãnh đạo</th>
                </tr>`;

             bodyHtml = data.map((item, idx) => {
                let leadersHtml = (item.lanhDao || []).map(ld => `
                    <div class="text-[10px] mb-1 px-1.5 py-0.5 rounded border border-slate-200 w-fit bg-slate-50">
                        <span class="font-bold text-slate-700">${ld.chucVu}:</span> ${ld.ten} <span class="text-slate-400 italic">(${ld.sdt})</span>
                    </div>`).join('') || '<span class="text-xs text-slate-300 italic">Chưa cập nhật</span>';

                return `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx+1}</td>
                    <td class="p-3 font-bold text-blue-700">${item.ten}</td>
                    <td class="p-3">
                        <div class="text-xs font-bold text-slate-600">${item.tenCum || ''}</div>
                        <div class="text-[10px] text-slate-400">${item.tenLienCum || ''}</div>
                    </td>
                    <td class="p-3 text-right font-mono text-slate-700">${this.formatNumber(item.vlr)}</td>
                    <td class="p-3 text-right font-mono text-slate-500">${this.formatNumber(item.danSo)}</td>
                    <td class="p-3">${leadersHtml}</td>
                </tr>`;
             }).join('');
        }

        // --------------------------------------------------------
        // CASE 4: CỬA HÀNG
        // --------------------------------------------------------
        else if (type === 'store') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100">STT</th>
                    <th class="p-3 border-b bg-slate-100">Mã CH</th>
                    <th class="p-3 border-b bg-slate-100">Tên Cửa Hàng</th>
                    <th class="p-3 border-b bg-slate-100">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100">Địa chỉ</th>
                    <th class="p-3 border-b bg-slate-100">Diện tích</th>
                </tr>`;
            
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx+1}</td>
                    <td class="p-3 font-bold text-blue-600 font-mono">${i.id}</td>
                    <td class="p-3 font-bold text-slate-700">${i.ten}</td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-sm">${i.diaChi}</td>
                    <td class="p-3 text-sm font-bold text-slate-600">${i.dienTich || '-'}</td>
                </tr>`).join('');
        }

        // --------------------------------------------------------
        // CASE 5: NHÂN SỰ (GDV, SALES, B2B)
        // --------------------------------------------------------
        else if (type === 'gdv' || type === 'sales' || type === 'b2b') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100">STT</th>
                    <th class="p-3 border-b bg-slate-100">Mã NV</th>
                    <th class="p-3 border-b bg-slate-100">Họ Tên</th>
                    <th class="p-3 border-b bg-slate-100">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 text-center">Vùng</th>
                    <th class="p-3 border-b bg-slate-100">Số ĐT</th>
                    <th class="p-3 border-b bg-slate-100 text-center">Trạng thái</th>
                </tr>`;
            
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition ${i.trangThai==='Nghỉ việc'?'opacity-60 bg-slate-50':''}">
                    <td class="p-3 text-center text-slate-500">${idx+1}</td>
                    <td class="p-3 font-bold text-slate-600 font-mono">${i.ma}</td>
                    <td class="p-3 font-medium text-slate-800">${i.ten}</td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-center"><span class="badge-region">${i.vung||'-'}</span></td>
                    <td class="p-3 text-sm font-mono">${i.sdt||''}</td>
                    <td class="p-3 text-center">${this.getStatusBadge(i.trangThai, i.ngayNghi)}</td>
                </tr>`).join('');
        }

        // --------------------------------------------------------
        // CASE 6: TRẠM BTS
        // --------------------------------------------------------
        else if (type === 'bts') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100">STT</th>
                    <th class="p-3 border-b bg-slate-100">Mã Trạm</th>
                    <th class="p-3 border-b bg-slate-100">Tên Trạm</th>
                    <th class="p-3 border-b bg-slate-100">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100">Địa chỉ</th>
                    <th class="p-3 border-b bg-slate-100">Ghi chú</th>
                </tr>`;
            
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx+1}</td>
                    <td class="p-3 font-bold text-slate-700 font-mono">${i.maTram}</td>
                    <td class="p-3 font-medium text-blue-700">${i.tenTram}</td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-xs text-slate-600 max-w-[200px] truncate" title="${i.diaChi}">${i.diaChi}</td>
                    <td class="p-3 text-xs italic text-slate-500">${i.ghiChu||''}</td>
                </tr>`).join('');
        }

        // --------------------------------------------------------
        // CASE 7: KÊNH GIÁN TIẾP
        // --------------------------------------------------------
        else if (type === 'indirect') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100">STT</th>
                    <th class="p-3 border-b bg-slate-100">Mã ĐL/ĐB</th>
                    <th class="p-3 border-b bg-slate-100">Tên Điểm bán</th>
                    <th class="p-3 border-b bg-slate-100">Loại</th>
                    <th class="p-3 border-b bg-slate-100">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100">NV Phụ trách</th>
                </tr>`;
            
            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx+1}</td>
                    <td class="p-3 font-bold text-blue-600 font-mono">${i.maDL}</td>
                    <td class="p-3 font-medium text-slate-700">${i.ten}</td>
                    <td class="p-3"><span class="text-xs border px-1.5 py-0.5 rounded bg-slate-50">${i.loai}</span></td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-xs font-mono text-slate-500">${i.maNV||''}</td>
                </tr>`).join('');
        }

        thead.innerHTML = headerHtml;
        tbody.innerHTML = bodyHtml;
        lucide.createIcons();
    },
    

    renderDashboardCharts(kpiData, instances) {
        // ... (Giữ nguyên hàm này)
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
