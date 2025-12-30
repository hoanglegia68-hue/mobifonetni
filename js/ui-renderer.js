
const UIRenderer = {
    // ============================================================
    // 1. CÁC HÀM HELPER DÙNG CHUNG
    // ============================================================

    // Format số liệu (1.000.000)
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return new Intl.NumberFormat('vi-VN').format(num);
    },

    // Định dạng diện tích (km²)
    formatAreaKm2(km2, maxDecimals = 2) {
        if (km2 === null || km2 === undefined || km2 === '') return '-';
        const n = Number(km2);
        if (!Number.isFinite(n)) return '-';
        const fmt = new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxDecimals
        });
        return `${fmt.format(n)} km²`;
    },

    // Tạo Link Google Map (Đã fix lỗi cú pháp link)
    getMapLink(lat, lng, address) {
        if (!lat || !lng) return `<span class="text-slate-500 text-xs">${address}</span>`;
        return `
            <div class="flex flex-col">
                <span class="text-xs font-medium text-slate-700 truncate max-w-[200px]" title="${address}">${address}</span>
                <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
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

    // Tính số ngày còn lại
    getDaysRemaining(endDateStr) {
        if (!endDateStr) return 9999;
        let end;
        if (endDateStr.includes('/')) {
            const parts = endDateStr.split('/');
            if (parts.length === 3) {
                end = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        if (!end || isNaN(end.getTime())) {
            end = new Date(endDateStr);
        }
        if (isNaN(end.getTime())) return 9999;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffTime = end - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    // Format ngày VN (dd/mm/yyyy)
    formatDateVN(dateStr) {
        if (!dateStr) return '';
        try {
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
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu phù hợp</td></tr>`;
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
</td>
                        <td class="text-sm border-b border-slate-100 text-right font-mono">${(px.dienTich === null || px.dienTich === undefined || px.dienTich === '') ? '-' : this.formatAreaKm2(px.dienTich)}</td>
<td class="border-b border-slate-100"><div class="flex flex-col items-start gap-1">${leadersHtml}</div></td>
                        <td class="text-center align-middle border-b border-slate-100">
                            <button onclick="app.openEditModal('${px.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="Chỉnh sửa"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                        </td>
                    </tr>`;
                });
            });
        });

        tbody.innerHTML = html;
        if (window.lucide) lucide.createIcons();
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
            const dt = this.formatAreaKm2(item.dienTich);

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
        if (window.lucide) lucide.createIcons();
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs">
                    <div class="font-bold text-blue-600">${item.maCH}</div>
                    <div class="text-slate-500 truncate w-32">${item.tenCH}</div>
                </td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
                
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3"><div class="flex flex-wrap gap-1">${(item.phuongXas || []).map(px => `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-[10px]">${px}</span>`).join('')}</div></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
                
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs" title="${item.maLienCum}">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-xs" title="${item.maCum}">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
               
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
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
        if (window.lucide) lucide.createIcons();
    },

    renderBTSTable(data) {
        const tbody = document.getElementById('bts-list-body');
        if (!tbody) return;

        const COLSPAN = 24; // 22 cột dữ liệu + Ghi chú + Tác vụ

        // Helper: lấy giá trị theo nhiều alias (hỗ trợ header sheet có viết hoa/thường, có dấu, có khoảng trắng...)
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

        // Helper: hiển thị rỗng thành '-' (để bảng dễ đọc)
        const safe = (v) => {
            if (v === null || v === undefined) return '-';
            const s = String(v).trim();
            return s === '' ? '-' : s;
        };

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, idx) => {
            const maTram = pick(item, 'maTram', 'Mã Trạm', 'matram');
            const loaiTram = pick(item, 'loaitram', 'loaiTram', 'Loại trạm', 'loai tram');
            const maLienCum = pick(item, 'maLienCum', 'Mã Liên Cụm', 'maliencum');
            const maCum = pick(item, 'maCum', 'Mã Cụm', 'macum');
            const diaChi = pick(item, 'diaChi', 'Địa chỉ', 'dia chi', 'DiaChi');
            const lat = pick(item, 'lat', 'Lat', 'LAT', 'latitude', 'vĩ độ', 'vi do');
            const lng = pick(item, 'lng', 'Lng', 'LNG', 'longitude', 'kinh độ', 'kinh do');

            const vlr3g = pick(item, 'VLR 3G', 'VLR3G', 'VLR_3G', 'VLR 3g');
            const vlr4g = pick(item, 'VLR 4G', 'VLR4G', 'VLR_4G', 'VLR 4g');
            const asim = pick(item, 'ASIM', 'asim');
            const gtel = pick(item, 'GTEL', 'gtel');
            const vnsky = pick(item, 'VNSKY', 'vnsky');
            const saymee = pick(item, 'SAYMEE', 'saymee');
            const m2mTong = pick(item, 'M2M - Tổng', 'M2M - Tong', 'M2M Tổng', 'M2M_TONG', 'M2M');
            const dataGb = pick(item, 'Data (GB/BQN)', 'Data(GB/BQN)', 'DATA (GB/BQN)', 'Data GB/BQN', 'DATA_GB_BQN');
            const csg = pick(item, 'CSG', 'csg');

            const tbaon = pick(item, 'TBAON_ACTIVE', 'TBAON ACTIVE', 'TBAON-ACTIVE');
            const portaon = pick(item, 'PORTAON_EMTY', 'PORTAON_EMPTY', 'PORTAON EMTY', 'PORTAON-EMTY');
            const olt = pick(item, 'OLT', 'olt');
            const tbgpon = pick(item, 'TBGPON_ACTIVE', 'TBGPON ACTIVE', 'TBGPON-ACTIVE');
            const linegpon = pick(item, 'LINEGPON_EMTY', 'LINEGPON_EMPTY', 'LINEGPON EMTY', 'LINEGPON-EMTY');

            const ghiChu = pick(item, 'ghiChu', 'Ghi chú', 'Ghi Chu', 'note');

            return `
                <tr class="bg-white border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3 font-mono font-bold text-slate-700">${safe(maTram)}</td>
                    <td class="p-3 text-sm">${safe(loaiTram)}</td>
                    <td class="p-3 text-xs" title="${safe(maLienCum)}">${app.getNameLienCum(maLienCum) || safe(maLienCum)}</td>
                    <td class="p-3 text-xs" title="${safe(maCum)}">${app.getNameCum(maCum) || safe(maCum)}</td>
                    <td class="p-3">${this.getMapLink(lat, lng, diaChi)}</td>
                    <td class="p-3 text-right">${safe(vlr3g)}</td>
                    <td class="p-3 text-right">${safe(vlr4g)}</td>
                    <td class="p-3 text-right">${safe(asim)}</td>
                    <td class="p-3 text-right">${safe(gtel)}</td>
                    <td class="p-3 text-right">${safe(vnsky)}</td>
                    <td class="p-3 text-right">${safe(saymee)}</td>
                    <td class="p-3 text-right font-semibold">${safe(m2mTong)}</td>
                    <td class="p-3 text-right">${safe(dataGb)}</td>
                    <td class="p-3 text-right">${safe(csg)}</td>
                    <td class="p-3 text-right">${safe(tbaon)}</td>
                    <td class="p-3 text-right">${safe(portaon)}</td>
                    <td class="p-3 text-right">${safe(olt)}</td>
                    <td class="p-3 text-right">${safe(tbgpon)}</td>
                    <td class="p-3 text-right">${safe(linegpon)}</td>
                    <td class="p-3 text-sm italic text-slate-500">${safe(ghiChu)}</td>
                    <td class="p-3 text-center">
                        <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    },


    // ============================================================
    // 4. SỐ LIỆU KINH DOANH (KPI) 
    // ============================================================

    renderKPIStructureTable(structure) {
        const tbody = document.getElementById('body-cautruc');
        if (tbody) {
            tbody.innerHTML = structure.map((item, i) => `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="p-3 text-center">${i + 1}</td>
                    <td class="p-3 font-mono font-bold text-blue-600">${item.ma}</td>
                    <td class="p-3 font-semibold">${item.tenHienThi}</td>
                    <td class="p-3 text-sm text-slate-500">${item.dvt}</td>
                    <td class="p-3 text-sm">${item.ngayApDung || '-'}</td>
                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${item.active ? 'Đang áp dụng' : 'Ngưng'}</span></td>
                    <td class="p-3 text-center"><button onclick="app.openEditModal()" class="admin-only text-slate-400 hover:text-blue-600"><i data-lucide="edit-3" class="w-4 h-4"></i></button></td>
                </tr>
            `).join('');
        }
        if (window.lucide) lucide.createIcons();
    },

    renderKPIActualTable(data, structure) {
        const tbody = document.getElementById('kpi-actual-tbody') || document.getElementById('body-thuchien');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="100" class="text-center py-8 text-slate-400 italic">Không có dữ liệu phù hợp với bộ lọc</td></tr>`;
            return;
        }

        // Tạo lại Header động
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
                if (app.handleRowClick) tr.onclick = () => app.handleRowClick(item.hienThi);
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

                if (kpi.dvt && kpi.dvt.toLowerCase().includes('%')) {
                    let percent = actual;
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

        const colTotals = {};
        kpiStructure.forEach(k => colTotals[k.ma] = 0);
        rows.forEach(row => {
            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const val = Number(planMap[key]) || 0;
                colTotals[kpi.ma] += val;
            });
        });

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
        if (!thead) { thead = document.createElement('thead'); table.appendChild(thead); }
        thead.innerHTML = theadHtml;

        const tbody = document.getElementById('body-kehoach');
        if (!tbody) return;

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + kpiStructure.length}" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

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

        let tfoot = table.querySelector('tfoot');
        if (tfoot) tfoot.remove();
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
        if (window.lucide) lucide.createIcons();
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
            if (window.lucide) lucide.createIcons();
            return;
        }

        tbody.innerHTML = data.map((item, i) => `
            <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                <td class="p-3 text-center text-slate-500 font-medium border-r">${i + 1}</td>
                <td class="p-3 font-bold text-blue-700 font-mono text-sm border-r">${item.maNV}</td>
                <td class="p-3 text-sm text-slate-700 border-r">${item.channelStr || '-'}</td>
                <td class="p-3 text-sm text-slate-600 border-r">${app.getNameCum(item.maCum)}</td>
                <td class="p-3 text-sm text-slate-500 text-xs border-r">${app.getNameLienCum(item.maLienCum)}</td>
                <td class="p-3 text-right"><span class="text-xs font-bold text-slate-400">${item.totalLogs} records</span></td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 6. DASHBOARD CHÍNH
    // ============================================================

    async renderDashboard(filterScope = 'all') {
        const allClusters = await DataService.getClusters();
        const allStores = await DataService.getStores();
        const allBts = await DataService.getBTS();
        const allGdvs = await DataService.getGDVs();
        const allSales = await DataService.getSalesStaff();
        const allB2B = await DataService.getB2BStaff();
        const allIndirect = await DataService.getIndirectChannels();

        // 1. NÂNG CẤP DROPDOWN (Chia Group Cụm / Liên Cụm)
        const select = document.getElementById('dashboard-scope-select');
        if (select && select.querySelectorAll('optgroup').length === 0) {
            select.innerHTML = '<option value="all">Toàn Công Ty</option>';

            const lcGroup = document.createElement('optgroup');
            lcGroup.label = "--- LIÊN CỤM ---";
            allClusters.forEach(c => {
                lcGroup.innerHTML += `<option value="${c.maLienCum}">${c.tenLienCum}</option>`;
            });
            select.appendChild(lcGroup);

            const cGroup = document.createElement('optgroup');
            cGroup.label = "--- CỤM ---";
            allClusters.forEach(lc => {
                lc.cums.forEach(c => {
                    cGroup.innerHTML += `<option value="${c.maCum}">${c.tenCum} (${lc.tenLienCum})</option>`;
                });
            });
            select.appendChild(cGroup);
            select.value = filterScope;
        }

        // 2. LOGIC LỌC DỮ LIỆU
        const filterByScope = (list) => {
            if (filterScope === 'all') return list;
            return list.filter(item => item.maLienCum === filterScope || item.maCum === filterScope);
        };

        const stores = filterByScope(allStores);
        const bts = filterByScope(allBts);
        const gdvs = filterByScope(allGdvs);
        const sales = filterByScope(allSales);
        const b2b = filterByScope(allB2B);
        const indirect = filterByScope(allIndirect);

        let communes = [];
        if (filterScope === 'all') {
            allClusters.forEach(lc => lc.cums.forEach(c => communes.push(...c.phuongXas)));
        } else {
            const foundLC = allClusters.find(c => c.maLienCum === filterScope);
            if (foundLC) {
                foundLC.cums.forEach(c => communes.push(...c.phuongXas));
            } else {
                allClusters.forEach(lc => {
                    const foundCum = lc.cums.find(c => c.maCum === filterScope);
                    if (foundCum) communes.push(...foundCum.phuongXas);
                });
            }
        }

        const totalVLR = communes.reduce((sum, px) => sum + (Number(px.vlr) || 0), 0);
        const totalPop = communes.reduce((sum, px) => sum + (Number(px.danSo) || 0), 0);
        const totalCommunes = communes.length;

        const totalArea = communes.reduce((sum, px) => sum + (Number(px.dienTich || px.dientich) || 0), 0);
        const storesExpiring = stores.filter(s => s.ngayHetHan && this.getDaysRemaining(s.ngayHetHan) < 30).length;
        const countActive = (list) => list.filter(i => i.trangThai !== 'Nghỉ việc').length;

        // 3. VẼ CÁC CARDS
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
                    <div class="flex justify-between items-center"><span class="text-slate-500">Diện tích:</span> <span class="font-bold text-slate-700">${this.formatAreaKm2(totalArea)}</span></div>
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

        // 4. BẢNG CHI TIẾT PHÂN BỔ
        let displayItems = [];
        let viewMode = 'liencum';

        if (filterScope === 'all') {
            viewMode = 'liencum';
            displayItems = allClusters.map(lc => ({
                code: lc.maLienCum,
                name: lc.tenLienCum,
                subCount: lc.cums.length,
                type: 'Liên Cụm',
                filterKey: 'maLienCum'
            }));
        } else {
            const foundLC = allClusters.find(c => c.maLienCum === filterScope);

            if (foundLC) {
                viewMode = 'cum';
                displayItems = foundLC.cums.map(c => ({
                    code: c.maCum,
                    name: c.tenCum,
                    subCount: c.phuongXas.length,
                    type: 'Cụm',
                    filterKey: 'maCum'
                }));
            } else {
                viewMode = 'cum_detail';
                let foundCum = null;
                allClusters.forEach(lc => {
                    const c = lc.cums.find(x => x.maCum === filterScope);
                    if (c) foundCum = c;
                });

                if (foundCum) {
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

        const tHeadLabel = viewMode === 'liencum' ? 'Liên Cụm' : 'Cụm / Đơn vị';
        const tSubLabel = viewMode === 'liencum' ? 'Số Cụm' : 'Số Xã';

        const tableHeaderRows = document.querySelectorAll('#view-dashboard table thead th');
        if (tableHeaderRows.length > 2) {
            tableHeaderRows[1].textContent = `Đơn vị (${tHeadLabel})`;
            tableHeaderRows[2].textContent = tSubLabel;
        }

        const tbody = document.getElementById('dashboard-breakdown-body');
        if (tbody) {
            tbody.innerHTML = displayItems.map((item, idx) => {
                const code = item.code;
                const filterKey = item.filterKey;

                const cStore = allStores.filter(i => i[filterKey] === code).length;
                const cGdv = allGdvs.filter(i => i[filterKey] === code).length;
                const cSale = allSales.filter(i => i[filterKey] === code).length;
                const cAgency = allIndirect.filter(i => i[filterKey] === code).length;
                const cBts = allBts.filter(i => i[filterKey] === code).length;

                const makeLink = (count, type, cssClass) => {
                    if (count === 0) return `<span class="text-slate-300">-</span>`;
                    return `<button onclick="app.showDashboardDetail('${type}', '${code}')" 
                            class="${cssClass} hover:underline hover:scale-110 transition-transform cursor-pointer px-2 py-0.5 rounded shadow-sm text-xs border border-transparent hover:border-slate-300">
                            ${count}
                            </button>`;
                };
                
                // Logic nút subCount
                const subType = item.type === 'Liên Cụm' ? 'list_cum' : 'commune';
                const subCountHtml = `<button onclick="app.showDashboardDetail('${subType}', '${item.code}')" 
                    class="text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded text-xs hover:bg-slate-200 hover:scale-110 transition-transform cursor-pointer border border-transparent hover:border-slate-300">
                    ${item.subCount}
                </button>`;

                return `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${code}</div>
                    </td>
                    <td class="p-3 text-center font-medium">${subCountHtml}</td>
                    <td class="p-3 text-center">${makeLink(cStore, 'store', 'text-blue-700 font-bold bg-blue-50')}</td>
                    <td class="p-3 text-center">${makeLink(cGdv, 'gdv', 'text-emerald-700 font-bold bg-emerald-50')}</td>
                    <td class="p-3 text-center">${makeLink(cSale, 'sales', 'text-orange-700 font-bold bg-orange-50')}</td>
                    <td class="p-3 text-center">${makeLink(cAgency, 'indirect', 'text-cyan-700 font-bold bg-cyan-50')}</td>
                    <td class="p-3 text-center">${makeLink(cBts, 'bts', 'text-indigo-700 font-bold bg-indigo-50')}</td>
                </tr>`;
            }).join('');
        }
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 7. VẼ BIỂU ĐỒ (KPI REPORT)
    // ============================================================

    renderKPIReport(data, filterInfo) {
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

            if (elActual) {
                elActual.textContent = this.formatNumber(actual);
                elActual.style.cursor = 'pointer';
                elActual.style.textDecoration = 'underline';
                elActual.title = "Bấm để xem chi tiết phân bổ";
                elActual.onclick = () => {
                    if (app.showKPIBreakdown) app.showKPIBreakdown(prefix, 'cum');
                };
            }

            if (elPlan) elPlan.textContent = this.formatNumber(plan);

            const percent = plan > 0 ? Math.round((actual / plan) * 100) : (actual > 0 ? 100 : 0);
            if (elPercent) elPercent.textContent = `${percent}%`;
            if (elProg) elProg.style.width = `${Math.min(percent, 100)}%`;
        };

        updateWidget('sub', data.sub.actual, data.sub.plan);
        updateWidget('rev', data.rev.actual, data.rev.plan);

        // ============================================================
        // [NEW] Thống kê mở rộng cho khu vực "Phát triển thuê bao"
        // ============================================================
        const updateSubMetrics = (metrics, fInfo) => {
            if (!metrics) return;
            const fmt1 = (n) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n ?? 0);
            const fmtPct = (pct) => (pct === null || pct === undefined) ? '—' : `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(1)}%`;
            const fmtDelta = (delta) => `${delta >= 0 ? '+' : ''}${this.formatNumber(delta ?? 0)}`;
            const md = (ymd) => {
                if (!ymd) return '';
                const p = String(ymd).split('-');
                if (p.length !== 3) return ymd;
                return `${p[2]}/${p[1]}`;
            };
            const setCompare = (el, delta, pct, prefixText) => {
                if (!el) return;
                el.textContent = `${prefixText}: ${fmtDelta(delta)}${pct !== null && pct !== undefined ? ` (${fmtPct(pct)})` : ''}`;
                el.classList.remove('text-emerald-600', 'text-rose-600', 'text-slate-600');
                if (delta > 0) el.classList.add('text-emerald-600');
                else if (delta < 0) el.classList.add('text-rose-600');
                else el.classList.add('text-slate-600');
            };

            // TB ngày
            const elAvg = document.getElementById('stat-sub-avgday');
            const elAvgNote = document.getElementById('stat-sub-avgday-note');
            if (elAvg) elAvg.textContent = fmt1(metrics.avgDaily?.value || 0);
            if (elAvgNote) {
                const days = metrics.avgDaily?.days || 0;
                const from = fInfo?.dFrom || metrics.avgDaily?.range?.from;
                const to = fInfo?.dTo || metrics.avgDaily?.range?.to;
                elAvgNote.textContent = `Theo khoảng lọc (${days} ngày)${from && to ? `: ${md(from)}–${md(to)}` : ''}`;
            }

            // WTD
            const elWtd = document.getElementById('stat-sub-wtd');
            if (elWtd) elWtd.textContent = this.formatNumber(metrics.week?.curr || 0);
            setCompare(document.getElementById('stat-sub-wtd-compare'), metrics.week?.delta || 0, metrics.week?.pct, 'So tuần trước');
            const elWtdRange = document.getElementById('stat-sub-wtd-range');
            if (elWtdRange && metrics.week?.range) {
                elWtdRange.textContent = `Tuần này: ${md(metrics.week.range.from)}–${md(metrics.week.range.to)}`;
            }

            // MTD
            const elMtd = document.getElementById('stat-sub-mtd');
            if (elMtd) elMtd.textContent = this.formatNumber(metrics.month?.curr || 0);
            const elMtdAvg = document.getElementById('stat-sub-mtd-avg');
            if (elMtdAvg) elMtdAvg.textContent = `BQ tháng này: ${fmt1(metrics.month?.avg || 0)}/ngày`;
            const elMtdPrevAvg = document.getElementById('stat-sub-mtd-prevavg');
            if (elMtdPrevAvg) elMtdPrevAvg.textContent = `BQ tháng trước: ${fmt1(metrics.month?.prevAvg || 0)}/ngày`;
            setCompare(document.getElementById('stat-sub-mtd-compare'), metrics.month?.delta || 0, metrics.month?.pct, 'So tháng trước');
            const elMtdRange = document.getElementById('stat-sub-mtd-range');
            if (elMtdRange && metrics.month?.range) {
                elMtdRange.textContent = `Tháng này: ${md(metrics.month.range.from)}–${md(metrics.month.range.to)}`;
            }

            // YTD
            const elYtd = document.getElementById('stat-sub-ytd');
            if (elYtd) elYtd.textContent = this.formatNumber(metrics.year?.curr || 0);
            setCompare(document.getElementById('stat-sub-ytd-compare'), metrics.year?.delta || 0, metrics.year?.pct, 'So cùng kỳ năm trước');
            const elYtdRange = document.getElementById('stat-sub-ytd-range');
            if (elYtdRange && metrics.year?.range) {
                elYtdRange.textContent = `Năm nay: ${md(metrics.year.range.from)}–${md(metrics.year.range.to)}`;
            }
        };

        updateSubMetrics(data?.sub?.metrics, filterInfo);

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
                            app.handleChannelChartClick(type, channelName);
                        }
                    },
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                }
            });
        };

        const ctxSubCluster = document.getElementById('chartSubCluster');
        if (ctxSubCluster) {
            const clusterKeys = Object.keys(data.sub.cluster);
            const labels = clusterKeys.map(k => app.getNameLienCum(k) || app.getNameCum(k) || k);
            const valActual = clusterKeys.map(k => data.sub.cluster[k].actual);
            const valPlan = clusterKeys.map(k => data.sub.cluster[k].plan);

            app.chartInstances['chartSubCluster'] = new Chart(ctxSubCluster.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { type: 'line', label: 'Kế hoạch', data: valPlan, borderColor: '#94a3b8', borderWidth: 2, pointBackgroundColor: '#fff', pointBorderColor: '#94a3b8', pointRadius: 4, fill: false, tension: 0.1, order: 1 },
                        { type: 'bar', label: 'Thực hiện', data: valActual, backgroundColor: '#059669', borderRadius: 4, order: 2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { tooltip: { mode: 'index', intersect: false } },
                    scales: { y: { beginAtZero: true, grid: { borderDash: [2, 2] } }, x: { grid: { display: false } } },
                    onClick: (e, activeEls) => {
                        if (activeEls.length > 0) {
                            const index = activeEls[0].index;
                            const code = clusterKeys[index];
                            const viewLevel = code.startsWith('LC') ? 'liencum' : 'cum';
                            if (app.showKPIBreakdown) app.showKPIBreakdown('sub', viewLevel);
                        }
                    }
                }
            });
        }

        const createClusterChart = (canvasId, clusterData, colorActual, type = 'rev') => {
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
                    datasets: [
                        { label: 'Thực hiện', data: actuals, backgroundColor: colorActual, order: 2 },
                        { label: 'Kế hoạch', data: plans, backgroundColor: '#cbd5e1', order: 3 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    },
                    onClick: (e, activeEls) => {
                        if (activeEls.length > 0) {
                            const index = activeEls[0].index;
                            const code = clusters[index];
                            const viewLevel = code.startsWith('LC') ? 'liencum' : 'cum';
                            if (app.showKPIBreakdown) app.showKPIBreakdown(type, viewLevel);
                        }
                    }
                }
            });
        };

        createLineChart('chartSubDaily', data.sub.daily, '#10b981');
        createChannelChart('chartSubChannel', data.sub.channel, '#34d399', 'sub');
        createLineChart('chartRevDaily', data.rev.daily, '#2563eb');
        createChannelChart('chartRevChannel', data.rev.channel, '#60a5fa', 'rev');
        createClusterChart('chartRevCluster', data.rev.cluster, '#1d4ed8', 'rev');
    },

    renderStaffPerformance(groups) {
        const updateCard = (prefix, data) => {
            const elCount = document.getElementById(`${prefix}-count`);
            const elActual = document.getElementById(`${prefix}-actual`);
            const elPlan = document.getElementById(`${prefix}-plan`);
            const elPercent = document.getElementById(`${prefix}-percent`);

            if (elCount) elCount.textContent = this.formatNumber(data.totalCount);
            if (elActual) elActual.textContent = this.formatNumber(data.totalActual);
            if (elPlan) elPlan.textContent = this.formatNumber(data.totalPlan);
            if (elPercent) {
                elPercent.textContent = `${data.totalPercent}%`;
                elPercent.className = "text-lg font-bold " + (
                    data.totalPercent >= 100 ? "text-emerald-600" :
                        (data.totalPercent >= 80 ? "text-orange-600" : "text-red-600")
                );
            }
        };

        if (groups.gdv) updateCard('gdv', groups.gdv);
        if (groups.sales) updateCard('sales', groups.sales);
        if (groups.b2b) updateCard('b2b', groups.b2b);
    },

    // ============================================================
    // 8. MODAL CHI TIẾT
    // ============================================================

    renderDetailModalContent(type, data, meta = {}) {
        const thead = document.getElementById('modal-detail-thead');
        const tbody = document.getElementById('modal-detail-tbody');
        if (!thead || !tbody) return;

        let toggleHtml = '';
        if (type === 'kpi-breakdown' || type === 'kpi-channel-detail') {
            const isCum = meta.viewLevel === 'cum';
            const btnClassBase = "px-3 py-1 text-xs font-bold rounded border transition-colors focus:outline-none";
            const btnActive = "bg-blue-600 text-white border-blue-600 shadow-sm";
            const btnInactive = "bg-white text-slate-600 border-slate-300 hover:bg-slate-50";

            const fnCallCum = type === 'kpi-breakdown'
                ? `app.showKPIBreakdown('${meta.type}', 'cum')`
                : `app.handleChannelChartClick('${meta.type}', '${meta.channelName}', 'cum')`;

            const fnCallLC = type === 'kpi-breakdown'
                ? `app.showKPIBreakdown('${meta.type}', 'liencum')`
                : `app.handleChannelChartClick('${meta.type}', '${meta.channelName}', 'liencum')`;

            toggleHtml = `
                <tr class="bg-slate-50 border-b">
                    <td colspan="6" class="p-3">
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

        if (type === 'staff-performance') {
            // 1. Tạo Header
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700">Nhân viên</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700">Đơn vị</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Kế hoạch</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Thực hiện</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32 font-bold text-slate-700">% HT</th>
                </tr>`;

            // 2. Khởi tạo biến tính tổng [NEW]
            let sumPlan = 0;
            let sumActual = 0;

            // 3. Tạo các dòng dữ liệu (Body)
            bodyHtml = data.map((item, idx) => {
                // Cộng dồn vào biến tổng [NEW]
                sumPlan += Number(item.plan) || 0;
                sumActual += Number(item.actual) || 0;

                let colorClass = Number(item.percent) >= 100 ? 'bg-green-500' : (Number(item.percent) >= 80 ? 'bg-yellow-500' : 'bg-red-500');
                let textClass = Number(item.percent) >= 100 ? 'text-green-600' : (Number(item.percent) >= 80 ? 'text-yellow-600' : 'text-red-600');

                return `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${item.code}</div>
                    </td>
                    <td class="p-3 text-sm text-slate-600">${app.getNameCum(item.maCum) || item.maCum || '-'}</td>
                    <td class="p-3 text-right text-slate-500 font-mono">${this.formatNumber(item.plan)}</td>
                    <td class="p-3 text-right font-bold text-slate-800 font-mono">${this.formatNumber(item.actual)}</td>
                    <td class="p-3 align-middle">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold ${textClass} w-10 text-right">${item.percent}%</span>
                            <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-20">
                                <div class="h-full ${colorClass}" style="width: ${Math.min(item.percent, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            // 4. Thêm Hàng TỔNG CỘNG vào cuối bảng [NEW]
            const totalPercent = sumPlan > 0 ? ((sumActual / sumPlan) * 100).toFixed(1) : 0;
            
            // Logic màu sắc cho hàng tổng
            let totalColorClass = totalPercent >= 100 ? 'bg-green-600' : (totalPercent >= 80 ? 'bg-blue-600' : 'bg-red-500');
            let totalTextClass = totalPercent >= 100 ? 'text-green-700' : (totalPercent >= 80 ? 'text-blue-700' : 'text-red-600');

            bodyHtml += `
                <tr class="bg-blue-50 border-t-2 border-blue-200">
                    <td colspan="3" class="p-3 text-center font-bold text-blue-800 uppercase tracking-wider">TỔNG CỘNG</td>
                    <td class="p-3 text-right font-bold text-slate-600 font-mono">${this.formatNumber(sumPlan)}</td>
                    <td class="p-3 text-right font-bold text-blue-800 font-mono text-base">${this.formatNumber(sumActual)}</td>
                    <td class="p-3 align-middle">
                         <div class="flex items-center gap-2">
                            <span class="text-sm font-bold ${totalTextClass} w-10 text-right">${totalPercent}%</span>
                            <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden w-20">
                                <div class="h-full ${totalColorClass}" style="width: ${Math.min(totalPercent, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }
        else if (type === 'kpi-breakdown') {
            headerHtml = `
                ${toggleHtml}
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700">Đơn vị (${meta.viewLevel === 'liencum' ? 'Liên Cụm' : 'Cụm'})</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Thực hiện</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Kế hoạch</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32 font-bold text-slate-700">% HT</th>
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
        else if (type === 'kpi-channel-detail') {
            headerHtml = `
                ${toggleHtml}
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700">Đơn vị (${meta.viewLevel === 'liencum' ? 'Liên Cụm' : 'Cụm'})</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Sản lượng Kênh</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Tổng Đơn vị</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32 font-bold text-slate-700">Tỷ trọng</th>
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
        else if (type === 'commune' || type === 'geo') {
            headerHtml = `
                <tr>
                    <th class="p-3 text-left border-b font-bold text-slate-700 w-12 bg-slate-100">STT</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Tên Phường/Xã</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Thuộc Đơn vị</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700 bg-slate-100">VLR (Thuê bao)</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700 bg-slate-100">Dân số</th>
                    <th class="p-3 text-right border-b font-bold text-slate-700 bg-slate-100">Diện tích</th>
                    <th class="p-3 text-left border-b font-bold text-slate-700 bg-slate-100">Thông tin Lãnh đạo</th>
                </tr>`;

            bodyHtml = data.map((item, idx) => {
                let leadersHtml = (item.lanhDao || []).map(ld => `
                    <div class="text-[10px] mb-1 px-1.5 py-0.5 rounded border border-slate-200 w-fit bg-slate-50">
                        <span class="font-bold text-slate-700">${ld.chucVu}:</span> ${ld.ten} <span class="text-slate-400 italic">(${ld.sdt})</span>
                    </div>`).join('') || '<span class="text-xs text-slate-300 italic">Chưa cập nhật</span>';

                return `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3 font-bold text-blue-700">${item.ten}</td>
                    <td class="p-3">
                        <div class="text-xs font-bold text-slate-600">${item.tenCum || ''}</div>
                        <div class="text-[10px] text-slate-400">${item.tenLienCum || ''}</div>
                    </td>
                    <td class="p-3 text-right font-mono text-slate-700">${this.formatNumber(item.vlr)}</td>
                    <td class="p-3 text-right font-mono text-slate-500">${this.formatNumber(item.danSo)}</td>
                    <td class="p-3 text-right font-mono text-slate-500">${(item.dienTich === null || item.dienTich === undefined || item.dienTich === '') ? '-' : this.formatAreaKm2(item.dienTich)}</td>
                    <td class="p-3">${leadersHtml}</td>
                </tr>`;
            }).join('');
        }
        else if (type === 'store') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Cửa hàng</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Địa chỉ</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700">Diện tích</th>
                </tr>`;

            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-semibold text-slate-800">${i.ten || '-'}</div>
                        <div class="text-[10px] text-slate-400 font-mono">Mã: ${i.id || '-'}</div>
                    </td>
                    <td class="p-3 text-xs">
                        <div class="font-semibold text-slate-700">${app.getNameCum(i.maCum) || i.maCum || '-'}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum) || i.maLienCum || '-'}</div>
                    </td>
                    <td class="p-3 text-xs max-w-[360px]">
                        <div class="text-slate-700">${i.diaChi || '-'}</div>
                    </td>
                    <td class="p-3 text-right font-bold text-blue-600">${i.dienTich || '-'}</td>
                </tr>`).join('');
        }
        else if (type === 'gdv' || type === 'sales' || type === 'b2b') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Nhân viên</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 text-center font-bold text-slate-700">Vùng</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Số ĐT</th>
                    <th class="p-3 border-b bg-slate-100 text-center font-bold text-slate-700">Trạng thái</th>
                </tr>`;

            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition ${i.trangThai === 'Nghỉ việc' ? 'opacity-60 bg-slate-50' : ''}">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-semibold text-slate-800">${i.ten || '-'}</div>
                        <div class="text-[10px] text-slate-400 font-mono">Mã: ${i.maNV || '-'}</div>
                    </td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-center"><span class="badge-region">${i.vung || '-'}</span></td>
                    <td class="p-3 text-sm font-mono">${i.sdt || ''}</td>
                    <td class="p-3 text-center">${this.getStatusBadge(i.trangThai, i.ngayNghi)}</td>
                </tr>`).join('');
        }
        else if (type === 'bts') {
            const pick = (obj, ...keys) => {
                for (const k of keys) {
                    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
                }
                return undefined;
            };
            const safe = (v) => {
                if (v === null || v === undefined) return '-';
                const s = String(v).trim();
                return s === '' ? '-' : s;
            };

            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100 font-bold text-slate-700 w-10">STT</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Trạm BTS</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Địa chỉ</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Số liệu</th>
                </tr>`;

            const metricCell = (label, value) => `
                <div class="flex items-center justify-between gap-3">
                    <span class="text-slate-400">${label}</span>
                    <span class="font-mono font-semibold text-slate-700">${safe(value)}</span>
                </div>`;

            bodyHtml = data.map((i, idx) => {
                const maTram = pick(i, 'maTram', 'Mã Trạm', 'matram');
                const loaiTram = pick(i, 'loaitram', 'loaiTram', 'Loại trạm', 'loai tram');
                const maLienCum = pick(i, 'maLienCum', 'Mã Liên Cụm', 'maliencum');
                const maCum = pick(i, 'maCum', 'Mã Cụm', 'macum');
                const diaChi = pick(i, 'diaChi', 'Địa chỉ', 'dia chi', 'DiaChi');
                const lat = pick(i, 'lat', 'Lat', 'LAT', 'latitude');
                const lng = pick(i, 'lng', 'Lng', 'LNG', 'longitude');

                const vlr3g = pick(i, 'VLR 3G', 'VLR3G', 'VLR_3G', 'VLR 3g');
                const vlr4g = pick(i, 'VLR 4G', 'VLR4G', 'VLR_4G', 'VLR 4g');
                const asim = pick(i, 'ASIM', 'asim');
                const gtel = pick(i, 'GTEL', 'gtel');
                const vnsky = pick(i, 'VNSKY', 'vnsky');
                const saymee = pick(i, 'SAYMEE', 'saymee');
                const m2mTong = pick(i, 'M2M - Tổng', 'M2M - Tong', 'M2M Tổng', 'M2M_TONG', 'M2M');
                const dataGb = pick(i, 'Data (GB/BQN)', 'Data(GB/BQN)', 'DATA (GB/BQN)', 'Data GB/BQN', 'DATA_GB_BQN');
                const csg = pick(i, 'CSG', 'csg');

                const tbaon = pick(i, 'TBAON_ACTIVE', 'TBAON ACTIVE', 'TBAON-ACTIVE');
                const portaon = pick(i, 'PORTAON_EMTY', 'PORTAON_EMPTY', 'PORTAON EMTY', 'PORTAON-EMTY');
                const olt = pick(i, 'OLT', 'olt');
                const tbgpon = pick(i, 'TBGPON_ACTIVE', 'TBGPON ACTIVE', 'TBGPON-ACTIVE');
                const linegpon = pick(i, 'LINEGPON_EMTY', 'LINEGPON_EMPTY', 'LINEGPON EMTY', 'LINEGPON-EMTY');

                const ghiChu = pick(i, 'ghiChu', 'Ghi chú', 'Ghi Chu', 'note');

                const mapLink = app.getMapLink(lat, lng, diaChi);

                return `
                    <tr class="border-b hover:bg-slate-50 transition">
                        <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                        <td class="p-3">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="font-bold text-slate-800 font-mono">${safe(maTram)}</div>
                                    <div class="mt-1 flex flex-wrap items-center gap-1">
                                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">${safe(loaiTram)}</span>
                                        <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">${app.getNameLienCum(maLienCum) || safe(maLienCum)}</span>
                                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 font-bold">${app.getNameCum(maCum) || safe(maCum)}</span>
                                    </div>
                                    ${ghiChu ? `<div class="mt-2 text-xs italic text-slate-400">Ghi chú: ${safe(ghiChu)}</div>` : ``}
                                </div>
                            </div>
                        </td>
                        <td class="p-3 text-xs">
                            <div class="font-semibold text-blue-700">${mapLink}</div>
                            <div class="text-slate-600 mt-1">${safe(diaChi)}</div>
                        </td>
                        <td class="p-3">
                            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-x-6 gap-y-1 text-[11px]">
                                ${metricCell('VLR 3G', vlr3g)}
                                ${metricCell('VLR 4G', vlr4g)}
                                ${metricCell('ASIM', asim)}
                                ${metricCell('GTEL', gtel)}
                                ${metricCell('VNSKY', vnsky)}
                                ${metricCell('SAYMEE', saymee)}
                                ${metricCell('M2M Tổng', m2mTong)}
                                ${metricCell('Data (GB/BQN)', dataGb)}
                                ${metricCell('CSG', csg)}
                                ${metricCell('TBAON_ACTIVE', tbaon)}
                                ${metricCell('PORTAON_EMTY', portaon)}
                                ${metricCell('OLT', olt)}
                                ${metricCell('TBGPON_ACTIVE', tbgpon)}
                                ${metricCell('LINEGPON_EMTY', linegpon)}
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }
        else if (type === 'indirect') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center bg-slate-100 font-bold text-slate-700">STT</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Mã ĐL/ĐB</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Tên Điểm bán</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Loại</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 font-bold text-slate-700">NV Phụ trách</th>
                </tr>`;

            bodyHtml = data.map((i, idx) => `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3 font-bold text-blue-600 font-mono">${i.maDL}</td>
                    <td class="p-3 font-medium text-slate-700">${i.ten}</td>
                    <td class="p-3"><span class="text-xs border px-1.5 py-0.5 rounded bg-slate-50">${i.loai}</span></td>
                    <td class="p-3 text-xs">
                        <div>${app.getNameCum(i.maCum)}</div>
                        <div class="text-slate-400">${app.getNameLienCum(i.maLienCum)}</div>
                    </td>
                    <td class="p-3 text-xs font-mono text-slate-500">${i.maNV || ''}</td>
                </tr>`).join('');
        }

        thead.innerHTML = headerHtml;
        tbody.innerHTML = bodyHtml;
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 9. BẢNG XẾP HẠNG (CHÍNH THỨC)
    // ============================================================

    renderRankingTable(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm italic">Chưa có dữ liệu xếp hạng</div>`;
            return;
        }

        let html = `
            <div class="overflow-auto max-h-[350px] custom-scrollbar relative bg-white rounded-b-xl w-full">
                <table class="w-full text-sm text-left border-collapse min-w-[350px]">
                    <thead class="text-[10px] text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th class="px-3 py-2 text-center w-10 font-bold bg-slate-50">#</th>
                            <th class="px-3 py-2 font-bold bg-slate-50">Đơn vị / Nhân viên</th>
                            <th class="px-3 py-2 text-right font-bold bg-slate-50">Kế hoạch</th>
                            <th class="px-3 py-2 text-right font-bold bg-slate-50">Thực hiện</th>
                            <th class="px-3 py-2 text-center font-bold bg-slate-50">%</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">`;

        data.forEach((item, index) => {
            let rankBadge = `<span class="text-slate-500 font-mono text-xs">#${index + 1}</span>`;
            if (index === 0) rankBadge = `<div class="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-xs mx-auto">1</div>`;
            else if (index === 1) rankBadge = `<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs mx-auto">2</div>`;
            else if (index === 2) rankBadge = `<div class="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs mx-auto">3</div>`;

            let percentClass = "text-slate-600 font-bold";
            if (item.percent >= 100) percentClass = "text-emerald-600 font-bold bg-emerald-50 border-emerald-100";
            else if (item.percent >= 80) percentClass = "text-blue-600 font-bold bg-blue-50 border-blue-100";
            else if (item.percent < 50) percentClass = "text-red-500 font-bold bg-red-50 border-red-100";

            let subInfoHtml = '';
            if (item.sub) {
                let subDisplay = item.sub;
                if (window.app && window.app.mapCum && window.app.mapCum[item.sub]) {
                    subDisplay = window.app.mapCum[item.sub];
                }
                subInfoHtml = `<div class="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                    <i data-lucide="user" class="w-2.5 h-2.5"></i> ${subDisplay}
                </div>`;
            }

            if (item.phone) {
                subInfoHtml += `
                <div class="mt-1">
                    <a href="tel:${item.phone}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-green-100 text-slate-500 hover:text-green-600 transition text-[10px]">
                        <i data-lucide="phone" class="w-2.5 h-2.5"></i> ${item.phone}
                    </a>
                </div>`;
            }

            html += `
                <tr class="hover:bg-slate-50 transition group">
                    <td class="px-2 py-3 text-center align-top">${rankBadge}</td>
                    <td class="px-3 py-3 align-top">
                        <div class="font-bold text-slate-700 text-sm leading-tight mb-1">${item.name}</div>
                        ${subInfoHtml}
                    </td>
                    <td class="px-3 py-3 text-right align-top text-slate-400 font-mono text-xs whitespace-nowrap">
                        ${this.formatNumber(item.plan)}
                    </td>
                    <td class="px-3 py-3 text-right align-top font-bold text-slate-700 font-mono text-xs whitespace-nowrap">
                        ${this.formatNumber(item.actual)}
                    </td>
                    <td class="px-3 py-3 text-center align-top">
                        <span class="${percentClass} px-2 py-1 rounded border text-[11px] inline-block min-w-[45px] text-center">
                            ${item.percent}%
                        </span>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    },
 
// ============================================================
    // 10. RENDER TAB VLR & DOANH THU (ĐÃ CẬP NHẬT)
    // ============================================================

    /**
     * Render bảng thống kê chi tiết VLR & PSC từ dữ liệu sheet vlr_psc
     * Data input: Array các dòng có cột: maLienCum, tenLienCum, tenPX, tbvlr, tbpsc, date
     */
    renderVlrPscTable(data) {
        const tbody = document.getElementById('vlr-details-body'); // ID này cần có trong HTML
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-400">Không có dữ liệu</td></tr>`;
            return;
        }

        // Render từng dòng dữ liệu
        tbody.innerHTML = data.map((item, idx) => `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-700">${item.tenPX || '-'}</div>
                    <div class="text-[10px] text-slate-400">${item.tenLienCum || '-'} (${item.maLienCum})</div>
                </td>
                <td class="p-3 text-center text-sm text-slate-600 font-mono">
                     ${item.date ? this.formatDateVN(item.date) : '-'}
                </td>
                <td class="p-3 text-right font-bold text-blue-700 font-mono">
                    ${this.formatNumber(item.tbvlr)}
                </td>
                <td class="p-3 text-right font-bold text-emerald-700 font-mono">
                    ${this.formatNumber(item.tbpsc)}
                </td>
            </tr>
        `).join('');
    },

    /**
     * Render các thẻ Card tổng hợp (Summary Cards) cho VLR/PSC
     * metrics input format: { 
     * vlr: { weekThis, weekPrev, monthThis, monthPrev }, 
     * psc: { weekThis, weekPrev, monthThis, monthPrev } 
     * }
     */
    renderVlrPscStats(metrics) {
        // Helper để vẽ so sánh tăng giảm
        const getDelta = (curr, prev) => {
            if(!prev) return '';
            const delta = curr - prev;
            const color = delta >= 0 ? 'text-green-600' : 'text-red-600';
            const icon = delta >= 0 ? '↑' : '↓';
            return `<span class="text-xs ${color} ml-1 font-medium">(${icon} ${this.formatNumber(Math.abs(delta))})</span>`;
        };

        // Render VLR
        const vlrContainer = document.getElementById('vlr-stats-container');
        if(vlrContainer && metrics.vlr) {
            vlrContainer.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-blue-50 p-3 rounded border border-blue-100">
                        <div class="text-xs text-slate-500 uppercase font-bold">VLR BQ Tuần này</div>
                        <div class="text-xl font-bold text-blue-700">${this.formatNumber(metrics.vlr.weekThis)}</div>
                        <div class="text-xs text-slate-400 mt-1">Tuần trước: ${this.formatNumber(metrics.vlr.weekPrev)} ${getDelta(metrics.vlr.weekThis, metrics.vlr.weekPrev)}</div>
                    </div>
                    <div class="bg-indigo-50 p-3 rounded border border-indigo-100">
                        <div class="text-xs text-slate-500 uppercase font-bold">VLR BQ Tháng này</div>
                        <div class="text-xl font-bold text-indigo-700">${this.formatNumber(metrics.vlr.monthThis)}</div>
                        <div class="text-xs text-slate-400 mt-1">Tháng trước: ${this.formatNumber(metrics.vlr.monthPrev)} ${getDelta(metrics.vlr.monthThis, metrics.vlr.monthPrev)}</div>
                    </div>
                </div>
            `;
        }

        // Render PSC
        const pscContainer = document.getElementById('psc-stats-container');
        if(pscContainer && metrics.psc) {
            pscContainer.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-emerald-50 p-3 rounded border border-emerald-100">
                        <div class="text-xs text-slate-500 uppercase font-bold">PSC BQ Tuần này</div>
                        <div class="text-xl font-bold text-emerald-700">${this.formatNumber(metrics.psc.weekThis)}</div>
                        <div class="text-xs text-slate-400 mt-1">Tuần trước: ${this.formatNumber(metrics.psc.weekPrev)} ${getDelta(metrics.psc.weekThis, metrics.psc.weekPrev)}</div>
                    </div>
                    <div class="bg-teal-50 p-3 rounded border border-teal-100">
                        <div class="text-xs text-slate-500 uppercase font-bold">PSC BQ Tháng này</div>
                        <div class="text-xl font-bold text-teal-700">${this.formatNumber(metrics.psc.monthThis)}</div>
                        <div class="text-xs text-slate-400 mt-1">Tháng trước: ${this.formatNumber(metrics.psc.monthPrev)} ${getDelta(metrics.psc.monthThis, metrics.psc.monthPrev)}</div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render Bảng Doanh Thu (Hạ tầng số, Data, Saymee)
     * metrics input format: {
     * hts: { this: 0, prev: 0, ytd: 0 },
     * data: { this: 0, prev: 0, ytd: 0 },
     * saymee: { this: 0, prev: 0, ytd: 0 }
     * }
     */
// ============================================================
// 4.x SỐ LIỆU KINH DOANH — BẢNG CHI TIẾT (kpi_data)
// ============================================================
    renderBusinessKPIDetailTable(rows, opts = {}) {
        const container = document.getElementById('business-data-container');
        if (!container) return;

        const page = Number(opts.page) || 1;
        const pageSize = Number(opts.pageSize) || 50;
        const kpiNameMap = opts.kpiNameMap || {};
        const total = Array.isArray(rows) ? rows.length : 0;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        const p = Math.min(Math.max(1, page), maxPage);

        const startIdx = (p - 1) * pageSize;
        const slice = (rows || []).slice(startIdx, startIdx + pageSize);

        // Pick value by key (case-insensitive), prefer non-empty
        const pick = (r, ...keys) => {
            if (!r) return '';
            const lmap = {};
            Object.keys(r).forEach(k => { lmap[String(k).toLowerCase()] = k; });
            for (const k of keys) {
                if (!k) continue;
                if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k];
                const lk = lmap[String(k).toLowerCase()];
                if (lk && r[lk] !== undefined && r[lk] !== null && String(r[lk]).trim() !== '') return r[lk];
            }
            return '';
        };

        const esc = (v) => String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        // Resolve names from app dictionary (fallback to code)
        const getLienCumName = (code) => {
            const c = String(code || '').trim();
            if (!c) return '';
            try {
                const fn = window.app && typeof window.app.getNameLienCum === 'function' ? window.app.getNameLienCum.bind(window.app) : null;
                const name = fn ? fn(c) : c;
                return name || c;
            } catch (e) { return c; }
        };
        const getCumName = (code) => {
            const c = String(code || '').trim();
            if (!c) return '';
            try {
                const fn = window.app && typeof window.app.getNameCum === 'function' ? window.app.getNameCum.bind(window.app) : null;
                const name = fn ? fn(c) : c;
                return name || c;
            } catch (e) { return c; }
        };

        const getKpiName = (code) => {
            const raw = String(code || '').trim();
            const clean = (window.app && typeof window.app.cleanCode === 'function') ? window.app.cleanCode(raw) : raw;
            return kpiNameMap[raw] || kpiNameMap[clean] || '';
        };

        const fmtChannel = (v) => {
            const s = String(v ?? '').trim();
            if (!s) return '';
            return s.split('-')[0].trim();
        };

        // UI labels mapping (yêu cầu)
        const headers = [
            { id: 'date', label: 'Ngày', align: 'left' },
            { id: 'maNV', label: 'Mã Nhân Viên', align: 'left' },
            { id: 'maLienCum', label: 'Tên Liên Cụm', align: 'left' },
            { id: 'maCum', label: 'Tên Cụm', align: 'left' },
            { id: 'maKpi', label: 'Mã KPI', align: 'left' },
            { id: 'channelType', label: 'Kênh', align: 'left' },

            { id: 'giaTri', label: 'Thuê bao', align: 'right' },
        ];

        const showInfo = () => {
            const mode = opts.mode || 'cum';
            const scopeValue = opts.scopeValue || '';
            const keyword = opts.keyword || '';
            const mFrom = opts.mFrom || '';
            const mTo = opts.mTo || '';
            const modeLabel = mode === 'employee' ? 'Nhân viên' : (mode === 'liencum' ? 'Liên cụm' : 'Cụm');
            const scopeLabel = scopeValue ? esc(scopeValue) : '<span class="text-slate-400">Tất cả</span>';
            const kwLabel = keyword ? esc(keyword) : '<span class="text-slate-400">Không</span>';
            return `
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div class="text-sm text-slate-600">
                        <span class="font-semibold text-slate-800">KPI Data</span>
                        <span class="mx-2 text-slate-300">•</span>
                        <span>Tháng: <span class="font-medium text-slate-800">${esc(mFrom)} → ${esc(mTo)}</span></span>
                        <span class="mx-2 text-slate-300">•</span>
                        <span>Chế độ: <span class="font-medium text-slate-800">${esc(modeLabel)}</span></span>
                        <span class="mx-2 text-slate-300">•</span>
                        <span>Phạm vi: <span class="font-medium text-slate-800">${scopeLabel}</span></span>
                        <span class="mx-2 text-slate-300">•</span>
                        <span>Từ khóa: <span class="font-medium text-slate-800">${kwLabel}</span></span>
                    </div>
                    <div class="text-xs text-slate-500">
                        Tổng dòng: <span class="font-semibold text-slate-800">${this.formatNumber(total)}</span>
                    </div>
                </div>
            `;
        };

        const renderPagination = () => {
            const pageSizes = [20, 50, 100, 200, 500];
            const sizeOptions = pageSizes.map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}/trang</option>`).join('');
            return `
                <div class="flex flex-wrap items-center justify-between gap-3 mt-4">
                    <div class="flex items-center gap-2 text-sm">
                        <button class="px-3 py-1 rounded-lg border hover:bg-slate-50" ${p <= 1 ? 'disabled' : ''} onclick="app.businessGotoPage(${p - 1})">←</button>
                        <div>Trang <span class="font-semibold">${p}</span>/<span class="font-semibold">${maxPage}</span></div>
                        <button class="px-3 py-1 rounded-lg border hover:bg-slate-50" ${p >= maxPage ? 'disabled' : ''} onclick="app.businessGotoPage(${p + 1})">→</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <select class="border rounded-lg px-2 py-1 text-sm" onchange="app.businessSetPageSize(this.value)">
                            ${sizeOptions}
                        </select>
                        <button class="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700" onclick="app.exportBusinessKpiCSV()">
                            Xuất CSV
                        </button>
                    </div>
                </div>
            `;
        };

        if (!slice || slice.length === 0) {
            container.innerHTML = `
                ${showInfo()}
                <div class="p-8 text-center text-slate-500">
                    Không có dữ liệu phù hợp bộ lọc.
                </div>
            `;
            return;
        }

        // Build table header
        const thead = headers.map(h => `
            <th class="p-3 ${h.align === 'right' ? 'text-right' : 'text-left'} whitespace-nowrap">${h.label}</th>
        `).join('');

        // Build rows
        let tbody = '';
        for (let i = 0; i < slice.length; i++) {
            const r = slice[i];

            const d = pick(r, 'date', 'ngay');
            const maNV = pick(r, 'maNV', 'manv');

            const maLC = pick(r, 'maLienCum', 'maliencum', 'lienCum');
            const maC = pick(r, 'maCum', 'macum', 'cum');

            const kpiCode = pick(r, 'maKpi', 'maKPI', 'makpi');
            const kpiName = getKpiName(kpiCode);

           // ✅ KÊNH: chỉ lấy từ channelType
            const chRaw = pick(r, 'channelType');
            const ch = fmtChannel(chRaw);


            // ✅ THUÊ BAO: chỉ lấy từ giaTri (kể cả = 0 vẫn hiển thị)
            const gtRaw = pick(r, 'giaTri');
            const gt = (gtRaw === null || gtRaw === undefined) ? '' : String(gtRaw);

            // -----------------------------------------------------------

            const lcName = getLienCumName(maLC);
            const cName = getCumName(maC);

            const cellLC = maLC ? `
                <div class="font-medium text-slate-800">${esc(lcName)}</div>
                <div class="text-xs text-slate-400">${esc(maLC)}</div>
            ` : '<span class="text-slate-400">-</span>';

            const cellC = maC ? `
                <div class="font-medium text-slate-800">${esc(cName)}</div>
                <div class="text-xs text-slate-400">${esc(maC)}</div>
            ` : '<span class="text-slate-400">-</span>';

            const cellKPI = `
                <div class="font-semibold text-slate-800">${esc(kpiCode || '-') }</div>
                ${kpiName && String(kpiName).trim() && String(kpiName).trim() !== String(kpiCode || '').trim()
                    ? `<div class="text-xs text-slate-500 truncate max-w-[260px]" title="${esc(kpiName)}">${esc(kpiName)}</div>`
                    : ''}
            `;

            const cellCH = ch ? `
                <div class="font-medium text-slate-800" title="${esc(chRaw)}">${esc(ch)}</div>
            ` : '<span class="text-slate-400">-</span>';

            const cellGT = gt ? `<span class="font-mono">${esc(gt)}</span>` : '<span class="text-slate-400">-</span>';

            tbody += `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 whitespace-nowrap">${esc(d || '-')}</td>
                    <td class="p-3 whitespace-nowrap font-mono">${esc(maNV || '-')}</td>
                    <td class="p-3">${cellLC}</td>
                    <td class="p-3">${cellC}</td>
                    <td class="p-3">${cellKPI}</td>
                    <td class="p-3 whitespace-nowrap">${cellCH}</td>
                    <td class="p-3 text-right whitespace-nowrap">${cellGT}</td>
                </tr>
            `;
        }

        container.innerHTML = `
            ${showInfo()}
            <div class="overflow-auto border rounded-xl bg-white">
                <table class="min-w-[980px] w-full text-sm">
                    <thead class="bg-slate-100 text-slate-700 sticky top-0">
                        <tr>${thead}</tr>
                    </thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
            ${renderPagination()}
        `;

        if (window.lucide) window.lucide.createIcons();
    },

    renderDoanhThuSummary(metrics) {
        const tbody = document.getElementById('revenue-summary-body');
        if (!tbody) return;

        const rows = [
            { label: 'Doanh thu Hạ tầng số (Ko Data)', key: 'hts', icon: 'server', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Doanh thu Data', key: 'data', icon: 'wifi', color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Doanh thu Saymee', key: 'saymee', icon: 'smile', color: 'text-pink-600', bg: 'bg-pink-50' }
        ];

        tbody.innerHTML = rows.map(row => {
            const m = metrics[row.key] || { this: 0, prev: 0, ytd: 0 };
            const delta = m.this - m.prev;
            const percent = m.prev > 0 ? ((delta / m.prev) * 100).toFixed(1) : 0;
            const trendColor = delta >= 0 ? 'text-green-600' : 'text-red-500';
            const trendIcon = delta >= 0 ? '▲' : '▼';

            return `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg ${row.bg} ${row.color}">
                            <i data-lucide="${row.icon}" class="w-5 h-5"></i>
                        </div>
                        <span class="font-bold text-slate-700">${row.label}</span>
                    </div>
                </td>
                <td class="p-4 text-right font-mono text-slate-600">${this.formatNumber(m.prev)}</td>
                <td class="p-4 text-right">
                    <div class="font-bold font-mono text-lg text-slate-800">${this.formatNumber(m.this)}</div>
                    <div class="text-[10px] ${trendColor} font-bold">${trendIcon} ${Math.abs(percent)}%</div>
                </td>
                <td class="p-4 text-right font-bold font-mono ${row.color}">${this.formatNumber(m.ytd)}</td>
            </tr>
            `;
        }).join('');
        
        if (window.lucide) lucide.createIcons();
    }
};
