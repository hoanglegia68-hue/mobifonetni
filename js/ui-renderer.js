/* ==========================================================================
 * ui-renderer.js — FINAL VERSION
 * Chức năng: Xử lý hiển thị HTML, cập nhật bảng biểu, Dashboard & Chart
 * ========================================================================== */

const UIRenderer = {
    // ============================================================
    // 1. CÁC HÀM HELPER DÙNG CHUNG (UTILS)
    // ============================================================

    formatNumber(num) {
        if (num === null || num === undefined || num === '') return '0';
        return new Intl.NumberFormat('vi-VN').format(num);
    },

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

    getMapLink(lat, lng, address) {
        if (!lat || !lng) return `<span class="text-slate-500 text-xs">${address || '-'}</span>`;
        return `
            <div class="flex flex-col">
                <span class="text-xs font-medium text-slate-700 truncate max-w-[200px]" title="${address}">${address}</span>
                <a href="http://maps.google.com/maps?q=${lat},${lng}" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <i data-lucide="map-pin" class="w-3 h-3"></i> Xem bản đồ
                </a>
            </div>
        `;
    },

    getStatusBadge(status, date) {
        if (status === 'Nghỉ việc') {
            return `<span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Nghỉ việc (${date || ''})</span>`;
        }
        return `<span class="px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Đang làm việc</span>`;
    },

    getRowClass(status) {
        return status === 'Nghỉ việc' ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white hover:bg-slate-50';
    },

    getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    getDaysRemaining(endDateStr) {
        if (!endDateStr) return 9999;
        let end;
        // Xử lý định dạng dd/mm/yyyy
        if (typeof endDateStr === 'string' && endDateStr.includes('/')) {
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
    // 2. QUẢN LÝ HẠ TẦNG (CLUSTERS/COMMUNES)
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

                    // Cột Liên Cụm (Rowspan)
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
                            </td>`;
                    }

                    // Cột Cụm (Rowspan)
                    if (indexPx === 0) {
                        html += `
                            <td class="border-r border-slate-100 align-top pt-4 w-48" rowspan="${totalRowsCum}">
                                <div class="font-semibold text-slate-700">${cum.tenCum}</div>
                                <div class="text-slate-400 text-[10px] italic">(${cum.maCum})</div>
                                <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <i data-lucide="user" class="w-3 h-3"></i> ${cum.phuTrach}
                                </div>
                            </td>`;
                    }

                    // Xử lý Lãnh đạo xã
                    let leadersHtml = px.lanhDao && px.lanhDao.length > 0 ? px.lanhDao.map(ld => {
                        let badgeClass = (ld.chucVu.includes('Chủ tịch') || ld.chucVu.includes('Bí thư')) ? 'text-blue-700 bg-blue-50' :
                                         (ld.chucVu.includes('CA') || ld.chucVu.includes('Công an')) ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100';
                        return `<div class="text-[10px] mb-1 px-1.5 py-0.5 rounded border border-slate-200 w-fit ${badgeClass}" title="SĐT: ${ld.sdt}">
                                    <span class="opacity-75 font-semibold">${ld.chucVu}:</span> <span>${ld.ten}</span>
                                </div>`;
                    }).join('') : '<span class="text-xs text-slate-300 italic">Chưa cập nhật</span>';

                    // Cột Phường/Xã
                    html += `
                        <td class="font-medium text-slate-800 border-b border-slate-100 p-3">${px.ten}</td>
                        <td class="text-sm border-b border-slate-100 p-3">
                            <div class="flex flex-col gap-1">
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">VLR:</span> <span class="font-mono font-bold text-blue-600">${this.formatNumber(px.vlr)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Dân:</span> <span class="font-mono text-slate-600">${this.formatNumber(px.danSo)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-slate-400 text-xs w-8">Trạm:</span> <span class="font-mono text-emerald-600 font-bold">${px.tram}</span></div>
                            </div>
                        </td>
                        <td class="text-sm border-b border-slate-100 p-3 text-right font-mono">${this.formatAreaKm2(px.dienTich)}</td>
                        <td class="border-b border-slate-100 p-3"><div class="flex flex-col items-start gap-1">${leadersHtml}</div></td>
                        <td class="text-center align-middle border-b border-slate-100 p-3">
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
    // 3. KÊNH & NHÂN SỰ & HẠ TẦNG MẠNG
    // ============================================================

    // 3.1 Cửa hàng
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

            // Logic cảnh báo hết hạn thuê
            if (daysLeft < 0) {
                alertHtml = `<span class="flex items-center text-red-600 font-bold text-xs"><i data-lucide="alert-triangle" class="w-3 h-3 mr-1"></i> QUÁ HẠN (${Math.abs(daysLeft)} ngày)</span>`;
                rowClass = 'bg-red-50';
            } else if (daysLeft <= (app.rentalConfig?.urgentDay || 7)) {
                alertHtml = `<span class="flex items-center text-red-600 font-bold text-xs"><i data-lucide="siren" class="w-3 h-3 mr-1 animate-pulse"></i> CÒN ${daysLeft} NGÀY (GẤP)</span>`;
            } else if (daysLeft <= (app.rentalConfig?.alertDays[1] || 30)) {
                alertHtml = `<span class="flex items-center text-orange-500 font-bold text-xs"><i data-lucide="bell" class="w-3 h-3 mr-1"></i> Còn ${daysLeft} ngày</span>`;
            } else if (daysLeft <= (app.rentalConfig?.alertDays[0] || 60)) {
                alertHtml = `<span class="flex items-center text-yellow-600 font-bold text-xs"><i data-lucide="clock" class="w-3 h-3 mr-1"></i> Sắp hết (${daysLeft} ngày)</span>`;
            } else {
                alertHtml = `<span class="text-slate-400 text-xs">Còn ${daysLeft} ngày</span>`;
            }

            return `
            <tr class="${rowClass} border-b hover:bg-slate-50">
                <td class="p-3 text-center">${idx + 1}</td>
                <td class="p-3 font-bold text-blue-600">${item.id}</td>
                <td class="p-3 font-semibold">${item.ten}</td>
                <td class="p-3 text-sm text-slate-700">${app.getNameLienCum ? app.getNameLienCum(item.maLienCum) : item.maLienCum}</td>
                <td class="p-3 text-sm text-slate-500">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                <td class="p-3">${this.getMapLink(item.lat, item.lng, item.diaChi)}</td>
                <td class="p-3 text-xs">
                    <div class="whitespace-nowrap"><span class="text-slate-500">Dài:</span> <b>${item.dai || '-'}</b>m</div>
                    <div class="whitespace-nowrap"><span class="text-slate-500">Rộng:</span> <b>${item.rong || '-'}</b>m</div>
                    <div class="mt-1 font-bold text-blue-700 bg-blue-50 px-1 rounded w-fit">DT: ${item.dienTich || '-'} m²</div>
                </td>
                <td class="p-3">
                    <div class="text-xs">
                        <div class="text-slate-500">BĐ: <span class="font-mono text-slate-700">${this.formatDateVN(item.ngayThue)}</span></div>
                        <div class="text-slate-500">KT: <span class="font-mono font-bold text-slate-800">${this.formatDateVN(item.ngayHetHan)}</span></div>
                    </div>
                </td>
                <td class="p-3">${alertHtml}</td>
                <td class="p-3 text-sm text-slate-500 italic max-w-[200px] truncate" title="${item.ghiChu || ''}">${item.ghiChu || ''}</td>
            </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    },

    // 3.2 Giao dịch viên
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> 
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs">
                    <div class="font-bold text-blue-600">${item.maCH}</div>
                    <div class="text-slate-500 truncate w-32">${item.tenCH}</div>
                </td>
                <td class="p-3 text-xs">${app.getNameLienCum ? app.getNameLienCum(item.maLienCum) : item.maLienCum}</td>
                <td class="p-3 text-xs">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    },

    // 3.3 Nhân viên bán hàng
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> 
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs">${app.getNameLienCum ? app.getNameLienCum(item.maLienCum) : item.maLienCum}</td>
                <td class="p-3 text-xs">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3"><div class="flex flex-wrap gap-1">${(item.phuongXas || []).map(px => `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-[10px]">${px}</span>`).join('')}</div></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    },

    // 3.4 Kênh B2B
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
                <td class="p-3 font-mono font-bold text-slate-600">${item.maNV}</td> 
                <td class="p-3 font-medium">${item.ten}</td>
                <td class="p-3 text-xs">${app.getNameLienCum ? app.getNameLienCum(item.maLienCum) : item.maLienCum}</td>
                <td class="p-3 text-xs">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                <td class="p-3 text-center"><span class="badge-region">${item.vung}</span></td>
                <td class="p-3 text-xs font-mono">${item.sdt}</td>
                <td class="p-3 text-center">${this.getStatusBadge(item.trangThai, item.ngayNghi)}</td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    },

  // Thay thế hàm renderIndirectTable cũ trong file ui-renderer.js

    renderIndirectTable(data) {
        const tbody = document.getElementById('indirect-list-body');
        if (!tbody) return;

        // Helper: Lấy dữ liệu an toàn từ nhiều tên cột khác nhau (Case insensitive)
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

        // Helper: Xử lý link Google Drive để hiển thị thumbnail nhanh
        const getDisplayUrl = (url) => {
            if (!url) return '';
            // Nếu là link Google Drive, chuyển sang link thumbnail lh3
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://lh3.googleusercontent.com/d/${match[1]}=s100`; // s100 = size 100px
            }
            return url;
        };

        if (!data || data.length === 0) {
            // Colspan = 8 để khớp với header mới
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400">Không tìm thấy dữ liệu điểm bán</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, idx) => {
            // Mapping dữ liệu linh hoạt
            const ten = pick(item, 'ten', 'Ten', 'tenDiemBan', 'Tên Điểm Bán');
            const ma = pick(item, 'maDL', 'MaDL', 'maCode', 'code', 'id', 'Mã ĐL/ĐB');
            const chu = pick(item, 'chuSoHuu', 'ChuSoHuu', 'chu', 'nguoiDaiDien', 'Chủ sở hữu');
            const sdt = pick(item, 'sdt', 'SDT', 'soDienThoai', 'SĐT');
            const phanLoai = pick(item, 'phanloai', 'Phanloai', 'PhanLoai', 'loai', 'Loại'); 
            const tuyen = pick(item, 'tuyen', 'Tuyen', 'tuyenBanHang', 'Tuyến');
            const diaChi = pick(item, 'diaChi', 'DiaChi', 'diachi', 'DC', 'Địa chỉ');
            const lat = pick(item, 'lat', 'Lat', 'ViDo');
            const lng = pick(item, 'lng', 'Lng', 'KinhDo');
            
            const maCum = pick(item, 'maCum', 'MaCum', 'cum', 'Cum') || '-';
            const tenCum = (window.app && app.getNameCum) ? app.getNameCum(maCum) : maCum;

            // Lấy link ảnh (Ưu tiên cột AnhTrong/AnhNgoai)
            const imgTrong = pick(item, 'anhTrong', 'AnhTrong', 'imgInside', 'img1');
            const imgNgoai = pick(item, 'anhNgoai', 'AnhNgoai', 'imgOutside', 'img2');

            // Render 1 ô ảnh
            const renderImgCell = (url, icon) => {
                if (!url || url.length < 5) return `<div class="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300"><i data-lucide="${icon}" class="w-4 h-4"></i></div>`;
                const displayUrl = getDisplayUrl(url);
                return `
                    <div class="relative w-8 h-8 group-img cursor-pointer border border-slate-200 rounded overflow-hidden hover:scale-[3] hover:z-50 hover:shadow-xl transition-all bg-white"
                         onclick="event.stopPropagation(); window.open('${url}', '_blank')">
                        <img src="${displayUrl}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/100?text=Error'">
                    </div>
                `;
            };

            // Badge phân loại
            let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
            const loaiLower = String(phanLoai).toLowerCase();
            if (loaiLower.includes('loại 1') || loaiLower.includes('chiến lược')) badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
            else if (loaiLower.includes('loại 2') || loaiLower.includes('tiềm năng')) badgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            else if (loaiLower.includes('c2c')) badgeClass = 'bg-orange-100 text-orange-700 border-orange-200';

            return `
            <tr class="bg-white border-b hover:bg-blue-50/30 transition group">
                <td class="p-3 text-center text-slate-500 text-xs font-medium border-r border-dashed border-slate-100">${idx + 1}</td>
                
                <td class="p-3 align-top">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700 text-sm group-hover:text-blue-700 transition">${ten || '---'}</span>
                        <span class="font-mono text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><i data-lucide="hash" class="w-3 h-3"></i> ${ma || '---'}</span>
                    </div>
                </td>

                <td class="p-3 align-top">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-slate-700">${chu || '---'}</span>
                        ${sdt ? `<a href="tel:${sdt}" class="text-xs text-slate-500 mt-1 hover:text-blue-600 flex items-center gap-1 w-fit"><i data-lucide="phone" class="w-3 h-3"></i> ${sdt}</a>` : ''}
                    </div>
                </td>

                <td class="p-3 align-top">
                    <div class="flex flex-col items-start gap-1">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${phanLoai || 'Đại lý'}</span>
                        ${tuyen ? `<span class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><i data-lucide="route" class="w-3 h-3 text-slate-400"></i> Tuyến: <b class="text-slate-600">${tuyen}</b></span>` : ''}
                    </div>
                </td>

                <td class="p-3 align-top max-w-[200px]">
                    ${this.getMapLink(lat, lng, diaChi)}
                </td>

                <td class="p-3 text-center align-top">
                     <div class="flex flex-col items-center">
                        <span class="font-bold text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100 whitespace-nowrap">${tenCum}</span>
                        ${tenCum !== maCum ? `<span class="text-[9px] text-slate-400 mt-0.5">(${maCum})</span>` : ''}
                     </div>
                </td>

                <td class="p-3 text-center align-middle">
                    <div class="flex gap-2 justify-center">
                        ${renderImgCell(imgTrong, 'image')}
                        ${renderImgCell(imgNgoai, 'camera')}
                    </div>
                </td>

                <td class="p-3 text-center align-middle">
                     <button onclick="app.openEditIndirectModal('${ma}')" 
                            class="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm transition"
                            title="Chỉnh sửa & Upload ảnh">
                        <i data-lucide="file-pen-line" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
        
        if (window.lucide) lucide.createIcons();
    },
    // 3.6 Trạm BTS
    renderBTSTable(data) {
        const tbody = document.getElementById('bts-list-body');
        if (!tbody) return;

        // Helper trích xuất an toàn
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

        const safe = (v) => {
            if (v === null || v === undefined) return '-';
            const s = String(v).trim();
            return s === '' ? '-' : s;
        };

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="24" class="text-center p-4 text-slate-400">Không tìm thấy dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, idx) => {
            // Mapping fields
            const maTram = pick(item, 'maTram', 'Mã Trạm', 'matram');
            const loaiTram = pick(item, 'loaitram', 'Loại trạm');
            const maLienCum = pick(item, 'maLienCum', 'Mã Liên Cụm');
            const maCum = pick(item, 'maCum', 'Mã Cụm');
            const diaChi = pick(item, 'diaChi', 'Địa chỉ');
            const lat = pick(item, 'lat', 'Lat');
            const lng = pick(item, 'lng', 'Lng');

            return `
                <tr class="bg-white border-b hover:bg-slate-50 transition">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3 font-mono font-bold text-slate-700">${safe(maTram)}</td>
                    <td class="p-3 text-sm">${safe(loaiTram)}</td>
                    <td class="p-3 text-xs">${app.getNameLienCum ? app.getNameLienCum(maLienCum) : safe(maLienCum)}</td>
                    <td class="p-3 text-xs">${app.getNameCum ? app.getNameCum(maCum) : safe(maCum)}</td>
                    <td class="p-3">${this.getMapLink(lat, lng, diaChi)}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'VLR 3G'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'VLR 4G'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'ASIM'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'GTEL'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'VNSKY'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'SAYMEE'))}</td>
                    <td class="p-3 text-right font-semibold">${safe(pick(item, 'M2M - Tổng'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'Data (GB/BQN)'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'CSG'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'TBAON_ACTIVE'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'PORTAON_EMTY'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'OLT'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'TBGPON_ACTIVE'))}</td>
                    <td class="p-3 text-right">${safe(pick(item, 'LINEGPON_EMTY'))}</td>
                    <td class="p-3 text-sm italic text-slate-500">${safe(pick(item, 'ghiChu', 'Ghi chú'))}</td>
                    <td class="p-3 text-center">
                        <button onclick="app.openEditModal()" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full admin-only">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 4. SỐ LIỆU KPI & KẾ HOẠCH
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

        const thead = document.getElementById('kpi-header');
        if (thead) {
            let headerHtml = `
                <tr>
                    <th rowspan="2" class="w-12 text-center sticky left-0 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">#</th>
                    <th rowspan="2" class="min-w-[150px] sticky left-12 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Đơn vị</th>
                    <th rowspan="2" class="w-20">Thời gian</th>`;

            let subHeaderHtml = '<tr>';
            structure.forEach(kpi => {
                headerHtml += `<th colspan="2" class="text-center min-w-[200px]">${kpi.tenHienThi} (${kpi.dvt})</th>`;
                subHeaderHtml += `
                    <th class="text-right w-24 border-t border-r border-slate-200">Thực hiện</th>
                    <th class="text-right w-24 border-t border-slate-200">Kế hoạch</th>`;
            });

            headerHtml += '</tr>';
            subHeaderHtml += '</tr>';
            thead.innerHTML = headerHtml + subHeaderHtml;
        }

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
                <td class="p-3 text-sm font-medium border-r text-slate-600">${item.month || ''}</td>`;

            structure.forEach(kpi => {
                const cleanKey = app.cleanCode ? app.cleanCode(kpi.ma) : kpi.ma;
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
                    <td class="p-3 text-right font-medium border-r ${item.isTotal ? 'bg-blue-100' : 'text-slate-500'}">${planVal}</td>`;
            });

            tr.innerHTML = rowHtml;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    },

    renderPlanningTable(rows, kpiStructure, planMap = {}) {
        const table = document.getElementById('table-kehoach');
        if (!table) return;

        // Tính tổng
        const colTotals = {};
        kpiStructure.forEach(k => colTotals[k.ma] = 0);
        rows.forEach(row => {
            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const val = Number(planMap[key]) || 0;
                colTotals[kpi.ma] += val;
            });
        });

        // Header
        let theadHtml = `
            <tr>
                <th class="w-12 text-center p-3 border font-bold text-slate-800 bg-slate-200 sticky top-0 left-0 z-[60] shadow-md border-b-2 border-slate-300">STT</th>
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[200px] sticky top-0 left-12 z-[60] shadow-md border-b-2 border-slate-300">Đơn vị (Cụm)</th> 
                <th class="p-3 border font-bold text-slate-800 bg-slate-200 text-left min-w-[120px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">Liên Cụm</th>`;

        kpiStructure.forEach(kpi => {
            theadHtml += `<th class="p-3 border font-bold text-slate-800 bg-slate-200 text-right min-w-[140px] sticky top-0 z-50 shadow-sm border-b-2 border-slate-300">${kpi.tenHienThi} <br> <span class="text-[10px] font-normal text-slate-600 italic">(${kpi.dvt})</span></th>`;
        });
        theadHtml += `</tr>`;

        let thead = table.querySelector('thead');
        if (!thead) { thead = document.createElement('thead'); table.appendChild(thead); }
        thead.innerHTML = theadHtml;

        // Body
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
                    <td class="p-3 text-sm text-slate-500 border-r text-xs">${app.getNameLienCum ? app.getNameLienCum(row.maLienCum) : row.maLienCum}</td>`;

            kpiStructure.forEach(kpi => {
                const key = `${row.maCum}_${kpi.ma}`;
                const rawVal = planMap[key];
                const displayVal = rawVal !== undefined ? new Intl.NumberFormat('vi-VN').format(rawVal) : '';
                rowHtml += `<td class="p-2 border-r"><input type="text" class="plan-input w-full text-right border border-slate-200 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-semibold text-slate-700 focus:bg-white bg-slate-50/30" placeholder="-" data-cum="${row.maCum}" data-kpi="${kpi.ma}" value="${displayVal}" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"></td>`;
            });
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');

        // Footer (Total)
        let tfoot = table.querySelector('tfoot');
        if (tfoot) tfoot.remove();
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);

        let tfootHtml = `
            <tr class="bg-yellow-100 font-bold text-slate-800 border-t-2 border-yellow-300 shadow-inner sticky bottom-0 z-50">
                <td class="p-3 text-center sticky left-0 z-[60] bg-yellow-100 border-r border-yellow-200 border-t-2 border-yellow-300">#</td>
                <td class="p-3 text-left sticky left-12 z-[60] bg-yellow-100 border-r border-yellow-200 uppercase tracking-wider text-xs border-t-2 border-yellow-300">Tổng cộng</td>
                <td class="p-3 border-r border-yellow-200 bg-yellow-100"></td>`;
        kpiStructure.forEach(kpi => {
            const totalVal = colTotals[kpi.ma] || 0;
            const displayTotal = totalVal > 0 ? new Intl.NumberFormat('vi-VN').format(totalVal) : '-';
            tfootHtml += `<td class="p-3 text-right border-r border-yellow-200 text-blue-800 text-sm bg-yellow-100">${displayTotal}</td>`;
        });
        tfootHtml += `</tr>`;
        tfoot.innerHTML = tfootHtml;
    },

    // ============================================================
    // 5. USER LOGS & STATS (PHÂN QUYỀN & LỊCH SỬ)
    // ============================================================

    renderUserLogFilter(listCum, selectedCum = "") {
        const container = document.getElementById('filter-container-user');
        if (!container) return;

        let options = `<option value="">-- Chọn Đơn vị (Cụm) --</option>`;
        listCum.forEach(cumCode => {
            const tenCum = app.getNameCum ? app.getNameCum(cumCode) : cumCode;
            const isSelected = cumCode === selectedCum ? 'selected' : '';
            options += `<option value="${cumCode}" ${isSelected}>${tenCum || cumCode}</option>`;
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
                 onclick="app.handleUserFilterChange('${item.maCum}'); if(document.getElementById('user-filter-select')) document.getElementById('user-filter-select').value='${item.maCum}';">
                <span class="text-[10px] uppercase font-bold text-slate-500 truncate" title="${item.tenCum}">${item.tenCum}</span>
                <div class="flex justify-between items-end mt-1">
                    <span class="text-lg font-bold text-blue-700 leading-none">${item.userCount}</span>
                    <span class="text-[10px] text-slate-400">users</span>
                </div>
            </div>`).join('');
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
                <div class="flex flex-col items-center gap-2"><i data-lucide="filter" class="w-8 h-8 opacity-50"></i><span>Vui lòng chọn Cụm để xem chi tiết</span></div>
            </td></tr>`;
            if (window.lucide) lucide.createIcons();
            return;
        }
        tbody.innerHTML = data.map((item, i) => `
            <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                <td class="p-3 text-center text-slate-500 font-medium border-r">${i + 1}</td>
                <td class="p-3 font-bold text-blue-700 font-mono text-sm border-r">${item.maNV}</td>
                <td class="p-3 text-sm text-slate-700 border-r">${item.channelStr || '-'}</td>
                <td class="p-3 text-sm text-slate-600 border-r">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                <td class="p-3 text-sm text-slate-500 text-xs border-r">${app.getNameLienCum ? app.getNameLienCum(item.maLienCum) : item.maLienCum}</td>
                <td class="p-3 text-right"><span class="text-xs font-bold text-slate-400">${item.totalLogs} records</span></td>
            </tr>`).join('');
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 6. DASHBOARD CHÍNH
    // ============================================================

    async renderDashboard(filterScope = 'all') {
        // Giả định DataService đã được định nghĩa
        const allClusters = await DataService.getClusters();
        const allStores = await DataService.getStores();
        const allBts = await DataService.getBTS();
        const allGdvs = await DataService.getGDVs();
        const allSales = await DataService.getSalesStaff();
        const allB2B = await DataService.getB2BStaff();
        const allIndirect = await DataService.getIndirectChannels();

        // Setup Dropdown Scope
        const select = document.getElementById('dashboard-scope-select');
        if (select && select.querySelectorAll('optgroup').length === 0) {
            select.innerHTML = '<option value="all">Toàn Công Ty</option>';
            const lcGroup = document.createElement('optgroup');
            lcGroup.label = "--- LIÊN CỤM ---";
            allClusters.forEach(c => { lcGroup.innerHTML += `<option value="${c.maLienCum}">${c.tenLienCum}</option>`; });
            select.appendChild(lcGroup);
            const cGroup = document.createElement('optgroup');
            cGroup.label = "--- CỤM ---";
            allClusters.forEach(lc => { lc.cums.forEach(c => { cGroup.innerHTML += `<option value="${c.maCum}">${c.tenCum} (${lc.tenLienCum})</option>`; }); });
            select.appendChild(cGroup);
            select.value = filterScope;
        }

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
            if (foundLC) { foundLC.cums.forEach(c => communes.push(...c.phuongXas)); }
            else {
                allClusters.forEach(lc => {
                    const foundCum = lc.cums.find(c => c.maCum === filterScope);
                    if (foundCum) communes.push(...foundCum.phuongXas);
                });
            }
        }

        const totalVLR = communes.reduce((sum, px) => sum + (Number(px.vlr) || 0), 0);
        const totalPop = communes.reduce((sum, px) => sum + (Number(px.danSo) || 0), 0);
        const totalArea = communes.reduce((sum, px) => sum + (Number(px.dienTich || px.dientich) || 0), 0);
        const storesExpiring = stores.filter(s => s.ngayHetHan && this.getDaysRemaining(s.ngayHetHan) < 30).length;
        const countActive = (list) => list.filter(i => i.trangThai !== 'Nghỉ việc').length;

        // Render Cards (Infrastructure)
        const infraEl = document.getElementById('dashboard-infrastructure');
        if (infraEl) {
            infraEl.innerHTML = `
                <div onclick="app.showDashboardDetail('store', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Cửa Hàng</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(stores.length)}</h3></div>
                        <div class="p-2 bg-blue-50 text-blue-600 rounded-lg"><i data-lucide="store" class="w-6 h-6"></i></div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-100 text-sm flex justify-between">
                        <span class="text-slate-500">Sắp hết hạn:</span> <span class="font-bold ${storesExpiring > 0 ? 'text-red-500' : ''}">${storesExpiring}</span>
                    </div>
                </div>
                <div onclick="app.showDashboardDetail('geo', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-yellow-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Địa Lý & Dân Số</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(communes.length)}</h3></div>
                        <div class="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><i data-lucide="map" class="w-6 h-6"></i></div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div class="flex justify-between items-center"><span>VLR:</span> <span class="font-bold text-blue-700">${this.formatNumber(totalVLR)}</span></div>
                        <div class="flex justify-between items-center"><span>Dân số:</span> <span class="font-bold">${this.formatNumber(totalPop)}</span></div>
                        <div class="flex justify-between items-center"><span>Diện tích:</span> <span class="font-bold">${this.formatAreaKm2(totalArea)}</span></div>
                    </div>
                </div>
                <div onclick="app.showDashboardDetail('indirect', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-cyan-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Điểm Bán</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(indirect.length)}</h3></div>
                        <div class="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><i data-lucide="shopping-bag" class="w-6 h-6"></i></div>
                    </div>
                </div>
                <div onclick="app.showDashboardDetail('bts', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-indigo-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-center">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Trạm BTS</p><h3 class="text-3xl font-bold text-slate-800">${this.formatNumber(bts.length)}</h3></div>
                        <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><i data-lucide="tower-control" class="w-6 h-6"></i></div>
                    </div>
                </div>`;
        }

        // Render Cards (HR)
        const hrEl = document.getElementById('dashboard-hr');
        if (hrEl) {
            hrEl.innerHTML = `
                <div onclick="app.showDashboardDetail('gdv', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Giao Dịch Viên</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(gdvs))}</h3></div>
                        <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><i data-lucide="users" class="w-6 h-6"></i></div>
                    </div>
                </div>
                <div onclick="app.showDashboardDetail('sales', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-orange-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">NV Bán Hàng</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(sales))}</h3></div>
                        <div class="p-2 bg-orange-50 text-orange-600 rounded-lg"><i data-lucide="briefcase" class="w-6 h-6"></i></div>
                    </div>
                </div>
                <div onclick="app.showDashboardDetail('b2b', '${filterScope}')" class="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-500 hover:shadow-md transition-shadow cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div><p class="text-slate-500 text-sm font-medium uppercase">Kênh KHDN</p><h3 class="text-3xl font-bold text-slate-800 mt-1">${this.formatNumber(countActive(b2b))}</h3></div>
                        <div class="p-2 bg-purple-50 text-purple-600 rounded-lg"><i data-lucide="building-2" class="w-6 h-6"></i></div>
                    </div>
                </div>`;
        }

        // Render Breakdown Table
        let displayItems = [];
        let viewMode = 'liencum';
        if (filterScope === 'all') {
            displayItems = allClusters.map(lc => ({ code: lc.maLienCum, name: lc.tenLienCum, subCount: lc.cums.length, type: 'Liên Cụm', filterKey: 'maLienCum' }));
        } else {
            const foundLC = allClusters.find(c => c.maLienCum === filterScope);
            if (foundLC) {
                viewMode = 'cum';
                displayItems = foundLC.cums.map(c => ({ code: c.maCum, name: c.tenCum, subCount: c.phuongXas.length, type: 'Cụm', filterKey: 'maCum' }));
            } else {
                viewMode = 'cum_detail';
                allClusters.forEach(lc => {
                    const c = lc.cums.find(x => x.maCum === filterScope);
                    if (c) displayItems = [{ code: c.maCum, name: c.tenCum, subCount: c.phuongXas.length, type: 'Cụm', filterKey: 'maCum' }];
                });
            }
        }

        const tbody = document.getElementById('dashboard-breakdown-body');
        if (tbody) {
            tbody.innerHTML = displayItems.map((item, idx) => {
                const cStore = allStores.filter(i => i[item.filterKey] === item.code).length;
                const cGdv = allGdvs.filter(i => i[item.filterKey] === item.code).length;
                const cSale = allSales.filter(i => i[item.filterKey] === item.code).length;
                const cAgency = allIndirect.filter(i => i[item.filterKey] === item.code).length;
                const cBts = allBts.filter(i => i[item.filterKey] === item.code).length;
                
                const makeLink = (count, type, cssClass) => count === 0 ? `<span class="text-slate-300">-</span>` : `<button onclick="app.showDashboardDetail('${type}', '${item.code}')" class="${cssClass} px-2 py-0.5 rounded shadow-sm text-xs hover:scale-110 transition-transform">${count}</button>`;
                const subType = item.type === 'Liên Cụm' ? 'list_cum' : 'commune';

                return `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${item.code}</div>
                    </td>
                    <td class="p-3 text-center"><button onclick="app.showDashboardDetail('${subType}', '${item.code}')" class="bg-slate-100 px-2 py-1 rounded text-xs font-bold">${item.subCount}</button></td>
                    <td class="p-3 text-center">${makeLink(cStore, 'store', 'text-blue-700 bg-blue-50')}</td>
                    <td class="p-3 text-center">${makeLink(cGdv, 'gdv', 'text-emerald-700 bg-emerald-50')}</td>
                    <td class="p-3 text-center">${makeLink(cSale, 'sales', 'text-orange-700 bg-orange-50')}</td>
                    <td class="p-3 text-center">${makeLink(cAgency, 'indirect', 'text-cyan-700 bg-cyan-50')}</td>
                    <td class="p-3 text-center">${makeLink(cBts, 'bts', 'text-indigo-700 bg-indigo-50')}</td>
                </tr>`;
            }).join('');
        }
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 7. VẼ BIỂU ĐỒ (CHART.JS)
    // ============================================================

    renderKPIReport(data, filterInfo) {
        const chartIds = ['chartSubDaily', 'chartSubChannel', 'chartSubCluster', 'chartRevDaily', 'chartRevChannel', 'chartRevCluster'];
        if (!app.chartInstances) app.chartInstances = {};
        
        // Reset chart cũ
        chartIds.forEach(id => {
            if (app.chartInstances[id]) {
                app.chartInstances[id].destroy();
                delete app.chartInstances[id];
            }
        });

        // Update Stats Widgets
        const updateWidget = (prefix, actual, plan) => {
            const elActual = document.getElementById(`stat-${prefix}-actual`);
            const elPlan = document.getElementById(`stat-${prefix}-plan`);
            const elPercent = document.getElementById(`stat-${prefix}-percent`);
            const elProg = document.getElementById(`prog-${prefix}`);

            if (elActual) {
                elActual.textContent = this.formatNumber(actual);
                elActual.onclick = () => { if (app.showKPIBreakdown) app.showKPIBreakdown(prefix, 'cum'); };
                elActual.classList.add('cursor-pointer', 'hover:text-blue-600', 'transition');
            }
            if (elPlan) elPlan.textContent = this.formatNumber(plan);
            
            const percent = plan > 0 ? Math.round((actual / plan) * 100) : (actual > 0 ? 100 : 0);
            if (elPercent) elPercent.textContent = `${percent}%`;
            
            if (elProg) {
                elProg.style.width = `${Math.min(percent, 100)}%`;
                elProg.className = `h-2 rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-green-500' : (percent >= 80 ? 'bg-yellow-500' : 'bg-red-500')}`;
            }
        };

        if (data.sub) updateWidget('sub', data.sub.actual, data.sub.plan);
        if (data.rev) updateWidget('rev', data.rev.actual, data.rev.plan);

        if (data.sub && data.sub.metrics) {
            const m = data.sub.metrics;
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = this.formatNumber(val);
            };
            const elAvg = document.getElementById('stat-sub-avgday');
            if (elAvg) elAvg.textContent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(m.avgDaily?.value || 0);

            setTxt('stat-sub-wtd', m.week?.curr);
            setTxt('stat-sub-mtd', m.month?.curr);
            setTxt('stat-sub-ytd', m.year?.curr);
        }

        // Helper Charts
        const createLineChart = (canvasId, dailyData, colorHex) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const dates = Object.keys(dailyData).sort();
            const values = dates.map(d => dailyData[d]);
            const labels = dates.map(d => {
                const parts = d.split('-'); 
                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
            });

            app.chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Thực hiện',
                        data: values,
                        borderColor: colorHex,
                        backgroundColor: colorHex + '10',
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        };

        const createDoughnutChart = (canvasId, channelData) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !channelData) return;
            const labels = Object.keys(channelData);
            const values = Object.values(channelData);
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

            app.chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }
                }
            });
        };

        const createBarChart = (canvasId, clusterData, colorHex) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !clusterData) return;
            const sorted = Object.entries(clusterData).sort(([,a], [,b]) => b - a).slice(0, 10);
            const labels = sorted.map(([k]) => k);
            const values = sorted.map(([,v]) => v);

            app.chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Sản lượng', data: values, backgroundColor: colorHex, borderRadius: 4 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        y: { grid: { display: false } }
                    }
                }
            });
        };

        if (data.sub) {
            createLineChart('chartSubDaily', data.sub.daily, '#10b981');
            createDoughnutChart('chartSubChannel', data.sub.channel);
            createBarChart('chartSubCluster', data.sub.cluster, '#10b981');
        }
        
        if (data.rev) {
            createLineChart('chartRevDaily', data.rev.daily, '#3b82f6');
            createDoughnutChart('chartRevChannel', data.rev.channel);
            createBarChart('chartRevCluster', data.rev.cluster, '#3b82f6');
        }
    },

    // ============================================================
    // 8. MODAL CHI TIẾT (GENERIC)
    // ============================================================

    renderDetailModalContent(type, data, meta = {}) {
        const thead = document.getElementById('modal-detail-thead');
        const tbody = document.getElementById('modal-detail-tbody');
        const scrollView = document.getElementById('modal-scroll-view');
        
        if (scrollView) scrollView.scrollTop = 0;
        if (!thead || !tbody) return;

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400 italic">Không có dữ liệu chi tiết</td></tr>`;
            return;
        }

        let headerHtml = '';
        let bodyHtml = '';

        // CASE 1: STAFF PERFORMANCE
        if (type === 'staff-performance') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center w-16 bg-slate-100 font-bold text-slate-700 sticky top-0 z-20">Hạng</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700 sticky top-0 z-20">Nhân viên</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold text-slate-700 sticky top-0 z-20">Đơn vị</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700 sticky top-0 z-20">Kế hoạch</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold text-slate-700 sticky top-0 z-20">Thực hiện</th>
                    <th class="p-3 border-b text-center bg-slate-100 w-32 font-bold text-slate-700 sticky top-0 z-20">% HT</th>
                </tr>`;

            let sumPlan = 0, sumActual = 0;
            
            bodyHtml = data.map((item, idx) => {
                const plan = Number(item.plan) || 0;
                const actual = Number(item.actual) || 0;
                sumPlan += plan;
                sumActual += actual;
                const pct = Number(item.percent) || 0;
                let colorClass = pct >= 100 ? 'bg-emerald-500' : (pct >= 80 ? 'bg-blue-500' : 'bg-red-500');

                let rankDisplay = `<span class="font-mono text-slate-500 font-bold">#${idx + 1}</span>`;
                let rowBg = "hover:bg-slate-50";

                if (idx === 0) {
                    rankDisplay = `<div class="mx-auto w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm"><i data-lucide="trophy" class="w-4 h-4"></i></div>`;
                    rowBg = "bg-yellow-50/40 hover:bg-yellow-50";
                } else if (idx === 1) {
                    rankDisplay = `<div class="mx-auto w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">2</div>`;
                    rowBg = "bg-slate-50/40 hover:bg-slate-100";
                } else if (idx === 2) {
                    rankDisplay = `<div class="mx-auto w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">3</div>`;
                    rowBg = "bg-orange-50/40 hover:bg-orange-100";
                }
                
                return `
                <tr class="border-b ${rowBg} transition-colors">
                    <td class="p-3 text-center align-middle">${rankDisplay}</td>
                    <td class="p-3 align-middle">
                        <div class="font-bold text-slate-700">${item.name || item.ten}</div>
                        <div class="text-[10px] font-mono text-slate-400">${item.code || item.maNV || ''}</div>
                    </td>
                    <td class="p-3 text-sm text-slate-600 align-middle">${app.getNameCum ? app.getNameCum(item.maCum) : (item.maCum || '-')}</td>
                    <td class="p-3 text-right font-mono text-slate-600 align-middle">${this.formatNumber(plan)}</td>
                    <td class="p-3 text-right font-bold font-mono text-blue-700 align-middle">${this.formatNumber(actual)}</td>
                    <td class="p-3 align-middle">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold w-10 text-right ${pct >= 100 ? 'text-emerald-600' : 'text-slate-600'}">${pct}%</span>
                            <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div class="h-full ${colorClass}" style="width: ${Math.min(pct, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            const totalPct = sumPlan > 0 ? ((sumActual / sumPlan) * 100).toFixed(1) : 0;
            bodyHtml += `
                <tr class="bg-blue-50/80 font-bold border-t-2 border-blue-100 sticky bottom-0 shadow-sm z-20">
                    <td colspan="3" class="p-3 text-center uppercase text-blue-800 text-xs tracking-wider">Tổng cộng</td>
                    <td class="p-3 text-right font-mono text-blue-800">${this.formatNumber(sumPlan)}</td>
                    <td class="p-3 text-right font-mono text-blue-800">${this.formatNumber(sumActual)}</td>
                    <td class="p-3 text-right text-blue-800">${totalPct}%</td>
                </tr>`;
        }
        
        // CASE 2: KPI BREAKDOWN
        else if (type === 'kpi-breakdown') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b text-center w-12 bg-slate-100 font-bold sticky top-0 z-20">STT</th>
                    <th class="p-3 border-b text-left bg-slate-100 font-bold sticky top-0 z-20">Đơn vị</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold sticky top-0 z-20">Kế hoạch</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold sticky top-0 z-20">Thực hiện</th>
                    <th class="p-3 border-b text-center bg-slate-100 font-bold sticky top-0 z-20">% HT</th>
                    <th class="p-3 border-b text-right bg-slate-100 font-bold sticky top-0 z-20">Tỷ trọng</th>
                </tr>`;
            
            const totalActual = data.reduce((sum, i) => sum + (Number(i.actual)||0), 0);
            
            bodyHtml = data.map((item, idx) => {
                const plan = Number(item.plan) || 0;
                const actual = Number(item.actual) || 0;
                const pct = plan > 0 ? ((actual / plan) * 100).toFixed(1) : 0;
                const contribution = totalActual > 0 ? ((actual / totalActual) * 100).toFixed(1) : 0;
                
                return `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                    <td class="p-3 font-medium text-blue-700">${item.name}</td>
                    <td class="p-3 text-right font-mono text-slate-500">${this.formatNumber(plan)}</td>
                    <td class="p-3 text-right font-mono font-bold text-slate-700">${this.formatNumber(actual)}</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-1 rounded text-xs font-bold ${pct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}">
                            ${pct}%
                        </span>
                    </td>
                    <td class="p-3 text-right text-xs text-slate-400">${contribution}%</td>
                </tr>`;
            }).join('');
        }

        // CASE 3: STORE DETAIL
        else if (type === 'store') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Tên Cửa Hàng</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Địa chỉ</th>
                    <th class="p-3 border-b bg-slate-100 text-center sticky top-0 z-20">Hết hạn</th>
                </tr>`;
            
            bodyHtml = data.map(item => {
                let status = '<span class="text-slate-400">-</span>';
                if (item.ngayHetHan) {
                    const today = new Date();
                    const expDate = new Date(item.ngayHetHan);
                    const diffTime = expDate - today;
                    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (daysLeft < 0) {
                        status = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Quá hạn ${Math.abs(daysLeft)} ngày</span>`;
                    } else if (daysLeft < 30) {
                        status = `<span class="text-red-600 font-bold text-xs">Còn ${daysLeft} ngày</span>`;
                    } else {
                        status = `<span class="text-emerald-600 text-xs font-medium">${daysLeft} ngày</span>`;
                    }
                }

                return `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3">
                        <div class="font-bold text-blue-700">${item.ten}</div>
                        <div class="text-xs text-slate-500">${item.id || item.maCH || ''}</div>
                    </td>
                    <td class="p-3 text-sm">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                    <td class="p-3 text-xs text-slate-600 truncate max-w-[200px]" title="${item.diaChi}">${item.diaChi || '-'}</td>
                    <td class="p-3 text-center">${status}</td>
                </tr>`;
            }).join('');
        }

        // CASE 4: HUMAN RESOURCES (GDV, SALES, B2B)
        else if (['gdv', 'sales', 'b2b'].includes(type)) {
             headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Mã NV</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Họ tên</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 text-center sticky top-0 z-20">Trạng thái</th>
                </tr>`;
            
            bodyHtml = data.map(item => `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-mono text-slate-600 font-bold">${item.maNV}</td>
                    <td class="p-3 font-medium text-slate-800">${item.ten}</td>
                    <td class="p-3 text-sm text-slate-500">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                    <td class="p-3 text-center text-xs">
                        ${this.getStatusBadge ? this.getStatusBadge(item.trangThai) : `<span class="badge badge-outline">${item.trangThai}</span>`}
                    </td>
                </tr>`).join('');
        }
        
        // CASE 5: BTS
        else if (type === 'bts') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Mã Trạm</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Loại</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Đơn vị</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">VLR (4G)</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">Data (GB)</th>
                </tr>`;
            
            bodyHtml = data.map(item => `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-bold text-blue-700">${item['Mã Trạm'] || item.maTram}</td>
                    <td class="p-3 text-sm"><span class="bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-xs">${item['Loại trạm'] || item.loai || '-'}</span></td>
                    <td class="p-3 text-sm text-slate-500">${app.getNameCum ? app.getNameCum(item.maCum) : item.maCum}</td>
                    <td class="p-3 text-right font-mono text-slate-700">${this.formatNumber(item['VLR 4G'] || item.vlr)}</td>
                    <td class="p-3 text-right font-mono text-slate-700">${this.formatNumber(item['Data (GB/BQN)'] || item.data)}</td>
                </tr>`).join('');
        }

        // CASE 6: LIST CUM
        else if (type === 'list_cum') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Mã Cụm</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Tên Cụm</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Phụ trách</th>
                    <th class="p-3 border-b bg-slate-100 text-center sticky top-0 z-20">Số Xã</th>
                </tr>`;
            bodyHtml = data.map(item => `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-mono font-bold text-slate-600">${item.maCum}</td>
                    <td class="p-3 font-bold text-blue-700">${item.tenCum}</td>
                    <td class="p-3 text-sm text-slate-500">${item.phuTrach || '-'}</td>
                    <td class="p-3 text-center font-bold text-slate-700">${item.phuongXas ? item.phuongXas.length : 0}</td>
                </tr>`).join('');
        }

        // CASE 7: COMMUNES
        else if (type === 'commune') {
             headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Phường/Xã</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">Dân Số</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">Diện Tích</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">VLR</th>
                    <th class="p-3 border-b bg-slate-100 text-right sticky top-0 z-20">Trạm</th>
                </tr>`;
            
            bodyHtml = data.map(item => `
                <tr class="border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-medium text-slate-700">${item.ten}</td>
                    <td class="p-3 text-right font-mono text-slate-600">${this.formatNumber(item.danSo)}</td>
                    <td class="p-3 text-right font-mono text-slate-600">${this.formatAreaKm2(item.dienTich)}</td>
                    <td class="p-3 text-right font-mono font-bold text-blue-600">${this.formatNumber(item.vlr)}</td>
                    <td class="p-3 text-right font-mono font-bold text-emerald-600">${item.tram}</td>
                </tr>`).join('');
        }
        
        // ... (Các case phía trên giữ nguyên)

        // CASE 8: INDIRECT (ĐÃ SỬA: Render trực tiếp vào Modal thay vì gọi hàm renderIndirectTable)
        else if (type === 'indirect') {
            headerHtml = `
                <tr>
                    <th class="p-3 border-b bg-slate-100 text-center w-12 sticky top-0 z-20">STT</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Tên Điểm Bán / Mã</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Chủ / SĐT</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Phân Loại & Tuyến</th>
                    <th class="p-3 border-b bg-slate-100 text-left sticky top-0 z-20">Địa chỉ</th>
                    <th class="p-3 border-b bg-slate-100 text-center sticky top-0 z-20">Cụm</th>
                    <th class="p-3 border-b bg-slate-100 text-center sticky top-0 z-20">Hình ảnh</th>
                </tr>`;

            // Helper: Lấy dữ liệu an toàn (Copy từ renderIndirectTable vì phạm vi biến cục bộ)
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

            // Helper: Xử lý link Google Drive thumbnail
            const getDisplayUrl = (url) => {
                if (!url) return '';
                const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}=s100`;
                return url;
            };

            // Helper: Render ô ảnh
            const renderImgCell = (url, icon) => {
                if (!url || url.length < 5) return `<div class="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300"><i data-lucide="${icon}" class="w-4 h-4"></i></div>`;
                const displayUrl = getDisplayUrl(url);
                return `
                    <div class="relative w-8 h-8 group-img cursor-pointer border border-slate-200 rounded overflow-hidden hover:scale-[3] hover:z-50 hover:shadow-xl transition-all bg-white"
                         onclick="event.stopPropagation(); window.open('${url}', '_blank')">
                        <img src="${displayUrl}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/100?text=Error'">
                    </div>`;
            };

            bodyHtml = data.map((item, idx) => {
                const ten = pick(item, 'ten', 'Ten', 'tenDiemBan', 'Tên Điểm Bán');
                const ma = pick(item, 'maDL', 'MaDL', 'maCode', 'code', 'id', 'Mã ĐL/ĐB');
                const chu = pick(item, 'chuSoHuu', 'ChuSoHuu', 'chu', 'nguoiDaiDien', 'Chủ sở hữu');
                const sdt = pick(item, 'sdt', 'SDT', 'soDienThoai', 'SĐT');
                const phanLoai = pick(item, 'phanloai', 'Phanloai', 'PhanLoai', 'loai', 'Loại');
                const tuyen = pick(item, 'tuyen', 'Tuyen', 'tuyenBanHang', 'Tuyến');
                const diaChi = pick(item, 'diaChi', 'DiaChi', 'diachi', 'DC', 'Địa chỉ');
                const lat = pick(item, 'lat', 'Lat', 'ViDo');
                const lng = pick(item, 'lng', 'Lng', 'KinhDo');
                const maCum = pick(item, 'maCum', 'MaCum', 'cum', 'Cum') || '-';
                const tenCum = (window.app && app.getNameCum) ? app.getNameCum(maCum) : maCum;
                const imgTrong = pick(item, 'anhTrong', 'AnhTrong', 'imgInside', 'img1');
                const imgNgoai = pick(item, 'anhNgoai', 'AnhNgoai', 'imgOutside', 'img2');

                let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                const loaiLower = String(phanLoai).toLowerCase();
                if (loaiLower.includes('loại 1') || loaiLower.includes('chiến lược')) badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
                else if (loaiLower.includes('loại 2') || loaiLower.includes('tiềm năng')) badgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                else if (loaiLower.includes('c2c')) badgeClass = 'bg-orange-100 text-orange-700 border-orange-200';

                return `
                <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-500 text-xs font-medium">${idx + 1}</td>
                    <td class="p-3 align-top">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-700 text-sm">${ten || '---'}</span>
                            <span class="font-mono text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><i data-lucide="hash" class="w-3 h-3"></i> ${ma || '---'}</span>
                        </div>
                    </td>
                    <td class="p-3 align-top">
                        <div class="flex flex-col">
                            <span class="text-sm font-medium text-slate-700">${chu || '---'}</span>
                            ${sdt ? `<a href="tel:${sdt}" class="text-xs text-slate-500 mt-1 hover:text-blue-600 flex items-center gap-1 w-fit"><i data-lucide="phone" class="w-3 h-3"></i> ${sdt}</a>` : ''}
                        </div>
                    </td>
                    <td class="p-3 align-top">
                        <div class="flex flex-col items-start gap-1">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${phanLoai || 'Đại lý'}</span>
                            ${tuyen ? `<span class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><i data-lucide="route" class="w-3 h-3 text-slate-400"></i> Tuyến: <b class="text-slate-600">${tuyen}</b></span>` : ''}
                        </div>
                    </td>
                    <td class="p-3 align-top max-w-[200px]">
                        ${this.getMapLink(lat, lng, diaChi)}
                    </td>
                    <td class="p-3 text-center align-top">
                        <span class="font-bold text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100 whitespace-nowrap">${tenCum}</span>
                    </td>
                    <td class="p-3 text-center align-middle">
                        <div class="flex gap-2 justify-center">
                            ${renderImgCell(imgTrong, 'image')}
                            ${renderImgCell(imgNgoai, 'camera')}
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        

        // Render HTML
        thead.innerHTML = headerHtml;
        tbody.innerHTML = bodyHtml;
        if (window.lucide) lucide.createIcons();
    },

    // ============================================================
    // 9. BẢNG XẾP HẠNG & RAW DATA TABLE
    // ============================================================

    renderRankingTable(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 italic">Chưa có dữ liệu xếp hạng</div>`;
            return;
        }

        let html = `
            <div class="overflow-auto max-h-[350px] bg-white rounded-b-xl custom-scrollbar">
                <table class="w-full text-sm text-left border-collapse">
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
            let rankBadge = `<span class="text-slate-500 font-mono">#${index + 1}</span>`;
            let rowBg = "hover:bg-slate-50";
            
            if (index === 0) {
                rankBadge = `<div class="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-xs mx-auto shadow-sm">1</div>`;
                rowBg = "bg-yellow-50/30 hover:bg-yellow-50";
            } else if (index === 1) {
                rankBadge = `<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs mx-auto">2</div>`;
            } else if (index === 2) {
                rankBadge = `<div class="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs mx-auto">3</div>`;
            }

            html += `
                <tr class="${rowBg} transition border-b border-slate-50">
                    <td class="px-2 py-3 text-center align-middle">${rankBadge}</td>
                    <td class="px-3 py-3 align-middle">
                        <div class="font-bold text-slate-700">${item.name}</div>
                        ${item.phone ? `<div class="mt-1"><a href="tel:${item.phone}" class="text-[10px] text-blue-500 hover:underline"><i data-lucide="phone" class="w-3 h-3 inline"></i> ${item.phone}</a></div>` : ''}
                    </td>
                    <td class="px-3 py-3 text-right font-mono text-xs text-slate-500 align-middle">${this.formatNumber(item.plan)}</td>
                    <td class="px-3 py-3 text-right font-mono text-xs font-bold text-blue-700 align-middle">${this.formatNumber(item.actual)}</td>
                    <td class="px-3 py-3 text-center align-middle">
                        <span class="px-2 py-1 rounded border text-[11px] font-bold ${item.percent >= 100 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-blue-600 bg-blue-50 border-blue-100'}">
                            ${item.percent}%
                        </span>
                    </td>
                </tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    },

    renderBusinessKPIDetailTable(rows, opts = {}) {
        const container = document.getElementById('business-data-container');
        if (!container) return;

        const page = Number(opts.page) || 1;
        const pageSize = Number(opts.pageSize) || 50;
        const total = rows ? rows.length : 0;
        const maxPage = Math.ceil(total / pageSize) || 1;
        const slice = (rows || []).slice((page - 1) * pageSize, page * pageSize);

        if (slice.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">Không có dữ liệu phù hợp.</div>`;
            return;
        }

        let tbodyHtml = slice.map(r => `
            <tr class="border-b hover:bg-slate-50 transition-colors">
                <td class="p-3 font-mono text-slate-600 text-xs">${r.date || '-'}</td>
                <td class="p-3 font-mono font-bold text-blue-700 text-xs">${r.maNV || '-'}</td>
                <td class="p-3 text-xs text-slate-600">${app.getNameLienCum ? app.getNameLienCum(r.maLienCum) : (r.maLienCum || '-')}</td>
                <td class="p-3 text-xs text-slate-600">${app.getNameCum ? app.getNameCum(r.maCum) : (r.maCum || '-')}</td>
                <td class="p-3 font-semibold text-xs">${r.maKpi || '-'}</td>
                <td class="p-3 text-xs"><span class="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">${r.channelType || '-'}</span></td>
                <td class="p-3 text-right font-bold font-mono text-blue-700 text-sm">${this.formatNumber(r.giaTri)}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="overflow-hidden border rounded-xl bg-white shadow-sm flex flex-col h-full">
                <div class="overflow-auto flex-1 custom-scrollbar">
                    <table class="w-full text-sm border-collapse">
                        <thead class="bg-slate-50 text-slate-700 sticky top-0 z-10 shadow-sm text-xs uppercase">
                            <tr>
                                <th class="p-3 text-left font-bold border-b">Ngày</th>
                                <th class="p-3 text-left font-bold border-b">Mã NV</th>
                                <th class="p-3 text-left font-bold border-b">Liên Cụm</th>
                                <th class="p-3 text-left font-bold border-b">Cụm</th>
                                <th class="p-3 text-left font-bold border-b">KPI</th>
                                <th class="p-3 text-left font-bold border-b">Kênh</th>
                                <th class="p-3 text-right font-bold border-b">Sản lượng</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">${tbodyHtml}</tbody>
                    </table>
                </div>
                <div class="flex justify-between items-center p-3 bg-slate-50 border-t text-xs text-slate-600 shrink-0">
                    <span>Tổng dòng: <b class="text-blue-700">${this.formatNumber(total)}</b></span>
                    <div class="flex gap-2 items-center">
                        <button class="px-3 py-1.5 border bg-white rounded hover:bg-slate-100 disabled:opacity-50 transition" ${page <= 1 ? 'disabled' : ''} onclick="app.businessGotoPage(${page-1})">Trước</button>
                        <span class="py-1 font-medium">Trang ${page}/${maxPage}</span>
                        <button class="px-3 py-1.5 border bg-white rounded hover:bg-slate-100 disabled:opacity-50 transition" ${page >= maxPage ? 'disabled' : ''} onclick="app.businessGotoPage(${page+1})">Sau</button>
                    </div>
                </div>
            </div>`;
    }
};

window.UIRenderer = UIRenderer;
