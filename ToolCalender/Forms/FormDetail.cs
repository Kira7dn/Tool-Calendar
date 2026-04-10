using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Data;

namespace ToolCalender.Forms
{
    /// <summary>
    /// Form xem chi tiết và chỉnh sửa thông tin văn bản.
    /// Mở bằng double-click hoặc nút "Xem / Sửa".
    /// </summary>
    public class FormDetail : Form
    {
        // ── Colors ──────────────────────────────────────────────
        private static readonly Color CHeader    = Color.FromArgb(15, 40, 80);
        private static readonly Color CAccent    = Color.FromArgb(37, 99, 235);
        private static readonly Color CBg        = Color.FromArgb(241, 245, 249);
        private static readonly Color CCard      = Color.White;
        private static readonly Color CLabel     = Color.FromArgb(51, 65, 85);
        private static readonly Color CMuted     = Color.FromArgb(100, 116, 139);
        private static readonly Color CBorder    = Color.FromArgb(203, 213, 225);
        private static readonly Color CDanger    = Color.FromArgb(254, 226, 226);
        private static readonly Color CDangerTxt = Color.FromArgb(153, 27, 27);
        private static readonly Color CWarn      = Color.FromArgb(254, 243, 199);
        private static readonly Color CWarnTxt   = Color.FromArgb(120, 53, 15);
        private static readonly Color CAlert     = Color.FromArgb(255, 237, 213);
        private static readonly Color CAlertTxt  = Color.FromArgb(154, 52, 18);
        private static readonly Color COk        = Color.FromArgb(209, 250, 229);
        private static readonly Color COkTxt     = Color.FromArgb(6, 95, 70);

        // ── Input Controls ──────────────────────────────────────
        private TextBox      txtSoVanBan    = new();
        private TextBox      txtTrichYeu    = new();
        private DateTimePicker dtpNgayBanHanh = new();
        private TextBox      txtCoQuanBH    = new();
        private TextBox      txtChuQuan     = new();
        private DateTimePicker dtpThoiHan   = new();
        private TextBox      txtDonViChiDao = new();
        private TextBox      txtFilePath    = new();
        private CheckBox     chkKhongThoiHan = new();
        private CheckBox     chkDaTaoLich   = new();

        // ── Display Labels ──────────────────────────────────────
        private Panel  pnlDeadlineBanner = new();
        private Label  lblDeadlineBanner = new();
        private Label  lblNgayThem       = new();
        private Button btnSave           = new();
        private Button btnCalendar       = new();
        private Button btnOpenFile       = new();
        private Button btnClose          = new();
        
        // ── Comment Controls ──────────────────────────────────
        private FlowLayoutPanel pnlCommentsList = new();
        private TextBox txtCommentInput = new();
        private Button btnSendComment = new();

        private readonly DocumentRecord _original;
        public DocumentRecord? UpdatedRecord { get; private set; }

        // ════════════════════════════════════════════════════════
        public FormDetail(DocumentRecord doc)
        {
            _original = doc;
            BuildUI();
            PopulateFields(doc);
            ApplyPermissions();
            UpdateDeadlineBanner();
            LoadComments();
        }

        // ════════════════════════════════════════════════════════
        // UI Construction
        // ════════════════════════════════════════════════════════
        private void BuildUI()
        {
            this.Text            = "Chi Tiết Văn Bản";
            this.Size            = new Size(860, 780);
            this.MinimumSize     = new Size(780, 700);
            this.StartPosition   = FormStartPosition.CenterParent;
            this.BackColor       = CBg;
            this.Font            = new Font("Segoe UI", 9.5f);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox     = false;

            // ── Header ──────────────────────────────────────────
            var pnlHeader = new Panel
            {
                Dock      = DockStyle.Top,
                Height    = 76,
                BackColor = CHeader
            };
            pnlHeader.Paint += (s, e) =>
            {
                using var pen = new Pen(CAccent, 3);
                e.Graphics.DrawLine(pen, 0, pnlHeader.Height - 3, pnlHeader.Width, pnlHeader.Height - 3);
            };

            var lblTitle = new Label
            {
                Text      = "📋  CHI TIẾT VĂN BẢN",
                ForeColor = Color.White,
                Font      = new Font("Segoe UI", 15f, FontStyle.Bold),
                AutoSize  = true,
                Location  = new Point(20, 10)
            };
            lblNgayThem = new Label
            {
                ForeColor = Color.FromArgb(147, 197, 253),
                Font      = new Font("Segoe UI", 8.5f, FontStyle.Italic),
                AutoSize  = true,
                Location  = new Point(22, 40)
            };
            pnlHeader.Controls.AddRange(new Control[] { lblTitle, lblNgayThem });

            // ── Bottom Buttons ──────────────────────────────────
            var pnlButtons = new Panel
            {
                Dock      = DockStyle.Bottom,
                Height    = 64,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding   = new Padding(20, 14, 20, 0)
            };
            pnlButtons.Paint += (s, e) =>
                e.Graphics.DrawLine(new Pen(CBorder), 0, 0, pnlButtons.Width, 0);

            btnSave = MakeButton("💾  Lưu Thay Đổi", Color.FromArgb(21, 128, 61), Color.White);
            btnSave.Size   = new Size(160, 36);
            btnSave.Left   = 20;
            btnSave.Top    = 14;
            btnSave.Click += BtnSave_Click;

            btnCalendar = MakeButton("📅  Tạo / Cập Nhật Lịch", CAccent, Color.White);
            btnCalendar.Size   = new Size(180, 36);
            btnCalendar.Left   = 188;
            btnCalendar.Top    = 14;
            btnCalendar.Click += BtnCalendar_Click;

            btnOpenFile = MakeButton("📂  Mở File Gốc", Color.FromArgb(71, 85, 105), Color.White);
            btnOpenFile.Size   = new Size(140, 36);
            btnOpenFile.Left   = 376;
            btnOpenFile.Top    = 14;
            btnOpenFile.Click += BtnOpenFile_Click;

            btnClose = MakeButton("✖  Đóng", Color.FromArgb(100, 116, 139), Color.White);
            btnClose.Size   = new Size(100, 36);
            btnClose.Left   = 524;
            btnClose.Top    = 14;
            btnClose.Click += (s, e) => { this.DialogResult = DialogResult.Cancel; this.Close(); };

            pnlButtons.Controls.AddRange(new Control[] { btnSave, btnCalendar, btnOpenFile, btnClose });

            // ── Scroll Panel ─────────────────────────────────────
            var pnlScroll = new Panel
            {
                Dock       = DockStyle.Fill,
                AutoScroll = true,
                Padding    = new Padding(20, 14, 20, 10)
            };

            var mainStack = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.TopDown,
                WrapContents  = false,
                AutoSize      = true,
                Padding       = new Padding(0)
            };

            // ── Section 1: Deadline Banner ───────────────────────
            pnlDeadlineBanner = new Panel
            {
                Width     = 780,
                Height    = 80,
                Padding   = new Padding(16, 10, 16, 10),
                Margin    = new Padding(0, 0, 0, 12)
            };
            pnlDeadlineBanner.Paint += (s, e) =>
            {
                using var pen = new Pen(CBorder);
                e.Graphics.DrawRectangle(pen, new Rectangle(0, 0, pnlDeadlineBanner.Width - 1, pnlDeadlineBanner.Height - 1));
            };
            lblDeadlineBanner = new Label
            {
                Dock      = DockStyle.Fill,
                Font      = new Font("Segoe UI", 12f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleLeft
            };
            pnlDeadlineBanner.Controls.Add(lblDeadlineBanner);

            // ── Section 2: Thông tin chính ───────────────────────
            var grpInfo = MakeSectionBox("📝  THÔNG TIN VĂN BẢN", 780);

            var tbl = new TableLayoutPanel
            {
                ColumnCount = 4,
                AutoSize    = true,
                Width       = 740,
                Padding     = new Padding(0, 6, 0, 4)
            };
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190f));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,  50f));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190f));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,  50f));

            int r = 0;
            // Row 0
            AddRow(tbl, r, 0, "Số văn bản  (*)",   txtSoVanBan = MakeTxt());
            AddRow(tbl, r, 2, "Ngày ban hành",      dtpNgayBanHanh = MakeDtp());
            r++;

            // Row 1
            AddRow(tbl, r, 0, "Cơ quan ban hành",  txtCoQuanBH = MakeTxt());
            AddRow(tbl, r, 2, "Cơ quan chủ quản tham mưu  (*)", txtChuQuan = MakeTxt());
            r++;

            // Row 2: Thời hạn
            AddRow(tbl, r, 0, "Thời hạn / Ngày đến hạn  (*)", dtpThoiHan = MakeDtp());
            dtpThoiHan.ValueChanged += (s, e) => UpdateDeadlineBanner();
            AddRow(tbl, r, 2, "Đơn vị được chỉ đạo", txtDonViChiDao = MakeTxt());
            r++;

            // Row 3: checkboxes
            chkKhongThoiHan = new CheckBox
            {
                Text      = "Không có thời hạn cụ thể",
                ForeColor = CMuted,
                Font      = new Font("Segoe UI", 9f, FontStyle.Italic),
                AutoSize  = true,
                Margin    = new Padding(0, 2, 0, 4)
            };
            chkKhongThoiHan.CheckedChanged += (s, e) =>
            {
                dtpThoiHan.Enabled          = !chkKhongThoiHan.Checked;
                pnlDeadlineBanner.Visible   = !chkKhongThoiHan.Checked;
                if (!chkKhongThoiHan.Checked) UpdateDeadlineBanner();
            };
            chkDaTaoLich = new CheckBox
            {
                Text      = "Đã tạo lịch Calendar",
                ForeColor = CMuted,
                Font      = new Font("Segoe UI", 9f),
                AutoSize  = true,
                Margin    = new Padding(0, 2, 0, 4)
            };
            tbl.Controls.Add(chkKhongThoiHan, 1, r);
            tbl.Controls.Add(chkDaTaoLich, 3, r);
            r++;

            // Row 4: Spacer
            r++;

            grpInfo.Controls.Add(tbl);

            // ── Trích yếu (Full Width outside table) ────────────
            var pnlTrichYeu = new Panel
            {
                Dock    = DockStyle.Top,
                Height  = 160,
                Padding = new Padding(10, 5, 5, 0)
            };
            var lblTrichYeuTitle = new Label
            {
                Text      = "Trích yếu / Nội dung chính của văn bản:",
                ForeColor = CLabel,
                Font      = new Font("Segoe UI", 9f, FontStyle.Bold),
                Dock      = DockStyle.Top,
                Height    = 22
            };
            txtTrichYeu = new TextBox
            {
                Multiline     = true,
                AcceptsReturn = true,
                Dock          = DockStyle.Fill,
                BorderStyle   = BorderStyle.FixedSingle,
                BackColor     = CCard,
                ForeColor     = CLabel,
                Font          = new Font("Segoe UI", 10f),
                ScrollBars    = ScrollBars.Vertical
            };
            pnlTrichYeu.Controls.Add(txtTrichYeu);
            pnlTrichYeu.Controls.Add(lblTrichYeuTitle);

            grpInfo.Controls.Add(pnlTrichYeu);
            pnlTrichYeu.BringToFront();
            tbl.BringToFront(); // Table stays at top
            r++;

            // Row 5: File path
            AddLabel(tbl, r, 0, "File văn bản gốc");
            txtFilePath = new TextBox
            {
                BorderStyle   = BorderStyle.FixedSingle,
                BackColor     = Color.FromArgb(248, 250, 252),
                ForeColor     = CMuted,
                Font          = new Font("Segoe UI", 8.5f, FontStyle.Italic),
                Height        = 26,
                ReadOnly      = true,
                Margin        = new Padding(0, 4, 0, 4)
            };
            tbl.Controls.Add(txtFilePath, 1, r);
            tbl.SetColumnSpan(txtFilePath, 3);
            r++;

            grpInfo.Controls.Add(tbl);

            // ── Section 3: Lịch sử & Nhắc nhở ───────────────────
            var grpRemind = MakeSectionBox("🔔  NHẮC NHỞ TỰ ĐỘNG", 780);

            var pnlReminderInfo = new Panel
            {
                Width     = 740,
                Height    = 54,
                BackColor = Color.FromArgb(239, 246, 255),
                Margin    = new Padding(0, 6, 0, 4)
            };
            pnlReminderInfo.Paint += (s, e) =>
            {
                using var pen = new Pen(Color.FromArgb(186, 214, 250));
                e.Graphics.DrawRectangle(pen, new Rectangle(0, 0, pnlReminderInfo.Width - 1, pnlReminderInfo.Height - 1));

                using var iconBrush = new SolidBrush(Color.FromArgb(37, 99, 235));
                using var fnt = new Font("Segoe UI", 9f);
                string line1 = "🔔  Hệ thống sẽ tự động tạo nhắc nhở qua Windows Calendar:";
                string line2 = "     • 7 ngày trước hạn  •  3 ngày trước hạn  •  1 ngày trước hạn  •  Đúng ngày hết hạn";
                e.Graphics.DrawString(line1, new Font("Segoe UI", 9f, FontStyle.Bold), iconBrush, new PointF(14, 8));
                e.Graphics.DrawString(line2, fnt, iconBrush, new PointF(14, 28));
            };

            grpRemind.Controls.Add(pnlReminderInfo);

            // ── Section 4: Thảo luận / Comment (Facebook style) ────────
            var grpComments = MakeSectionBox("💬  THẢO LUẬN & GHI CHÚ", 780);
            
            pnlCommentsList = new FlowLayoutPanel {
                Width = 740,
                Height = 250,
                AutoScroll = true,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding = new Padding(5),
                Margin = new Padding(0, 5, 0, 5)
            };

            var pnlInput = new Panel { Width = 740, Height = 80, Margin = new Padding(0, 5, 0, 0) };
            txtCommentInput = new TextBox {
                Multiline = true,
                Dock = DockStyle.Fill,
                PlaceholderText = "Nhập nội dung thảo luận hoặc ghi chú tại đây...",
                Font = new Font("Segoe UI", 10)
            };
            btnSendComment = new Button {
                Text = "Gửi",
                Dock = DockStyle.Right,
                Width = 80,
                BackColor = CAccent,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold)
            };
            btnSendComment.Click += BtnSendComment_Click;

            pnlInput.Controls.Add(txtCommentInput);
            pnlInput.Controls.Add(btnSendComment);

            grpComments.Controls.Add(pnlCommentsList);
            grpComments.Controls.Add(pnlInput);

            mainStack.Controls.Add(pnlDeadlineBanner);
            mainStack.Controls.Add(grpInfo);
            mainStack.Controls.Add(grpRemind);
            mainStack.Controls.Add(grpComments);

            pnlScroll.Controls.Add(mainStack);

            this.Controls.Add(pnlScroll);
            this.Controls.Add(pnlButtons);
            this.Controls.Add(pnlHeader);
        }

        // ════════════════════════════════════════════════════════
        // Section Box Helper
        // ════════════════════════════════════════════════════════
        private Panel MakeSectionBox(string title, int width)
        {
            var pnl = new Panel
            {
                Width     = width,
                AutoSize  = true,
                BackColor = CCard,
                Margin    = new Padding(0, 0, 0, 12),
                Padding   = new Padding(14, 8, 14, 14)
            };
            pnl.Paint += (s, e) =>
            {
                using var border = new Pen(CBorder);
                e.Graphics.DrawRectangle(border, new Rectangle(0, 0, pnl.Width - 1, pnl.Height - 1));
                using var hBrush = new SolidBrush(Color.FromArgb(224, 231, 242));
                e.Graphics.FillRectangle(hBrush, 0, 0, pnl.Width, 34);
                using var accentPen = new Pen(CAccent, 3);
                e.Graphics.DrawLine(accentPen, 0, 0, 0, 34);
                using var txtBrush = new SolidBrush(Color.FromArgb(15, 40, 80));
                using var fnt = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                e.Graphics.DrawString(title, fnt, txtBrush, new PointF(14, 9));
            };
            // Header spacer
            pnl.Controls.Add(new Panel { Height = 40, BackColor = Color.Transparent });
            return pnl;
        }

        // ════════════════════════════════════════════════════════
        // Deadline Banner Updater
        // ════════════════════════════════════════════════════════
        private void UpdateDeadlineBanner()
        {
            if (chkKhongThoiHan.Checked)
            {
                pnlDeadlineBanner.BackColor    = Color.FromArgb(241, 245, 249);
                lblDeadlineBanner.ForeColor    = CMuted;
                lblDeadlineBanner.Text         = "ℹ️  Văn bản không có thời hạn cụ thể";
                return;
            }

            DateTime thoiHan = dtpThoiHan.Value.Date;
            int days = (int)(thoiHan - DateTime.Today).TotalDays;

            Color bg, fg;
            string msg;

            if (days < 0)
            {
                bg = CDanger; fg = CDangerTxt;
                msg = $"🚨  QUÁ HẠN {Math.Abs(days)} NGÀY  —  Đã quá thời hạn từ ngày {thoiHan:dd/MM/yyyy}. Cần xử lý ngay!";
            }
            else if (days == 0)
            {
                bg = Color.FromArgb(252, 165, 165); fg = Color.FromArgb(127, 29, 29);
                msg = $"⚡  HẾT HẠN HÔM NAY  —  {thoiHan:dd/MM/yyyy}  |  Cần hoàn thành ngay trong ngày hôm nay!";
            }
            else if (days <= 3)
            {
                bg = CAlert; fg = CAlertTxt;
                msg = $"⚠️  CÒN {days} NGÀY  —  Đến hạn {thoiHan:dd/MM/yyyy}  |  Rất cấp bách, cần hoàn thành sớm!";
            }
            else if (days <= 7)
            {
                bg = CWarn; fg = CWarnTxt;
                msg = $"⏰  CÒN {days} NGÀY  —  Đến hạn {thoiHan:dd/MM/yyyy}  |  Sắp đến hạn, cần chuẩn bị!";
            }
            else if (days <= 30)
            {
                bg = Color.FromArgb(224, 242, 254); fg = Color.FromArgb(7, 89, 133);
                msg = $"📅  CÒN {days} NGÀY  —  Đến hạn {thoiHan:dd/MM/yyyy}  |  Trong vòng 1 tháng.";
            }
            else
            {
                bg = COk; fg = COkTxt;
                msg = $"✅  CÒN {days} NGÀY  —  Đến hạn {thoiHan:dd/MM/yyyy}  |  Còn nhiều thời gian.";
            }

            pnlDeadlineBanner.BackColor  = bg;
            lblDeadlineBanner.ForeColor  = fg;
            lblDeadlineBanner.Text       = msg;
        }

        // ════════════════════════════════════════════════════════
        // Populate Fields
        // ════════════════════════════════════════════════════════
        private void PopulateFields(DocumentRecord doc)
        {
            txtSoVanBan.Text   = doc.SoVanBan;
            txtTrichYeu.Text   = doc.TrichYeu;
            txtCoQuanBH.Text   = doc.CoQuanBanHanh;
            txtChuQuan.Text    = doc.CoQuanChuQuan;
            txtDonViChiDao.Text = doc.DonViChiDao;
            txtFilePath.Text   = doc.FilePath;

            if (doc.NgayBanHanh.HasValue)
                dtpNgayBanHanh.Value = doc.NgayBanHanh.Value;

            if (doc.ThoiHan.HasValue)
            {
                dtpThoiHan.Value        = doc.ThoiHan.Value;
                chkKhongThoiHan.Checked = false;
            }
            else
            {
                chkKhongThoiHan.Checked = true;
                dtpThoiHan.Enabled      = false;
            }

            chkDaTaoLich.Checked = doc.DaTaoLich;
            lblNgayThem.Text     = $"Ngày thêm vào hệ thống: {doc.NgayThem:dd/MM/yyyy  HH:mm}  |  ID: {doc.Id}";
            btnCalendar.Text     = doc.DaTaoLich ? "📅  Cập Nhật Lịch" : "📅  Tạo Lịch Nhắc";
        }

        // ════════════════════════════════════════════════════════
        // Button Handlers
        // ════════════════════════════════════════════════════════
        private void BtnSave_Click(object? sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtSoVanBan.Text))
            {
                MessageBox.Show("Vui lòng nhập Số văn bản.", "Thiếu thông tin",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtSoVanBan.Focus();
                return;
            }

            UpdatedRecord = new DocumentRecord
            {
                Id            = _original.Id,
                FilePath      = _original.FilePath,
                NgayThem      = _original.NgayThem,
                SoVanBan      = txtSoVanBan.Text.Trim(),
                TrichYeu      = txtTrichYeu.Text.Trim(),
                NgayBanHanh   = dtpNgayBanHanh.Value.Date,
                CoQuanBanHanh = txtCoQuanBH.Text.Trim(),
                CoQuanChuQuan = txtChuQuan.Text.Trim(),
                ThoiHan       = chkKhongThoiHan.Checked ? (DateTime?)null : dtpThoiHan.Value.Date,
                DonViChiDao   = txtDonViChiDao.Text.Trim(),
                DaTaoLich     = chkDaTaoLich.Checked
            };

            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        private void BtnCalendar_Click(object? sender, EventArgs e)
        {
            if (chkKhongThoiHan.Checked)
            {
                MessageBox.Show("Không thể tạo lịch cho văn bản không có thời hạn.",
                    "Không có thời hạn", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Build a temp record to create calendar
            var temp = new DocumentRecord
            {
                Id            = _original.Id,
                SoVanBan      = txtSoVanBan.Text.Trim(),
                TrichYeu      = txtTrichYeu.Text.Trim(),
                NgayBanHanh   = dtpNgayBanHanh.Value.Date,
                CoQuanBanHanh = txtCoQuanBH.Text.Trim(),
                CoQuanChuQuan = txtChuQuan.Text.Trim(),
                ThoiHan       = dtpThoiHan.Value.Date,
                DonViChiDao   = txtDonViChiDao.Text.Trim(),
                FilePath      = _original.FilePath,
                NgayThem      = _original.NgayThem,
                DaTaoLich     = true
            };

            try
            {
                CalendarService.CreateCalendarEvents(temp);
                chkDaTaoLich.Checked = true;
                btnCalendar.Text     = "📅  Cập Nhật Lịch";
                MessageBox.Show(
                    $"✅ Đã tạo sự kiện lịch cho «{temp.SoVanBan}»!\n\n" +
                    "Windows Calendar sẽ mở để xác nhận import.\n" +
                    "Nhắc nhở: 7 ngày • 3 ngày • 1 ngày trước hạn.",
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
            string path = _original.FilePath;
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
            {
                MessageBox.Show("Không tìm thấy file gốc.\nFile có thể đã bị di chuyển hoặc xóa.",
                    "Không tìm thấy", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName        = path,
                UseShellExecute = true
            });
        }

        // ════════════════════════════════════════════════════════
        // Comment Logic
        // ════════════════════════════════════════════════════════
        private void LoadComments()
        {
            pnlCommentsList.Controls.Clear();
            var comments = DatabaseService.GetComments(_original.Id);
            foreach (var c in comments)
            {
                AddCommentUI(c);
            }
            pnlCommentsList.VerticalScroll.Value = pnlCommentsList.VerticalScroll.Maximum;
        }

        private void AddCommentUI(Comment c)
        {
            var pnl = new Panel { Width = 710, AutoSize = true, Margin = new Padding(0, 0, 0, 10), Padding = new Padding(8), BackColor = Color.White };
            pnl.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, pnl.Width, 100, 10, 10)); // Sẽ fix autosize sau

            var lblUser = new Label { Text = c.Username, Font = new Font("Segoe UI", 9, FontStyle.Bold), ForeColor = CAccent, AutoSize = true, Location = new Point(8, 5) };
            var lblTime = new Label { Text = c.CreatedAt.ToString("HH:mm dd/MM/yyyy"), Font = new Font("Segoe UI", 8), ForeColor = CMuted, AutoSize = true, Location = new Point(lblUser.Right + 10, 6) };
            var lblMsg = new Label { Text = c.Content, Font = new Font("Segoe UI", 10), AutoSize = true, Location = new Point(8, 25), MaximumSize = new Size(680, 0) };

            pnl.Controls.Add(lblUser);
            pnl.Controls.Add(lblTime);
            pnl.Controls.Add(lblMsg);
            pnlCommentsList.Controls.Add(pnl);
        }

        private void BtnSendComment_Click(object? sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtCommentInput.Text)) return;
            if (SessionService.CurrentUser == null) return;

            var c = new Comment {
                DocumentId = _original.Id,
                UserId = SessionService.CurrentUser.Id,
                Username = SessionService.CurrentUser.Username,
                Content = txtCommentInput.Text.Trim()
            };

            DatabaseService.InsertComment(c);
            txtCommentInput.Clear();
            LoadComments();
        }

        private void ApplyPermissions()
        {
            bool isAdmin = SessionService.IsAdmin;
            
            // Nếu không phải admin, không cho sửa nội dung chính
            txtSoVanBan.ReadOnly = !isAdmin;
            txtTrichYeu.ReadOnly = !isAdmin;
            dtpNgayBanHanh.Enabled = isAdmin;
            txtCoQuanBH.ReadOnly = !isAdmin;
            txtChuQuan.ReadOnly = !isAdmin;
            dtpThoiHan.Enabled = isAdmin;
            txtDonViChiDao.ReadOnly = !isAdmin;
            chkKhongThoiHan.Enabled = isAdmin;

            btnSave.Visible = isAdmin;
            btnCalendar.Visible = isAdmin;
            
            if (!isAdmin) {
                this.Text = "Xem Chi Tiết Văn Bản (Chỉ đọc)";
            }
        }

        [System.Runtime.InteropServices.DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);

        // ════════════════════════════════════════════════════════
        // Helpers
        // ════════════════════════════════════════════════════════
        private void AddRow(TableLayoutPanel tbl, int row, int col, string lbl, Control ctrl)
        {
            AddLabel(tbl, row, col, lbl);
            ctrl.Margin = new Padding(0, 4, 12, 6);
            tbl.Controls.Add(ctrl, col + 1, row);
        }

        private void AddLabel(TableLayoutPanel tbl, int row, int col, string text)
        {
            tbl.Controls.Add(new Label
            {
                Text      = text,
                ForeColor = CLabel,
                Font      = new Font("Segoe UI", 9f, FontStyle.Bold),
                Anchor    = AnchorStyles.Right | AnchorStyles.Top,
                AutoSize  = false,
                Height    = 26,
                Width     = 180,
                TextAlign = ContentAlignment.MiddleRight,
                Margin    = new Padding(0, 6, 8, 0)
            }, col, row);
        }

        private TextBox MakeTxt() => new TextBox
        {
            BorderStyle = BorderStyle.FixedSingle,
            BackColor   = CCard,
            ForeColor   = CLabel,
            Font        = new Font("Segoe UI", 9.5f),
            Height      = 27,
            Dock        = DockStyle.Top
        };

        private DateTimePicker MakeDtp() => new DateTimePicker
        {
            Format       = DateTimePickerFormat.Custom,
            CustomFormat = "dd/MM/yyyy",
            Height       = 27,
            Dock         = DockStyle.Top
        };

        private Button MakeButton(string text, Color bg, Color fg) => new Button
        {
            Text       = text,
            BackColor  = bg,
            ForeColor  = fg,
            FlatStyle  = FlatStyle.Flat,
            Font       = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor     = Cursors.Hand,
            FlatAppearance = { BorderSize = 0 }
        };
    }
}
