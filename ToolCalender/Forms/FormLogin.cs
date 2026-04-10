using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using ToolCalender.Data;
using ToolCalender.Services;

namespace ToolCalender.Forms
{
    public class FormLogin : Form
    {
        // ── Controls ───────────────────────────────────────────
        private TextBox  txtUsername  = new();
        private TextBox  txtPassword  = new();
        private Button   btnLogin     = new();
        private Label    lblEye       = new();   // Toggle hiện/ẩn mật khẩu
        private Label    lblError     = new();   // Thông báo lỗi inline

        // ── Security: Rate-limit ────────────────────────────────
        private int      _failCount   = 0;
        private DateTime _lockUntil   = DateTime.MinValue;
        private bool     _pwdVisible  = false;

        // ── Colors ──────────────────────────────────────────────
        private static readonly Color C1 = Color.FromArgb(15,  32,  68);   // nền tối
        private static readonly Color C2 = Color.FromArgb(26,  54, 110);   // nền card
        private static readonly Color CA = Color.FromArgb(56, 139, 253);   // accent xanh
        private static readonly Color CT = Color.White;
        private static readonly Color CE = Color.FromArgb(252, 129, 129);  // lỗi

        public FormLogin()
        {
            BuildUI();
        }

        // ════════════════════════════════════════════════════════
        private void BuildUI()
        {
            this.Text            = "Đăng nhập - Hệ thống Quản lý Văn bản";
            this.Size            = new Size(420, 560);
            this.MinimumSize     = new Size(420, 560);
            this.MaximumSize     = new Size(420, 560);
            this.StartPosition   = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor       = C1;
            this.Region          = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 20, 20));

            // ── Gradient background ─────────────────────────────
            this.Paint += (s, e) =>
            {
                using var brush = new LinearGradientBrush(
                    this.ClientRectangle,
                    Color.FromArgb(15, 32, 68),
                    Color.FromArgb(22, 48, 95),
                    LinearGradientMode.ForwardDiagonal);
                e.Graphics.FillRectangle(brush, this.ClientRectangle);
            };

            // ── Drag to move ────────────────────────────────────
            bool dragging = false; Point dragStart = Point.Empty;
            this.MouseDown += (s, e) => { dragging = true; dragStart = e.Location; };
            this.MouseMove += (s, e) => { if (dragging) { var p = PointToScreen(e.Location); Location = new Point(p.X - dragStart.X, p.Y - dragStart.Y); }};
            this.MouseUp   += (s, e) => dragging = false;

            // ── ✕ Close button (góc phải trên) ──────────────────
            var btnClose = new Label
            {
                Text      = "✕",
                Size      = new Size(36, 36),
                Location  = new Point(Width - 44, 8),
                Font      = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = Color.FromArgb(150, 180, 220),
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter,
                Cursor    = Cursors.Hand
            };
            btnClose.Click    += (s, e) => Application.Exit();
            btnClose.MouseEnter += (s, e) => btnClose.ForeColor = CE;
            btnClose.MouseLeave += (s, e) => btnClose.ForeColor = Color.FromArgb(150, 180, 220);

            // ── Logo / Icon ──────────────────────────────────────
            var lblIcon = new Label
            {
                Text      = "📋",
                Size      = new Size(72, 72),
                Location  = new Point((Width - 72) / 2, 55),
                Font      = new Font("Segoe UI Emoji", 34f),
                ForeColor = CT,
                BackColor = Color.FromArgb(40, CA),
                TextAlign = ContentAlignment.MiddleCenter
            };
            lblIcon.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, 72, 72, 36, 36));

            // ── Tiêu đề ──────────────────────────────────────────
            var lblTitle = new Label
            {
                Text      = "XIN CHÀO!",
                Size      = new Size(Width - 60, 44),
                Location  = new Point(30, 148),
                Font      = new Font("Segoe UI", 22f, FontStyle.Bold),
                ForeColor = CT,
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter
            };

            var lblSub = new Label
            {
                Text      = "Vui lòng đăng nhập để tiếp tục",
                Size      = new Size(Width - 60, 26),
                Location  = new Point(30, 192),
                Font      = new Font("Segoe UI", 10f),
                ForeColor = Color.FromArgb(140, 170, 215),
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter
            };

            // ── Card panel ───────────────────────────────────────
            var card = new Panel
            {
                Size      = new Size(360, 240),
                Location  = new Point(30, 232),
                BackColor = C2
            };
            card.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, 360, 240, 14, 14));

            // ── Username field ───────────────────────────────────
            var lblUName = new Label
            {
                Text      = "TÊN ĐĂNG NHẬP",
                Location  = new Point(20, 20),
                Size      = new Size(320, 18),
                Font      = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 150, 220),
                BackColor = Color.Transparent
            };

            var pnlUser = MakeInputPanel(20, 42, 320, out txtUsername, false);

            // ── Password field ───────────────────────────────────
            var lblPwd = new Label
            {
                Text      = "MẬT KHẨU",
                Location  = new Point(20, 112),
                Size      = new Size(320, 18),
                Font      = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 150, 220),
                BackColor = Color.Transparent
            };

            var pnlPwd = MakeInputPanel(20, 134, 320, out txtPassword, true);

            // ── Eye toggle ───────────────────────────────────────
            lblEye = new Label
            {
                Text      = "👁",
                Size      = new Size(30, 30),
                Location  = new Point(310, 140),   // sẽ tính lại dưới
                Font      = new Font("Segoe UI Emoji", 14f),
                ForeColor = Color.FromArgb(100, 140, 200),
                BackColor = Color.Transparent,
                Cursor    = Cursors.Hand,
                TextAlign = ContentAlignment.MiddleCenter
            };
            lblEye.Location = new Point(
                pnlPwd.Left + pnlPwd.Width - 34,
                pnlPwd.Top + (pnlPwd.Height - 30) / 2);
            lblEye.Click += TogglePassword;
            lblEye.MouseEnter += (s, e) => lblEye.ForeColor = CT;
            lblEye.MouseLeave += (s, e) => lblEye.ForeColor = Color.FromArgb(100, 140, 200);

            card.Controls.AddRange(new Control[] { lblUName, pnlUser, lblPwd, pnlPwd, lblEye });

            // ── Thông báo lỗi inline ─────────────────────────────
            lblError = new Label
            {
                Text      = "",
                Size      = new Size(360, 26),
                Location  = new Point(30, 484),
                Font      = new Font("Segoe UI", 9f),
                ForeColor = CE,
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter
            };

            // ── Login button ─────────────────────────────────────
            btnLogin = new Button
            {
                Text      = "ĐĂNG NHẬP",
                Size      = new Size(360, 50),
                Location  = new Point(30, 492),
                BackColor = CA,
                ForeColor = CT,
                FlatStyle = FlatStyle.Flat,
                Font      = new Font("Segoe UI", 11f, FontStyle.Bold),
                Cursor    = Cursors.Hand
            };
            btnLogin.FlatAppearance.BorderSize = 0;
            btnLogin.Click      += BtnLogin_Click;
            btnLogin.MouseEnter += (s, e) => btnLogin.BackColor = Color.FromArgb(80, 160, 255);
            btnLogin.MouseLeave += (s, e) => btnLogin.BackColor = CA;
            // Bo góc nút
            btnLogin.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, 360, 50, 10, 10));

            // ── Enter key support ────────────────────────────────
            txtUsername.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; txtPassword.Focus(); }};
            txtPassword.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; BtnLogin_Click(s, e); }};

            // ── Footer ───────────────────────────────────────────
            var lblFooter = new Label
            {
                Text      = "© 2026 Hệ thống Quản lý Văn bản Hành chính",
                Size      = new Size(Width, 22),
                Location  = new Point(0, 530),
                Font      = new Font("Segoe UI", 7.5f),
                ForeColor = Color.FromArgb(70, 100, 140),
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            {
                btnClose, lblIcon, lblTitle, lblSub, card,
                lblError, btnLogin, lblFooter
            });
        }

        // ════════════════════════════════════════════════════════
        // Input Panel Factory (box tối + viền accent khi focus)
        // ════════════════════════════════════════════════════════
        private Panel MakeInputPanel(int x, int y, int w, out TextBox txt, bool isPassword)
        {
            var pnl = new Panel
            {
                Location  = new Point(x, y),
                Size      = new Size(w, 46),
                BackColor = Color.FromArgb(12, 28, 62),
                Padding   = new Padding(12, 8, isPassword ? 38 : 12, 8)
            };
            pnl.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, w, 46, 9, 9));
            pnl.Paint += (s, e) =>
            {
                bool focused = pnl.ContainsFocus;
                using var pen = new Pen(focused ? CA : Color.FromArgb(45, 70, 110), focused ? 2 : 1);
                e.Graphics.DrawRectangle(pen, new Rectangle(0, 0, pnl.Width - 1, pnl.Height - 1));
            };

            txt = new TextBox
            {
                Dock        = DockStyle.Fill,
                BorderStyle = BorderStyle.None,
                BackColor   = Color.FromArgb(12, 28, 62),
                ForeColor   = CT,
                Font        = new Font("Segoe UI", 11f),
                PasswordChar = isPassword ? '●' : '\0'
            };
            txt.GotFocus  += (s, e) => pnl.Invalidate();
            txt.LostFocus += (s, e) => pnl.Invalidate();

            pnl.Controls.Add(txt);
            return pnl;
        }

        // ════════════════════════════════════════════════════════
        // Toggle hiện / ẩn mật khẩu
        // ════════════════════════════════════════════════════════
        private void TogglePassword(object? sender, EventArgs e)
        {
            _pwdVisible = !_pwdVisible;
            txtPassword.PasswordChar = _pwdVisible ? '\0' : '●';
            lblEye.Text = _pwdVisible ? "🙈" : "👁";
            txtPassword.Focus();
        }

        // ════════════════════════════════════════════════════════
        // Login Logic + Rate-Limit (chống brute-force)
        // ════════════════════════════════════════════════════════
        private void BtnLogin_Click(object? sender, EventArgs e)
        {
            // ── Kiểm tra khóa ─────────────────────────────────
            if (DateTime.Now < _lockUntil)
            {
                int secs = (int)(_lockUntil - DateTime.Now).TotalSeconds;
                ShowError($"⛔ Quá nhiều lần thử sai. Vui lòng chờ {secs}s.");
                return;
            }

            // ── Validate input ─────────────────────────────────
            string username = txtUsername.Text.Trim();
            string password = txtPassword.Text;   // Không Trim mật khẩu

            if (string.IsNullOrWhiteSpace(username))
            {
                ShowError("⚠ Vui lòng nhập tên đăng nhập."); txtUsername.Focus(); return;
            }
            if (string.IsNullOrWhiteSpace(password))
            {
                ShowError("⚠ Vui lòng nhập mật khẩu."); txtPassword.Focus(); return;
            }
            // Giới hạn độ dài tránh DoS
            if (username.Length > 50 || password.Length > 200)
            {
                ShowError("⚠ Thông tin đăng nhập không hợp lệ."); return;
            }

            // ── Gọi DB (đã dùng parameterized query) ──────────
            var user = DatabaseService.Login(username, password);

            if (user != null)
            {
                _failCount = 0;
                SessionService.CurrentUser = user;
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            else
            {
                _failCount++;
                if (_failCount >= 3)
                {
                    _lockUntil = DateTime.Now.AddSeconds(30);
                    _failCount = 0;
                    ShowError("⛔ Sai 3 lần liên tiếp. Hệ thống khóa 30 giây.");
                }
                else
                {
                    ShowError($"❌ Sai tài khoản hoặc mật khẩu! (Lần {_failCount}/3)");
                }
                txtPassword.Clear();
                txtPassword.Focus();
            }
        }

        // ════════════════════════════════════════════════════════
        private void ShowError(string msg)
        {
            lblError.Text = msg;
            // Hiệu ứng rung nhẹ
            var pos = btnLogin.Location;
            for (int i = 0; i < 3; i++)
            {
                btnLogin.Left = pos.X + 5; Application.DoEvents(); System.Threading.Thread.Sleep(30);
                btnLogin.Left = pos.X - 5; Application.DoEvents(); System.Threading.Thread.Sleep(30);
            }
            btnLogin.Left = pos.X;
        }

        // ════════════════════════════════════════════════════════
        [System.Runtime.InteropServices.DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);
    }
}
