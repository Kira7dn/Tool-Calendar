using ToolCalender.Data;
using ToolCalender.Forms;
using ToolCalender.Models;
using ToolCalender.Services;

namespace ToolCalender
{
    public partial class Form1 : Form
    {
        // ── Color Palette (Government Professional) ─────────────
        private static readonly Color CHeaderBg = Color.FromArgb(30, 58, 95);
        private static readonly Color CHeaderText = Color.White;
        private static readonly Color CBackground = Color.FromArgb(240, 244, 248);
        private static readonly Color CAccent = Color.FromArgb(37, 99, 235);
        private static readonly Color CCard = Color.White;
        private static readonly Color CText = Color.FromArgb(30, 41, 59);
        private static readonly Color CMuted = Color.FromArgb(100, 116, 139);
        private static readonly Color CBorder = Color.FromArgb(203, 213, 225);

        // Status colors for rows
        private static readonly Color CRowDanger = Color.FromArgb(254, 226, 226);
        private static readonly Color CRowDangerText = Color.FromArgb(153, 27, 27);
        private static readonly Color CRowWarning = Color.FromArgb(254, 243, 199);
        private static readonly Color CRowWarningText = Color.FromArgb(120, 53, 15);
        private static readonly Color CRowAlert = Color.FromArgb(255, 237, 213);
        private static readonly Color CRowAlertText = Color.FromArgb(154, 52, 18);
        private static readonly Color CRowOk = Color.FromArgb(220, 252, 231);
        private static readonly Color CRowOkText = Color.FromArgb(21, 128, 61);

        // ── Controls ─────────────────────────────────────────────
        private DataGridView dgv = new();
        private Label lblTong = new();
        private Label lblSapHan = new();
        private Label lblQuaHan = new();
        private Label lblHienTai = new();
        private TextBox txtSearch = new();

        private readonly NotificationService _notifySvc = new();
        private NotifyIcon _notifyIcon = new();
        private List<DocumentRecord> _allDocs = new();

        public Form1()
        {
            InitializeComponent();
            BuildUI();
            SetupTrayIcon();
            LoadData();
            _notifySvc.Initialize(_notifyIcon);
        }

        // ════════════════════════════════════════════════════════
        // UI Construction
        // ════════════════════════════════════════════════════════
        private void BuildUI()
        {
            this.Text = "Quản Lý Văn Bản - Hệ Thống Nhắc Nhở";
            this.Size = new Size(1200, 720);
            this.MinimumSize = new Size(900, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = CBackground;
            this.Font = new Font("Segoe UI", 9.5f);
            this.Icon = SystemIcons.Application;

            // ── Header ──────────────────────────────────────────
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 68,
                BackColor = CHeaderBg
            };

            var lblTitle = new Label
            {
                Text = "🏛  HỆ THỐNG QUẢN LÝ VĂN BẢN HÀNH CHÍNH",
                ForeColor = CHeaderText,
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(20, 18)
            };

            lblHienTai = new Label
            {
                ForeColor = Color.FromArgb(147, 197, 253),
                Font = new Font("Segoe UI", 9f),
                AutoSize = true,
                Location = new Point(0, 10)
            };
            UpdateClock();
            // Auto-update clock
            var clockTimer = new System.Windows.Forms.Timer { Interval = 60000 };
            clockTimer.Tick += (s, e) => UpdateClock();
            clockTimer.Start();
            lblHienTai.Left = this.ClientSize.Width - lblHienTai.Width - 20;

            pnlHeader.Controls.AddRange(new Control[] { lblTitle, lblHienTai });
            pnlHeader.Resize += (s, e) => lblHienTai.Left = pnlHeader.Width - lblHienTai.Width - 20;

            // ── Stats Bar ────────────────────────────────────────
            var pnlStats = new Panel
            {
                Dock = DockStyle.Top,
                Height = 80,
                BackColor = Color.FromArgb(15, 40, 75),
                Padding = new Padding(20, 15, 20, 10)
            };

            var statLayout = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Padding = new Padding(0)
            };

            lblTong = CreateStatCard("Tổng văn bản", "0", Color.FromArgb(59, 130, 246));
            lblSapHan = CreateStatCard("Sắp hết hạn (≤7 ngày)", "0", Color.FromArgb(245, 158, 11));
            lblQuaHan = CreateStatCard("Quá hạn", "0", Color.FromArgb(239, 68, 68));
            var lblHomNay = CreateStatCard("Hôm nay", DateTime.Today.ToString("dd/MM/yyyy"), Color.FromArgb(16, 185, 129));

            statLayout.Controls.AddRange(new[] { lblTong, lblSapHan, lblQuaHan, lblHomNay });
            pnlStats.Controls.Add(statLayout);

            // ── Toolbar ──────────────────────────────────────────
            var pnlToolbar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = CCard,
                Padding = new Padding(15, 10, 15, 0)
            };
            pnlToolbar.Paint += (s, e) =>
                e.Graphics.DrawLine(new Pen(CBorder), 0, pnlToolbar.Height - 1, pnlToolbar.Width, pnlToolbar.Height - 1);

            var btnAdd = MakeToolButton("➕  Thêm Văn Bản", Color.FromArgb(21, 128, 61));
            btnAdd.Click += BtnAdd_Click;

            var btnDelete = MakeToolButton("🗑  Xóa", Color.FromArgb(185, 28, 28));
            btnDelete.Click += BtnDelete_Click;

            var btnCalendar = MakeToolButton("📅  Tạo Lịch", Color.FromArgb(37, 99, 235));
            btnCalendar.Click += BtnCalendar_Click;

            var btnRefresh = MakeToolButton("🔄  Làm Mới", Color.FromArgb(71, 85, 105));
            btnRefresh.Click += (s, e) => LoadData();

            var btnOpenFile = MakeToolButton("📂  Mở File Gốc", Color.FromArgb(124, 58, 237));
            btnOpenFile.Click += BtnOpenFile_Click;

            // Search
            var lblSearch = new Label
            {
                Text = "🔍",
                Font = new Font("Segoe UI", 12f),
                ForeColor = CMuted,
                AutoSize = true,
                Margin = new Padding(15, 4, 2, 0)
            };
            txtSearch = new TextBox
            {
                Width = 200,
                Height = 30,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = CBackground,
                ForeColor = CText,
                Font = new Font("Segoe UI", 9.5f),
                PlaceholderText = "Tìm kiếm...",
                Margin = new Padding(0, 4, 0, 0)
            };
            txtSearch.TextChanged += (s, e) => FilterData();

            var toolFlow = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                Padding = new Padding(0)
            };
            toolFlow.Controls.AddRange(new Control[] { btnAdd, btnDelete, btnCalendar, btnOpenFile, btnRefresh, lblSearch, txtSearch });
            pnlToolbar.Controls.Add(toolFlow);

            // ── DataGridView ─────────────────────────────────────
            dgv = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = CBackground,
                BorderStyle = BorderStyle.None,
                GridColor = CBorder,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AutoSizeRowsMode = DataGridViewAutoSizeRowsMode.AllCells,
                ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing,
                ColumnHeadersHeight = 38,
                RowTemplate = { Height = 36 },
                Font = new Font("Segoe UI", 9.5f),
                CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal
            };

            dgv.ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
            {
                BackColor = Color.FromArgb(51, 65, 85),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Alignment = DataGridViewContentAlignment.MiddleLeft,
                Padding = new Padding(8, 0, 0, 0)
            };
            dgv.DefaultCellStyle = new DataGridViewCellStyle
            {
                SelectionBackColor = Color.FromArgb(219, 234, 254),
                SelectionForeColor = CText,
                Padding = new Padding(6, 2, 6, 2)
            };

            SetupGridColumns();

            dgv.CellDoubleClick += (s, e) =>
            {
                if (e.RowIndex >= 0) ShowDetail(e.RowIndex);
            };
            dgv.DataBindingComplete += DgvColorRows;

            // ── Status bar ───────────────────────────────────────
            var pnlStatus = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 26,
                BackColor = Color.FromArgb(51, 65, 85)
            };
            var lblStatusBar = new Label
            {
                Text = "  ✅ Hệ thống đang hoạt động | Nhắc nhở: 7 ngày, 3 ngày, 1 ngày trước hạn",
                ForeColor = Color.FromArgb(148, 163, 184),
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Font = new Font("Segoe UI", 8.5f)
            };
            pnlStatus.Controls.Add(lblStatusBar);

            // ── Assembly ─────────────────────────────────────────
            this.Controls.Add(dgv);
            this.Controls.Add(pnlToolbar);
            this.Controls.Add(pnlStats);
            this.Controls.Add(pnlHeader);
            this.Controls.Add(pnlStatus);
        }

        private void SetupGridColumns()
        {
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colStt",
                HeaderText = "STT",
                Width = 50,
                SortMode = DataGridViewColumnSortMode.NotSortable
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colSoVb",
                HeaderText = "Số Văn Bản",
                Width = 140
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colTrichYeu",
                HeaderText = "Trích Yếu / Nội Dung",
                AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill,
                DefaultCellStyle = new DataGridViewCellStyle { WrapMode = DataGridViewTriState.True }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colNgayBH",
                HeaderText = "Ngày Ban Hành",
                Width = 120
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colCoQuan",
                HeaderText = "Cơ Quan Ban Hành",
                Width = 180
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colThoiHan",
                HeaderText = "Thời Hạn",
                Width = 100,
                DefaultCellStyle = new DataGridViewCellStyle { Font = new Font("Segoe UI", 9.5f, FontStyle.Bold) }
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colDonVi",
                HeaderText = "Đơn Vị Chỉ Đạo",
                Width = 180
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colTrangThai",
                HeaderText = "Trạng Thái",
                Width = 130
            });
            dgv.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "colLich",
                HeaderText = "Lịch",
                Width = 60,
                SortMode = DataGridViewColumnSortMode.NotSortable
            });
        }

        // ════════════════════════════════════════════════════════
        // Data
        // ════════════════════════════════════════════════════════
        private void LoadData()
        {
            _allDocs = DatabaseService.GetAll();
            FilterData();
            UpdateStats();
        }

        private void FilterData()
        {
            string q = txtSearch.Text.Trim().ToLower();
            var filtered = string.IsNullOrEmpty(q)
                ? _allDocs
                : _allDocs.Where(d =>
                    (d.SoVanBan ?? "").ToLower().Contains(q) ||
                    (d.TrichYeu ?? "").ToLower().Contains(q) ||
                    (d.CoQuanBanHanh ?? "").ToLower().Contains(q) ||
                    (d.DonViChiDao ?? "").ToLower().Contains(q)).ToList();

            dgv.Rows.Clear();
            int stt = 1;
            foreach (var doc in filtered)
            {
                dgv.Rows.Add(
                    stt++,
                    doc.SoVanBan,
                    doc.TrichYeu,
                    doc.NgayBanHanh?.ToString("dd/MM/yyyy") ?? "—",
                    doc.CoQuanBanHanh,
                    doc.ThoiHan?.ToString("dd/MM/yyyy") ?? "Chưa có",
                    doc.DonViChiDao,
                    doc.TrangThai,
                    doc.DaTaoLich ? "✅" : "—"
                );
                dgv.Rows[dgv.Rows.Count - 1].Tag = doc;
            }
            DgvColorRows(null, null!);
        }

        private void UpdateStats()
        {
            int tong = _allDocs.Count;
            int sapHan = _allDocs.Count(d => d.SoNgayConLai is >= 0 and <= 7);
            int quaHan = _allDocs.Count(d => d.SoNgayConLai < 0);
            SetStatCard(lblTong, tong.ToString());
            SetStatCard(lblSapHan, sapHan.ToString());
            SetStatCard(lblQuaHan, quaHan.ToString());
        }

        private void DgvColorRows(object? sender, DataGridViewBindingCompleteEventArgs e)
        {
            foreach (DataGridViewRow row in dgv.Rows)
            {
                if (row.Tag is not DocumentRecord doc) continue;
                int days = doc.SoNgayConLai;

                Color bg, fg;
                if (days < 0) { bg = CRowDanger; fg = CRowDangerText; }
                else if (days == 0) { bg = Color.FromArgb(252, 165, 165); fg = Color.FromArgb(127, 29, 29); }
                else if (days <= 3) { bg = CRowAlert; fg = CRowAlertText; }
                else if (days <= 7) { bg = CRowWarning; fg = CRowWarningText; }
                else { bg = CCard; fg = CText; }

                row.DefaultCellStyle.BackColor = bg;
                row.DefaultCellStyle.ForeColor = fg;
                row.DefaultCellStyle.SelectionBackColor = Color.FromArgb(219, 234, 254);
                row.DefaultCellStyle.SelectionForeColor = CText;
            }
        }

        // ════════════════════════════════════════════════════════
        // Actions
        // ════════════════════════════════════════════════════════
        private void BtnAdd_Click(object? sender, EventArgs e)
        {
            using var form = new FormAddDocument();
            if (form.ShowDialog(this) == DialogResult.OK && form.Result != null)
            {
                int id = DatabaseService.Insert(form.Result);
                form.Result.Id = id;
                LoadData();
                MessageBox.Show($"✅ Đã lưu văn bản \"{form.Result.SoVanBan}\" thành công!",
                    "Thành công", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void BtnDelete_Click(object? sender, EventArgs e)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null)
            {
                MessageBox.Show("Vui lòng chọn một văn bản để xóa.", "Chưa chọn",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            var confirm = MessageBox.Show(
                $"Bạn có chắc muốn xóa văn bản:\n«{doc.SoVanBan}»?",
                "Xác nhận xóa", MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (confirm == DialogResult.Yes)
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
                MessageBox.Show("Vui lòng chọn một văn bản để tạo lịch.", "Chưa chọn",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                CalendarService.CreateCalendarEvents(doc);
                doc.DaTaoLich = true;
                DatabaseService.Update(doc);
                LoadData();
                MessageBox.Show(
                    $"✅ Đã tạo sự kiện lịch cho văn bản «{doc.SoVanBan}»!\n\n" +
                    "Windows Calendar sẽ mở để bạn xác nhận import.\n" +
                    "Đã tạo nhắc nhở: 7 ngày, 3 ngày, 1 ngày trước hạn.",
                    "Tạo Lịch Thành Công", MessageBoxButtons.OK, MessageBoxIcon.Information);
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
            if (doc == null)
            {
                MessageBox.Show("Vui lòng chọn một văn bản.", "Chưa chọn",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (string.IsNullOrEmpty(doc.FilePath) || !File.Exists(doc.FilePath))
            {
                MessageBox.Show("Không tìm thấy file gốc.\nFile có thể đã bị di chuyển hoặc xóa.",
                    "Không tìm thấy file", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = doc.FilePath,
                UseShellExecute = true
            });
        }

        private void ShowDetail(int rowIndex)
        {
            var (doc, _) = GetSelectedDoc();
            if (doc == null) return;

            var info = $"📄  THÔNG TIN VĂN BẢN\n" +
                       $"{"─".PadRight(50, '─')}\n\n" +
                       $"Số văn bản:           {doc.SoVanBan}\n" +
                       $"Ngày ban hành:        {doc.NgayBanHanh:dd/MM/yyyy}\n" +
                       $"Cơ quan ban hành:     {doc.CoQuanBanHanh}\n" +
                       $"Cơ quan tham mưu:     {doc.CoQuanChuQuan}\n\n" +
                       $"Trích yếu:            {doc.TrichYeu}\n\n" +
                       $"Thời hạn:             {doc.ThoiHan:dd/MM/yyyy}\n" +
                       $"Trạng thái:           {doc.TrangThai}\n\n" +
                       $"Đơn vị chỉ đạo:\n  {doc.DonViChiDao}\n\n" +
                       $"Đã tạo lịch:          {(doc.DaTaoLich ? "Có ✅" : "Chưa")}\n" +
                       $"File gốc:             {doc.FilePath}";

            MessageBox.Show(info, $"Chi Tiết: {doc.SoVanBan}",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        // ════════════════════════════════════════════════════════
        // Helpers
        // ════════════════════════════════════════════════════════
        private (DocumentRecord? doc, int rowIndex) GetSelectedDoc()
        {
            if (dgv.SelectedRows.Count == 0) return (null, -1);
            var row = dgv.SelectedRows[0];
            return (row.Tag as DocumentRecord, row.Index);
        }

        private void UpdateClock()
        {
            lblHienTai.Text = $"🕐  {DateTime.Now:HH:mm  |  dddd, dd/MM/yyyy}";
        }

        private Label CreateStatCard(string caption, string value, Color accent)
        {
            var panel = new Panel
            {
                Width = 200,
                Height = 50,
                BackColor = Color.FromArgb(30, accent.R, accent.G, accent.B),
                Margin = new Padding(0, 0, 12, 0)
            };

            // We'll use a label to return and later update the value
            var lbl = new Label
            {
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f),
                Padding = new Padding(10, 0, 0, 0),
                Tag = new { Caption = caption, Accent = accent }
            };

            UpdateStatLabel(lbl, caption, value, accent);
            panel.Controls.Add(lbl);

            // Add a colored left border
            panel.Paint += (s, e) =>
            {
                using var pen = new Pen(accent, 4);
                e.Graphics.DrawLine(pen, 0, 0, 0, panel.Height);
            };

            // Add to a wrapper so we can return the label for later updates
            lbl.Tag = value;
            panel.Tag = caption;

            // Attach to stat layout via the parent lbl
            var wrapper = new Panel
            {
                Width = 210,
                Height = 50,
                BackColor = Color.Transparent,
                Margin = new Padding(0, 0, 10, 0)
            };
            // Just use label directly as stat card
            var card = new Label
            {
                Width = 200,
                Height = 50,
                BackColor = Color.FromArgb(255, 255, 255, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f),
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(14, 0, 0, 0),
                Text = $"{caption}\n{value}",
                Margin = new Padding(0, 0, 10, 0),
                Tag = caption,
                AutoSize = false
            };
            // Paint left bar
            card.Paint += (s, ev) =>
            {
                using var pen = new Pen(accent, 5);
                ev.Graphics.DrawLine(pen, 0, 5, 0, card.Height - 5);
            };

            return card;
        }

        private void SetStatCard(Label lbl, string newValue)
        {
            string caption = lbl.Tag?.ToString() ?? "";
            // Extract caption from text
            var parts = lbl.Text.Split('\n');
            string cap = parts.Length > 0 ? parts[0] : caption;
            lbl.Text = $"{cap}\n{newValue}";
        }

        private void UpdateStatLabel(Label lbl, string caption, string value, Color accent)
        {
            lbl.Text = $"{caption}\n{value}";
        }

        private Button MakeToolButton(string text, Color color)
        {
            return new Button
            {
                Text = text,
                BackColor = color,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Height = 32,
                AutoSize = true,
                Cursor = Cursors.Hand,
                Margin = new Padding(0, 0, 6, 0),
                FlatAppearance = { BorderSize = 0, MouseOverBackColor = Color.FromArgb(color.R + 20 > 255 ? 255 : color.R + 20, color.G, color.B) }
            };
        }

        // ════════════════════════════════════════════════════════
        // System Tray
        // ════════════════════════════════════════════════════════
        private void SetupTrayIcon()
        {
            _notifyIcon = new NotifyIcon
            {
                Text = "Quản Lý Văn Bản",
                Icon = SystemIcons.Application,
                Visible = true
            };

            var menu = new ContextMenuStrip();
            menu.Items.Add("📋  Mở cửa sổ chính", null, (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; this.BringToFront(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("❌  Thoát", null, (s, e) => { _notifyIcon.Visible = false; Application.Exit(); });

            _notifyIcon.ContextMenuStrip = menu;
            _notifyIcon.DoubleClick += (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; this.BringToFront(); };

            this.FormClosing += (s, e) =>
            {
                if (e.CloseReason == CloseReason.UserClosing)
                {
                    e.Cancel = true;
                    this.Hide();
                    _notifyIcon.ShowBalloonTip(3000,
                        "Đang chạy nền",
                        "Ứng dụng vẫn chạy. Double-click icon để mở lại.",
                        ToolTipIcon.Info);
                }
            };
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _notifySvc.Dispose();
            _notifyIcon.Dispose();
            base.OnFormClosed(e);
        }
    }
}
