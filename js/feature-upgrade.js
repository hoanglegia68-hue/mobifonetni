/* ==========================================================================
 * feature-upgrade.js
 * Nâng cấp tính năng:
 * 1) KPI cá nhân
 * 2) Đăng ký lịch tuần + báo cáo + phê duyệt
 * 3) Nhịp đập thị trường
 * 4) Báo cáo công việc trọng tâm
 * 5) Danh mục sản phẩm
 * ========================================================================== */

(function () {
    const EXTRA_TITLES = {
        kpi_personal: 'KPI CÁ NHÂN',
        weekly_plan: 'LỊCH TUẦN & BÁO CÁO',
        market_beat: 'NHỊP ĐẬP THỊ TRƯỜNG',
        focus_report: 'BÁO CÁO TRỌNG TÂM',
        products: 'DANH MỤC SẢN PHẨM'
    };

    function nowMonthKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function dateInputValue(d) {
        if (!(d instanceof Date) || isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function debounce(fn, wait = 250) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function patchApp(app) {
        if (!app || app.__featureUpgradePatched) return;
        app.__featureUpgradePatched = true;

        const originalUpdateTitle = typeof app.updateTitle === 'function' ? app.updateTitle.bind(app) : null;
        const originalLoadDataForPage = typeof app.loadDataForPage === 'function' ? app.loadDataForPage.bind(app) : null;
        const originalInit = typeof app.init === 'function' ? app.init.bind(app) : null;

        Object.assign(app, {
            _kpiPersonalRows: [],
            _kpiPersonalFilteredRows: [],
            _weeklyRows: [],
            _weeklyCopyLists: { submitted: [], registered: [], missing: [] },
            _selectedWeeklyRowId: null,
            _weeklyUsersForSelect: [],
            _weeklyChucNangFilter: 'all',
            _userFunctionByEmail: {},
            _marketRows: [],
            _marketEntryExpanded: false,
            _marketClusterLists: { has: [], missing: [] },
            _focusRows: [],
            _focusEntryExpanded: false,
            _productsRows: [],
            _filteredProductsRows: [],
            _weeklyViewCache: null,
            _focusViewCache: null,
            _productsViewCache: null,
            _viewCacheTtlMs: 0,
            _featureWarmupDone: false,
            _savingWeekly: false,
            _savingMarket: false,
            _savingFocus: false,

            isAdminUser_() {
                const role = String(this.currentUser?.role || '').toLowerCase();
                const scope = String(this.currentUser?.scope || '').toLowerCase();
                return role === 'admin' || role === 'bgd' || scope === 'all';
            },

            normalizeHeaderKey_(key) {
                return String(key || '')
                    .trim()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '');
            },

            pickValue_(row, aliases = []) {
                if (!row || typeof row !== 'object') return '';
                const map = {};
                Object.keys(row).forEach((k) => { map[this.normalizeHeaderKey_(k)] = row[k]; });
                for (const a of aliases) {
                    const key = this.normalizeHeaderKey_(a);
                    if (Object.prototype.hasOwnProperty.call(map, key)) {
                        const val = map[key];
                        if (val !== null && val !== undefined && String(val).trim() !== '') return val;
                    }
                }
                return '';
            },

            safeText_(value) {
                const txt = value === null || value === undefined ? '' : String(value);
                if (window.UIRenderer && typeof UIRenderer.escapeHTML === 'function') {
                    return UIRenderer.escapeHTML(txt);
                }
                return txt
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            },

            safeUrl_(value, allowDataImage = false) {
                const raw = String(value || '').trim();
                if (!raw) return '';
                if (allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw)) {
                    return raw;
                }
                try {
                    const u = new URL(raw, window.location.origin);
                    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
                } catch (e) {
                    return '';
                }
                return '';
            },

            num_(value) {
                const n = Number(value);
                return Number.isFinite(n) ? n : 0;
            },

            fmtNumber_(value) {
                if (window.UIRenderer && typeof UIRenderer.formatNumber === 'function') {
                    return UIRenderer.formatNumber(this.num_(value));
                }
                return new Intl.NumberFormat('vi-VN').format(this.num_(value));
            },

            fmtDDMM_(dateValue) {
                const d = this.parseDate_(dateValue);
                if (!d) return '--';
                return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            },

            exportRowsToExcel_(rows, fileName, columnMap) {
                if (!window.XLSX) {
                    this.toast_('Thiếu thư viện xuất Excel.', 'error');
                    return;
                }
                const outRows = (rows || []).map((r) => {
                    const obj = {};
                    (columnMap || []).forEach((c) => {
                        obj[c.label] = c.value(r);
                    });
                    return obj;
                });
                const ws = XLSX.utils.json_to_sheet(outRows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Report');
                XLSX.writeFile(wb, fileName || 'report.xlsx');
            },

            toast_(message, level = 'info') {
                const box = document.getElementById('toast-container');
                if (!box) {
                    alert(message);
                    return;
                }
                const el = document.createElement('div');
                const colorMap = { error: '#ef4444', success: '#16a34a', warning: '#d97706', info: '#2563eb' };
                el.className = 'toast';
                el.style.borderLeftColor = colorMap[level] || colorMap.info;
                el.innerHTML = `<span class="text-sm text-slate-700">${this.safeText_(message)}</span>`;
                box.appendChild(el);
                setTimeout(() => {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 2400);
            },

            warmupFeatureData_() {
                if (this._featureWarmupDone) return;
                this._featureWarmupDone = true;
                if (!window.DataService || typeof DataService.warmup !== 'function') return;
                const task = () => {
                    DataService.warmup(['kpicanhan', 'lich_tuan', 'market', 'report', 'products'])
                        .catch((e) => console.warn('[Feature] warmup failed', e));
                };
                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(task, { timeout: 1200 });
                } else {
                    setTimeout(task, 250);
                }
            },

            async copyText_(text, okMessage = 'Đã copy.') {
                try {
                    await navigator.clipboard.writeText(String(text || ''));
                    this.toast_(okMessage, 'success');
                    return true;
                } catch (e) {
                    const ta = document.createElement('textarea');
                    ta.value = String(text || '');
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                        document.execCommand('copy');
                        this.toast_(okMessage, 'success');
                        return true;
                    } catch (err) {
                        this.toast_('Không thể copy tự động, vui lòng copy thủ công.', 'warning');
                        return false;
                    } finally {
                        document.body.removeChild(ta);
                    }
                }
            },

            parseDate_(value) {
                if (!value && value !== 0) return null;
                if (value instanceof Date && !isNaN(value.getTime())) return value;
                if (typeof value === 'number' && Number.isFinite(value)) {
                    if (value > 1000000000000) {
                        const d = new Date(value);
                        return isNaN(d.getTime()) ? null : d;
                    }
                    if (value > 10000 && value < 100000) {
                        const base = Date.UTC(1899, 11, 30);
                        const d = new Date(base + Math.round(value) * 86400000);
                        return isNaN(d.getTime()) ? null : d;
                    }
                }
                const s = String(value).trim();
                if (!s) return null;
                let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            },

            toMonthKey_(value) {
                if (!value && value !== 0) return '';
                const s = String(value).trim();
                if (/^\d{4}-\d{2}$/.test(s)) return s;
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
                let m = s.match(/^(\d{1,2})\/(\d{4})$/);
                if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}`;
                m = s.match(/^(\d{4})\/(\d{1,2})$/);
                if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
                const d = this.parseDate_(s);
                return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
            },

            toWeekStart_(value) {
                let d = this.parseDate_(value);
                if (!d) d = new Date();
                d.setHours(0, 0, 0, 0);
                const day = d.getDay();
                const diff = (day === 0 ? -6 : 1) - day;
                d.setDate(d.getDate() + diff);
                return dateInputValue(d);
            },

            setDefaultWeekInput_(id) {
                const el = document.getElementById(id);
                if (!el) return '';
                if (!el.value) el.value = this.toWeekStart_(new Date());
                return this.toWeekStart_(el.value);
            },

            getCurrentIdentity_() {
                const u = this.currentUser || {};
                const email = String(u.email || u.username || '').trim().toLowerCase();
                const name = String(u.fullname || u.name || u.username || '').trim();
                const username = String(u.username || '').trim().toLowerCase();
                const scope = String(u.scope || '').trim();
                return { email, name, username, scope };
            },

            normalizeKpiRow_(row, idx) {
                const month = this.toMonthKey_(this.pickValue_(row, ['Thang', 'thang']));
                const maNV = String(this.pickValue_(row, ['Ma_NV', 'ma_nv', 'manv', 'maNV']) || '').trim();
                const tenNV = String(this.pickValue_(row, ['ten_nv', 'tennv', 'Ten_NV']) || '').trim();
                const email = String(this.pickValue_(row, ['email']) || '').trim().toLowerCase();
                const boPhan = String(this.pickValue_(row, ['bo_phan', 'bophan']) || '').trim();
                const chucNang = String(this.pickValue_(row, ['chuc_nang', 'chucnang']) || '').trim();
                const tongDiem = this.num_(this.pickValue_(row, ['TongDiem', 'tongdiem']));
                const groups = [];
                for (let i = 1; i <= 7; i++) {
                    const gName = String(this.pickValue_(row, [`H${i}_ten`]) || '').trim();
                    const gWeight = this.num_(this.pickValue_(row, [`H${i}_trongSo`, `H${i}_trongso`]));
                    const gKH = this.pickValue_(row, [`H${i}_kh`, `H${i}_Kh`, `H${i}_KH`]);
                    const gTH = this.pickValue_(row, [`H${i}_th`, `H${i}_Th`, `H${i}_TH`]);
                    const gTile = this.num_(this.pickValue_(row, [`H${i}_tile`, `H${i}_tiLe`]));
                    const gMax = this.num_(this.pickValue_(row, [`H${i}_max`]));
                    const gDiem = this.num_(this.pickValue_(row, [`H${i}_diem`]));
                    if (gName || gWeight || gKH || gTH || gTile || gMax || gDiem) {
                        groups.push({
                            index: i,
                            ten: gName || `H${i}`,
                            trongSo: gWeight,
                            kh: gKH,
                            th: gTH,
                            tile: gTile,
                            max: gMax,
                            diem: gDiem
                        });
                    }
                }
                return {
                    id: `${month || 'unknown'}_${maNV || email || idx}`,
                    month,
                    maNV,
                    tenNV,
                    boPhan,
                    chucNang,
                    email,
                    tongDiem,
                    groups
                };
            },

            isPersonalKpiOwnedByCurrentUser_(row) {
                const me = this.getCurrentIdentity_();
                const userScope = String(me.scope || '').trim().toLowerCase();
                if (this.isAdminUser_()) return true;
                const emailOk = me.email && row.email && row.email === me.email;
                const usernameEmailOk = me.username && row.email && row.email === String(me.username).trim().toLowerCase();
                const codeOk = userScope && row.maNV && String(row.maNV).trim().toLowerCase() === userScope;
                const userOk = me.username && row.maNV && String(row.maNV).trim().toLowerCase() === me.username;
                const nameOk = me.name && row.tenNV && String(row.tenNV).trim().toLowerCase() === me.name.toLowerCase();
                return emailOk || usernameEmailOk || codeOk || userOk || nameOk;
            },

            async loadPersonalKPIView(forceReload = false) {
                try {
                    const monthInput = document.getElementById('kpi-personal-month');
                    const kwInput = document.getElementById('kpi-personal-keyword');
                    if (monthInput && !monthInput.value) monthInput.value = nowMonthKey();
                    const monthKey = monthInput ? monthInput.value : nowMonthKey();
                    if (forceReload && DataService.invalidateLocalCache_) {
                        DataService.invalidateLocalCache_(['kpicanhan']);
                    }
                    const raw = await DataService.getPersonalKPI();
                    const rows = (raw || []).map((r, i) => this.normalizeKpiRow_(r, i)).filter((r) => r.month);
                    let baseRows = rows;
                    if (!this.isAdminUser_()) {
                        baseRows = rows.filter((r) => this.isPersonalKpiOwnedByCurrentUser_(r));
                    }

                    let filtered = baseRows.filter((r) => !monthKey || r.month === monthKey);
                    if (!filtered.length && baseRows.length) {
                        const latestMonth = baseRows.map((r) => r.month).sort().slice(-1)[0];
                        filtered = baseRows.filter((r) => r.month === latestMonth);
                        if (monthInput) monthInput.value = latestMonth;
                    }
                    this._kpiPersonalRows = filtered;
                    if (kwInput && !this.isAdminUser_()) {
                        kwInput.value = '';
                        kwInput.disabled = true;
                        kwInput.placeholder = 'Bạn chỉ xem KPI cá nhân';
                    }
                    this.renderPersonalKPITable();
                } catch (e) {
                    console.error('[KPI Personal] load failed:', e);
                    this.toast_(`Không tải được KPI cá nhân: ${e.message}`, 'error');
                }
            },

            renderPersonalKPITable() {
                const tbody = document.getElementById('kpi-personal-table-body');
                if (!tbody) return;
                const mobileList = document.getElementById('kpi-personal-mobile-list');
                const kw = String(document.getElementById('kpi-personal-keyword')?.value || '').trim().toLowerCase();
                let rows = (this._kpiPersonalRows || []).slice();
                if (kw) {
                    rows = rows.filter((r) => {
                        return [
                            r.maNV, r.tenNV, r.boPhan, r.chucNang, r.email
                        ].some((v) => String(v || '').toLowerCase().includes(kw));
                    });
                }
                this._kpiPersonalFilteredRows = rows;

                const totalScore = rows.reduce((acc, r) => acc + this.num_(r.tongDiem), 0);
                const avgScore = rows.length ? (totalScore / rows.length) : 0;
                const setTxt = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val;
                };
                setTxt('kpi-avg-score', this.fmtNumber_(avgScore.toFixed(2)));
                setTxt('kpi-total-users', this.fmtNumber_(rows.length));

                const highBox = document.getElementById('kpi-top5-high');
                const lowBox = document.getElementById('kpi-top5-low');
                const sorted = rows.slice().sort((a, b) => this.num_(b.tongDiem) - this.num_(a.tongDiem));
                const top5 = sorted.slice(0, 5);
                const low5 = sorted.slice(-5).reverse();
                if (highBox) {
                    highBox.innerHTML = top5.length
                        ? top5.map((r, i) => `<div>${i + 1}. ${this.safeText_(r.tenNV || r.maNV)} <b>(${this.fmtNumber_(r.tongDiem)})</b></div>`).join('')
                        : '<div>Không có dữ liệu.</div>';
                }
                if (lowBox) {
                    lowBox.innerHTML = low5.length
                        ? low5.map((r, i) => `<div>${i + 1}. ${this.safeText_(r.tenNV || r.maNV)} <b>(${this.fmtNumber_(r.tongDiem)})</b></div>`).join('')
                        : '<div>Không có dữ liệu.</div>';
                }

                if (!rows.length) {
                    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Không có dữ liệu KPI cá nhân.</td></tr>`;
                    if (mobileList) {
                        mobileList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">Không có dữ liệu KPI cá nhân.</div>`;
                    }
                    const groupBox = document.getElementById('kpi-personal-group-list');
                    if (groupBox) groupBox.innerHTML = 'Không có dữ liệu nhóm KPI.';
                    return;
                }

                const html = rows.map((r, i) => `
                    <tr class="bg-white hover:bg-blue-50/40">
                        <td class="text-center">${i + 1}</td>
                        <td>${this.safeText_(r.month)}</td>
                        <td>
                            <div class="font-semibold text-slate-700">${this.safeText_(r.tenNV || '-')}</div>
                            <div class="text-[11px] text-slate-500">${this.safeText_(r.maNV || '-')} | ${this.safeText_(r.boPhan || '-')}</div>
                        </td>
                        <td class="text-right font-bold text-blue-700">${this.fmtNumber_(r.tongDiem)}</td>
                        <td class="text-center">
                            <button class="btn-secondary text-xs py-1 px-2" onclick="app.showPersonalKpiDetail('${this.safeText_(r.id)}')">Xem</button>
                        </td>
                    </tr>
                `).join('');
                tbody.innerHTML = html;

                if (mobileList) {
                    mobileList.innerHTML = rows.map((r, i) => `
                        <div class="border border-slate-200 rounded-lg p-3 bg-white">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="text-xs text-slate-500">#${i + 1} • ${this.safeText_(r.month)}</div>
                                    <div class="font-semibold text-slate-800 mt-0.5">${this.safeText_(r.tenNV || '-')}</div>
                                    <div class="text-[11px] text-slate-500">${this.safeText_(r.maNV || '-')} | ${this.safeText_(r.boPhan || '-')}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[10px] text-slate-500">Tổng điểm</div>
                                    <div class="text-base font-bold text-blue-700">${this.fmtNumber_(r.tongDiem)}</div>
                                </div>
                            </div>
                            <button class="btn-secondary text-xs mt-2 w-full justify-center" onclick="app.showPersonalKpiDetail('${this.safeText_(r.id)}')">Xem chi tiết</button>
                        </div>
                    `).join('');
                }
                if (rows[0]) this.showPersonalKpiDetail(rows[0].id, false);
            },

            showPersonalKpiDetail(id, notifyIfNotFound = true) {
                const row = (this._kpiPersonalFilteredRows || this._kpiPersonalRows || []).find((r) => String(r.id) === String(id));
                const groupBox = document.getElementById('kpi-personal-group-list');
                if (!groupBox) return;
                if (!row) {
                    if (notifyIfNotFound) this.toast_('Không tìm thấy chi tiết KPI.', 'warning');
                    groupBox.innerHTML = 'Không có dữ liệu nhóm KPI.';
                    return;
                }
                if (!row.groups || !row.groups.length) {
                    groupBox.innerHTML = `<div class="text-sm text-slate-500">Không có nhóm KPI chi tiết cho bản ghi này.</div>`;
                    return;
                }
                const cards = row.groups.map((g) => `
                    <div class="bg-white border border-slate-200 rounded-lg p-3">
                        <div class="flex items-center justify-between mb-1">
                            <div class="font-semibold text-slate-700">${this.safeText_(g.ten)}</div>
                            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">H${g.index}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-1 text-xs text-slate-600">
                            <div>Trọng số: <b>${this.fmtNumber_(g.trongSo)}</b></div>
                            <div>Tỷ lệ: <b>${this.fmtNumber_(g.tile)}%</b></div>
                            <div>KH: <b>${this.safeText_(g.kh || 0)}</b></div>
                            <div>TH: <b>${this.safeText_(g.th || 0)}</b></div>
                            <div>Max: <b>${this.fmtNumber_(g.max)}</b></div>
                            <div>Điểm: <b class="text-emerald-700">${this.fmtNumber_(g.diem)}</b></div>
                        </div>
                    </div>
                `).join('');
                groupBox.innerHTML = `
                    <div class="mb-3 text-xs text-slate-500">
                        <div><b>Nhân sự:</b> ${this.safeText_(row.tenNV || row.maNV || '-')}</div>
                        <div><b>Tháng:</b> ${this.safeText_(row.month)} | <b>Tổng điểm:</b> <span class="font-bold text-blue-700">${this.fmtNumber_(row.tongDiem)}</span></div>
                    </div>
                    <div class="space-y-2">${cards}</div>
                `;
                groupBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },

            normalizeWeeklyRow_(row, idx) {
                return {
                    id: String(this.pickValue_(row, ['id']) || `WEEK_${idx}`).trim(),
                    email: String(this.pickValue_(row, ['email']) || '').trim().toLowerCase(),
                    ten_nv: String(this.pickValue_(row, ['ten_nv', 'tennv']) || '').trim(),
                    ngay_bat_dau: this.toWeekStart_(this.pickValue_(row, ['ngay_bat_dau', 'ngaybatdau'])),
                    muc_tieu: String(this.pickValue_(row, ['muc_tieu', 'muctieu']) || '').trim(),
                    thu_2: String(this.pickValue_(row, ['thu_2', 'thu2']) || '').trim(),
                    kq_thu_2: String(this.pickValue_(row, ['kq_thu_2', 'kqthu2']) || '').trim(),
                    thu_3: String(this.pickValue_(row, ['thu_3', 'thu3']) || '').trim(),
                    kq_thu_3: String(this.pickValue_(row, ['kq_thu_3', 'kqthu3']) || '').trim(),
                    thu_4: String(this.pickValue_(row, ['thu_4', 'thu4']) || '').trim(),
                    kq_thu_4: String(this.pickValue_(row, ['kq_thu_4', 'kqthu4']) || '').trim(),
                    thu_5: String(this.pickValue_(row, ['thu_5', 'thu5']) || '').trim(),
                    kq_thu_5: String(this.pickValue_(row, ['kq_thu_5', 'kqthu5']) || '').trim(),
                    thu_6: String(this.pickValue_(row, ['thu_6', 'thu6']) || '').trim(),
                    kq_thu_6: String(this.pickValue_(row, ['kq_thu_6', 'kqthu6']) || '').trim(),
                    thu_7: String(this.pickValue_(row, ['thu_7', 'thu7']) || '').trim(),
                    kq_thu_7: String(this.pickValue_(row, ['kq_thu_7', 'kqthu7']) || '').trim(),
                    cn: String(this.pickValue_(row, ['cn']) || '').trim(),
                    kq_cn: String(this.pickValue_(row, ['kq_cn', 'kqcn']) || '').trim(),
                    trang_thai: String(this.pickValue_(row, ['trang_thai', 'trangthai']) || '').trim().toLowerCase(),
                    ghi_chu: String(this.pickValue_(row, ['ghi_chu', 'ghichu']) || '').trim()
                };
            },

            buildUserFunctionMap_(kpiRows) {
                const map = {};
                const latestByEmail = {};
                (kpiRows || []).forEach((r) => {
                    const email = String(this.pickValue_(r, ['email']) || '').trim().toLowerCase();
                    const fn = String(this.pickValue_(r, ['chuc_nang', 'chucnang']) || '').trim();
                    const month = this.toMonthKey_(this.pickValue_(r, ['Thang', 'thang']));
                    if (!email || !fn) return;
                    if (!latestByEmail[email] || month >= latestByEmail[email].month) {
                        latestByEmail[email] = { month, fn };
                    }
                });
                Object.keys(latestByEmail).forEach((email) => { map[email] = latestByEmail[email].fn; });
                this._userFunctionByEmail = map;
            },

            populateWeeklyChucNangFilter_() {
                const select = document.getElementById('weekly-chucnang-filter');
                if (!select || !this.isAdminUser_()) return;
                const funcs = Array.from(new Set(Object.values(this._userFunctionByEmail || {}).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
                let html = '<option value="all">Tất cả chức năng</option>';
                funcs.forEach((f) => { html += `<option value="${this.safeText_(f)}">${this.safeText_(f)}</option>`; });
                select.innerHTML = html;
                if (this._weeklyChucNangFilter && funcs.includes(this._weeklyChucNangFilter)) {
                    select.value = this._weeklyChucNangFilter;
                } else {
                    select.value = 'all';
                    this._weeklyChucNangFilter = 'all';
                }
            },

            handleWeeklyChucNangFilter(value) {
                this._weeklyChucNangFilter = String(value || 'all');
                this.loadWeeklyPlanView();
            },

            updateWeeklyDayDateLabels_(weekStart) {
                const base = this.parseDate_(weekStart);
                if (!base) return;
                const nodes = document.querySelectorAll('.weekly-day-date');
                nodes.forEach((node) => {
                    const day = Number(node.getAttribute('data-day') || 0);
                    const offset = day === 8 ? 6 : Math.max(0, day - 2);
                    const d = new Date(base.getTime());
                    d.setDate(base.getDate() + offset);
                    node.textContent = `(${this.fmtDDMM_(d)})`;
                });
            },

            isWeeklyRegistered_(row) {
                return Boolean(
                    row.muc_tieu || row.thu_2 || row.thu_3 || row.thu_4 || row.thu_5 || row.thu_6 || row.thu_7 || row.cn
                );
            },

            isWeeklySubmitted_(row) {
                return Boolean(
                    row.kq_thu_2 || row.kq_thu_3 || row.kq_thu_4 || row.kq_thu_5 || row.kq_thu_6 || row.kq_thu_7 || row.kq_cn
                );
            },

            fillWeeklyForm_(row, weekStart) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                setVal('weekly-week-start', weekStart);
                this.updateWeeklyDayDateLabels_(weekStart);
                setVal('weekly-plan-id', row?.id || '');
                setVal('weekly-muc-tieu', row?.muc_tieu || '');
                setVal('weekly-thu-2', row?.thu_2 || '');
                setVal('weekly-kq-thu-2', row?.kq_thu_2 || '');
                setVal('weekly-thu-3', row?.thu_3 || '');
                setVal('weekly-kq-thu-3', row?.kq_thu_3 || '');
                setVal('weekly-thu-4', row?.thu_4 || '');
                setVal('weekly-kq-thu-4', row?.kq_thu_4 || '');
                setVal('weekly-thu-5', row?.thu_5 || '');
                setVal('weekly-kq-thu-5', row?.kq_thu_5 || '');
                setVal('weekly-thu-6', row?.thu_6 || '');
                setVal('weekly-kq-thu-6', row?.kq_thu_6 || '');
                setVal('weekly-thu-7', row?.thu_7 || '');
                setVal('weekly-kq-thu-7', row?.kq_thu_7 || '');
                setVal('weekly-cn', row?.cn || '');
                setVal('weekly-kq-cn', row?.kq_cn || '');
                setVal('weekly-ghi-chu', row?.ghi_chu || '');

                const lockPlan = row && row.trang_thai === 'approved' && !this.isAdminUser_();
                const planFields = ['weekly-muc-tieu', 'weekly-thu-2', 'weekly-thu-3', 'weekly-thu-4', 'weekly-thu-5', 'weekly-thu-6', 'weekly-thu-7', 'weekly-cn'];
                planFields.forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.disabled = !!lockPlan;
                });

                const statusEl = document.getElementById('weekly-status');
                if (statusEl) {
                    if (!row) {
                        statusEl.className = 'weekly-status-chip ml-auto text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-semibold';
                        statusEl.textContent = 'Trạng thái: Chưa đăng ký';
                    } else if (row.trang_thai === 'approved') {
                        statusEl.className = 'weekly-status-chip ml-auto text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold';
                        statusEl.textContent = 'Trạng thái: Đã phê duyệt';
                    } else {
                        statusEl.className = 'weekly-status-chip ml-auto text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-semibold';
                        statusEl.textContent = 'Trạng thái: Chờ phê duyệt';
                    }
                }

                const approveBtn = document.getElementById('btn-approve-weekly-plan');
                if (approveBtn) {
                    approveBtn.disabled = !this.isAdminUser_() || !row || row.trang_thai === 'approved';
                }
            },

            renderWeeklyRows_(rows) {
                const tbody = document.getElementById('weekly-report-table-body');
                const mobileList = document.getElementById('weekly-report-mobile-list');
                if (!tbody) return;
                if (!rows.length) {
                    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400">Tuần này chưa có dữ liệu.</td></tr>`;
                    if (mobileList) mobileList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">Tuần này chưa có dữ liệu.</div>`;
                    return;
                }
                const me = this.getCurrentIdentity_();
                let viewRows = rows.slice();
                if (!this.isAdminUser_()) {
                    viewRows = rows.filter((r) => r.email === me.email || r.ten_nv.toLowerCase() === me.name.toLowerCase());
                }
                if (this.isAdminUser_() && this._weeklyChucNangFilter && this._weeklyChucNangFilter !== 'all') {
                    viewRows = viewRows.filter((r) => String(this._userFunctionByEmail?.[r.email] || '').trim() === this._weeklyChucNangFilter);
                }
                const html = viewRows.map((r, i) => {
                    const statusLabel = r.trang_thai === 'approved'
                        ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">Đã duyệt</span>`
                        : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 font-bold">Chờ duyệt</span>`;
                    const submittedLabel = this.isWeeklySubmitted_(r)
                        ? `<span class="text-emerald-700 font-semibold">Có</span>`
                        : `<span class="text-slate-400">Chưa</span>`;
                    const fn = this.safeText_(this._userFunctionByEmail?.[r.email] || '-');
                    return `
                        <tr class="bg-white hover:bg-slate-50 cursor-pointer" onclick="app.selectWeeklyRow('${this.safeText_(r.id)}')">
                            <td>
                                <div class="font-semibold text-slate-700">${this.safeText_(r.ten_nv || '-')}</div>
                                <div class="text-[11px] text-slate-500">${fn}</div>
                            </td>
                            <td>${this.safeText_(r.email || '-')}</td>
                            <td class="text-center">${statusLabel}</td>
                            <td class="text-center">${submittedLabel}</td>
                        </tr>
                    `;
                }).join('');
                tbody.innerHTML = html;

                if (mobileList) {
                    mobileList.innerHTML = viewRows.map((r, i) => {
                        const statusLabel = r.trang_thai === 'approved'
                            ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">Đã duyệt</span>`
                            : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 font-bold">Chờ duyệt</span>`;
                        const submittedLabel = this.isWeeklySubmitted_(r)
                            ? `<span class="text-emerald-700 font-semibold">Đã nộp</span>`
                            : `<span class="text-slate-400">Chưa nộp</span>`;
                        const fn = this.safeText_(this._userFunctionByEmail?.[r.email] || '-');
                        return `
                            <div class="border border-slate-200 rounded-lg p-3 bg-white cursor-pointer" onclick="app.selectWeeklyRow('${this.safeText_(r.id)}')">
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <div class="text-xs text-slate-500">#${i + 1} • ${fn}</div>
                                        <div class="font-semibold text-slate-800 mt-0.5">${this.safeText_(r.ten_nv || '-')}</div>
                                        <div class="text-[11px] text-slate-500">${this.safeText_(r.email || '-')}</div>
                                    </div>
                                    ${statusLabel}
                                </div>
                                <div class="mt-2 text-xs">${submittedLabel}</div>
                            </div>
                        `;
                    }).join('');
                }
            },

            populateWeeklyUserSelect_(rows, usersRaw) {
                const select = document.getElementById('weekly-user-select');
                if (!select || !this.isAdminUser_()) return;

                const users = (usersRaw || []).map((u) => {
                    const email = String(this.pickValue_(u, ['email', 'username']) || '').trim().toLowerCase();
                    const name = String(this.pickValue_(u, ['fullname', 'name', 'ten_nv']) || '').trim() || email;
                    const role = String(this.pickValue_(u, ['role']) || '').trim().toLowerCase();
                    return { email, name, role };
                }).filter((u) => u.email && u.role !== 'admin');

                const byEmail = new Map();
                users.forEach((u) => byEmail.set(u.email, u));
                (rows || []).forEach((r) => {
                    if (r.email && !byEmail.has(r.email)) byEmail.set(r.email, { email: r.email, name: r.ten_nv || r.email, role: 'view' });
                });
                this._weeklyUsersForSelect = Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

                const current = String(select.value || '').trim().toLowerCase();
                let html = `<option value=\"\">-- Chọn nhân sự --</option>`;
                let list = this._weeklyUsersForSelect.slice();
                if (this._weeklyChucNangFilter && this._weeklyChucNangFilter !== 'all') {
                    list = list.filter((u) => String(this._userFunctionByEmail?.[u.email] || '').trim() === this._weeklyChucNangFilter);
                }
                list.forEach((u) => {
                    const fn = this._userFunctionByEmail?.[u.email] || '-';
                    html += `<option value=\"${this.safeText_(u.email)}\">${this.safeText_(u.name)} - ${this.safeText_(fn)}</option>`;
                });
                select.innerHTML = html;
                if (current && list.some((u) => u.email === current)) {
                    select.value = current;
                }
            },

            buildWeeklyStats_(rows, usersRaw) {
                const me = this.getCurrentIdentity_();
                const isAdmin = this.isAdminUser_();
                let scopedRows = (rows || []).slice();
                if (isAdmin && this._weeklyChucNangFilter && this._weeklyChucNangFilter !== 'all') {
                    scopedRows = scopedRows.filter((r) => String(this._userFunctionByEmail?.[r.email] || '').trim() === this._weeklyChucNangFilter);
                }
                const users = (usersRaw || []).map((u) => {
                    const email = String(this.pickValue_(u, ['email', 'username']) || '').trim().toLowerCase();
                    const name = String(this.pickValue_(u, ['fullname', 'name', 'ten_nv']) || '').trim() || email;
                    const role = String(this.pickValue_(u, ['role']) || '').trim().toLowerCase();
                    return { email, name, role };
                }).filter((u) => u.email && u.role !== 'admin');
                const staffMap = new Map();
                users.forEach((u) => staffMap.set(u.email, u));

                const regSet = new Set();
                const repSet = new Set();
                scopedRows.forEach((r) => {
                    if (this.isWeeklyRegistered_(r)) regSet.add(r.email);
                    if (this.isWeeklySubmitted_(r)) repSet.add(r.email);
                    if (r.email && !staffMap.has(r.email)) {
                        staffMap.set(r.email, { email: r.email, name: r.ten_nv || r.email, role: 'view' });
                    }
                });

                if (isAdmin && this._weeklyChucNangFilter && this._weeklyChucNangFilter !== 'all') {
                    Array.from(staffMap.keys()).forEach((email) => {
                        if (String(this._userFunctionByEmail?.[email] || '').trim() !== this._weeklyChucNangFilter) {
                            staffMap.delete(email);
                        }
                    });
                }

                if (!isAdmin) {
                    staffMap.clear();
                    const selfEmail = me.email || me.username;
                    if (selfEmail) {
                        staffMap.set(selfEmail, { email: selfEmail, name: me.name || selfEmail, role: 'view' });
                    }
                }

                const toLine = (u) => `${u.name} <${u.email}>`;
                const staffList = Array.from(staffMap.values());
                const registered = staffList.filter((u) => regSet.has(u.email)).map(toLine);
                const submitted = staffList.filter((u) => repSet.has(u.email)).map(toLine);
                const missing = staffList.filter((u) => !regSet.has(u.email)).map(toLine);

                this._weeklyCopyLists = { submitted, registered, missing };
                const setTxt = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = this.fmtNumber_(val);
                };
                setTxt('weekly-stat-total-staff', staffList.length);
                setTxt('weekly-stat-submitted', submitted.length);
                setTxt('weekly-stat-registered', registered.length);
                setTxt('weekly-stat-missing', missing.length);
            },

            async loadWeeklyPlanView(forceReload = false) {
                try {
                    const weekStart = this.setDefaultWeekInput_('weekly-week-start');
                    let weekRows = [];
                    let usersRaw = [];
                    const canUseCache = !forceReload
                        && this._weeklyViewCache
                        && this._weeklyViewCache.weekStart === weekStart
                        && (Date.now() - this._weeklyViewCache.ts) < this._viewCacheTtlMs;

                    if (canUseCache) {
                        weekRows = (this._weeklyViewCache.weekRows || []).slice();
                        usersRaw = (this._weeklyViewCache.usersRaw || []).slice();
                        this._userFunctionByEmail = { ...(this._weeklyViewCache.userFunctionByEmail || {}) };
                    } else {
                        if (forceReload && DataService.invalidateLocalCache_) {
                            DataService.invalidateLocalCache_(['lich_tuan']);
                        }
                        const [planRaw, freshUsersRaw, kpiRaw] = await Promise.all([
                            DataService.getWeeklyPlans(),
                            DataService.getUsers(),
                            DataService.getPersonalKPI()
                        ]);
                        usersRaw = freshUsersRaw || [];
                        this.buildUserFunctionMap_(kpiRaw || []);
                        const normalized = (planRaw || []).map((r, i) => this.normalizeWeeklyRow_(r, i));
                        weekRows = normalized.filter((r) => r.ngay_bat_dau === weekStart);
                        this._weeklyViewCache = {
                            weekStart,
                            weekRows: weekRows.slice(),
                            usersRaw: usersRaw.slice(),
                            userFunctionByEmail: { ...(this._userFunctionByEmail || {}) },
                            ts: Date.now()
                        };
                    }

                    this.populateWeeklyChucNangFilter_();
                    this._weeklyRows = weekRows;

                    this.populateWeeklyUserSelect_(weekRows, usersRaw || []);
                    this.renderWeeklyRows_(weekRows);
                    this.buildWeeklyStats_(weekRows, usersRaw || []);

                    const me = this.getCurrentIdentity_();
                    let selected = null;
                    if (this._selectedWeeklyRowId) {
                        selected = weekRows.find((r) => r.id === this._selectedWeeklyRowId) || null;
                    }
                    if (!selected) {
                        selected = weekRows.find((r) => r.email === me.email) || null;
                    }
                    if (!selected && this.isAdminUser_()) {
                        const selectedEmail = String(document.getElementById('weekly-user-select')?.value || '').trim().toLowerCase();
                        if (selectedEmail) {
                            selected = weekRows.find((r) => r.email === selectedEmail) || null;
                        }
                        if (!selected) selected = weekRows[0] || null;
                    }
                    this.fillWeeklyForm_(selected, weekStart);

                    if (this.isAdminUser_()) {
                        const select = document.getElementById('weekly-user-select');
                        if (select) {
                            const nextEmail = selected?.email || select.value || '';
                            if (nextEmail) select.value = nextEmail;
                        }
                    }
                } catch (e) {
                    console.error('[Weekly] load failed:', e);
                    this.toast_(`Không tải được dữ liệu lịch tuần: ${e.message}`, 'error');
                }
            },

            selectWeeklyRow(id) {
                this._selectedWeeklyRowId = id;
                const weekStart = this.setDefaultWeekInput_('weekly-week-start');
                const row = (this._weeklyRows || []).find((r) => r.id === id) || null;
                this.fillWeeklyForm_(row, weekStart);
                if (this.isAdminUser_() && row?.email) {
                    const select = document.getElementById('weekly-user-select');
                    if (select) select.value = row.email;
                }
            },

            selectWeeklyUser(email) {
                if (!this.isAdminUser_()) return;
                const e = String(email || '').trim().toLowerCase();
                const weekStart = this.setDefaultWeekInput_('weekly-week-start');
                const row = (this._weeklyRows || []).find((r) => r.email === e) || null;
                if (row) {
                    this._selectedWeeklyRowId = row.id;
                    this.fillWeeklyForm_(row, weekStart);
                    return;
                }
                const userInfo = (this._weeklyUsersForSelect || []).find((u) => u.email === e);
                this._selectedWeeklyRowId = null;
                this.fillWeeklyForm_(null, weekStart);
                if (userInfo) {
                    const setVal = (id, val) => {
                        const el = document.getElementById(id);
                        if (el) el.value = val || '';
                    };
                    setVal('weekly-ghi-chu', `Nhập lịch cho: ${userInfo.name} (${userInfo.email})`);
                }
            },

            async saveWeeklyPlan() {
                if (this._savingWeekly) return;
                const saveBtn = document.getElementById('btn-save-weekly-plan')
                    || document.querySelector('button[onclick*="saveWeeklyPlan"]');
                this._savingWeekly = true;
                this._setSaveActionState_(saveBtn, 'saving', { savingText: 'Đang lưu dữ liệu...' });
                this.toast_('Đang lưu dữ liệu lịch tuần...', 'info');
                try {
                    const weekStart = this.setDefaultWeekInput_('weekly-week-start');
                    const me = this.getCurrentIdentity_();
                    const selectedEmail = String(document.getElementById('weekly-user-select')?.value || '').trim().toLowerCase();
                    const selectedUser = (this._weeklyUsersForSelect || []).find((u) => u.email === selectedEmail);
                    const currentId = String(document.getElementById('weekly-plan-id')?.value || '').trim();
                    let row = (this._weeklyRows || []).find((r) => r.id === currentId) || null;
                    if (!row && currentId) {
                        row = { id: currentId, email: me.email, ten_nv: me.name };
                    }
                    const ownerEmail = this.isAdminUser_()
                        ? (selectedEmail || row?.email || me.email)
                        : (row?.email || me.email);
                    const ownerName = this.isAdminUser_()
                        ? (selectedUser?.name || row?.ten_nv || me.name || me.username)
                        : (row?.ten_nv || me.name || me.username);
                    if (!ownerEmail) {
                        this.toast_('Không xác định được email người gửi.', 'error');
                        return;
                    }

                    const payload = {
                        id: currentId || '',
                        email: ownerEmail,
                        ten_nv: ownerName,
                        ngay_bat_dau: weekStart,
                        muc_tieu: document.getElementById('weekly-muc-tieu')?.value || '',
                        thu_2: document.getElementById('weekly-thu-2')?.value || '',
                        kq_thu_2: document.getElementById('weekly-kq-thu-2')?.value || '',
                        thu_3: document.getElementById('weekly-thu-3')?.value || '',
                        kq_thu_3: document.getElementById('weekly-kq-thu-3')?.value || '',
                        thu_4: document.getElementById('weekly-thu-4')?.value || '',
                        kq_thu_4: document.getElementById('weekly-kq-thu-4')?.value || '',
                        thu_5: document.getElementById('weekly-thu-5')?.value || '',
                        kq_thu_5: document.getElementById('weekly-kq-thu-5')?.value || '',
                        thu_6: document.getElementById('weekly-thu-6')?.value || '',
                        kq_thu_6: document.getElementById('weekly-kq-thu-6')?.value || '',
                        thu_7: document.getElementById('weekly-thu-7')?.value || '',
                        kq_thu_7: document.getElementById('weekly-kq-thu-7')?.value || '',
                        cn: document.getElementById('weekly-cn')?.value || '',
                        kq_cn: document.getElementById('weekly-kq-cn')?.value || '',
                        ghi_chu: document.getElementById('weekly-ghi-chu')?.value || ''
                    };

                    const resp = await DataService.upsertWeeklyPlan(payload);
                    if (resp?.error) throw new Error(resp.error);
                    await this.loadWeeklyPlanView(true);
                    await this._showSaveSuccessState_(saveBtn, 'Lưu dữ liệu thành công', 700);
                    this.toast_('Đã lưu lịch tuần thành công.', 'success');
                } catch (e) {
                    console.error('[Weekly] save failed:', e);
                    this.toast_(`Không lưu được lịch tuần: ${e.message}`, 'error');
                } finally {
                    this._setSaveActionState_(saveBtn, 'idle');
                    this._savingWeekly = false;
                }
            },

            async approveWeeklyPlan() {
                if (!this.isAdminUser_()) {
                    this.toast_('Chỉ admin mới có quyền phê duyệt.', 'warning');
                    return;
                }
                const id = String(document.getElementById('weekly-plan-id')?.value || '').trim();
                if (!id) {
                    this.toast_('Chọn bản ghi cần phê duyệt trước.', 'warning');
                    return;
                }
                try {
                    const ghiChu = String(document.getElementById('weekly-ghi-chu')?.value || '').trim();
                    const resp = await DataService.approveWeeklyPlan(id, ghiChu);
                    if (resp?.error) throw new Error(resp.error);
                    this.toast_('Đã phê duyệt lịch tuần.', 'success');
                    await this.loadWeeklyPlanView(true);
                } catch (e) {
                    console.error('[Weekly] approve failed:', e);
                    this.toast_(`Không phê duyệt được: ${e.message}`, 'error');
                }
            },

            copyWeeklyList(type) {
                const list = this._weeklyCopyLists?.[type] || [];
                if (!list.length) {
                    this.toast_('Danh sách đang trống.', 'warning');
                    return;
                }
                this.copyText_(list.join('\n'), 'Đã copy danh sách.');
            },

            allowedCumCodes_() {
                const all = [];
                (this.fullClusterData || []).forEach((lc) => {
                    (lc.cums || []).forEach((c) => {
                        if (c?.maCum) all.push(String(c.maCum).trim());
                    });
                });
                const uniqueAll = Array.from(new Set(all));
                if (this.isAdminUser_()) return uniqueAll;

                const scope = String(this.currentUser?.scope || '').trim();
                if (!scope || scope.toLowerCase() === 'all') return uniqueAll;
                if ((this.mapCum || {})[scope]) return [scope];
                const lc = (this.fullClusterData || []).find((x) => String(x.maLienCum || '').trim() === scope);
                if (lc) return (lc.cums || []).map((c) => String(c.maCum || '').trim()).filter(Boolean);
                return uniqueAll.filter((c) => String(c).trim() === scope);
            },

            populateMarketCumSelect_() {
                const sel = document.getElementById('market-ma-cum');
                if (!sel) return;
                const allowed = this.allowedCumCodes_();
                const options = allowed.map((code) => {
                    const name = this.getNameCum ? this.getNameCum(code) : code;
                    return `<option value="${this.safeText_(code)}">${this.safeText_(name || code)}</option>`;
                }).join('');
                sel.innerHTML = options || '<option value="">Không có cụm</option>';
            },

            normalizeMarketRow_(row, idx) {
                return {
                    id: String(this.pickValue_(row, ['id']) || `MARKET_${idx}`).trim(),
                    week_start: this.toWeekStart_(this.pickValue_(row, ['week_start', 'ngay_bat_dau', 'tuan', 'thang'])),
                    email: String(this.pickValue_(row, ['email']) || '').trim().toLowerCase(),
                    ten_nv: String(this.pickValue_(row, ['ten_nv', 'tennv']) || '').trim(),
                    ma_cum: String(this.pickValue_(row, ['ma_cum', 'macum', 'maCum']) || '').trim(),
                    nha_mang: String(this.pickValue_(row, ['nha_mang', 'nhamang']) || '').trim(),
                    noi_dung: String(this.pickValue_(row, ['noi_dung', 'noidung']) || '').trim(),
                    hinh_anh: String(this.pickValue_(row, ['hinh_anh', 'hinhanh']) || '').trim(),
                    doi_tuong: String(this.pickValue_(row, ['doi_tuong', 'doituong']) || '').trim(),
                    thoi_gian: String(this.pickValue_(row, ['thoi_gian', 'thoigian']) || '').trim(),
                    dia_ban: String(this.pickValue_(row, ['dia_ban', 'diaban']) || '').trim(),
                    created_at: this.pickValue_(row, ['created_at', 'updated_at', 'ngay_tao']) || ''
                };
            },

            isRecentMarketRow_(row) {
                const created = this.parseDate_(row?.created_at || row?.week_start);
                if (!created) return false;
                const now = new Date();
                const diff = now.getTime() - created.getTime();
                return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
            },

            applyMarketAdminMode_() {
                const isAdmin = this.isAdminUser_();
                const entry = document.getElementById('market-entry-panel');
                const tableWrap = document.getElementById('market-table-wrap');
                const feed = document.getElementById('market-admin-feed');
                const toggleBtn = document.getElementById('market-toggle-entry-btn');
                if (entry) {
                    entry.classList.toggle('hidden', !!isAdmin);
                    entry.style.display = '';
                }
                if (tableWrap) tableWrap.style.display = isAdmin ? 'none' : '';
                if (feed) {
                    feed.style.display = isAdmin ? '' : 'none';
                    feed.classList.toggle('hidden', !isAdmin);
                }
                if (isAdmin) {
                    this._marketEntryExpanded = false;
                    if (toggleBtn) toggleBtn.style.display = 'none';
                    return;
                }
                if (toggleBtn) toggleBtn.style.display = '';
                this.setMarketEntryExpanded_(!!this._marketEntryExpanded);
            },

            setMarketEntryExpanded_(expanded) {
                if (this.isAdminUser_()) return;
                const entry = document.getElementById('market-entry-panel');
                const toggleBtn = document.getElementById('market-toggle-entry-btn');
                if (!entry || !toggleBtn) return;
                this._marketEntryExpanded = !!expanded;
                entry.classList.toggle('hidden', !this._marketEntryExpanded);
                entry.style.display = '';
                toggleBtn.innerHTML = this._marketEntryExpanded
                    ? '<i data-lucide="chevron-up" class="w-4 h-4 mr-1"></i>Thu gọn nhập thông tin'
                    : '<i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Nhập thông tin';
                if (window.lucide) lucide.createIcons();
            },

            toggleMarketEntryPanel() {
                this.setMarketEntryExpanded_(!this._marketEntryExpanded);
            },

            renderMarketAdminFeed_() {
                const feed = document.getElementById('market-admin-feed');
                if (!feed) return;
                if (!this._marketRows.length) {
                    feed.innerHTML = `<div class="text-sm text-slate-400 py-4">Tuần này chưa có bản tin thị trường.</div>`;
                    return;
                }
                const cards = this._marketRows
                    .slice()
                    .sort((a, b) => String(b.created_at || b.week_start).localeCompare(String(a.created_at || a.week_start)))
                    .map((r) => {
                        const isNew = this.isRecentMarketRow_(r);
                        const safeImgUrl = this.safeUrl_(r.hinh_anh);
                        const img = safeImgUrl ? `<a href="${this.safeText_(safeImgUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 hover:underline">Hình ảnh chương trình</a>` : '';
                        return `
                            <div class="border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <div class="text-sm font-bold text-slate-800">${this.safeText_(r.nha_mang || '-')} - ${this.safeText_(r.noi_dung || '-')}</div>
                                        <div class="text-xs text-slate-500 mt-1">${this.safeText_(r.ten_nv || r.email || '-')} | ${this.safeText_(this.getNameCum ? (this.getNameCum(r.ma_cum) || r.ma_cum) : r.ma_cum)}</div>
                                    </div>
                                    ${isNew ? '<span class="blink-new px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">NEW</span>' : ''}
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
                                    <div><b>Đối tượng:</b> ${this.safeText_(r.doi_tuong || '-')}</div>
                                    <div><b>Thời gian:</b> ${this.safeText_(r.thoi_gian || '-')}</div>
                                    <div><b>Địa bàn:</b> ${this.safeText_(r.dia_ban || '-')}</div>
                                    <div><b>Tuần:</b> ${this.safeText_(r.week_start || '-')}</div>
                                </div>
                                <div class="mt-2">${img}</div>
                            </div>
                        `;
                    }).join('');
                feed.innerHTML = `<div class="grid grid-cols-1 xl:grid-cols-2 gap-3">${cards}</div>`;
            },

            exportMarketExcel() {
                this.exportRowsToExcel_(this._marketRows, `market_${this.setDefaultWeekInput_('market-week-start')}.xlsx`, [
                    { label: 'Tuần', value: (r) => r.week_start },
                    { label: 'Nhân sự', value: (r) => r.ten_nv || r.email },
                    { label: 'Email', value: (r) => r.email },
                    { label: 'Cụm', value: (r) => this.getNameCum ? (this.getNameCum(r.ma_cum) || r.ma_cum) : r.ma_cum },
                    { label: 'Nhà mạng', value: (r) => r.nha_mang },
                    { label: 'Nội dung', value: (r) => r.noi_dung },
                    { label: 'Đối tượng', value: (r) => r.doi_tuong },
                    { label: 'Thời gian', value: (r) => r.thoi_gian },
                    { label: 'Địa bàn', value: (r) => r.dia_ban },
                    { label: 'Hình ảnh', value: (r) => r.hinh_anh }
                ]);
                this.toast_('Đã xuất Excel nhịp đập thị trường.', 'success');
            },

            renderMarketRows_() {
                const tbody = document.getElementById('market-table-body');
                if (!tbody) return;
                if (!(this._marketRows || []).length) {
                    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">Tuần này chưa có bản tin thị trường.</td></tr>`;
                    return;
                }
                const html = this._marketRows.map((r, i) => {
                    const safeImgUrl = this.safeUrl_(r.hinh_anh);
                    const img = safeImgUrl
                        ? `<a href="${this.safeText_(safeImgUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Xem ảnh</a>`
                        : '<span class="text-slate-400">-</span>';
                    return `
                        <tr class="bg-white hover:bg-slate-50">
                            <td>${this.safeText_(r.week_start)}</td>
                            <td>${this.safeText_(r.ten_nv || r.email || '-')}</td>
                            <td>${this.safeText_(this.getNameCum ? (this.getNameCum(r.ma_cum) || r.ma_cum) : r.ma_cum)}</td>
                            <td class="font-semibold text-slate-700">${this.safeText_(r.nha_mang || '-')}</td>
                            <td>${this.safeText_(r.noi_dung || '-')}</td>
                            <td>${this.safeText_(r.doi_tuong || '-')}</td>
                            <td>${this.safeText_(r.thoi_gian || '-')}</td>
                            <td>${this.safeText_(r.dia_ban || '-')}</td>
                            <td>${img}</td>
                        </tr>
                    `;
                }).join('');
                tbody.innerHTML = html;
            },

            fillMarketForm_(row) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                setVal('market-id', row?.id || '');
                setVal('market-nha-mang', row?.nha_mang || '');
                setVal('market-noi-dung', row?.noi_dung || '');
                setVal('market-hinh-anh', row?.hinh_anh || '');
                setVal('market-doi-tuong', row?.doi_tuong || '');
                setVal('market-thoi-gian', row?.thoi_gian || '');
                setVal('market-dia-ban', row?.dia_ban || '');
                if (row?.ma_cum) setVal('market-ma-cum', row.ma_cum);
            },

            updateMarketClusterStats_(usersRaw = []) {
                const allowed = this.allowedCumCodes_();
                const hasSet = new Set((this._marketRows || []).map((r) => String(r.ma_cum || '').trim()).filter(Boolean));
                const has = allowed.filter((c) => hasSet.has(String(c).trim()));
                const missing = allowed.filter((c) => !hasSet.has(String(c).trim()));

                const userMap = {};
                (usersRaw || []).forEach((u) => {
                    const email = String(this.pickValue_(u, ['email', 'username']) || '').trim().toLowerCase();
                    if (!email) return;
                    userMap[email] = String(this.pickValue_(u, ['fullname', 'ten_nv', 'name']) || '').trim() || email;
                });

                const reporterSet = new Set();
                (this._marketRows || []).forEach((r) => {
                    const email = String(r.email || '').trim().toLowerCase();
                    if (!email) return;
                    const name = String(r.ten_nv || userMap[email] || email).trim();
                    reporterSet.add(`${name} <${email}>`);
                });

                const hasClusters = has.map((c) => `${c} - ${this.getNameCum ? (this.getNameCum(c) || c) : c}`);
                const missingClusters = missing.map((c) => `${c} - ${this.getNameCum ? (this.getNameCum(c) || c) : c}`);
                this._marketClusterLists = {
                    has: Array.from(reporterSet).sort((a, b) => a.localeCompare(b, 'vi')),
                    missing: missingClusters,
                    hasClusters: hasClusters
                };

                const setTxt = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = this.fmtNumber_(val);
                };
                setTxt('market-stat-has', has.length);
                setTxt('market-stat-missing', missing.length);

                const renderList = (id, list, emptyText) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (!list || !list.length) {
                        el.innerHTML = `<div class="text-slate-400">${this.safeText_(emptyText)}</div>`;
                        return;
                    }
                    el.innerHTML = list.map((x) => `<div class="truncate" title="${this.safeText_(x)}">• ${this.safeText_(x)}</div>`).join('');
                };
                renderList('market-list-has', hasClusters, 'Chưa có cụm nào.');
                renderList('market-list-missing', missingClusters, 'Đủ dữ liệu tất cả cụm.');
            },

            async loadMarketBeatView(forceReload = false) {
                try {
                    let weekStart = this.setDefaultWeekInput_('market-week-start');
                    this.populateMarketCumSelect_();
                    this.applyMarketAdminMode_();
                    if (forceReload && DataService.invalidateLocalCache_) {
                        DataService.invalidateLocalCache_(['market']);
                    }
                    const [raw, usersRaw] = await Promise.all([
                        DataService.getMarketBeat(),
                        DataService.getUsers()
                    ]);
                    const allowed = new Set(this.allowedCumCodes_().map((x) => String(x).trim()));
                    const allRows = (raw || []).map((r, i) => this.normalizeMarketRow_(r, i));
                    let rows = allRows.filter((r) => r.week_start === weekStart);
                    if (!rows.length && allRows.length) {
                        const latestWeek = allRows.map((r) => r.week_start).filter(Boolean).sort().slice(-1)[0];
                        if (latestWeek) {
                            weekStart = latestWeek;
                            const weekEl = document.getElementById('market-week-start');
                            if (weekEl) weekEl.value = latestWeek;
                            rows = allRows.filter((r) => r.week_start === latestWeek);
                        }
                    }
                    if (!this.isAdminUser_()) {
                        rows = rows.filter((r) => !r.ma_cum || allowed.has(String(r.ma_cum).trim()));
                    }
                    this._marketRows = rows;
                    this.renderMarketRows_();
                    this.renderMarketAdminFeed_();
                    this.updateMarketClusterStats_(usersRaw || []);

                    const me = this.getCurrentIdentity_();
                    const myLatest = rows.find((r) => r.email === me.email) || null;
                    this.fillMarketForm_(myLatest);
                } catch (e) {
                    console.error('[Market] load failed:', e);
                    this.toast_(`Không tải được dữ liệu thị trường: ${e.message}`, 'error');
                }
            },

            async saveMarketBeat() {
                if (this._savingMarket) return;
                if (this.isAdminUser_()) {
                    this.toast_('Admin chỉ xem bản tin thị trường, không nhập liệu tại màn hình này.', 'warning');
                    return;
                }
                const saveBtn = document.getElementById('btn-save-market-beat')
                    || document.querySelector('button[onclick*="saveMarketBeat"]');
                this._savingMarket = true;
                this._setSaveActionState_(saveBtn, 'saving', { savingText: 'Đang lưu dữ liệu...' });
                this.toast_('Đang lưu dữ liệu nhịp đập thị trường...', 'info');
                try {
                    const weekStart = this.setDefaultWeekInput_('market-week-start');
                    const me = this.getCurrentIdentity_();
                    const payload = {
                        id: String(document.getElementById('market-id')?.value || '').trim(),
                        week_start: weekStart,
                        email: me.email,
                        ten_nv: me.name || me.username,
                        ma_cum: String(document.getElementById('market-ma-cum')?.value || '').trim(),
                        nha_mang: String(document.getElementById('market-nha-mang')?.value || '').trim(),
                        noi_dung: String(document.getElementById('market-noi-dung')?.value || '').trim(),
                        hinh_anh: String(document.getElementById('market-hinh-anh')?.value || '').trim(),
                        doi_tuong: String(document.getElementById('market-doi-tuong')?.value || '').trim(),
                        thoi_gian: String(document.getElementById('market-thoi-gian')?.value || '').trim(),
                        dia_ban: String(document.getElementById('market-dia-ban')?.value || '').trim()
                    };
                    if (!payload.nha_mang || !payload.noi_dung) {
                        this.toast_('Vui lòng nhập tối thiểu Nhà mạng và Nội dung chương trình.', 'warning');
                        return;
                    }
                    const resp = await DataService.upsertMarketBeat(payload);
                    if (resp?.error) throw new Error(resp.error);
                    await this.loadMarketBeatView(true);
                    this.setMarketEntryExpanded_(false);
                    await this._showSaveSuccessState_(saveBtn, 'Lưu dữ liệu thành công', 700);
                    this.toast_('Đã ghi nhận nhịp đập thị trường.', 'success');
                } catch (e) {
                    console.error('[Market] save failed:', e);
                    this.toast_(`Không lưu được dữ liệu thị trường: ${e.message}`, 'error');
                } finally {
                    this._setSaveActionState_(saveBtn, 'idle');
                    this._savingMarket = false;
                }
            },

            copyMarketClusterList(type) {
                const list = this._marketClusterLists?.[type] || [];
                if (!list.length) {
                    this.toast_('Danh sách đang trống.', 'warning');
                    return;
                }
                const ok = (type === 'has')
                    ? 'Đã copy danh sách tên + email người đã nhập.'
                    : 'Đã copy danh sách cụm chưa có thông tin.';
                this.copyText_(list.join('\n'), ok);
            },

            normalizeFocusRow_(row, idx) {
                return {
                    id: String(this.pickValue_(row, ['id']) || `REPORT_${idx}`).trim(),
                    week_start: this.toWeekStart_(this.pickValue_(row, ['week_start', 'ngay_bat_dau', 'tuan'])),
                    email: String(this.pickValue_(row, ['email']) || '').trim().toLowerCase(),
                    ten_nv: String(this.pickValue_(row, ['ten_nv', 'tennv']) || '').trim(),
                    stt: String(this.pickValue_(row, ['stt']) || '').trim(),
                    chuong_trinh_hanh_dong: String(this.pickValue_(row, ['chuong_trinh_hanh_dong', 'chuongtrinhanhdong']) || '').trim(),
                    noi_dung_chuong_trinh: String(this.pickValue_(row, ['noi_dung_chuong_trinh', 'noidungchuongtrinh']) || '').trim(),
                    khach_hang_muc_tieu: String(this.pickValue_(row, ['khach_hang_muc_tieu', 'khachhangmuctieu']) || '').trim(),
                    kenh_ll_trien_khai: String(this.pickValue_(row, ['kenh_ll_trien_khai', 'kenhlltrienkhai']) || '').trim(),
                    trien_khai_tai: String(this.pickValue_(row, ['trien_khai_tai', 'trienkhaitai']) || '').trim(),
                    muc_tieu_dinh_luong: String(this.pickValue_(row, ['muc_tieu_dinh_luong', 'muctieudinhluong']) || '').trim(),
                    muc_tieu_dinh_tinh: String(this.pickValue_(row, ['muc_tieu_dinh_tinh', 'muctieudinhtinh']) || '').trim(),
                    chi_phi: String(this.pickValue_(row, ['chi_phi', 'chiphi']) || '').trim()
                };
            },

            applyFocusAdminMode_() {
                const isAdmin = this.isAdminUser_();
                const entry = document.getElementById('focus-entry-panel');
                const toggleBtn = document.getElementById('focus-toggle-entry-btn');
                if (isAdmin) {
                    this._focusEntryExpanded = false;
                    if (entry) entry.style.display = 'none';
                    if (toggleBtn) toggleBtn.style.display = 'none';
                    return;
                }
                if (toggleBtn) toggleBtn.style.display = '';
                this.setFocusEntryExpanded_(!!this._focusEntryExpanded);
            },

            setFocusEntryExpanded_(expanded) {
                if (this.isAdminUser_()) return;
                const entry = document.getElementById('focus-entry-panel');
                const toggleBtn = document.getElementById('focus-toggle-entry-btn');
                if (!entry || !toggleBtn) return;
                this._focusEntryExpanded = !!expanded;
                entry.style.display = this._focusEntryExpanded ? '' : 'none';
                toggleBtn.innerHTML = this._focusEntryExpanded
                    ? '<i data-lucide="chevron-up" class="w-4 h-4 mr-1"></i>Thu gọn nhập báo cáo'
                    : '<i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Nhập báo cáo';
                if (window.lucide) lucide.createIcons();
            },

            toggleFocusEntryPanel() {
                this.setFocusEntryExpanded_(!this._focusEntryExpanded);
            },

            exportFocusExcel() {
                this.exportRowsToExcel_(this._focusRows, `focus_report_${this.setDefaultWeekInput_('focus-week-start')}.xlsx`, [
                    { label: 'Tuần', value: (r) => r.week_start },
                    { label: 'Nhân sự', value: (r) => r.ten_nv || r.email },
                    { label: 'Email', value: (r) => r.email },
                    { label: 'Chương trình', value: (r) => r.chuong_trinh_hanh_dong },
                    { label: 'Nội dung chương trình', value: (r) => r.noi_dung_chuong_trinh },
                    { label: 'Khách hàng mục tiêu', value: (r) => r.khach_hang_muc_tieu },
                    { label: 'Kênh/LL triển khai', value: (r) => r.kenh_ll_trien_khai },
                    { label: 'Triển khai tại', value: (r) => r.trien_khai_tai },
                    { label: 'KQ định lượng', value: (r) => r.muc_tieu_dinh_luong },
                    { label: 'KQ định tính', value: (r) => r.muc_tieu_dinh_tinh },
                    { label: 'Ghi chú', value: (r) => r.chi_phi }
                ]);
                this.toast_('Đã xuất Excel báo cáo trọng tâm.', 'success');
            },

            renderFocusRows_() {
                const tbody = document.getElementById('focus-report-table-body');
                const mobileList = document.getElementById('focus-report-mobile-list');
                if (!tbody) return;
                if (!(this._focusRows || []).length) {
                    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">Tuần này chưa có báo cáo trọng tâm.</td></tr>`;
                    if (mobileList) mobileList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">Tuần này chưa có báo cáo trọng tâm.</div>`;
                    return;
                }
                const html = this._focusRows.map((r, i) => `
                    <tr class="bg-white hover:bg-slate-50 cursor-pointer" onclick="app.editFocusReport('${this.safeText_(r.id)}')">
                        <td>${this.safeText_(r.week_start)}</td>
                        <td>${this.safeText_(r.ten_nv || r.email || '-')}</td>
                        <td class="font-semibold text-slate-700">${this.safeText_(r.chuong_trinh_hanh_dong || '-')}</td>
                        <td>${this.safeText_(r.noi_dung_chuong_trinh || '-')}</td>
                        <td>${this.safeText_(r.khach_hang_muc_tieu || '-')}</td>
                        <td>${this.safeText_(r.kenh_ll_trien_khai || '-')}</td>
                        <td>${this.safeText_(r.trien_khai_tai || '-')}</td>
                        <td>${this.safeText_(r.muc_tieu_dinh_luong || '-')}</td>
                        <td>${this.safeText_(r.muc_tieu_dinh_tinh || '-')}</td>
                        <td>${this.safeText_(r.chi_phi || '-')}</td>
                    </tr>
                `).join('');
                tbody.innerHTML = html;

                if (mobileList) {
                    mobileList.innerHTML = this._focusRows.map((r, i) => `
                        <div class="border border-slate-200 rounded-lg p-3 bg-white cursor-pointer" onclick="app.editFocusReport('${this.safeText_(r.id)}')">
                            <div class="text-xs text-slate-500">#${i + 1} • Tuần ${this.safeText_(r.week_start || '-')}</div>
                            <div class="font-semibold text-slate-800 mt-1">${this.safeText_(r.chuong_trinh_hanh_dong || '-')}</div>
                            <div class="text-xs text-slate-600 mt-1">${this.safeText_(r.noi_dung_chuong_trinh || '-')}</div>
                            <div class="grid grid-cols-2 gap-2 mt-2 text-[11px] text-slate-600">
                                <div><b>KH mục tiêu:</b> ${this.safeText_(r.khach_hang_muc_tieu || '-')}</div>
                                <div><b>Kênh:</b> ${this.safeText_(r.kenh_ll_trien_khai || '-')}</div>
                                <div><b>Triển khai:</b> ${this.safeText_(r.trien_khai_tai || '-')}</div>
                                <div><b>Ghi chú:</b> ${this.safeText_(r.chi_phi || '-')}</div>
                            </div>
                        </div>
                    `).join('');
                }
            },

            fillFocusForm_(row) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                setVal('focus-id', row?.id || '');
                setVal('focus-chuong-trinh-hanh-dong', row?.chuong_trinh_hanh_dong || '');
                setVal('focus-noi-dung', row?.noi_dung_chuong_trinh || '');
                setVal('focus-khach-hang', row?.khach_hang_muc_tieu || '');
                setVal('focus-kenh', row?.kenh_ll_trien_khai || '');
                setVal('focus-trien-khai', row?.trien_khai_tai || '');
                setVal('focus-muc-tieu-dinh-luong', row?.muc_tieu_dinh_luong || '');
                setVal('focus-muc-tieu-dinh-tinh', row?.muc_tieu_dinh_tinh || '');
                setVal('focus-chi-phi', row?.chi_phi || '');
            },

            async loadFocusReportView(forceReload = false) {
                try {
                    const weekStart = this.setDefaultWeekInput_('focus-week-start');
                    this.applyFocusAdminMode_();
                    const me = this.getCurrentIdentity_();
                    let rows = [];
                    const canUseCache = !forceReload
                        && this._focusViewCache
                        && this._focusViewCache.weekStart === weekStart
                        && (Date.now() - this._focusViewCache.ts) < this._viewCacheTtlMs;
                    if (canUseCache) {
                        rows = (this._focusViewCache.rows || []).slice();
                    } else {
                        if (forceReload && DataService.invalidateLocalCache_) {
                            DataService.invalidateLocalCache_(['report']);
                        }
                        rows = (await DataService.getFocusReports() || []).map((r, i) => this.normalizeFocusRow_(r, i))
                            .filter((r) => r.week_start === weekStart);
                        this._focusViewCache = { weekStart, rows: rows.slice(), ts: Date.now() };
                    }
                    if (!this.isAdminUser_()) {
                        rows = rows.filter((r) => r.email === me.email);
                    }
                    this._focusRows = rows;
                    this.renderFocusRows_();
                    this.fillFocusForm_(rows[0] || null);
                    this.applyFocusAdminMode_();
                } catch (e) {
                    console.error('[Focus] load failed:', e);
                    this.toast_(`Không tải được báo cáo trọng tâm: ${e.message}`, 'error');
                }
            },

            editFocusReport(id) {
                const row = (this._focusRows || []).find((r) => r.id === id);
                if (!row) return;
                this.fillFocusForm_(row);
                if (!this.isAdminUser_()) this.setFocusEntryExpanded_(true);
            },

            async saveFocusReport() {
                if (this._savingFocus) return;
                if (this.isAdminUser_()) {
                    this.toast_('Admin chỉ xem báo cáo tại màn hình này.', 'warning');
                    return;
                }
                const saveBtn = document.getElementById('btn-save-focus-report')
                    || document.querySelector('button[onclick*="saveFocusReport"]');
                this._savingFocus = true;
                this._setSaveActionState_(saveBtn, 'saving', { savingText: 'Đang lưu dữ liệu...' });
                this.toast_('Đang lưu dữ liệu báo cáo trọng tâm...', 'info');
                try {
                    const weekStart = this.setDefaultWeekInput_('focus-week-start');
                    const me = this.getCurrentIdentity_();
                    const payload = {
                        id: String(document.getElementById('focus-id')?.value || '').trim(),
                        week_start: weekStart,
                        email: me.email,
                        ten_nv: me.name || me.username,
                        chuong_trinh_hanh_dong: String(document.getElementById('focus-chuong-trinh-hanh-dong')?.value || '').trim(),
                        noi_dung_chuong_trinh: String(document.getElementById('focus-noi-dung')?.value || '').trim(),
                        khach_hang_muc_tieu: String(document.getElementById('focus-khach-hang')?.value || '').trim(),
                        kenh_ll_trien_khai: String(document.getElementById('focus-kenh')?.value || '').trim(),
                        trien_khai_tai: String(document.getElementById('focus-trien-khai')?.value || '').trim(),
                        muc_tieu_dinh_luong: String(document.getElementById('focus-muc-tieu-dinh-luong')?.value || '').trim(),
                        muc_tieu_dinh_tinh: String(document.getElementById('focus-muc-tieu-dinh-tinh')?.value || '').trim(),
                        chi_phi: String(document.getElementById('focus-chi-phi')?.value || '').trim()
                    };
                    if (!payload.chuong_trinh_hanh_dong && !payload.noi_dung_chuong_trinh) {
                        this.toast_('Vui lòng nhập chương trình hành động hoặc nội dung.', 'warning');
                        return;
                    }
                    const resp = await DataService.upsertFocusReport(payload);
                    if (resp?.error) throw new Error(resp.error);
                    await this.loadFocusReportView(true);
                    if (!this.isAdminUser_()) this.setFocusEntryExpanded_(false);
                    await this._showSaveSuccessState_(saveBtn, 'Lưu dữ liệu thành công', 700);
                    this.toast_('Đã lưu báo cáo trọng tâm.', 'success');
                } catch (e) {
                    console.error('[Focus] save failed:', e);
                    this.toast_(`Không lưu được báo cáo: ${e.message}`, 'error');
                } finally {
                    this._setSaveActionState_(saveBtn, 'idle');
                    this._savingFocus = false;
                }
            },

            normalizeProductRow_(row, idx) {
                return {
                    id: String(this.pickValue_(row, ['id']) || `P_${idx}`).trim(),
                    ten_san_pham: String(this.pickValue_(row, ['ten_san_pham', 'tensanpham', 'tensanpham']) || '').trim(),
                    loai_san_pham: String(this.pickValue_(row, ['loai_san_pham', 'loaisanpham']) || '').trim(),
                    uu_dai: String(this.pickValue_(row, ['uu_dai', 'uudai']) || '').trim(),
                    gia_ban: String(this.pickValue_(row, ['gia_ban', 'giaban']) || '').trim(),
                    doi_tuong: String(this.pickValue_(row, ['doi_tuong', 'doituong']) || '').trim(),
                    thoi_gian: String(this.pickValue_(row, ['thoi_gian', 'thoigian']) || '').trim(),
                    cach_dang_ky: String(this.pickValue_(row, ['cach_dang_ky', 'cachdangky']) || '').trim(),
                    huy_dich_vu: String(this.pickValue_(row, ['huy_dich_vu', 'huydichvu']) || '').trim()
                };
            },

            renderProductsRows_(rows) {
                const tbody = document.getElementById('product-table-body');
                const mobileList = document.getElementById('product-mobile-list');
                if (!tbody) return;
                const isAdmin = this.isAdminUser_();
                if (!rows.length) {
                    tbody.innerHTML = `<tr><td colspan="${isAdmin ? 10 : 9}" class="text-center py-8 text-slate-400">Không có dữ liệu sản phẩm.</td></tr>`;
                    if (mobileList) mobileList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">Không có dữ liệu sản phẩm.</div>`;
                    return;
                }
                const html = rows.map((r, i) => `
                    <tr class="bg-white hover:bg-slate-50">
                        <td class="text-center">${i + 1}</td>
                        <td class="font-semibold text-slate-700">${this.safeText_(r.ten_san_pham || '-')}</td>
                        <td>${this.safeText_(r.loai_san_pham || '-')}</td>
                        <td>${this.safeText_(r.uu_dai || '-')}</td>
                        <td>${this.safeText_(r.gia_ban || '-')}</td>
                        <td>${this.safeText_(r.doi_tuong || '-')}</td>
                        <td>${this.safeText_(r.thoi_gian || '-')}</td>
                        <td>${this.safeText_(r.cach_dang_ky || '-')}</td>
                        <td>${this.safeText_(r.huy_dich_vu || '-')}</td>
                        ${isAdmin ? `
                            <td class="text-center admin-only">
                                <button class="btn-secondary text-xs py-1 px-2 mr-1" onclick="app.editProduct('${this.safeText_(r.id)}')">Sửa</button>
                                <button class="btn-secondary text-xs py-1 px-2 text-red-600" onclick="app.deleteProduct('${this.safeText_(r.id)}')">Xóa</button>
                            </td>
                        ` : ''}
                    </tr>
                `).join('');
                tbody.innerHTML = html;

                if (mobileList) {
                    mobileList.innerHTML = rows.map((r, i) => `
                        <div class="border border-slate-200 rounded-lg p-3 bg-white">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="text-xs text-slate-500">#${i + 1}</div>
                                    <div class="font-semibold text-slate-800">${this.safeText_(r.ten_san_pham || '-')}</div>
                                    <div class="text-[11px] text-slate-500">${this.safeText_(r.loai_san_pham || '-')}</div>
                                </div>
                                <div class="text-xs text-blue-700 font-semibold">${this.safeText_(r.gia_ban || '-')}</div>
                            </div>
                            <div class="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                <div><b>Ưu đãi:</b> ${this.safeText_(r.uu_dai || '-')}</div>
                                <div><b>Đối tượng:</b> ${this.safeText_(r.doi_tuong || '-')}</div>
                                <div><b>Thời gian:</b> ${this.safeText_(r.thoi_gian || '-')}</div>
                                <div><b>Đăng ký:</b> ${this.safeText_(r.cach_dang_ky || '-')}</div>
                            </div>
                            <div class="mt-1 text-[11px] text-slate-600"><b>Hủy DV:</b> ${this.safeText_(r.huy_dich_vu || '-')}</div>
                            ${isAdmin ? `
                                <div class="mt-2 flex gap-2">
                                    <button class="btn-secondary text-xs py-1 px-2 flex-1 justify-center" onclick="app.editProduct('${this.safeText_(r.id)}')">Sửa</button>
                                    <button class="btn-secondary text-xs py-1 px-2 text-red-600 flex-1 justify-center" onclick="app.deleteProduct('${this.safeText_(r.id)}')">Xóa</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('');
                }
            },

            async loadProductsView(forceReload = false) {
                try {
                    const canUseCache = !forceReload
                        && this._productsViewCache
                        && (Date.now() - this._productsViewCache.ts) < this._viewCacheTtlMs;
                    if (canUseCache) {
                        this._productsRows = (this._productsViewCache.rows || []).slice();
                    } else {
                        if (forceReload && DataService.invalidateLocalCache_) {
                            DataService.invalidateLocalCache_(['products']);
                        }
                        const rows = await DataService.getProducts();
                        this._productsRows = (rows || []).map((r, i) => this.normalizeProductRow_(r, i));
                        this._productsViewCache = { rows: this._productsRows.slice(), ts: Date.now() };
                    }
                    this.applyProductFilters();
                } catch (e) {
                    console.error('[Products] load failed:', e);
                    this.toast_(`Không tải được danh mục sản phẩm: ${e.message}`, 'error');
                }
            },

            applyProductFilters() {
                const nameKw = String(document.getElementById('product-filter-name')?.value || '').trim().toLowerCase();
                const typeKw = String(document.getElementById('product-filter-type')?.value || '').trim().toLowerCase();
                const targetKw = String(document.getElementById('product-filter-target')?.value || '').trim().toLowerCase();
                let rows = (this._productsRows || []).slice();
                if (nameKw) rows = rows.filter((r) => String(r.ten_san_pham || '').toLowerCase().includes(nameKw));
                if (typeKw) rows = rows.filter((r) => String(r.loai_san_pham || '').toLowerCase().includes(typeKw));
                if (targetKw) rows = rows.filter((r) => String(r.doi_tuong || '').toLowerCase().includes(targetKw));
                this._filteredProductsRows = rows;
                this.renderProductsRows_(rows);
            },

            clearProductFilters() {
                const ids = ['product-filter-name', 'product-filter-type', 'product-filter-target'];
                ids.forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.applyProductFilters();
            },

            editProduct(id) {
                if (!this.isAdminUser_()) return;
                const row = (this._productsRows || []).find((r) => r.id === id);
                if (!row) return;
                const setVal = (elId, val) => {
                    const el = document.getElementById(elId);
                    if (el) el.value = val || '';
                };
                setVal('product-id', row.id);
                setVal('product-name', row.ten_san_pham);
                setVal('product-type', row.loai_san_pham);
                setVal('product-offer', row.uu_dai);
                setVal('product-price', row.gia_ban);
                setVal('product-target', row.doi_tuong);
                setVal('product-time', row.thoi_gian);
                setVal('product-register', row.cach_dang_ky);
                setVal('product-cancel', row.huy_dich_vu);
                this.openProductModal(false);
            },

            openProductModal(reset = true) {
                if (!this.isAdminUser_()) return;
                if (reset) {
                    ['product-id', 'product-name', 'product-type', 'product-offer', 'product-price', 'product-target', 'product-time', 'product-register', 'product-cancel'].forEach((id) => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                }
                const modal = document.getElementById('modal-product');
                if (modal) {
                    modal.classList.add('open');
                    if (window.lucide) lucide.createIcons();
                }
            },

            closeProductModal() {
                const modal = document.getElementById('modal-product');
                if (modal) modal.classList.remove('open');
            },

            async saveProduct() {
                if (!this.isAdminUser_()) {
                    this.toast_('Chỉ admin được thêm/cập nhật sản phẩm.', 'warning');
                    return;
                }
                const payload = {
                    id: String(document.getElementById('product-id')?.value || '').trim(),
                    ten_san_pham: String(document.getElementById('product-name')?.value || '').trim(),
                    loai_san_pham: String(document.getElementById('product-type')?.value || '').trim(),
                    uu_dai: String(document.getElementById('product-offer')?.value || '').trim(),
                    gia_ban: String(document.getElementById('product-price')?.value || '').trim(),
                    doi_tuong: String(document.getElementById('product-target')?.value || '').trim(),
                    thoi_gian: String(document.getElementById('product-time')?.value || '').trim(),
                    cach_dang_ky: String(document.getElementById('product-register')?.value || '').trim(),
                    huy_dich_vu: String(document.getElementById('product-cancel')?.value || '').trim()
                };
                if (!payload.ten_san_pham || !payload.loai_san_pham) {
                    this.toast_('Tên sản phẩm và loại sản phẩm là bắt buộc.', 'warning');
                    return;
                }
                try {
                    const resp = await DataService.upsertProduct(payload);
                    if (resp?.error) throw new Error(resp.error);
                    this.toast_('Đã lưu sản phẩm.', 'success');
                    ['product-id', 'product-name', 'product-type', 'product-offer', 'product-price', 'product-target', 'product-time', 'product-register', 'product-cancel'].forEach((id) => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    this.closeProductModal();
                    await this.loadProductsView(true);
                } catch (e) {
                    console.error('[Products] save failed:', e);
                    this.toast_(`Không lưu được sản phẩm: ${e.message}`, 'error');
                }
            },

            async deleteProduct(id) {
                if (!this.isAdminUser_()) return;
                if (!confirm('Xóa sản phẩm này?')) return;
                try {
                    const resp = await DataService.deleteProduct(id);
                    if (resp?.error) throw new Error(resp.error);
                    this.toast_('Đã xóa sản phẩm.', 'success');
                    await this.loadProductsView(true);
                } catch (e) {
                    console.error('[Products] delete failed:', e);
                    this.toast_(`Không xóa được sản phẩm: ${e.message}`, 'error');
                }
            },

            bindFeatureEvents_() {
                if (this.__featureEventsBound) return;
                this.__featureEventsBound = true;

                const bindInput = (id, event, handler) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.addEventListener(event, handler);
                };

                bindInput('kpi-personal-month', 'change', () => this.loadPersonalKPIView());
                bindInput('kpi-personal-keyword', 'input', debounce(() => this.renderPersonalKPITable(), 180));
                bindInput('weekly-week-start', 'change', () => this.loadWeeklyPlanView());
                bindInput('market-week-start', 'change', () => this.loadMarketBeatView());
                bindInput('focus-week-start', 'change', () => this.loadFocusReportView());
                bindInput('product-filter-name', 'input', debounce(() => this.applyProductFilters(), 180));
                bindInput('product-filter-type', 'input', debounce(() => this.applyProductFilters(), 180));
                bindInput('product-filter-target', 'input', debounce(() => this.applyProductFilters(), 180));
            }
        });

        app.updateTitle = function (pageId) {
            if (EXTRA_TITLES[pageId]) {
                const el = document.getElementById('page-title');
                if (el) el.textContent = EXTRA_TITLES[pageId];
                return;
            }
            if (originalUpdateTitle) return originalUpdateTitle(pageId);
        };

        app.loadDataForPage = async function (pageId) {
            if (pageId === 'kpi_personal') return this.loadPersonalKPIView();
            if (pageId === 'weekly_plan') return this.loadWeeklyPlanView();
            if (pageId === 'market_beat') return this.loadMarketBeatView();
            if (pageId === 'focus_report') return this.loadFocusReportView();
            if (pageId === 'products') return this.loadProductsView();
            if (originalLoadDataForPage) return originalLoadDataForPage(pageId);
        };

        if (originalInit) {
            app.init = async function (...args) {
                await originalInit(...args);
                if (typeof this.warmupFeatureData_ === 'function') {
                    this.warmupFeatureData_();
                }
            };
        }

        app.bindFeatureEvents_();
    }

    function tryPatch() {
        if (window.app && window.DataService) {
            patchApp(window.app);
            return true;
        }
        return false;
    }

    if (!tryPatch()) {
        const timer = setInterval(() => {
            if (tryPatch()) clearInterval(timer);
        }, 120);
        setTimeout(() => clearInterval(timer), 6000);
    }
})();
