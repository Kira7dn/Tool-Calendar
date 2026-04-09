using System;
using System.Drawing;
using System.Drawing.Drawing2Interop;
using System.Windows.Forms;
using ToolCalender.Data;
using ToolCalender.Services;

namespace ToolCalender.Forms
{
    public class FormLogin : Form
    {
        private TextBox txtUsername;
        private TextBox txtPassword;
        private Button btnLogin;
        private Label lblRegister;
        private Panel mainPanel;

        public FormLogin()
        {
            SetupUI();
        }

        private void SetupUI()
        {
            this.Text = "Đăng nhập hệ thống - Tool Calendar";
            this.Size = new Size(400, 500);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.FromArgb(245, 247, 251);

            // Bo góc Form
            this.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 25, 25));

            mainPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(30) };
            
            var lblTitle = new Label {
                Text = "XIN CHÀO!",
                Font = new Font("Segoe UI", 24, FontStyle.Bold),
                ForeColor = Color.FromArgb(41, 128, 185),
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Top,
                Height = 80
            };

            var lblSub = new Label {
                Text = "Vui lòng đăng nhập để tiếp tục",
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.Gray,
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Top,
                Height = 30
            };

            var pnlContainer = new Panel { Dock = DockStyle.Top, Height = 250, Padding = new Padding(0, 20, 0, 0) };

            txtUsername = CreateStyledTextBox("Tên đăng nhập", 30);
            txtPassword = CreateStyledTextBox("Mật khẩu", 100, true);

            btnLogin = new Button {
                Text = "ĐĂNG NHẬP",
                Dock = DockStyle.Bottom,
                Height = 50,
                BackColor = Color.FromArgb(41, 128, 185),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnLogin.FlatAppearance.BorderSize = 0;
            btnLogin.Click += BtnLogin_Click;

            lblRegister = new Label {
                Text = "Chưa có tài khoản? Đăng ký ngay",
                Font = new Font("Segoe UI", 9, FontStyle.Underline),
                ForeColor = Color.FromArgb(41, 128, 185),
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Bottom,
                Height = 40,
                Cursor = Cursors.Hand
            };
            lblRegister.Click += (s, e) => {
                var frm = new FormRegister();
                frm.ShowDialog();
            };

            var btnClose = new Label {
                Text = "✕",
                Font = new Font("Arial", 14, FontStyle.Bold),
                ForeColor = Color.Gray,
                Location = new Point(370, 10),
                Size = new Size(20, 20),
                Cursor = Cursors.Hand
            };
            btnClose.Click += (s, e) => Application.Exit();

            pnlContainer.Controls.Add(txtPassword);
            pnlContainer.Controls.Add(txtUsername);

            mainPanel.Controls.Add(pnlContainer);
            mainPanel.Controls.Add(btnLogin);
            mainPanel.Controls.Add(lblRegister);
            mainPanel.Controls.Add(lblSub);
            mainPanel.Controls.Add(lblTitle);
            mainPanel.Controls.Add(btnClose);

            this.Controls.Add(mainPanel);
        }

        private TextBox CreateStyledTextBox(string placeholder, int y, bool isPassword = false)
        {
            var txt = new TextBox {
                Location = new Point(0, y),
                Width = 340,
                Font = new Font("Segoe UI", 12),
                BorderStyle = BorderStyle.None,
                ForeColor = Color.Gray,
                Text = placeholder
            };

            if (isPassword) txt.PasswordChar = '\0';

            txt.Enter += (s, e) => {
                if (txt.Text == placeholder) {
                    txt.Text = "";
                    txt.ForeColor = Color.Black;
                    if (isPassword) txt.PasswordChar = '●';
                }
            };

            txt.Leave += (s, e) => {
                if (string.IsNullOrWhiteSpace(txt.Text)) {
                    txt.Text = placeholder;
                    txt.ForeColor = Color.Gray;
                    if (isPassword) txt.PasswordChar = '\0';
                }
            };

            // Vẽ gạch ngang phía dưới
            var line = new Panel {
                Location = new Point(0, y + 30),
                Width = 340,
                Height = 2,
                BackColor = Color.FromArgb(41, 128, 185)
            };
            txt.ParentChanged += (s,e) => { if(txt.Parent != null) txt.Parent.Controls.Add(line); };

            return txt;
        }

        private void BtnLogin_Click(object? sender, EventArgs e)
        {
            var user = DatabaseService.Login(txtUsername.Text, txtPassword.Text);
            if (user != null)
            {
                SessionService.CurrentUser = user;
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            else
            {
                MessageBox.Show("Sai tài khoản hoặc mật khẩu!", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        [System.Runtime.InteropServices.DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);
    }

    public class FormRegister : Form
    {
        private TextBox txtUser, txtPass, txtConfirm;
        private ComboBox cbRole;
        private Button btnReg;

        public FormRegister()
        {
            this.Text = "Đăng ký tài khoản";
            this.Size = new Size(350, 450);
            this.StartPosition = FormStartPosition.CenterParent;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            var lbl = new Label { Text = "ĐĂNG KÝ MỚI", Font = new Font("Segoe UI", 16, FontStyle.Bold), Dock = DockStyle.Top, Height = 60, TextAlign = ContentAlignment.MiddleCenter };
            
            txtUser = new TextBox { PlaceholderText = "Tên đăng nhập", Width = 280, Location = new Point(35, 80), Font = new Font("Segoe UI", 11) };
            txtPass = new TextBox { PlaceholderText = "Mật khẩu", PasswordChar = '●', Width = 280, Location = new Point(35, 130), Font = new Font("Segoe UI", 11) };
            txtConfirm = new TextBox { PlaceholderText = "Xác nhận mật khẩu", PasswordChar = '●', Width = 280, Location = new Point(35, 180), Font = new Font("Segoe UI", 11) };
            
            cbRole = new ComboBox { Width = 280, Location = new Point(35, 230), Font = new Font("Segoe UI", 11), DropDownStyle = ComboBoxStyle.DropDownList };
            cbRole.Items.AddRange(new string[] { "Guest", "Admin" });
            cbRole.SelectedIndex = 0;

            btnReg = new Button { Text = "HOÀN TẤT ĐĂNG KÝ", Width = 280, Height = 45, Location = new Point(35, 300), BackColor = Color.FromArgb(41, 128, 185), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 10, FontStyle.Bold) };
            btnReg.Click += BtnReg_Click;

            this.Controls.AddRange(new Control[] { lbl, txtUser, txtPass, txtConfirm, cbRole, btnReg });
        }

        private void BtnReg_Click(object? sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtUser.Text) || string.IsNullOrWhiteSpace(txtPass.Text)) {
                MessageBox.Show("Vui lòng nhập đầy đủ thông tin."); return;
            }
            if (txtPass.Text != txtConfirm.Text) {
                MessageBox.Show("Mật khẩu xác nhận không khớp."); return;
            }

            if (DatabaseService.Register(txtUser.Text, txtPass.Text, cbRole.SelectedItem?.ToString() ?? "Guest"))
            {
                MessageBox.Show("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
                this.Close();
            }
            else
            {
                MessageBox.Show("Tên đăng nhập đã tồn tại.");
            }
        }
    }
}
