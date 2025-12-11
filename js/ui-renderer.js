const UIRenderer = {
    // --- 1. CÁC HÀM HELPER DÙNG CHUNG ---
    
    // Format số liệu (Dùng chung cho toàn hệ thống: 1.000.000)
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
                <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
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
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">VLR:</span> <span class="font-mono font-bold text-blue-600">${this.formatNumber(px.vlr)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Dân:</span> <span class="font-mono text-slate-600">${this.formatNumber(px.danSo)}</span></div>
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

    // --- 3. KÊNH TRỰC TIẾP ---

    // Trong file ui-renderer.js

    renderStoresTable(data) {
        const tbody = document.getElementById('store-list-body');
        if (!tbody) return;
        tbody.innerHTML = data.map((item, idx) => {
            
            // LOGIC CẢNH BÁO HẾT HẠN (GIỮ NGUYÊN)
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

            // XỬ LÝ HIỂN THỊ KÍCH THƯỚC
            // Giả sử dữ liệu trả về có các trường: dai, rong, dienTich
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

                <td class="p-3 border-b">
                    ${alertHtml}
                </td>

                <td class="p-3 border-b text-sm text-slate-500 italic max-w-[200px] truncate" title="${item.ghiChu || ''}">
                    ${item.ghiChu || ''}
                </td>
            </tr>
            `;
        }).join('');
        lucide.createIcons();
    },

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
        lucide.createIcons();
    },

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
        lucide.createIcons();
    },

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
        lucide.createIcons();
    },

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

    renderKPIStructureTable(structure) {
        // 1. Render Header Động cho bảng Thực hiện
        const thead = document.getElementById('kpi-header');
        if (thead) {
            let headerHtml = `
                <tr>
                    <th class="w-12 text-center p-3 border font-bold text-slate-700 bg-slate-100 sticky top-0 shadow-sm z-20">STT</th>
                    <th class="p-3 border font-bold text-slate-700 bg-slate-100 min-w-[200px] sticky top-0 shadow-sm z-20">Đơn vị</th>
            `;
            
            structure.forEach(item => {
                if(item.active) {
                    headerHtml += `<th class="p-3 border font-bold text-slate-700 bg-slate-100 text-right min-w-[120px] sticky top-0 shadow-sm z-20">${item.tenHienThi}<br><span class="text-[10px] font-normal text-slate-500">(${item.dvt})</span></th>`;
                }
            });
            headerHtml += `</tr>`;
            thead.innerHTML = headerHtml;
        }

        // 2. Render nội dung cho tab "Cấu trúc"
        const tbody = document.getElementById('body-cautruc');
        if (tbody) {
            tbody.innerHTML = structure.map((item, i) => `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="p-3 text-center">${i+1}</td>
                    <td class="p-3 font-mono font-bold text-blue-600">${item.ma}</td>
                    <td class="p-3 font-semibold">${item.tenHienThi}</td>
                    <td class="p-3 text-sm text-slate-500">${item.dvt}</td>
                    <td class="p-3 text-sm">${item.ngayApDung || '-'}</td>
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
        }
        lucide.createIcons();
    },

    // Render Bảng Dữ liệu thực tế
    renderKPIActualTable(data, structure) {
        const tbody = document.getElementById('kpi-actual-tbody') || document.getElementById('body-thuchien');

        if (!tbody) {
            console.error("Critical UI Error: Không tìm thấy <tbody> cho bảng KPI.");
            return;
        }
        
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="100" class="text-center py-8 text-slate-400 italic">Không có dữ liệu phù hợp với bộ lọc</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            if (item.isTotal) {
                tr.className = "bg-blue-100 font-bold border-t-2 border-blue-300 text-blue-900 sticky bottom-0 z-10 shadow-lg";
            } else {
                tr.className = "bg-white border-b hover:bg-slate-50 cursor-pointer transition-colors";
                tr.onclick = () => app.handleRowClick(item.hienThi); 
            }

            let sttHtml = item.isTotal ? '' : `<span class="text-slate-400">${index + 1}</span>`;
            
            let html = `
                <td class="p-3 text-center border-r border-slate-200">${sttHtml}</td>
                <td class="p-3 text-left border-r border-slate-200 ${item.isTotal ? 'uppercase' : 'font-medium'}">
                    ${item.hienThi}
                    ${item.phuong && item.phuong !== '-' ? `<div class="text-[10px] text-slate-400 font-normal ml-2 inline-block">(${item.phuong})</div>` : ''}
                </td>
            `;

            structure.forEach(kpi => {
                if (kpi.active) {
                    const cleanKey = app.cleanCode(kpi.ma); 
                    const val = item[cleanKey] || 0;
                    
                    const valClass = val > 0 ? (item.isTotal ? 'text-blue-800' : 'text-slate-800') : 'text-slate-300';
                    
                    html += `<td class="p-3 text-right border-r border-slate-200 ${valClass}">
                        ${this.formatNumber(val)}
                    </td>`;
                }
            });

            tr.innerHTML = html;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    },

   // --- 7. BẢNG GIAO KẾ HOẠCH (FIXED HEADER & COLUMNS - SIÊU CỐ ĐỊNH) ---
    renderPlanningTable(rows, kpiStructure, planMap = {}) {
        const table = document.getElementById('table-kehoach'); 
        if (!table) return;

        // --- BƯỚC 1: TÍNH TOÁN TỔNG ---
        const colTotals = {};
        kpiStructure.forEach(k => colTotals[k.ma] = 0);
        rows.forEach(row => {
            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const val = Number(planMap[key]) || 0;
                colTotals[kpi.ma] += val;
            });
        });

        // --- BƯỚC 2: RENDER HEADER (THEAD) ---
        // z-[60]: Góc trên cùng bên trái (STT + Tên Cụm) phải cao nhất
        // z-50: Các tiêu đề còn lại thấp hơn góc, nhưng cao hơn nội dung
        let theadHtml = `
            <tr>
                <th class="w-12 text-center p-3 border font-bold text-slate-800 bg-slate-200 sticky top-0 left-0 z-[60] shadow-md border-b-2 border-slate-300">STT</th>
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[200px] sticky top-0 left-12 z-[60] shadow-md border-b-2 border-slate-300">Đơn vị (Cụm)</th> 
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[120px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">Liên Cụm</th>
        `;

        kpiStructure.forEach(kpi => {
            theadHtml += `
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-right min-w-[140px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">
                    ${kpi.tenHienThi} <br> 
                    <span class="text-[10px] font-normal text-slate-600 italic">(${kpi.dvt})</span>
                </th>`;
        });
        theadHtml += `</tr>`;
        
        let thead = table.querySelector('thead');
        if(!thead) { 
            thead = document.createElement('thead'); 
            table.appendChild(thead); 
        }
        thead.innerHTML = theadHtml;

        // --- BƯỚC 3: RENDER BODY (TBODY) ---
        const tbody = document.getElementById('body-kehoach');
        if (!tbody) return;
        
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + kpiStructure.length}" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map((row, index) => {
            // z-30: Cột cố định bên trái (thấp hơn header z-50/60)
            // z-0: Các ô nhập liệu bình thường
            let rowHtml = `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors group">
                    <td class="p-3 text-center border-r bg-slate-50 font-medium text-slate-500 sticky left-0 z-30 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">${index + 1}</td>
                    <td class="p-3 font-medium text-blue-700 border-r whitespace-nowrap sticky left-12 z-30 bg-white group-hover:bg-slate-50 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title="${row.maCum}">
                        ${row.tenCum}
                    </td>
                    <td class="p-3 text-sm text-slate-500 border-r text-xs">
                        ${app.getNameLienCum(row.maLienCum)}
                    </td>
            `;

            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const rawVal = planMap[key];
                const displayVal = rawVal !== undefined ? new Intl.NumberFormat('vi-VN').format(rawVal) : '';

                rowHtml += `
                    <td class="p-2 border-r">
                        <input type="text" 
                            class="plan-input w-full text-right border border-slate-200 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-semibold text-slate-700 focus:bg-white bg-slate-50/30"
                            placeholder="-"
                            data-cum="${row.maCum}"
                            data-kpi="${kpi.ma}"
                            value="${displayVal}" 
                            oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"
                        >
                    </td>
                `;
            });

            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');

        // --- BƯỚC 4: RENDER FOOTER (TFOOT) ---
        // z-50: Dòng tổng phải nổi lên trên body khi cuộn xuống dưới cùng
        let tfoot = table.querySelector('tfoot');
        if(tfoot) tfoot.remove();
        
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);

        // Góc trái dưới cùng cũng cần cố định (sticky left) và z-index cao
        let tfootHtml = `
            <tr class="bg-yellow-100 font-bold text-slate-800 border-t-2 border-yellow-300 shadow-inner sticky bottom-0 z-50">
                <td class="p-3 text-center sticky left-0 z-[60] bg-yellow-100 border-r border-yellow-200 border-t-2 border-yellow-300">#</td>
                <td class="p-3 text-left sticky left-12 z-[60] bg-yellow-100 border-r border-yellow-200 uppercase tracking-wider text-xs border-t-2 border-yellow-300">Tổng cộng</td>
                <td class="p-3 border-r border-yellow-200 bg-yellow-100"></td> 
        `;

        kpiStructure.forEach(kpi => {
            const totalVal = colTotals[kpi.ma] || 0;
            const displayTotal = totalVal > 0 ? new Intl.NumberFormat('vi-VN').format(totalVal) : '-';
            
            tfootHtml += `
                <td class="p-3 text-right border-r border-yellow-200 text-blue-800 text-sm bg-yellow-100">
                    ${displayTotal}
                </td>
            `;
        });

        tfootHtml += `</tr>`;
        tfoot.innerHTML = tfootHtml;
    },

    // --- 8. TAB USER GHI NHẬN (CÓ THỐNG KÊ & LỌC CỤM) ---
    
    // Render Dropdown chọn Cụm
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
                    <select id="user-filter-select" onchange="app.handleUserFilterChange(this.value)" class="border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[250px]">
                        ${options}
                    </select>
                </div>
                <div class="h-6 w-px bg-slate-300 mx-2"></div>
                <div class="text-sm text-slate-600 flex items-center gap-1">
                    <i data-lucide="info" class="w-4 h-4 text-blue-500"></i>
                    <span>Dữ liệu trích xuất từ lịch sử ghi nhận KPI thực tế</span>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    // [File: ui-renderer.js]

    // 1. HÀM MỚI: RENDER THỐNG KÊ SO SÁNH CÁC CỤM
    renderClusterStats(statsData) {
        const container = document.getElementById('stats-grid');
        if (!container) return;

        if (!statsData || statsData.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-400 col-span-full">Chưa có dữ liệu thống kê.</p>';
            return;
        }

        // Sắp xếp giảm dần theo số lượng user
        statsData.sort((a, b) => b.userCount - a.userCount);

        container.innerHTML = statsData.map(item => `
            <div class="flex flex-col bg-slate-50 border border-slate-200 rounded p-2 hover:shadow-md transition cursor-pointer" 
                 onclick="app.handleUserFilterChange('${item.maCum}'); document.getElementById('user-filter-select').value='${item.maCum}';">
                <span class="text-[10px] uppercase font-bold text-slate-500 truncate" title="${item.tenCum}">
                    ${item.tenCum}
                </span>
                <div class="flex justify-between items-end mt-1">
                    <span class="text-lg font-bold text-blue-700 leading-none">${item.userCount}</span>
                    <span class="text-[10px] text-slate-400">users</span>
                </div>
            </div>
        `).join('');
    },

    // 2. SỬA HÀM RENDER LOGS (BỎ CỘT TYPE)
    renderKPIUserLogs(data) {
        const tbody = document.getElementById('body-user-ghinhan');
        
        let statDiv = document.getElementById('user-stat-summary');
        if (statDiv) {
            if (data && data.length > 0) {
                statDiv.innerHTML = `<div class="text-sm font-bold text-blue-800 mb-2">
                    ➤ Chi tiết: <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-1 border border-blue-200">${data.length} Mã NV</span>
                </div>`;
            } else {
                statDiv.innerHTML = '';
            }
        }

        if (!tbody) return;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-12 text-slate-400 italic bg-slate-50/50">
                <div class="flex flex-col items-center gap-2">
                    <i data-lucide="filter" class="w-8 h-8 opacity-50"></i>
                    <span>Vui lòng chọn Cụm (hoặc click vào ô thống kê) để xem chi tiết</span>
                </div>
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
    // --- 9. DASHBOARD ---

    renderDashboardSummary(clusters, stores, gdvs, sales, indirect, bts) {
        const tbody = document.getElementById('dashboard-summary-body');
        if (!tbody) return;

        const summaryData = clusters.map(lc => {
            const lcMa = lc.maLienCum; 
            return { 
                lcName: lc.tenLienCum, 
                lcMa: lcMa, 
                countCum: lc.cums.length,
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
                        <td class="p-2 text-right font-mono text-xs">${this.formatNumber(px.danSo)}</td>
                        <td class="p-2 text-right font-mono text-xs font-bold">${this.formatNumber(px.vlr)}</td>
                    </tr>
                `;
            });
        });
        tbody.innerHTML = rows;
    },

    renderDashboardCharts(kpiData, instances) {
        if (instances.revenueChart) instances.revenueChart.destroy();
        if (instances.subChart) instances.subChart.destroy();

        const labels = [...new Set(kpiData.map(d => d.maLienCum || d.lienCum))];
        const displayLabels = labels.map(code => app.getNameLienCum(code));
        
        // Mock Plan vs Actual Logic
        const dataPlan = labels.map(l => 600); 
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

        const totalNewSub = kpiData.reduce((sum, item) => sum + (Number(item.KPI_TB_MOI) || 0), 0);
        const total4G = kpiData.reduce((sum, item) => sum + (Number(item.KPI_4G) || 0), 0);

        const ctxSub = document.getElementById('chartSubscriber');
        if (ctxSub) {
            instances.subChart = new Chart(ctxSub.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Thuê bao mới', 'Gói cước 4G'],
                    datasets: [{
                        data: [totalNewSub, total4G],
                        backgroundColor: ['#10b981', '#f59e0b']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }
};
