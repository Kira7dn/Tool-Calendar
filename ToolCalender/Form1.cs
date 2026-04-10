using ToolCalender.Data;
using ToolCalender.Forms;
using ToolCalender.Models;
using ToolCalender.Services;

namespace ToolCalender
{
    public partial class Form1 : Form
    {
        // ── Color Palette ────────────────────────────────────────
        private static readonly Color CHeaderBg    = Color.FromArgb(15, 40, 80);
        private static readonly Color CHeaderText  = Color.White;
        private static readonly Color CBg          = Color.FromArgb(236, 241, 248);
        private static readonly Color CAccent      = Color.FromArgb(37, 99, 235);
        private static readonly Color CCard        = Color.White;
        private static readonly Color CText        = Color.FromArgb(30, 41, 59);
        private static readonly Color CMuted       = Color.FromArgb(100, 116, 139);
        private static readonly Color CBorder      = Color.FromArgb(203, 213, 225);
        private static readonly Color CToolbar     = Color.FromArgb(248, 250, 252);

        // Row status colors
        private static readonly Color CRowDanger    = Color.FromArgb(254, 226, 226);
        private static readonly Color CRowDangerTxt = Color.FromArgb(153, 27, 27);
        private static readonly Color CRowWarn      = Color.FromArgb(254, 243, 199);
        private static readonly Color CRowWarnTxt   = Color.FromArgb(120, 53, 15);
        private static readonly Color CRowAlert     = Color.FromArgb(255, 237, 213);
        private static readonly Color CRowAlertTxt  = Color.FromArgb(154, 52, 18);
        private static readonly Color CRowOk        = Color.White;
        private static readonly Color CRowOkTxt     = CText;

        // ── Controls ─────────────────────────────────────────────
        private DataGridView dgv       = new();
        private TextBox      txtSearch = new();
        private Label        lblClock  = new();
        private Label        lblTong   = new();
        private Label        lblSapHan = new();
        private Label        lblQuaHan = new();
        private Label        lblHomNay = new();
        private Panel        pnlStatTong   = new();
        private Panel        pnlStatSap    = new();
        private Panel        pnlStatQua    = new();
        private Panel        pnlStatHomNay = new();

        private readonly NotificationService _notifySvc = new();
        private NotifyIcon _notifyIcon = new();
        private List<DocumentRecord> _allDocs = new();

        // ════════════════════════════════════════════════════════════
        public Form1()
        {
            InitializeComponent();
            BuildUI();
            SetupTrayIcon();
            LoadData();
            _notifySvc.Initialize(_notifyIcon);
        }

        // ════════════════════════════════════════════════════════════
        // UI Construction
        // ════════════════════════════════════════════════════════════
        private void BuildUI()
        {
            this.Text          = "Quản Lý Văn Bản - Hệ Thống Nhắc Nhở Deadline";
            this.Size          = new Size(1280, 760);
            this.MinimumSize   = new Size(1000, 620);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor     = CBg;
            this.Font          = new Font("Segoe UI", 9.5f);
            this.Icon          = SystemIcons.Application;

            // ── Status Bar (Bottom) ─────────────────────────────
            var pnlStatus = new Panel
            {
                Dock      = DockStyle.Bottom,
                Height    = 28,
                BackColor = Color.FromArgb(30, 41, 59)
            };
            var lblStatusBar = new Label
            {
                Text      = "  ✅  Hệ thống đang hoạt động  |  Nhắc nhở tự động: 7 ngày • 3 ngày • 1 ngày trước hạn  |  Dữ liệu lưu cục bộ",
                ForeColor = Color.FromArgb(148, 163, 184),
                Dock      = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Font      = new Font("Segoe UI", 8.5f)
            };
            pnlStatus.Controls.Add(lblStatusBar);

            // ── Header ──────────────────────────────────────────
            var pnlHeader = new Panel
            {
                Dock      = DockStyle.Top,
                Height    = 84,
                BackColor = CHeaderBg
            };
            pnlHeader.Paint += (s, e) =>
            {
                // Accent line at bottom
                using var pen = new Pen(CAccent, 3);
                e.Graphics.DrawLine(pen, 0, pnlHeader.Height - 3, pnlHeader.Width, pnlHeader.Height - 3);
            };

            // --- User Info Pill (Góc phải trên) ---
            var pnlUserPill = new Panel {
                BackColor = Color.FromArgb(40, 255, 255, 255), // Màu trắng trong suốt mờ
                Height = 34,
                AutoSize = true,
                Padding = new Padding(10, 0, 10, 0),
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };
            pnlUserPill.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, 300, 34, 15, 15)); // Sẽ resize sau

            var lblUser = new Label {
                Text = $"👤 {SessionService.CurrentUser?.Username} ({SessionService.CurrentUser?.Role})",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                AutoSize = true,
                BackColor = Color.Transparent,
                Location = new Point(10, 8)
            };

            var btnLogout = new Label {
                Text = "🚪 Đăng xuất",
                ForeColor = Color.FromArgb(254, 202, 202),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Underline),
                AutoSize = true,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand,
                Location = new Point(10, 8) // Sẽ chỉnh lại trong sự kiện Resize
            };
            btnLogout.Click += (s, e) => {
                SessionService.Logout();
                Application.Restart();
            };

            pnlUserPill.Controls.Add(lblUser);
            pnlUserPill.Controls.Add(btnLogout);
            pnlHeader.Controls.Add(pnlUserPill);

            // Cập nhật vị trí và kích thước linh hoạt
            pnlHeader.Resize += (s, e) => {
                pnlUserPill.Width = lblUser.Width + btnLogout.Width + 35;
                pnlUserPill.Location = new Point(pnlHeader.Width - pnlUserPill.Width - 20, 12);
                lblUser.Location = new Point(10, 8);
                btnLogout.Location = new Point(lblUser.Right + 10, 9);
                
                lblClock.Location = new Point(pnlHeader.Width - lblClock.Width - 25, 48); // Đẩy đồng hồ xuống dưới Pill
            };

            var lblTitle = new Label
            {
                Text      = "🏛  HỆ THỐNG QUẢN LÝ VĂN BẢN HÀNH CHÍNH",
                ForeColor = CHeaderText,
                Font      = new Font("Segoe UI", 16f, FontStyle.Bold),
                AutoSize  = false,
                UseCompatibleTextRendering = true,
                Size      = new Size(800, 40),
                Location  = new Point(20, 8)
            };
            var lblSub = new Label
            {
                Text      = "Theo dõi thời hạn • Nhắc nhở tự động • Quản lý tập trung",
                ForeColor = Color.FromArgb(147, 197, 253),
                Font      = new Font("Segoe UI", 9.5f, FontStyle.Italic),
                AutoSize  = false,
                UseCompatibleTextRendering = true,
                Size      = new Size(800, 30),
                Location  = new Point(24, 45)
            };

            lblClock = new Label
            {
                ForeColor = Color.FromArgb(147, 197, 253),
                Font      = new Font("Segoe UI", 9.5f),
                AutoSize  = true,
                TextAlign = ContentAlignment.MiddleRight
            };
            UpdateClock();
            var clockTimer = new System.Windows.Forms.Timer { Interval = 30000 };
            clockTimer.Tick += (s, e) => UpdateClock();
            clockTimer.Start();

            pnlHeader.Controls.AddRange(new Control[] { lblTitle, lblSub, lblClock });
            pnlHeader.Controls.Add(lblTitle);

            // ── Stats Bar ────────────────────────────────────────
            var pnlStats = new Panel
            {
                Dock      = DockStyle.Top,
                Height    = 125,
                BackColor = Color.FromArgb(20, 52, 100),
                Padding   = new Padding(16, 12, 16, 12)
            };

            var statFlow = new FlowLayoutPanel
            {
                Dock          = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Padding       = new Padding(0),
                WrapContents  = false
            };

            (pnlStatTong, lblTong)     = CreateStatCard("📄  Tổng Văn Bản",        "0", Color.FromArgb(59, 130, 246));
            (pnlStatSap, lblSapHan)    = CreateStatCard("⏰  Sắp Hết Hạn (≤7 ngày)", "0", Color.FromArgb(245, 158, 11));
            (pnlStatQua, lblQuaHan)    = CreateStatCard("🚨  Quá Hạn",              "0", Color.FromArgb(239, 68, 68));
            (pnlStatHomNay, lblHomNay) = CreateStatCard("📅  Hôm Nay", DateTime.Today.ToString("dd/MM/yyyy"), Color.FromArgb(16, 185, 129));

            statFlow.Controls.AddRange(new Control[] { pnlStatTong, pnlStatSap, pnlStatQua, pnlStatHomNay });
            pnlStats.Controls.Add(statFlow);

            // ── Toolbar ──────────────────────────────────────────
            var pnlToolbar = new Panel
            {
                Dock      = DockStyle.Top,
                Height    = 54,
                BackColor = CToolbar,
                Padding   = new Padding(14, 0, 14, 0)
            };
            pnlToolbar.Paint += (s, e) =>
            {
                e.Graphics.DrawLine(new Pen(CBorder, 1), 0, 0, pnlToolbar.Width, 0);
                e.Graphics.DrawLine(new Pen(CBorder, 1), 0, pnlToolbar.Height - 1, pnlToolbar.Width, pnlToolbar.Height - 1);
            };

            var btnAdd = MakeToolButton("➕  Thêm Văn Bản", Color.FromArgb(21, 128, 61));
            btnAdd.Click += BtnAdd_Click;

            var btnEdit = MakeToolButton("✏️  Xem / Sửa", Color.FromArgb(37, 99, 235));
            btnEdit.Click += BtnEdit_Click;

            var btnDelete = MakeToolButton("🗑  Xóa", Color.FromArgb(185, 28, 28));
            btnDelete.Click += BtnDelete_Click;

            var btnCalendar = MakeToolButton("📅  Tạo Lịch Nhắc", Color.FromArgb(124, 58, 237));
            btnCalendar.Click += BtnCalendar_Click;

            var btnOpenFile = MakeToolButton("📂  Mở File Gốc", Color.FromArgb(71, 85, 105));
            btnOpenFile.Click += BtnOpenFile_Click;

            var btnRefresh = MakeToolButton("🔄  Làm Mới", Color.FromArgb(71, 85, 105));
            btnRefresh.Click += (s, e) => LoadData();

            var btnImport = MakeToolButton("📥  Nhập Dữ Liệu", Color.FromArgb(71, 85, 105));
            btnImport.Click += BtnImport_Click;

            // Search box — dùng TextBox đơn giản với icon trong Paint để tránh bị che chữ
            var pnlSearch = new Panel
            {
                Width     = 240,
                Height    = 32,
                BackColor = CCard,
                Margin    = new Padding(12, 0, 0, 0)
            };
            pnlSearch.Paint += (s, e) =>
            {
                using var borderPen = new Pen(CBorder);
                e.Graphics.DrawRectangle(borderPen, new Rectangle(0, 0, pnlSearch.Width - 1, pnlSearch.Height - 1));
                // Vẽ icon 🔍 như text để không tạo control chồng lên TextBox
                using var iconBrush = new SolidBrush(CMuted);
                using var iconFont  = new Font("Segoe UI", 10f);
                e.Graphics.DrawString("🔍", iconFont, iconBrush, new PointF(5, 6));
            };

            txtSearch = new TextBox
            {
                BorderStyle     = BorderStyle.None,
                BackColor       = CCard,
                ForeColor       = CText,
                Font            = new Font("Segoe UI", 9.5f),
                PlaceholderText = "Tìm kiếm văn bản...",
                Location        = new Point(28, 7),
                Width           = 206
            };
            txtSearch.TextChanged += (s, e) => FilterData();
            pnlSearch.Controls.Add(txtSearch);

            var toolFlow = new FlowLayoutPanel
            {
                Dock          = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Padding       = new Padding(0, 11, 0, 0),
                WrapContents  = false
            };
            toolFlow.Controls.AddRange(new Control[]
            {
                btnAdd, btnEdit, btnDelete, btnCalendar, btnOpenFile, btnImport, btnRefresh, pnlSearch
            });
            pnlToolbar.Controls.Add(toolFlow);

            // Áp dụng phân quyền Main
            if (!SessionService.IsAdmin)
            {
                btnAdd.Visible = false;
                btnDelete.Visible = false;
                btnImport.Visible = false;
            }

            // ── DataGridView ─────────────────────────────────────
            var pnlGrid = new Panel
            {
                Dock    = DockStyle.Fill,
                Padding = new Padding(14, 10, 14, 10)
            };

            dgv = new DataGridView
            {
                Dock                           = DockStyle.Fill,
                BackgroundColor                = CBg,
                BorderStyle                    = BorderStyle.None,
                GridColor                      = CBorder,
                RowHeadersVisible              = false,
                AllowUserToAddRows             = false,
                AllowUserToDeleteRows          = false,
                AllowUserToResizeColumns       = true,
                AllowUserToResizeRows          = false,
                ReadOnly                       = true,
                SelectionMode                  = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect                    = false,
                AutoSizeRowsMode               = DataGridViewAutoSizeRowsMode.AllCells,
                AutoSizeColumnsMode            = DataGridViewAutoSizeColumnsMode.None,
                ColumnHeadersHeightSizeMode        = DataGridViewColumnHeadersHeightSizeMode.AutoSize,
                RowTemplate                    = { Height = 38 },
                Font                           = new Font("Segoe UI", 9.5f),
                CellBorderStyle                = DataGridViewCellBorderStyle.SingleHorizontal,
                EnableHeadersVisualStyles      = false
            };

            dgv.ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
            {
                BackColor  = Color.FromArgb(30, 41, 59),
                ForeColor  = Color.White,
                Font       = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Alignment  = DataGridViewContentAlignment.MiddleLeft,
                Padding    = new Padding(10, 8, 10, 8),
                SelectionBackColor = Color.FromArgb(30, 41, 59),
                SelectionForeColor = Color.White,
                WrapMode   = DataGridViewTriState.True
            };
            dgv.DefaultCellStyle = new DataGridViewCellStyle
            {
                SelectionBackColor = Color.FromArgb(219, 234, 254),
                SelectionForeColor = CText,
                Padding            = new Padding(8, 2, 8, 2),
                Font               = new Font("Segoe UI", 9.5f)
            };
            dgv.AlternatingRowsDefaultCellStyle = new DataGridViewCellStyle
            {
                BackColor          = Color.FromArgb(248, 250, 252),
                SelectionBackColor = Color.FromArgb(219, 234, 254),
                SelectionForeColor = CText
            };

            SetupGridColumns();

            dgv.CellDoubleClick += (s, e) =>
            {
                if (e.RowIndex >= 0) OpenDetail(e.RowIndex);
            };
            dgv.DataBindingComplete += DgvColorRows;
            dgv.SelectionChanged   += DgvColorRows;

            // Xử lý tự động dãn rộng cột Trích Yếu khi Form/Grid thay đổi kích thước
            dgv.Resize += (s, e) => AutoSizeTrichYeuColumn();
            dgv.ColumnWidthChanged += (s, e) => {
                if (e.Column.Name != "colTrichYeu") AutoSizeTrichYeuColumn();
            };

            pnlGrid.Controls.Add(dgv);

            // ── Assembly ─────────────────────────────────────────
            this.Controls.Add(pnlGrid);
            this.Controls.Add(pnlToolbar);
            this.Controls.Add(pnlStats);
            this.Controls.Add(pnlHeader);
            this.Controls.Add(pnlStatus);
        }

        // ════════════════════════════════════════════════════════════
        // Grid Columns
        // ════════════════════════════════════════════════════════════
        private void SetupGridColumns()
        {
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colStt",
                HeaderText = "STT",
                Width      = 48,
                SortMode   = DataGridViewColumnSortMode.NotSortable,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Alignment = DataGridViewContentAlignment.MiddleCenter,
                    Font = new Font("Segoe UI", 9f)
                }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name         = "colSoVb",
                HeaderText   = "Số Văn Bản",
                Width        = 180, // Có thể kéo dãn bằng tay
                DefaultCellStyle = new DataGridViewCellStyle { Font = new Font("Segoe UI", 9.5f, FontStyle.Bold) }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name         = "colTrichYeu",
                HeaderText   = "Trích Yếu / Nội Dung",
                Width        = 350, // Khởi tạo, sẽ được tự động tính lại ở dưới
                DefaultCellStyle = new DataGridViewCellStyle { WrapMode = DataGridViewTriState.True }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colNgayBH",
                HeaderText = "Ngày Ban Hành",
                Width      = 125,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Alignment = DataGridViewContentAlignment.MiddleCenter
                }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colChuQuan",
                HeaderText = "Cơ Quan Chủ Quản Tham Mưu",
                Width      = 210
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colThoiHan",
                HeaderText = "Thời Hạn",
                Width      = 115,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Font      = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    Alignment = DataGridViewContentAlignment.MiddleCenter
                }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colTrangThai",
                HeaderText = "Trạng Thái",
                Width      = 145,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Font      = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    Alignment = DataGridViewContentAlignment.MiddleCenter
                }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name       = "colLich",
                HeaderText = "Lịch",
                Width      = 55,
                SortMode   = DataGridViewColumnSortMode.NotSortable,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Alignment = DataGridViewContentAlignment.MiddleCenter,
                    Font      = new Font("Segoe UI", 11f)
                }
            });
        }

        // ════════════════════════════════════════════════════════════
        // Data
        // ════════════════════════════════════════════════════════════
        private void LoadData()
        {
            _allDocs = DatabaseService.GetAll();
            FilterData();
            UpdateStats();
        }

        private void FilterData()
        {
            string q = txtSearch.Text.Trim().ToLower();
            var list = string.IsNullOrEmpty(q)
                ? _allDocs
                : _allDocs.Where(d =>
                    (d.SoVanBan       ?? "").ToLower().Contains(q) ||
                    (d.TrichYeu       ?? "").ToLower().Contains(q) ||
                    (d.CoQuanBanHanh  ?? "").ToLower().Contains(q) ||
                    (d.CoQuanChuQuan  ?? "").ToLower().Contains(q) ||
                    (d.DonViChiDao    ?? "").ToLower().Contains(q)).ToList();

            dgv.Rows.Clear();
            int stt = 1;
            foreach (var doc in list)
            {
                int idx = dgv.Rows.Add(
                    stt++,
                    doc.SoVanBan,
                    doc.TrichYeu,
                    doc.NgayBanHanh?.ToString("dd/MM/yyyy") ?? "—",
                    doc.CoQuanChuQuan,
                    doc.ThoiHan?.ToString("dd/MM/yyyy") ?? "Chưa có",
                    GetTrangThaiText(doc),
                    doc.DaTaoLich ? "✅" : "—"
                );
                dgv.Rows[idx].Tag = doc;
            }
            DgvColorRows(null, null!);
        }

        private string GetTrangThaiText(DocumentRecord doc)
        {
            if (doc.ThoiHan == null) return "Chưa xác định";
            int d = doc.SoNgayConLai;
            if (d < 0)   return $"🚨 Quá hạn {Math.Abs(d)} ngày";
            if (d == 0)  return "⚡ Hết hạn hôm nay!";
            if (d <= 3)  return $"⚠️ Còn {d} ngày";
            if (d <= 7)  return $"⏰ Còn {d} ngày";
            return $"✅ Còn {d} ngày";
        }

        private void UpdateStats()
        {
            int tong   = _allDocs.Count;
            int sap    = _allDocs.Count(d => d.SoNgayConLai is >= 1 and <= 7);
            int qua    = _allDocs.Count(d => d.SoNgayConLai < 0);
            int homNay = _allDocs.Count(d => d.SoNgayConLai == 0);

            lblTong.Text   = tong.ToString();
            lblSapHan.Text = sap.ToString();
            lblQuaHan.Text = qua.ToString();
            lblHomNay.Text = homNay.ToString();

            // Highlight if urgent
            pnlStatQua.BackColor  = qua > 0
                ? Color.FromArgb(239, 68, 68)
                : Color.FromArgb(50, 70, 100);
            pnlStatSap.BackColor  = sap > 0
                ? Color.FromArgb(217, 119, 6)
                : Color.FromArgb(50, 70, 100);
            pnlStatHomNay.BackColor = homNay > 0
                ? Color.FromArgb(239, 68, 68)
                : Color.FromArgb(50, 70, 100);
        }

        private void DgvColorRows(object? sender, EventArgs e)
        {
            foreach (DataGridViewRow row in dgv.Rows)
            {
                if (row.Tag is not DocumentRecord doc) continue;
                int days = doc.SoNgayConLai;

                Color bg, fg;
                if      (days < 0)  { bg = CRowDanger; fg = CRowDangerTxt; }
                else if (days == 0) { bg = Color.FromArgb(252, 165, 165); fg = Color.FromArgb(127, 29, 29); }
                else if (days <= 3) { bg = CRowAlert;  fg = CRowAlertTxt; }
                else if (days <= 7) { bg = CRowWarn;   fg = CRowWarnTxt; }
                else                { bg = CRowOk;     fg = CRowOkTxt; }

                row.DefaultCellStyle.BackColor      = bg;
                row.DefaultCellStyle.ForeColor      = fg;
                
                // Giữ nguyên màu gốc khi được chọn, chỉ làm đậm chữ
                row.DefaultCellStyle.SelectionBackColor = ControlPaint.Dark(bg, 0.05f); // Chỉ hơi sậm lại 5% để phân biệt
                row.DefaultCellStyle.SelectionForeColor = fg;

                // Tạo hiệu ứng đậm chữ khi dòng được chọn (Focus)
                if (row.Selected)
                {
                    row.DefaultCellStyle.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                }
                else
                {
                    row.DefaultCellStyle.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
                }
            }
        }

        // ════════════════════════════════════════════════════════════
        // Actions
        // ════════════════════════════════════════════════════════════
        private void BtnAdd_Click(object? sender, EventArgs e)
        {
            using var form = new FormAddDocument();
            if (form.ShowDialog(this) == DialogResult.OK && form.Result != null)
            {
                int id = DatabaseService.Insert(form.Result);
                form.Result.Id = id;
                LoadData();

                // Highlight newly added
                foreach (DataGridViewRow row in dgv.Rows)
                    if (row.Tag is DocumentRecord d && d.SoVanBan == form.Result.SoVanBan)
                        row.Selected = true;

                ShowSuccessToast($"Đã lưu văn bản «{form.Result.SoVanBan}» thành công!");
            }
        }

        private void BtnEdit_Click(object? sender, EventArgs e)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null)
            {
                ShowInfo("Vui lòng chọn một văn bản để xem / chỉnh sửa.");
                return;
            }
            OpenDetail(-1, doc);
        }

        private void BtnDelete_Click(object? sender, EventArgs e)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null)
            {
                ShowInfo("Vui lòng chọn một văn bản để xóa.");
                return;
            }

            using var confirm = new FormConfirm(
                "Xác nhận xóa văn bản",
                $"Bạn có chắc chắn muốn xóa văn bản:\n\n  «{doc.SoVanBan}»\n\nThao tác này không thể hoàn tác!",
                "🗑  Xóa", Color.FromArgb(185, 28, 28));

            if (confirm.ShowDialog(this) == DialogResult.OK)
            {
                DatabaseService.Delete(doc.Id);
                LoadData();
            }
        }

        private void BtnCalendar_Click(object? sender, EventArgs e)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null)
            {
                ShowInfo("Vui lòng chọn một văn bản để tạo lịch nhắc.");
                return;
            }
            if (doc.ThoiHan == null)
            {
                MessageBox.Show("Văn bản này không có thời hạn. Không thể tạo lịch.",
                    "Không có thời hạn", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                CalendarService.CreateCalendarEvents(doc);
                doc.DaTaoLich = true;
                DatabaseService.Update(doc);
                LoadData();
                ShowSuccessToast($"Đã tạo lịch nhắc nhở cho «{doc.SoVanBan}» (7, 3, 1 ngày trước hạn)");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi khi tạo lịch:\n{ex.Message}", "Lỗi",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void BtnOpenFile_Click(object? sender, EventArgs e)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null) { ShowInfo("Vui lòng chọn một văn bản."); return; }

            if (string.IsNullOrEmpty(doc.FilePath) || !File.Exists(doc.FilePath))
            {
                MessageBox.Show("Không tìm thấy file gốc.\nFile có thể đã bị di chuyển hoặc xóa.",
                    "Không tìm thấy", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName       = doc.FilePath,
                UseShellExecute = true
            });
        }

        private void OpenDetail(int rowIndex, DocumentRecord? doc = null)
        {
            if (doc == null)
            {
                var (d, _) = GetSelectedDoc();
                doc = d;
            }
            if (doc == null) return;

            using var detail = new FormDetail(doc);
            if (detail.ShowDialog(this) == DialogResult.OK && detail.UpdatedRecord != null)
            {
                DatabaseService.Update(detail.UpdatedRecord);
                LoadData();
                ShowSuccessToast("Đã cập nhật thông tin văn bản.");
            }
        }

        // ════════════════════════════════════════════════════════════
        // Helpers
        // ════════════════════════════════════════════════════════════
        private (DocumentRecord? doc, int rowIndex) GetSelectedDoc()
        {
            if (dgv.SelectedRows.Count == 0) return (null, -1);
            var row = dgv.SelectedRows[0];
            return (row.Tag as DocumentRecord, row.Index);
        }

        private void UpdateClock()
        {
            lblClock.Text = $"🕐  {DateTime.Now:HH:mm}  |  {DateTime.Now:dddd, dd/MM/yyyy}";
            // Reposition
            var pnlH = lblClock.Parent;
            if (pnlH != null)
                lblClock.Location = new Point(pnlH.Width - lblClock.Width - 24, 26);
        }

        private void ShowInfo(string msg) =>
            MessageBox.Show(msg, "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Information);

        private void ShowSuccessToast(string msg)
        {
            _notifyIcon.ShowBalloonTip(3000, "✅ Thành công", msg, ToolTipIcon.Info);
        }

        // ── Stat Card ────────────────────────────────────────────
        // Vẽ trực tiếp qua Paint để tránh label bị clip hoặc chồng lên nhau
        private (Panel panel, Label valueLabel) CreateStatCard(string caption, string value, Color accent)
        {
            var pnl = new Panel
            {
                Width     = 280,
                Height    = 95,
                BackColor = Color.FromArgb(50, 70, 100),
                Margin    = new Padding(0, 0, 10, 0),
                Cursor    = Cursors.Default
            };

            var lblCaption = new Label
            {
                Text      = caption,
                ForeColor = Color.FromArgb(148, 163, 184),
                Font      = new Font("Segoe UI", 10f),
                AutoSize  = false,
                UseCompatibleTextRendering = true,
                Width     = 265,
                Height    = 28,
                Location  = new Point(14, 12),
                TextAlign = ContentAlignment.TopLeft
            };

            // Label giá trị lớn nằm ở NỬA MẶT DƯỚI BÊN PHẢI (Top/Bottom layout)
            var lblValue = new Label
            {
                Text      = value,
                ForeColor = Color.White,
                Font      = new Font("Segoe UI", 18f, FontStyle.Bold),
                AutoSize  = false,
                UseCompatibleTextRendering = true,
                Width     = 260,
                Height    = 46,
                Location  = new Point(14, 40),
                TextAlign = ContentAlignment.TopRight
            };

            pnl.Controls.Add(lblCaption);
            pnl.Controls.Add(lblValue);

            pnl.Paint += (s, e) =>
            {
                var g = e.Graphics;
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

                // Accent border trái
                using var accentPen = new Pen(accent, 4);
                g.DrawLine(accentPen, 2, 4, 2, pnl.Height - 4);

                // Glow nhẹ phía trên
                using var glowBrush = new System.Drawing.Drawing2D.LinearGradientBrush(
                    new Rectangle(0, 0, pnl.Width, 4),
                    Color.FromArgb(50, accent.R, accent.G, accent.B),
                    Color.Transparent, 90f);
                g.FillRectangle(glowBrush, 0, 0, pnl.Width, 4);
            };

            return (pnl, lblValue);
        }

        // ── Tool Button ──────────────────────────────────────────
        private Button MakeToolButton(string text, Color color)
        {
            var btn = new Button
            {
                Text       = text,
                BackColor  = color,
                ForeColor  = Color.White,
                FlatStyle  = FlatStyle.Flat,
                Font       = new Font("Segoe UI", 9f, FontStyle.Bold),
                Height     = 32,
                AutoSize   = true,
                Cursor     = Cursors.Hand,
                Margin     = new Padding(0, 0, 6, 0),
                FlatAppearance =
                {
                    BorderSize           = 0,
                    MouseOverBackColor   = ControlPaint.Light(color, 0.15f),
                    MouseDownBackColor   = ControlPaint.Dark(color, 0.1f)
                }
            };
            return btn;
        }

        // ════════════════════════════════════════════════════════════
        // System Tray
        // ════════════════════════════════════════════════════════════
        private void SetupTrayIcon()
        {
            _notifyIcon = new NotifyIcon
            {
                Text    = "Quản Lý Văn Bản - Nhắc Nhở Deadline",
                Icon    = SystemIcons.Application,
                Visible = true
            };

            var menu = new ContextMenuStrip();
            menu.Items.Add("📋  Mở cửa sổ chính", null, (s, e) =>
            {
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
            });
            menu.Items.Add("➕  Thêm văn bản mới", null, BtnAdd_Click);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("❌  Thoát", null, (s, e) =>
            {
                _notifyIcon.Visible = false;
                Application.Exit();
            });

            _notifyIcon.ContextMenuStrip = menu;
            _notifyIcon.DoubleClick += (s, e) =>
            {
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
            };

            this.FormClosing += (s, e) =>
            {
                if (e.CloseReason == CloseReason.UserClosing)
                {
                    e.Cancel = true;
                    this.Hide();
                    _notifyIcon.ShowBalloonTip(3000, "Quản Lý Văn Bản",
                        "Ứng dụng vẫn chạy nền. Double-click icon để mở lại.",
                        ToolTipIcon.Info);
                }
            };
        }

        private void AutoSizeTrichYeuColumn()
        {
            if (dgv.Columns.Count == 0 || !dgv.Columns.Contains("colTrichYeu")) return;

            // Tính tổng độ rộng của tất cả các cột NGOẠI TRỪ cột Trích yếu
            int otherColumnsWidth = 0;
            foreach (DataGridViewColumn col in dgv.Columns)
            {
                if (col.Name != "colTrichYeu" && col.Visible)
                {
                    otherColumnsWidth += col.Width;
                }
            }

            // Độ rộng khả dụng của Grid (trừ đi khoảng cho scrollbar nếu có)
            int availableWidth = dgv.ClientSize.Width - 2; 
            
            // Cập nhật độ rộng cho cột Trích yếu
            int newWidth = availableWidth - otherColumnsWidth;
            if (newWidth > 200) // Đảm bảo không quá nhỏ
            {
                dgv.Columns["colTrichYeu"].Width = newWidth;
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _notifySvc.Dispose();
            _notifyIcon.Dispose();
            base.OnFormClosed(e);
        }
        private async void BtnImport_Click(object? sender, EventArgs e)
        {
            using var ofd = new OpenFileDialog { Filter = "Văn bản (*.pdf;*.docx;*.doc)|*.pdf;*.docx;*.doc", Title = "Chọn văn bản để nhập" };
            if (ofd.ShowDialog() == DialogResult.OK)
            {
                await ProcessFileImport(ofd.FileName);
            }
        }

        private async Task ProcessFileImport(string filePath)
        {
            try
            {
                // Hiện thông báo đang xử lý
                var loading = new Form { Text = "Đang xử lý...", Size = new Size(300, 100), StartPosition = FormStartPosition.CenterParent, FormBorderStyle = FormBorderStyle.FixedToolWindow };
                loading.Controls.Add(new Label { Text = "Đang bóc tách dữ liệu từ văn bản...\nVui lòng đợi trong giây lát.", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter });
                loading.Show(this);
                this.Enabled = false;

                var result = await DocumentExtractorService.ExtractFromFileAsync(filePath);
                
                loading.Close();
                this.Enabled = true;

                // Mở Form xác nhận thông tin
                using var formAdd = new FormAddDocument(result);
                if (formAdd.ShowDialog(this) == DialogResult.OK && formAdd.Result != null)
                {
                    int id = DatabaseService.Insert(formAdd.Result);
                    LoadData();
                    ShowSuccessToast("Đã nhập văn bản thành công!");
                }
            }
            catch (Exception ex)
            {
                this.Enabled = true;
                MessageBox.Show($"Lỗi khi bóc tách văn bản: {ex.Message}", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        [System.Runtime.InteropServices.DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);
    }
}
