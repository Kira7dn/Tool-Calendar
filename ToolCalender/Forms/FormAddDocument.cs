using ToolCalender.Models;
using ToolCalender.Services;

namespace ToolCalender.Forms
{
    public class FormAddDocument : Form
    {
        // ── Colors ──────────────────────────────────────────────
        private static readonly Color CHeader = Color.FromArgb(30, 58, 95);
        private static readonly Color CAccent = Color.FromArgb(37, 99, 235);
        private static readonly Color CBg = Color.FromArgb(241, 245, 249);
        private static readonly Color CCard = Color.White;
        private static readonly Color CLabel = Color.FromArgb(51, 65, 85);
        private static readonly Color CBorder = Color.FromArgb(203, 213, 225);

        // ── Controls ─────────────────────────────────────────────
        private Panel pnlDropZone = new();
        private Label lblDropHint = new();
        private Button btnBrowse = new();
        private Label lblFileName = new();

        private TextBox txtSoVanBan = new();
        private TextBox txtTrichYeu = new();
        private DateTimePicker dtpNgayBanHanh = new();
        private CheckBox chkNoDate = new();
        private TextBox txtCoQuan = new();
        private TextBox txtChuQuan = new();
        private DateTimePicker dtpThoiHan = new();
        private TextBox txtDonViChiDao = new();

        private Button btnSaveCalendar = new();
        private Button btnSaveOnly = new();
        private Button btnCancel = new();

        private Label lblStatus = new();

        public DocumentRecord? Result { get; private set; }
        private string _filePath = "";

        public FormAddDocument()
        {
            BuildUI();
        }

        private void BuildUI()
        {
            this.Text = "Thêm Văn Bản Mới";
            this.Size = new Size(780, 700);
            this.MinimumSize = new Size(700, 650);
            this.StartPosition = FormStartPosition.CenterParent;
            this.BackColor = CBg;
            this.Font = new Font("Segoe UI", 9.5f);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            // ── Header ──────────────────────────────────────────
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                BackColor = CHeader,
                Padding = new Padding(20, 0, 0, 0)
            };
            var lblTitle = new Label
            {
                Text = "📄  THÊM VĂN BẢN MỚI",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(20, 15)
            };
            pnlHeader.Controls.Add(lblTitle);

            // ── Drop Zone ────────────────────────────────────────
            pnlDropZone = new Panel
            {
                Height = 100,
                Margin = new Padding(20, 12, 20, 0),
                BackColor = Color.FromArgb(239, 246, 255),
                BorderStyle = BorderStyle.FixedSingle,
                Cursor = Cursors.Hand
            };
            pnlDropZone.AllowDrop = true;
            pnlDropZone.DragEnter += (s, e) =>
            {
                if (e.Data?.GetDataPresent(DataFormats.FileDrop) == true)
                    e.Effect = DragDropEffects.Copy;
            };
            pnlDropZone.DragDrop += (s, e) =>
            {
                var files = e.Data?.GetData(DataFormats.FileDrop) as string[];
                if (files?.Length > 0) LoadFile(files[0]);
            };
            pnlDropZone.Click += (s, e) => BrowseFile();

            lblDropHint = new Label
            {
                Text = "📂  Kéo thả file vào đây, hoặc nhấp để chọn file\n         (Hỗ trợ: PDF, DOCX)",
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Fill,
                ForeColor = Color.FromArgb(100, 116, 139),
                Font = new Font("Segoe UI", 10f)
            };

            btnBrowse = MakeButton("Chọn File...", CAccent, Color.White);
            btnBrowse.Size = new Size(120, 32);
            btnBrowse.Click += (s, e) => BrowseFile();

            pnlDropZone.Controls.Add(lblDropHint);

            lblFileName = new Label
            {
                Text = "",
                ForeColor = CAccent,
                Font = new Font("Segoe UI", 9f, FontStyle.Italic),
                Height = 20,
                Margin = new Padding(20, 4, 20, 0)
            };

            // ── Fields ───────────────────────────────────────────
            var pnlForm = new Panel { Padding = new Padding(20, 8, 20, 0), AutoSize = true };
            var layout = new TableLayoutPanel
            {
                ColumnCount = 4,
                AutoSize = true,
                Dock = DockStyle.Top,
                Padding = new Padding(0)
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170f));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170f));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));

            int row = 0;

            // Row 0: Số VB | Ngày ban hành
            AddLabelField(layout, row, 0, "Số văn bản (*)", txtSoVanBan = MakeTxt());
            AddLabelField(layout, row, 2, "Ngày ban hành", dtpNgayBanHanh = MakeDtp());
            row++;

            // Row 1: Trích yếu (span 3 cols)
            AddLabel(layout, row, 0, "Trích yếu / nội dung");
            txtTrichYeu = new TextBox
            {
                Multiline = true,
                Height = 55,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = CCard,
                ForeColor = CLabel,
                Font = new Font("Segoe UI", 9.5f)
            };
            layout.Controls.Add(txtTrichYeu, 1, row);
            layout.SetColumnSpan(txtTrichYeu, 3);
            row++;

            // Row 2: Cơ quan ban hành | Cơ quan tham mưu
            AddLabelField(layout, row, 0, "Cơ quan ban hành", txtCoQuan = MakeTxt());
            AddLabelField(layout, row, 2, "Cơ quan chủ quản tham mưu", txtChuQuan = MakeTxt());
            row++;

            // Row 3: Thời hạn | Đơn vị chỉ đạo
            AddLabelField(layout, row, 0, "Thời hạn (*)", dtpThoiHan = MakeDtp());
            AddLabelField(layout, row, 2, "Đơn vị được chỉ đạo", txtDonViChiDao = MakeTxt());
            row++;

            pnlForm.Controls.Add(layout);

            // Status
            lblStatus = new Label
            {
                Text = "",
                ForeColor = Color.FromArgb(21, 128, 61),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Height = 24,
                Margin = new Padding(0, 4, 0, 0),
                AutoSize = false,
                Dock = DockStyle.Top
            };

            // ── Buttons ──────────────────────────────────────────
            var pnlButtons = new Panel
            {
                Height = 55,
                Dock = DockStyle.Bottom,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding = new Padding(20, 10, 20, 0)
            };
            pnlButtons.Paint += (s, e) =>
            {
                e.Graphics.DrawLine(new Pen(CBorder), 0, 0, pnlButtons.Width, 0);
            };

            btnSaveCalendar = MakeButton("💾  Lưu & Tạo Lịch Calendar", Color.FromArgb(21, 128, 61), Color.White);
            btnSaveCalendar.Size = new Size(200, 34);
            btnSaveCalendar.Left = 20;
            btnSaveCalendar.Top = 10;
            btnSaveCalendar.Click += BtnSaveCalendar_Click;

            btnSaveOnly = MakeButton("Chỉ Lưu", CAccent, Color.White);
            btnSaveOnly.Size = new Size(100, 34);
            btnSaveOnly.Left = 228;
            btnSaveOnly.Top = 10;
            btnSaveOnly.Click += BtnSaveOnly_Click;

            btnCancel = MakeButton("Hủy", Color.FromArgb(100, 116, 139), Color.White);
            btnCancel.Size = new Size(80, 34);
            btnCancel.Left = 336;
            btnCancel.Top = 10;
            btnCancel.Click += (s, e) => { this.DialogResult = DialogResult.Cancel; this.Close(); };

            pnlButtons.Controls.AddRange(new Control[] { btnSaveCalendar, btnSaveOnly, btnCancel });

            // ── Assembly ─────────────────────────────────────────
            var pnlMain = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                Padding = new Padding(20, 10, 20, 0)
            };

            // Stack: dropzone → filename → form fields → status
            var stack = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                Dock = DockStyle.Top,
                AutoSize = true,
                Padding = new Padding(0)
            };

            pnlDropZone.Dock = DockStyle.None;
            pnlDropZone.Width = 700;
            pnlDropZone.Height = 90;
            lblFileName.Width = 700;
            layout.Width = 700;
            lblStatus.Width = 700;

            stack.Controls.Add(pnlDropZone);
            stack.Controls.Add(lblFileName);
            stack.Controls.Add(layout);
            stack.Controls.Add(lblStatus);

            pnlMain.Controls.Add(stack);

            this.Controls.Add(pnlButtons);
            this.Controls.Add(pnlMain);
            this.Controls.Add(pnlHeader);
        }

        // ── Helpers ─────────────────────────────────────────────
        private void AddLabelField(TableLayoutPanel tbl, int row, int col, string labelText, Control ctrl)
        {
            AddLabel(tbl, row, col, labelText);
            tbl.Controls.Add(ctrl, col + 1, row);
        }

        private void AddLabel(TableLayoutPanel tbl, int row, int col, string text)
        {
            var lbl = new Label
            {
                Text = text,
                ForeColor = CLabel,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Anchor = AnchorStyles.Right | AnchorStyles.Top,
                AutoSize = false,
                Height = 26,
                Width = 160,
                TextAlign = ContentAlignment.MiddleRight,
                Margin = new Padding(0, 6, 8, 0)
            };
            tbl.Controls.Add(lbl, col, row);
        }

        private TextBox MakeTxt() => new TextBox
        {
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = CCard,
            ForeColor = CLabel,
            Font = new Font("Segoe UI", 9.5f),
            Height = 26,
            Margin = new Padding(0, 4, 0, 4),
            Dock = DockStyle.Top
        };

        private DateTimePicker MakeDtp() => new DateTimePicker
        {
            Format = DateTimePickerFormat.Custom,
            CustomFormat = "dd/MM/yyyy",
            Height = 26,
            Margin = new Padding(0, 4, 0, 4),
            Dock = DockStyle.Top
        };

        private Button MakeButton(string text, Color bg, Color fg) => new Button
        {
            Text = text,
            BackColor = bg,
            ForeColor = fg,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            FlatAppearance = { BorderSize = 0 }
        };

        // ── Actions ─────────────────────────────────────────────
        private void BrowseFile()
        {
            using var dlg = new OpenFileDialog
            {
                Title = "Chọn văn bản",
                Filter = "Văn bản (*.pdf;*.docx;*.doc)|*.pdf;*.docx;*.doc|PDF|*.pdf|Word|*.docx;*.doc",
                Multiselect = false
            };
            if (dlg.ShowDialog() == DialogResult.OK)
                LoadFile(dlg.FileName);
        }

        private void LoadFile(string filePath)
        {
            _filePath = filePath;
            string name = Path.GetFileName(filePath);
            lblDropHint.Text = $"✅  Đã chọn: {name}";
            lblDropHint.ForeColor = Color.FromArgb(21, 128, 61);
            lblFileName.Text = "";

            lblStatus.Text = "⏳ Đang đọc và phân tích văn bản...";
            lblStatus.ForeColor = CAccent;
            Application.DoEvents();

            try
            {
                var record = DocumentExtractorService.ExtractFromFile(filePath);
                PopulateFields(record);
                lblStatus.Text = "✅ Đã trích xuất thông tin! Kiểm tra và chỉnh sửa trước khi lưu.";
                lblStatus.ForeColor = Color.FromArgb(21, 128, 61);
            }
            catch (Exception ex)
            {
                lblStatus.Text = $"⚠ Không trích xuất được tự động: {ex.Message}. Vui lòng nhập thủ công.";
                lblStatus.ForeColor = Color.FromArgb(180, 38, 0);
            }
        }

        private void PopulateFields(Models.DocumentRecord r)
        {
            if (!string.IsNullOrEmpty(r.SoVanBan)) txtSoVanBan.Text = r.SoVanBan;
            if (!string.IsNullOrEmpty(r.TrichYeu)) txtTrichYeu.Text = r.TrichYeu;
            if (r.NgayBanHanh.HasValue) dtpNgayBanHanh.Value = r.NgayBanHanh.Value;
            if (!string.IsNullOrEmpty(r.CoQuanBanHanh)) txtCoQuan.Text = r.CoQuanBanHanh;
            if (!string.IsNullOrEmpty(r.CoQuanChuQuan)) txtChuQuan.Text = r.CoQuanChuQuan;
            if (r.ThoiHan.HasValue) dtpThoiHan.Value = r.ThoiHan.Value;
            if (!string.IsNullOrEmpty(r.DonViChiDao)) txtDonViChiDao.Text = r.DonViChiDao;
        }

        private Models.DocumentRecord? BuildRecord()
        {
            if (string.IsNullOrWhiteSpace(txtSoVanBan.Text))
            {
                MessageBox.Show("Vui lòng nhập Số văn bản.", "Thiếu thông tin",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtSoVanBan.Focus();
                return null;
            }

            return new Models.DocumentRecord
            {
                FilePath = _filePath,
                SoVanBan = txtSoVanBan.Text.Trim(),
                TrichYeu = txtTrichYeu.Text.Trim(),
                NgayBanHanh = dtpNgayBanHanh.Value,
                CoQuanBanHanh = txtCoQuan.Text.Trim(),
                CoQuanChuQuan = txtChuQuan.Text.Trim(),
                ThoiHan = dtpThoiHan.Value,
                DonViChiDao = txtDonViChiDao.Text.Trim(),
                NgayThem = DateTime.Now,
                DaTaoLich = false
            };
        }

        private void BtnSaveCalendar_Click(object? sender, EventArgs e)
        {
            var record = BuildRecord();
            if (record == null) return;

            try
            {
                CalendarService.CreateCalendarEvents(record);
                record.DaTaoLich = true;
                Result = record;
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi tạo lịch: {ex.Message}\n\nVăn bản vẫn sẽ được lưu.",
                    "Lỗi Calendar", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Result = record;
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
        }

        private void BtnSaveOnly_Click(object? sender, EventArgs e)
        {
            var record = BuildRecord();
            if (record == null) return;
            Result = record;
            this.DialogResult = DialogResult.OK;
            this.Close();
        }
    }
}
